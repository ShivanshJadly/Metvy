// app/admin/conversations/page.tsx
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { db } from "@/lib/db";
import { chat, message, user } from "@/lib/db/schema";
import { ConversationsTable } from "./conversations-table";
// import { ExportButton } from "./export-button";

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{ userId?: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/");
  }

  const params = await searchParams;
  const userId = params?.userId;

  // Build query based on userId filter
  const query = userId
    ? db
        .select({
          id: chat.id,
          title: chat.title,
          createdAt: chat.createdAt,
          userId: chat.userId,
        })
        .from(chat)
        .where(eq(chat.userId, userId))
    : db
        .select({
          id: chat.id,
          title: chat.title,
          createdAt: chat.createdAt,
          userId: chat.userId,
        })
        .from(chat);

  const conversations = await query;

  // Get user info and message counts
  const conversationsWithDetails = await Promise.all(
    conversations.map(async (conv) => {
      const [userData] = await db
        .select()
        .from(user)
        .where(eq(user.id, conv.userId))
        .limit(1);

      const chatMessages = await db
        .select()
        .from(message)
        .where(eq(message.chatId, conv.id));

      const hasResumes = chatMessages.some(
        (msg) => msg.resumeIds && msg.resumeIds.length > 0
      );

      return {
        id: conv.id,
        title: conv.title || "Untitled Conversation",
        createdAt: conv.createdAt,
        userName: userData?.name || "Unknown",
        userEmail: userData?.email || "",
        userId: conv.userId,
        userPhone: userData?.phoneNumber || null,
        messageCount: chatMessages.length,
        hasResumes,
      };
    })
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl">
            {userId ? "User Conversations" : "All Conversations"}
          </h1>
          {userId && (
            <p className="mt-1 text-muted-foreground">
              Showing conversations for selected user
            </p>
          )}
        </div>
        {/*<ExportButton data={conversationsWithDetails} />*/}
      </div>

      <ConversationsTable data={conversationsWithDetails} />
    </div>
  );
}
