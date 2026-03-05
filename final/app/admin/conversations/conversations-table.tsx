// app/admin/conversations/conversations-table.tsx
"use client";

import { DataTable } from "@/app/admin/conversations/convo-data-table";
import { type Conversation, columns } from "./columns";

type ConversationsTableProps = {
  data: Conversation[];
};

export function ConversationsTable({ data }: ConversationsTableProps) {
  return <DataTable columns={columns} data={data} />;
}
