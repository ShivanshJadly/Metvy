import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  gt,
  gte,
  inArray,
  lt,
  type SQL,
} from "drizzle-orm";
import { db } from "@/lib/db";
import { generateUUID } from "@/lib/utils";
import { ChatSDKError } from "../errors";
import type { AppUsage } from "../usage";
import {
  type Chat,
  candidates,
  chat,
  message,
  type NewDBMessage,
  // type ResumeRequest,
  resumeRequests,
  // resume,
  resumes,
  type User,
  user,
} from "./schema";
import { generateHashedPassword } from "./utils";

export async function getUser(email: string): Promise<User[]> {
  try {
    return await db.select().from(user).where(eq(user.email, email));
  } catch (error) {
    console.error(error);
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get user by email"
    );
  }
}

export async function createUser(
  email: string,
  password: string,
  name: string
) {
  const hashedPassword = generateHashedPassword(password);

  try {
    return await db
      .insert(user)
      .values({ email, password: hashedPassword, name });
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to create user");
  }
}

export async function saveChat({
  id,
  userId,
  title,
}: {
  id?: string;
  userId: string;
  title: string;
}) {
  try {
    // First validate that the user exists
    const users = await db.select().from(user).where(eq(user.id, userId));

    if (users.length === 0) {
      throw new ChatSDKError("not_found:user", "User not found");
    }

    const chatId = id || generateUUID();

    const [newChat] = await db
      .insert(chat)
      .values({
        id: chatId,
        createdAt: new Date(),
        userId,
        title,
      })
      .returning();
    return newChat;
  } catch (error) {
    console.error(error);
    if (error instanceof ChatSDKError) {
      throw error;
    }
    throw new ChatSDKError("bad_request:database", "Failed to save chat");
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    await db.delete(message).where(eq(message.chatId, id));

    const [chatsDeleted] = await db
      .delete(chat)
      .where(eq(chat.id, id))
      .returning();
    return chatsDeleted;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete chat by id"
    );
  }
}

export async function getChatsByUserId({
  userId,
  limit,
  startingAfter,
  endingBefore,
}: {
  userId: string;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
}) {
  try {
    const extendedLimit = limit + 1;

    const query = (whereCondition?: SQL<any>) =>
      db
        .select()
        .from(chat)
        .where(
          whereCondition
            ? and(whereCondition, eq(chat.userId, userId))
            : eq(chat.userId, userId)
        )
        .orderBy(desc(chat.createdAt))
        .limit(extendedLimit);

    let filteredChats: Chat[] = [];

    if (startingAfter) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, startingAfter))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          "not_found:database",
          `Chat with id ${startingAfter} not found`
        );
      }

      filteredChats = await query(gt(chat.createdAt, selectedChat.createdAt));
    } else if (endingBefore) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, endingBefore))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          "not_found:database",
          `Chat with id ${endingBefore} not found`
        );
      }

      filteredChats = await query(lt(chat.createdAt, selectedChat.createdAt));
    } else {
      filteredChats = await query();
    }

    const hasMore = filteredChats.length > limit;

    return {
      chats: hasMore ? filteredChats.slice(0, limit) : filteredChats,
      hasMore,
    };
  } catch (_error) {
    console.log("===");
    console.log(_error);
    console.log("====");
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get chats by user id"
    );
  }
}

export async function getChatById({ id }: { id: string }) {
  try {
    const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));
    if (!selectedChat) {
      return null;
    }

    return selectedChat;
  } catch (_error) {
    console.log("====");
    console.log(_error);
    console.log("====");
    throw new ChatSDKError("bad_request:database", "Failed to get chat by id");
  }
}

export async function saveMessages({ messages }: { messages: NewDBMessage[] }) {
  try {
    return await db
      .insert(message)
      .values(messages as (typeof message.$inferInsert)[]);
  } catch (error) {
    console.error("ERROR ::", error);
    throw new ChatSDKError("bad_request:database", "Failed to save messages");
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  try {
    return await db
      .select()
      .from(message)
      .where(eq(message.chatId, id))
      .orderBy(asc(message.createdAt));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get messages by chat id"
    );
  }
}

export async function getMessageById({ id }: { id: string }) {
  try {
    return await db.select().from(message).where(eq(message.id, id));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get message by id"
    );
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  try {
    const messagesToDelete = await db
      .select({ id: message.id })
      .from(message)
      .where(
        and(eq(message.chatId, chatId), gte(message.createdAt, timestamp))
      );

    const messageIds = messagesToDelete.map(
      (currentMessage) => currentMessage.id
    );

    if (messageIds.length > 0) {
      return await db
        .delete(message)
        .where(
          and(eq(message.chatId, chatId), inArray(message.id, messageIds))
        );
    }
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete messages by chat id after timestamp"
    );
  }
}

export async function updateChatLastContextById({
  chatId,
  context,
}: {
  chatId: string;
  // Store merged server-enriched usage object
  context: AppUsage;
}) {
  try {
    return await db
      .update(chat)
      .set({ lastContext: context })
      .where(eq(chat.id, chatId));
  } catch (error) {
    console.warn("Failed to update lastContext for chat", chatId, error);
    return;
  }
}

export async function getMessageCountByUserId({
  id,
  differenceInHours,
}: {
  id: string;
  differenceInHours: number;
}) {
  try {
    const twentyFourHoursAgo = new Date(
      Date.now() - differenceInHours * 60 * 60 * 1000
    );

    const [stats] = await db
      .select({ count: count(message.id) })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(
        and(
          eq(chat.userId, id),
          gte(message.createdAt, twentyFourHoursAgo),
          eq(message.role, "user")
        )
      )
      .execute();

    return stats?.count ?? 0;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get message count by user id"
    );
  }
}

export async function createResumeRequest({
  userId,
  resumeIds,
  chatId,
  candidateIds,
  requestMessage,
}: {
  userId: string;
  chatId: string;
  resumeIds: string[];
  candidateIds: string[];
  requestMessage?: string;
}) {
  try {
    const [newRequest] = await db
      .insert(resumeRequests)
      .values({
        userId,
        chatId,
        resumeIds,
        candidateIds,
        requestMessage,
        status: "pending",
      })
      .returning();

    return newRequest;
  } catch (error) {
    console.error(error);
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to create resume request"
    );
  }
}

export async function getResumeRequestsByUserId(userId: string) {
  try {
    return await db
      .select({
        ...getTableColumns(resumeRequests),
        chatTitle: chat.title,
      })
      .from(resumeRequests)
      .leftJoin(chat, eq(resumeRequests.chatId, chat.id))
      .where(eq(resumeRequests.userId, userId))
      .orderBy(desc(resumeRequests.createdAt));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get resume requests"
    );
  }
}

// Add pagination support
export async function getAllResumeRequests({
  limit = 50,
  offset = 0,
}: {
  limit?: number;
  offset?: number;
} = {}) {
  try {
    return await db
      .select({
        ...getTableColumns(resumeRequests),
        chatTitle: chat.title,
        userName: user.name,
        userEmail: user.email,
        userPhoneNumber: user.phoneNumber,
      })
      .from(resumeRequests)
      .leftJoin(user, eq(resumeRequests.userId, user.id))
      .leftJoin(chat, eq(resumeRequests.chatId, chat.id))
      .orderBy(desc(resumeRequests.createdAt))
      .limit(limit)
      .offset(offset);
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get all resume requests"
    );
  }
}

// Get total count for pagination
export async function getResumeRequestsCount() {
  try {
    const [result] = await db
      .select({ count: count(resumeRequests.id) })
      .from(resumeRequests);
    return result?.count ?? 0;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get resume requests count"
    );
  }
}

export async function updateResumeRequestStatus({
  id,
  status,
  notes,
}: {
  id: string;
  status: "pending" | "approved" | "rejected";
  notes?: string;
}) {
  try {
    return await db
      .update(resumeRequests)
      .set({ status, notes, updatedAt: new Date() })
      .where(eq(resumeRequests.id, id))
      .returning();
  } catch (error) {
    console.error(error);
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update resume request"
    );
  }
}

export async function getCandidatesByIds(candidateIds: string[]) {
  try {
    return await db
      .select()
      .from(candidates)
      .where(inArray(candidates.candidateId, candidateIds));
  } catch (error) {
    console.error(error);
    throw new ChatSDKError("bad_request:database", "Failed to get candidates");
  }
}

export async function getResumesByIds(resumeIds: string[]) {
  try {
    return await db
      .select()
      .from(resumes)
      .where(inArray(resumes.resumeId, resumeIds));
  } catch (error) {
    console.error(error);
    throw new ChatSDKError("bad_request:database", "Failed to get resumes");
  }
}
