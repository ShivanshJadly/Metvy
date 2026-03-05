// app/admin/conversations/actions.ts
"use server";

import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { candidates, chat, message, resumes, user } from "@/lib/db/schema";

// Type for resume details
export type ResumeDetail = {
  resumeId: string;
  candidateId: string | null;
  firstName: string;
  lastName: string;
  email: string;
  skills: string[] | null;
  totalYearsExperience: number | null;
  keyDomains: string[] | null;
};

// Type for messages with resume data
export type MessageWithResumes = {
  id: string;
  role: string;
  content: string;
  parentMessageId: string | null;
  resumeIds: string[];
  candidateIds: string[];
  similarityScores: Array<{ resumeId: string; score: number }> | null;
  createdAt: Date;
  parentQuestion?: string;
  resumes?: ResumeDetail[]; // Only present in detail view
};

// Type for basic message in list view
export type BasicMessage = Omit<MessageWithResumes, "resumes">;

// Type for conversation list
export type ConversationWithDetails = {
  id: string;
  title: string;
  createdAt: Date;
  userName: string;
  userEmail: string;
  userId: string;
  userPhone: string | null;
  messages: BasicMessage[];
};

// Type for detailed conversation view
export type ConversationDetailWithResumes = {
  chatId: string;
  chatTitle: string;
  chatCreatedAt: Date;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string | null;
  messages: MessageWithResumes[];
};

export async function getConversations() {
  const chats = await db
    .select({
      chatId: chat.id,
      chatTitle: chat.title,
      chatCreatedAt: chat.createdAt,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userPhone: user.phoneNumber,
    })
    .from(chat)
    .innerJoin(user, eq(chat.userId, user.id))
    .orderBy(desc(chat.createdAt));

  const conversations: ConversationWithDetails[] = await Promise.all(
    chats.map(async (chatData) => {
      const messages = await db
        .select({
          id: message.id,
          role: message.role,
          parts: message.parts,
          parentMessageId: message.parentMessageId,
          resumeIds: message.resumeIds,
          candidateIds: message.candidateIds,
          similarityScores: message.similarityScores,
          createdAt: message.createdAt,
        })
        .from(message)
        .where(eq(message.chatId, chatData.chatId))
        .orderBy(message.createdAt);

      // Create a map of message IDs to their content for parent lookup
      const messageMap = new Map(
        messages.map((msg) => [msg.id, extractTextFromParts(msg.parts)])
      );

      return {
        id: chatData.chatId,
        title: chatData.chatTitle,
        createdAt: chatData.chatCreatedAt,
        userName: chatData.userName,
        userEmail: chatData.userEmail,
        userId: chatData.userId,
        userPhone: chatData.userPhone,
        messages: messages.map((msg) => ({
          id: msg.id,
          role: msg.role,
          content: extractTextFromParts(msg.parts),
          parentMessageId: msg.parentMessageId,
          resumeIds: msg.resumeIds || [],
          candidateIds: msg.candidateIds || [],
          similarityScores: msg.similarityScores,
          createdAt: msg.createdAt,
          parentQuestion: msg.parentMessageId
            ? messageMap.get(msg.parentMessageId)
            : undefined,
        })),
      };
    })
  );

  return conversations;
}

export async function getConversationDetails(
  conversationId: string
): Promise<ConversationDetailWithResumes> {
  const [chatData] = await db
    .select({
      chatId: chat.id,
      chatTitle: chat.title,
      chatCreatedAt: chat.createdAt,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userPhone: user.phoneNumber,
    })
    .from(chat)
    .innerJoin(user, eq(chat.userId, user.id))
    .where(eq(chat.id, conversationId));

  if (!chatData) {
    throw new Error("Conversation not found");
  }

  const messages = await db
    .select({
      id: message.id,
      role: message.role,
      parts: message.parts,
      parentMessageId: message.parentMessageId,
      resumeIds: message.resumeIds,
      candidateIds: message.candidateIds,
      similarityScores: message.similarityScores,
      createdAt: message.createdAt,
    })
    .from(message)
    .where(eq(message.chatId, conversationId))
    .orderBy(message.createdAt);

  // Get all unique resume IDs from all messages
  const allResumeIds = messages.flatMap((msg) => msg.resumeIds || []);
  const uniqueResumeIds = [...new Set(allResumeIds)];

  // Fetch all resume details in one query if there are any
  let resumeDetails: ResumeDetail[] = [];
  if (uniqueResumeIds.length > 0) {
    resumeDetails = (await db
      .select({
        resumeId: resumes.resumeId,
        candidateId: candidates.candidateId,
        firstName: candidates.firstName,
        lastName: candidates.lastName,
        email: candidates.email,
        skills: candidates.skills,
        totalYearsExperience: candidates.totalYearsExperience,
        keyDomains: candidates.keyDomains,
      })
      .from(resumes)
      .leftJoin(candidates, eq(resumes.candidateId, candidates.candidateId))
      .where(
        and(
          inArray(resumes.resumeId, uniqueResumeIds),
          isNotNull(resumes.candidateId)
        )
      )) as ResumeDetail[];
  }

  // Create message map for parent lookup
  const messageMap = new Map(
    messages.map((msg) => [msg.id, extractTextFromParts(msg.parts)])
  );

  return {
    ...chatData,
    messages: messages.map((msg) => ({
      id: msg.id,
      role: msg.role,
      content: extractTextFromParts(msg.parts),
      parentMessageId: msg.parentMessageId,
      resumeIds: msg.resumeIds || [],
      candidateIds: msg.candidateIds || [],
      similarityScores: msg.similarityScores,
      createdAt: msg.createdAt,
      parentQuestion: msg.parentMessageId
        ? messageMap.get(msg.parentMessageId)
        : undefined,
      resumes: resumeDetails.filter((r) =>
        (msg.resumeIds || []).includes(r.resumeId)
      ),
    })),
  };
}

function extractTextFromParts(parts: any): string {
  if (typeof parts === "string") {
    return parts;
  }
  if (Array.isArray(parts)) {
    return parts
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        if (part.text) {
          return part.text;
        }
        return "";
      })
      .join(" ");
  }
  if (parts && typeof parts === "object" && parts.text) {
    return parts.text;
  }
  return JSON.stringify(parts);
}
