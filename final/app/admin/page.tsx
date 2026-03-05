import { count, eq } from "drizzle-orm";
import { getUsers } from "@/app/admin/actions";
import { UsersTable } from "@/app/admin/users-table";
import { DataStreamHandler } from "@/components/data-stream-handler";
import { Card } from "@/components/ui/card";
import { db } from "@/lib/db";
import { chat, user } from "@/lib/db/schema";
import { AddUserDialog } from "./add-user-dialog";

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ userId?: string }>;
}) {
  const { userId } = await searchParams;

  // Get total users count
  const [userStats] = await db.select({ count: count() }).from(user).execute();

  // Get total chats count (filtered by userId if provided)
  const [chatStats] = userId
    ? await db
        .select({ count: count() })
        .from(chat)
        .where(eq(chat.userId, userId))
        .execute()
    : await db.select({ count: count() }).from(chat).execute();

  const users = await getUsers();

  // Highlight the selected user if userId is provided
  const highlightedUsers = userId
    ? users.map((u) => ({
        ...u,
        highlighted: u.id === userId,
      }))
    : users;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="font-bold text-3xl">Admin Dashboard</h1>
        <AddUserDialog />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-6">
          <h3 className="font-medium text-muted-foreground text-sm">
            Total Users
          </h3>
          <p className="mt-2 font-bold text-3xl">{userStats?.count ?? 0}</p>
        </Card>

        <Card className="p-6">
          <h3 className="font-medium text-muted-foreground text-sm">
            {userId ? "User Conversations" : "Total Conversations"}
          </h3>
          <p className="mt-2 font-bold text-3xl">{chatStats?.count ?? 0}</p>
        </Card>

        <Card className="p-6">
          <h3 className="font-medium text-muted-foreground text-sm">
            System Status
          </h3>
          <p className="mt-2 font-semibold text-green-600 text-lg">
            All Systems Nominal
          </p>
        </Card>
      </div>

      <Card className="p-6">
        <UsersTable data={highlightedUsers} />
      </Card>
      <DataStreamHandler />
    </div>
  );
}
