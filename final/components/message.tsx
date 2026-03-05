// components/message.tsx
"use client";
import type { UseChatHelpers } from "@ai-sdk/react";
import equal from "fast-deep-equal";
import { motion } from "framer-motion";
import { memo, useState } from "react";
import type { ChatMessage } from "@/lib/types";
import { cn, sanitizeText } from "@/lib/utils";
// import { GenericUuidRenderer } from "./clickable-uuid-text";
import { useDataStream } from "./data-stream-provider";
import { MessageContent } from "./elements/message";
import { SparklesIcon } from "./icons";
import { MessageActions } from "./message-actions";
import { MessageEditor } from "./message-editor";
import { MessageReasoning } from "./message-reasoning";
// import { Response } from "./elements/response";
import { ResponseWithUuids } from "./response-with-uuids";

const PurePreviewMessage = ({
  message,
  isLoading,
  setMessages,
  regenerate,
  requiresScrollPadding,
  onUuidSelect,
  selectedResumeUuids,
  resumeData,
}: {
  chatId: string;
  message: ChatMessage;
  isLoading: boolean;
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
  requiresScrollPadding: boolean;
  onUuidSelect: (uuid: string) => void;
  selectedResumeUuids: string[];
  resumeData: any[];
}) => {
  const [mode, setMode] = useState<"view" | "edit">("view");

  useDataStream();

  const resumeDataPart = message.parts?.find(
    (p) => p.type === "data-resume-ids"
  );

  // 2. Extract the UUIDs if the part exists
  const validUuids =
    resumeDataPart?.type === "data-resume-ids"
      ? resumeDataPart.data.resumeIds
      : null;

  // 3. Filter out ALL non-text parts from the main content
  const allContentParts =
    message.parts?.filter(
      (p) =>
        p.type === "text" || // Keep text parts
        p.type === "reasoning" // Keep reasoning parts
    ) || [];

  const reasoningParts =
    allContentParts.filter((p) => p.type === "reasoning") || [];
  const textParts = allContentParts.filter((p) => p.type === "text") || [];

  // console.log("Debug parts:", {
  //   messageId: message.id,
  //   allContentParts: allContentParts.map((p) => ({
  //     type: p.type,
  //     hasText: !!p.text,
  //   })),
  //   reasoningCount: reasoningParts.length,
  //   textCount: textParts.length,
  // });

  // if (message.role === "assistant") {
  //   console.log("FRONTEND: Assistant message in PreviewMessage:", message);
  // }

  // const streamdownComponents = {
  //   p: (props: any) => (
  //     <GenericUuidRenderer
  //       as="p"
  //       onUuidClick={onUuidSelect}
  //       selectedUuids={selectedResumeUuids}
  //       validUuids={validUuids}
  //       {...props}
  //     />
  //   ),

  //   td: (props: any) => (
  //     <GenericUuidRenderer
  //       as="td"
  //       className="px-4 py-2 text-sm"
  //       onUuidClick={onUuidSelect}
  //       selectedUuids={selectedResumeUuids}
  //       validUuids={validUuids}
  //       {...props}
  //     />
  //   ),

  //   li: (props: any) => (
  //     <GenericUuidRenderer
  //       as="li"
  //       onUuidClick={onUuidSelect}
  //       selectedUuids={selectedResumeUuids}
  //       validUuids={validUuids}
  //       {...props}
  //     />
  //   ),

  //   blockquote: (props: any) => (
  //     <GenericUuidRenderer
  //       as="blockquote"
  //       onUuidClick={onUuidSelect}
  //       selectedUuids={selectedResumeUuids}
  //       validUuids={validUuids}
  //       {...props}
  //     />
  //   ),
  // };

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="group/message w-full"
      data-role={message.role}
      data-testid={`message-${message.role}`}
      initial={{ opacity: 0 }}
    >
      {/* Render reasoning separately for assistant messages */}
      {message.role === "assistant" && reasoningParts.length > 0 && (
        <div className="my-2 flex w-full items-start gap-2 md:gap-3">
          <div className="-mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-background ring-1 ring-border">
            <SparklesIcon size={14} />
          </div>
          <div className="flex w-full flex-col gap-2">
            {reasoningParts.map((part, index) => (
              <MessageReasoning
                isLoading={isLoading}
                key={`reasoning-${message.id}-${index}`}
                reasoning={part.text || ""}
              />
            ))}
          </div>
        </div>
      )}

      {/* Render text content ONLY if textParts exist */}
      {textParts.length > 0 && (
        <div
          className={cn("flex w-full items-start gap-2 md:gap-3", {
            "justify-end": message.role === "user" && mode !== "edit",
            "justify-start": message.role === "assistant",
          })}
        >
          {message.role === "assistant" && (
            <div className="-mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-background ring-1 ring-border">
              <SparklesIcon size={14} />
            </div>
          )}

          <div
            className={cn("flex flex-col gap-2 md:gap-4", {
              "min-h-96": message.role === "assistant" && requiresScrollPadding,
              "w-full":
                (message.role === "assistant" &&
                  textParts.some((p) => p.text?.trim())) ||
                mode === "edit",
              "max-w-[calc(100%-2.5rem)] sm:max-w-[min(fit-content,80%)]":
                message.role === "user" && mode !== "edit",
            })}
          >
            {textParts.map((part, index) => {
              const key = `text-${message.id}-${index}`;

              if (mode === "view") {
                return (
                  <div key={key}>
                    <MessageContent
                      className={cn({
                        "wrap-break-words w-fit rounded-2xl px-3 py-2 text-right text-white":
                          message.role === "user",
                        "bg-transparent px-0 py-0 text-left":
                          message.role === "assistant",
                      })}
                      data-testid="message-content"
                      style={
                        message.role === "user"
                          ? { backgroundColor: "#006cff" }
                          : undefined
                      }
                    >
                      <ResponseWithUuids
                        onUuidClick={onUuidSelect}
                        resumeData={resumeData}
                        selectedUuids={selectedResumeUuids}
                        validUuids={validUuids}
                      >
                        {sanitizeText(part.text || "")}
                      </ResponseWithUuids>
                    </MessageContent>
                  </div>
                );
              }

              if (mode === "edit") {
                return (
                  <div
                    className="flex w-full flex-row items-start gap-3"
                    key={key}
                  >
                    <div className="size-8" />
                    <div className="min-w-0 flex-1">
                      <MessageEditor
                        key={message.id}
                        message={message}
                        regenerate={regenerate}
                        setMessages={setMessages}
                        setMode={setMode}
                      />
                    </div>
                  </div>
                );
              }

              return null;
            })}

            <MessageActions
              isLoading={isLoading}
              key={`action-${message.id}`}
              message={message}
              setMode={setMode}
            />
          </div>
        </div>
      )}
    </motion.div>
  );
};

export const PreviewMessage = memo(
  PurePreviewMessage,
  (prevProps, nextProps) => {
    if (prevProps.isLoading !== nextProps.isLoading) {
      return false;
    }
    if (prevProps.message.id !== nextProps.message.id) {
      return false;
    }
    if (prevProps.requiresScrollPadding !== nextProps.requiresScrollPadding) {
      return false;
    }
    if (!equal(prevProps.message.parts, nextProps.message.parts)) {
      return false;
    }
    if (!equal(prevProps.selectedResumeUuids, nextProps.selectedResumeUuids)) {
      return false;
    }

    return true;
  }
);

export const ThinkingMessage = () => {
  const role = "assistant";

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="group/message w-full"
      data-role={role}
      data-testid="message-assistant-loading"
      initial={{ opacity: 0 }}
    >
      <div className="flex items-start justify-start gap-3">
        <div className="-mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-background ring-1 ring-border">
          <SparklesIcon size={14} />
        </div>

        <div className="flex w-full flex-col gap-2 md:gap-4">
          <div className="p-0 text-muted-foreground text-sm">
            <LoadingText>Thinking...</LoadingText>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const LoadingText = ({ children }: { children: React.ReactNode }) => {
  return (
    <motion.div
      animate={{ backgroundPosition: ["100% 50%", "-100% 50%"] }}
      className="flex items-center text-transparent"
      style={{
        background:
          "linear-gradient(90deg, hsl(var(--muted-foreground)) 0%, hsl(var(--muted-foreground)) 35%, hsl(var(--foreground)) 50%, hsl(var(--muted-foreground)) 65%, hsl(var(--muted-foreground)) 100%)",
        backgroundSize: "200% 100%",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
      }}
      transition={{
        duration: 1.5,
        repeat: Number.POSITIVE_INFINITY,
        ease: "linear",
      }}
    >
      {children}
    </motion.div>
  );
};

// END components/message.tsx
