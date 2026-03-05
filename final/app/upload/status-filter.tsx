// app/upload/status-filter.tsx
"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function StatusFilter() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();

  const currentStatus = searchParams.get("status") || "all";

  const handleStatusChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value === "all") {
      params.delete("status");
    } else {
      params.set("status", value);
    }
    replace(`${pathname}?${params.toString()}`);
  };

  return (
    <Select onValueChange={handleStatusChange} value={currentStatus}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Filter by status" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Statuses</SelectItem>
        <SelectItem value="PENDING">Pending</SelectItem>
        <SelectItem value="PROCESSING">Processing</SelectItem>
        <SelectItem value="COMPLETED">Completed</SelectItem>
        <SelectItem value="FAILED">Failed</SelectItem>
        <SelectItem value="ARCHIVED">Archived</SelectItem>
      </SelectContent>
    </Select>
  );
}
