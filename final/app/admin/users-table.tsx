"use client";

import { DataTable } from "@/components/ui/data-table";
import { columns, type User } from "./columns";

type UsersTableProps = {
  data: User[];
};

export function UsersTable({ data }: UsersTableProps) {
  return <DataTable columns={columns} data={data} />;
}
