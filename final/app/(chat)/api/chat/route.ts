// chat/route.ts
import { google } from "@ai-sdk/google";
import {
  convertToModelMessages,
  createUIMessageStream,
  embed,
  generateObject,
  generateText,
  JsonToSseTransformStream,
  smoothStream,
  streamText,
} from "ai";
// import type { PgUUID } from "drizzle-orm/pg-core";
import { unstable_cache as cache } from "next/cache";
import type { ModelCatalog } from "tokenlens/core";
import { fetchModels } from "tokenlens/fetch";
import { getUsage } from "tokenlens/helpers";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { systemPrompt } from "@/lib/ai/prompts";
import { myProvider } from "@/lib/ai/providers";
import { isProductionEnvironment } from "@/lib/constants";
import {
  deleteChatById,
  getChatById,
  getMessagesByChatId,
  saveChat,
  saveMessages,
  updateChatLastContextById,
} from "@/lib/db/actions";
import { ChatSDKError } from "@/lib/errors";
import type { SearchResponse } from "@/lib/types";
import type { AppUsage } from "@/lib/usage";
import { convertToUIMessages, generateUUID } from "@/lib/utils";
import { searchResumes } from "@/lib/vs/search";
import { generateTitleFromUserMessage } from "../../actions";
import { type PostRequestBody, postRequestBodySchema } from "./schema";

export const maxDuration = 60;

// Initialize embedding model
const embeddingModel = google.textEmbedding("gemini-embedding-001");

// SCHEMA & TYPES

const retrievalDecisionSchema = z.object({
  needs_context: z
    .boolean()
    .describe(
      "Whether candidate context from database is needed to answer this query"
    ),
  reason: z
    .enum([
      "candidate_search",
      "skill_match",
      "requirement_match",
      "qualification_search",
      "general_conversation",
      "greeting",
      "clarification",
      "system_question",
    ])
    .describe("Why the decision was made"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Confidence score (0-1) in this decision"),
});

const getTokenlensCatalog = cache(
  async (): Promise<ModelCatalog | undefined> => {
    try {
      return await fetchModels();
    } catch (err) {
      console.warn(
        "TokenLens: catalog fetch failed, using default catalog",
        err
      );
      return;
    }
  },
  ["tokenlens-catalog"],
  { revalidate: 24 * 60 * 60 } // 24 hours
);

// retrieval decision

async function shouldRetrieveContextViaLLM(
  userMessage: string
): Promise<boolean> {
  const prompt = `You are a query classifier for a recruiting assistant system.

Your ONLY job is to determine if a user query needs access to candidate/resume data from the database.

CRITICAL RULES:
1. You MUST respond with valid JSON only - no markdown, no extra text
2. You MUST set needs_context to true OR false - never null or undefined
3. You MUST choose one reason from the provided enum
4. Confidence must be a number between 0 and 1
5. Do NOT explain or add any text outside the JSON

CONTEXT NEEDED (needs_context = true):
- Queries asking to find, search, or filter candidates
- Queries about specific skills, experience, or qualifications
- Queries asking "who", "which candidate", "find someone"
- Queries with specific job requirements to match
- Questions about candidate qualifications or backgrounds
- Queries asking for candidate recommendations or suggestions

CONTEXT NOT NEEDED (needs_context = false):
- Greetings ("hello", "hi", "hey")
- Asking what the assistant can do
- General questions not about candidates
- Clarification questions about how to use the system
- Questions about the recruiting process in general
- Thanking or saying goodbye

Examples:
- "Find candidates with 5 years Python experience" → true (candidate_search)
- "Hello, how are you?" → false (greeting)
- "Show me senior engineers in San Francisco" → true (candidate_search)
- "What can you help me with?" → false (system_question)
- "Find someone who knows Kubernetes" → true (skill_match)
- "Thanks, goodbye" → false (greeting)
- "Filter by salary range" → true (requirement_match)

Respond with ONLY valid JSON, nothing else.`;

  const userPrompt = `Query: "${userMessage}"

Classify this query. Respond ONLY with valid JSON object - no other text or markdown.`;

  try {
    const result = await generateObject({
      model: myProvider.languageModel("chat-model"),
      schema: retrievalDecisionSchema,
      system: prompt,
      prompt: userPrompt,
      temperature: 0.3,
      maxRetries: 2,
    });

    if (result.object.confidence < 0.6) {
      console.warn("Low confidence retrieval decision:", result.object);
    }

    console.log("Retrieval decision:", {
      message: userMessage.substring(0, 50),
      needs_context: result.object.needs_context,
      reason: result.object.reason,
      confidence: result.object.confidence,
    });

    return result.object.needs_context;
  } catch (error) {
    console.error("LLM retrieval decision failed, defaulting to true:", error);
    return true;
  }
}

async function searchForCandidates(
  query: string,
  k = 20
): Promise<SearchResponse["results"]> {
  // console.log("🔍 Generating embedding for query:", query.substring(0, 50));

  try {
    const { embedding } = await embed({
      model: embeddingModel,
      value: query,
      providerOptions: {
        google: {
          outputDimensionality: 1536,
          taskType: "RETRIEVAL_QUERY",
        },
      },
    });

    // console.log("📊 Searching database with embedding...");
    const searchResults: SearchResponse = await searchResumes(embedding, {
      k,
    });

    console.log("✅ Search complete:", {
      query: query.substring(0, 50),
      resultCount: searchResults.results.length,
    });

    return searchResults.results;
  } catch (error) {
    console.error("❌ Search failed:", error);
    throw error;
  }
}

/**
 * Format search results into context string for LLM
 */
function formatContextForLLM(results: any[]): string {
  if (results.length === 0) {
    return "No relevant candidates found in the database.";
  }

  return results
    .map((result) => {
      const meta = result.metadata;
      return `
## Candidate id: ${meta.resume_id}
- Candidate Location ${meta.location}
**Profile Summary**:
${result.text}
---`;
    })
    .join("\n\n");
}

async function generateOptimizedQuery(
  userMessage: string,
  uiMessages: any[]
): Promise<string> {
  const rewritePrompt = `You are a query optimizer for a recruiting database.

Rewrite the user's query into a positive search query optimized for vector similarity search.
Focus on WHAT TO INCLUDE, not what to exclude.

Examples:
- "Find candidates without engineering" → "Candidates with business, marketing, design, or liberal arts degrees"
- "Who has 5+ years experience?" → "Candidates with 5 or more years of experience"
- "Looking for python developers" → "Developers with Python experience"

CRITICAL:
- Respond with ONLY the optimized query string
- Do NOT add explanation or extra text
- Keep it concise (under 100 characters if possible)

User Query: "${userMessage}"

Optimized Search Query:`;

  const { text: rewrittenQuery } = await generateText({
    model: myProvider.languageModel("chat-model"),
    messages: [
      { role: "system", content: rewritePrompt },
      ...convertToModelMessages(uiMessages),
    ],
    temperature: 0.2,
    maxRetries: 2,
  });

  return rewrittenQuery.trim();
}

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    // console.log("📥 Received request body:", JSON.stringify(json, null, 2));
    requestBody = postRequestBodySchema.parse(json);
    // console.log("✅ Schema validation passed");
  } catch (err) {
    console.error(`Error parsing request body: ${err}`);
    return new ChatSDKError("bad_request:api").toResponse();
  }

  try {
    const { message, selectedChatModel } = requestBody;
    let { id } = requestBody;
    // console.log("🔍 Processing request:", {
    //   hasId: !!id,
    //   chatId: id,
    //   messageId: message.id,
    //   model: selectedChatModel,
    // });

    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    let chat: Awaited<ReturnType<typeof getChatById>>;

    if (id) {
      // console.log("Looking up existing chat:", id);
      chat = await getChatById({ id });

      if (chat) {
        // Chat exists - verify ownership
        // console.log("Chat found:", {
        //   chatId: chat.id,
        //   chatUserId: chat.userId,
        //   sessionUserId: session.user.id,
        // });

        if (chat.userId !== session.user.id) {
          console.error("User ID mismatch");
          return new ChatSDKError("forbidden:chat").toResponse();
        }
      } else {
        // Chat doesn't exist yet - create it with the provided ID
        // console.log("Creating new chat with provided ID:", id);
        const title = await generateTitleFromUserMessage({ message });

        chat = await saveChat({
          id, // Use the client-provided ID
          userId: session.user.id,
          title,
        });

        // console.log("New chat created:", id);
      }
    } else {
      // No ID provided - create new chat with generated ID
      // console.log("Creating new chat without ID");
      const title = await generateTitleFromUserMessage({ message });
      chat = await saveChat({
        userId: session.user.id,
        title,
      });
      id = chat.id;
      // console.log("New chat created:", id);
    }

    // Get existing messages and add new one
    const messagesFromDb = await getMessagesByChatId({ id });
    const uiMessages = [...convertToUIMessages(messagesFromDb), message];

    const messageText = message.parts?.[0]?.text || "";

    // Use LLM to decide retrieval
    let resumeIds: string[] = [];
    let candidateIds: string[] = [];
    let similarityScores: Array<{ resumeId: string; score: number }> = [];
    let context = "No candidate context needed for this query.";

    const needsRetrieval = await shouldRetrieveContextViaLLM(messageText);

    if (needsRetrieval) {
      console.debug(
        "LLM determined context is needed, generating search query..."
      );

      try {
        // Generate optimized search query
        const optimizedQuery = await generateOptimizedQuery(
          messageText,
          uiMessages
        );
        console.debug("Optimized query:", optimizedQuery);

        // Search vector database
        const results = await searchForCandidates(optimizedQuery, 20);

        context = formatContextForLLM(results);
        resumeIds = results.map(
          (result) => result.metadata.resume_id as string
        );
        candidateIds = results.map(
          (result) => result.metadata.candidate_id as string
        );
        similarityScores = results.map((result) => ({
          resumeId: result.metadata.resume_id as string,
          score: result.similarity,
        }));

        console.debug("Retrieved results:", {
          count: results.length,
          queryUsed: optimizedQuery.substring(0, 50),
        });
      } catch (error) {
        console.error("Retrieval failed:", error);
        context = "Unable to retrieve candidate data at this time.";
      }
    } else {
      console.log("⏭️  LLM determined context not needed");
    }

    // Save user message
    const userMessageId = message.id;
    await saveMessages({
      messages: [
        {
          chatId: id,
          id: userMessageId,
          role: "user",
          parts: message.parts,
          createdAt: new Date(),
          parentMessageId: null,
          resumeIds: null,
          candidateIds: null,
          similarityScores: null,
        },
      ],
    });

    let finalMergedUsage: AppUsage | undefined;

    // Create and handle stream
    const stream = createUIMessageStream({
      execute: ({ writer: dataStream }) => {
        console.log("BACKEND: Found resume IDs to send:", resumeIds);
        if (resumeIds && resumeIds.length > 0) {
          dataStream.write({
            type: "data-resume-ids",
            data: { resumeIds },
          });
        }
        const result = streamText({
          model: myProvider.languageModel(selectedChatModel),
          providerOptions: {
            google: {
              thinkingConfig: {
                includeThoughts: true,
              },
            },
          },
          system: systemPrompt({ context }),
          messages: convertToModelMessages(uiMessages),
          experimental_transform: smoothStream({ chunking: "word" }),
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: "stream-text",
          },
          onFinish: async ({ usage }) => {
            try {
              const providers = await getTokenlensCatalog();
              const modelId =
                myProvider.languageModel(selectedChatModel).modelId;

              if (!modelId || !providers) {
                finalMergedUsage = usage;
                dataStream.write({
                  type: "data-usage",
                  data: finalMergedUsage,
                });
                return;
              }

              const summary = getUsage({ modelId, usage, providers });
              finalMergedUsage = { ...usage, ...summary, modelId } as AppUsage;
              dataStream.write({ type: "data-usage", data: finalMergedUsage });
            } catch (err) {
              console.warn("TokenLens enrichment failed", err);
              finalMergedUsage = usage;
              dataStream.write({ type: "data-usage", data: finalMergedUsage });
            }
          },
        });

        result.consumeStream();
        dataStream.merge(
          result.toUIMessageStream({
            sendReasoning: true,
          })
        );
      },
      generateId: generateUUID,
      onFinish: async ({ messages }) => {
        await saveMessages({
          messages: messages.map((currentMessage) => ({
            id: currentMessage.id,
            role: currentMessage.role,
            parts: currentMessage.parts,
            createdAt: new Date(),
            chatId: id,
            parentMessageId:
              currentMessage.role === "assistant" ? userMessageId : null,
            // only to assistant messages
            resumeIds: currentMessage.role === "assistant" ? resumeIds : null,
            candidateIds:
              currentMessage.role === "assistant" ? candidateIds : null,
            similarityScores:
              currentMessage.role === "assistant" ? similarityScores : null,
          })),
        });

        if (finalMergedUsage) {
          try {
            await updateChatLastContextById({
              chatId: id,
              context: finalMergedUsage,
            });
          } catch (err) {
            console.warn("Unable to persist last usage for chat", id, err);
          }
        }
      },
      onError: () => "Oops, an error occurred!",
    });

    return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
  } catch (error) {
    const vercelId = request.headers.get("x-vercel-id");

    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    if (
      error instanceof Error &&
      error.message?.includes(
        "AI Gateway requires a valid credit card on file to service requests"
      )
    ) {
      return new ChatSDKError("bad_request:activate_gateway").toResponse();
    }

    console.error("Unhandled error in chat API:", error, { vercelId });
    return new ChatSDKError("offline:chat").toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const chat = await getChatById({ id });

  if (chat?.userId !== session.user.id) {
    return new ChatSDKError("forbidden:chat").toResponse();
  }

  const deletedChat = await deleteChatById({ id });
  return Response.json(deletedChat, { status: 200 });
}
