// app/admin/actions.ts
"use server";

import { hash } from "bcrypt";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";

export async function getUsers() {
  const session = await auth();

  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized");
  }

  const usersList = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phoneNumber,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
    })
    .from(user);

  return usersList;
}

export async function createUser(formData: FormData) {
  const session = await auth();

  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized");
  }

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const name = formData.get("name") as string;
  const phone = formData.get("phone") as string | null;
  const role = (formData.get("role") as "admin" | "user") || "user";

  if (!email || !password || !name) {
    throw new Error("Missing required fields");
  }

  const hashedPassword = await hash(password, 10);

  await db.insert(user).values({
    email,
    password: hashedPassword,
    name,
    phoneNumber: phone || null,
    role,
    status: "active",
  });
}

export async function updateUser(
  userId: string,
  data: {
    role?: "admin" | "user";
    status?: "active" | "suspended" | "deleted";
  }
) {
  const session = await auth();

  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized");
  }

  await db.update(user).set(data).where(eq(user.id, userId));

  redirect("/admin");
}

export async function deleteUser(userId: string) {
  const session = await auth();

  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized");
  }

  await db.update(user).set({ status: "deleted" }).where(eq(user.id, userId));

  redirect("/admin");
}
