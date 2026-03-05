// components/chat.tsx
"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useSearchParams } from "next/navigation";
import type { Session } from "next-auth";
import { useEffect, useRef, useState } from "react";
import { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
// import { useSession } from "next-auth/react";
// import { auth } from "@/app/(auth)/auth";
import { ChatHeader } from "@/components/chat-header";
// import {
//   AlertDialog,
//   AlertDialogAction,
//   AlertDialogCancel,
//   AlertDialogContent,
//   AlertDialogDescription,
//   AlertDialogFooter,
//   AlertDialogHeader,
//   AlertDialogTitle,
// } from "@/components/ui/alert-dialog";
import { useAutoResume } from "@/hooks/use-auto-resume";
import { createResumeRequest, getResumesByIds } from "@/lib/db/actions";
import { ChatSDKError } from "@/lib/errors";
import type { Attachment, ChatMessage } from "@/lib/types";
import type { AppUsage } from "@/lib/usage";
import { fetchWithErrorHandlers, generateUUID } from "@/lib/utils";
import { useDataStream } from "./data-stream-provider";
import { Messages } from "./messages";
import { MultimodalInput } from "./multimodal-input";
import { getChatHistoryPaginationKey } from "./sidebar-history";
import { toast } from "./toast";

export function Chat({
  id,
  initialMessages,
  initialChatModel,
  autoResume,
  initialLastContext,
  session,
}: {
  id: string;
  initialMessages: ChatMessage[];
  initialChatModel: string;
  autoResume: boolean;
  initialLastContext?: AppUsage;
  session: Session | null;
}) {
  const { mutate } = useSWRConfig();
  const { setDataStream } = useDataStream();

  // const session = auth();

  console.log(session);
  const [input, setInput] = useState<string>("");
  const [usage, setUsage] = useState<AppUsage | undefined>(initialLastContext);
  // const [showCreditCardAlert, setShowCreditCardAlert] = useState(false);
  const [currentModelId, setCurrentModelId] = useState(initialChatModel);
  const currentModelIdRef = useRef(currentModelId);

  const [resumeData, setResumeData] = useState<any[]>([]);

  const [selectedResumeUuids, setSelectedResumeUuids] = useState<string[]>([]);

  // 2. Define the handlers here
  const handleUuidSelect = (uuid: string) => {
    setSelectedResumeUuids(
      (prev) =>
        prev.includes(uuid)
          ? prev.filter((u) => u !== uuid) // De-select
          : [...prev, uuid] // Select
    );
  };

  const handleSubmitUuids = async () => {
    try {
      if (!session?.user?.id) {
        toast({
          type: "error",
          description: "You must be logged in to request resumes",
        });
        return;
      }

      await createResumeRequest({
        userId: session.user.id,
        chatId: id,
        resumeIds: selectedResumeUuids,
        candidateIds: selectedResumeUuids,
        requestMessage: `Requested ${selectedResumeUuids.length} resumes from AI search`,
      });

      toast({
        type: "success",
        description: `Resume request sent! (${selectedResumeUuids.length} candidates)`,
      });

      setSelectedResumeUuids([]);
    } catch (error) {
      console.error("Failed to create request:", error);
      toast({
        type: "error",
        description: "Failed to send resume request. Please try again.",
      });
    }
  };

  const handleClearUuids = () => {
    setSelectedResumeUuids([]);
  };

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    regenerate,
    resumeStream,
  } = useChat<ChatMessage>({
    id,
    messages: initialMessages,
    experimental_throttle: 100,
    generateId: generateUUID,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      fetch: fetchWithErrorHandlers,
      prepareSendMessagesRequest(request) {
        return {
          body: {
            id: request.id,
            message: request.messages.at(-1),
            selectedChatModel: currentModelIdRef.current,
            ...request.body,
          },
        };
      },
    }),
    onData: (dataPart) => {
      setDataStream((ds) => (ds ? [...ds, dataPart] : []));
      if (dataPart.type === "data-usage") {
        setUsage(dataPart.data);
      }
    },
    onFinish: () => {
      mutate(unstable_serialize(getChatHistoryPaginationKey));
    },
    onError: (error) => {
      if (error instanceof ChatSDKError) {
        // Check if it's a credit card error
        if (
          error.message?.includes("AI Gateway requires a valid credit card")
        ) {
          // setShowCreditCardAlert(true);
        } else {
          toast({
            type: "error",
            description: error.message,
          });
        }
      }
    },
  });

  useEffect(() => {
    const fetchResumeData = async () => {
      const allResumeIds = messages.flatMap(
        (message) =>
          message.parts
            ?.filter((p) => p.type === "data-resume-ids")
            .flatMap((p: any) => p.data.resumeIds) || []
      );

      if (allResumeIds.length > 0) {
        const uniqueResumeIds = [...new Set(allResumeIds)];
        const resumes = await getResumesByIds(uniqueResumeIds);
        setResumeData(resumes);
      }
    };

    fetchResumeData();
  }, [messages]);

  const searchParams = useSearchParams();
  const query = searchParams.get("query");

  const [hasAppendedQuery, setHasAppendedQuery] = useState(false);

  useEffect(() => {
    if (query && !hasAppendedQuery) {
      sendMessage({
        role: "user" as const,
        parts: [{ type: "text", text: query }],
      });

      setHasAppendedQuery(true);
      window.history.replaceState({}, "", `/chat/${id}`);
    }
  }, [query, sendMessage, hasAppendedQuery, id]);

  const [attachments, setAttachments] = useState<Attachment[]>([]);

  useAutoResume({
    autoResume,
    initialMessages,
    resumeStream,
    setMessages,
  });

  return (
    <div className="overscroll-behavior-contain flex h-dvh min-w-0 touch-pan-y flex-col bg-background">
      <ChatHeader chatId={id} />

      <Messages
        chatId={id}
        messages={messages}
        onClearUuids={handleClearUuids}
        onSubmitUuids={handleSubmitUuids}
        onUuidSelect={handleUuidSelect}
        regenerate={regenerate}
        resumeData={resumeData}
        selectedModelId={initialChatModel}
        selectedResumeUuids={selectedResumeUuids}
        setMessages={setMessages}
        status={status}
      />

      <div className="sticky bottom-0 z-1 mx-auto flex w-full max-w-7xl flex-col gap-2 border-t-0 bg-background px-2 pb-3 md:px-4 md:pb-4">
        <div className="-top-16 pointer-events-none absolute right-0 left-0 z-10 h-20 bg-linear-to-b from-transparent to-background" />

        {/* Input container */}
        <div className="relative z-20 mx-auto flex w-full max-w-7xl flex-col gap-2 bg-background px-2 py-4 md:px-4">
          <MultimodalInput
            attachments={attachments}
            chatId={id}
            input={input}
            messages={messages}
            onModelChange={setCurrentModelId}
            selectedModelId={currentModelId}
            sendMessage={sendMessage}
            setAttachments={setAttachments}
            setInput={setInput}
            setMessages={setMessages}
            status={status}
            stop={stop}
            usage={usage}
          />
        </div>
      </div>
    </div>
  );
}

// END components/chat.tsx
