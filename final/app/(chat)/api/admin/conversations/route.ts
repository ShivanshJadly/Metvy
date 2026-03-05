import { NextResponse } from "next/server";
import { getConversations } from "@/app/admin/conversations/actions";
import { requireAdmin } from "@/lib/admin/auth";

export async function GET() {
  await requireAdmin();
  const conversations = await getConversations();
  return NextResponse.json(conversations);
}
