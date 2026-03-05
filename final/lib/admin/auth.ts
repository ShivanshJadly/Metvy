// import { env } from "@/lib/env";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { getUser } from "../db/actions";

export async function requireAdmin() {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/login");
  }

  // Get user role and status from database
  const role = await getUserRole(session.user.email);
  const status = await getUserStatus(session.user.email);

  if (role !== "admin" || status !== "active") {
    redirect("/");
  }
}

export async function getUserRole(email: string): Promise<string> {
  // Get user ID first
  const [userData] = await getUser(email);

  if (!userData) {
    return "user";
  }

  return userData.role || "user";
}

export async function getUserStatus(email: string): Promise<string> {
  // Get user ID first
  const [userData] = await getUser(email);

  if (!userData) {
    return "active";
  }

  // Get status from UserStatus table
  const [statusData] = await db
    .select()
    .from(user)
    .where(eq(user.id, userData.id));

  return statusData?.status || "active";
}
