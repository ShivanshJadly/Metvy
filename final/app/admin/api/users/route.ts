import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";

const userUpdateSchema = z.object({
  email: z.string().email().optional(),
  role: z.enum(["user", "admin"]).optional(),
  status: z.enum(["active", "suspended", "deleted"]).optional(),
});

export async function GET() {
  // console.log("Hello");
  await requireAdmin();

  const users = await db
    .select({
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
    })
    .from(user);

  return NextResponse.json(users);
}

export async function POST(req: Request) {
  await requireAdmin();

  const body = await req.json();
  const { email, password, name, phone, role } = body;

  const newUser = await db.transaction(async (tx) => {
    const [u] = await tx
      .insert(user)
      .values({
        email,
        password,
        phoneNumber: phone,
        name,
        role,
        status: "active",
      })
      .returning();

    return u;
  });

  return NextResponse.json(newUser);
}

export async function PATCH(req: Request) {
  await requireAdmin();

  const body = await req.json();
  const { userId } = body;
  const data = userUpdateSchema.parse(body);

  await db.transaction(async (tx) => {
    if (data.email) {
      await tx
        .update(user)
        .set({ email: data.email })
        .where(eq(user.id, userId));
    }

    if (data.role) {
      await tx.update(user).set({ role: data.role }).where(eq(user.id, userId));
    }

    if (data.status) {
      await tx
        .update(user)
        .set({ status: data.status })
        .where(eq(user.id, userId));
    }
  });

  return NextResponse.json({ message: "User updated successfully" });
}

export async function DELETE(req: Request) {
  await requireAdmin();

  const { userId } = await req.json();

  await db.transaction(async (tx) => {
    await tx.update(user).set({ status: "deleted" }).where(eq(user.id, userId));
  });

  return NextResponse.json({ message: "User deleted successfully" });
}
