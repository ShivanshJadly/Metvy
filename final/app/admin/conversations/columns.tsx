// app/admin/conversations/columns.tsx
"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { parseDate } from "chrono-node";
import { format } from "date-fns";
import { ArrowUpDown, Filter, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type Conversation = {
  id: string;
  title: string;
  createdAt: Date;
  userName: string;
  userId: string;
  messageCount: number;
};

// Custom filter function for date filtering by day
const filterByDay = (row: any, columnId: string, filterValue: string) => {
  if (!filterValue) {
    return true;
  }

  const rowDate = new Date(row.getValue(columnId));
  const filterDate = new Date(filterValue);

  // Compare only the date part (ignore time)
  return (
    rowDate.getFullYear() === filterDate.getFullYear() &&
    rowDate.getMonth() === filterDate.getMonth() &&
    rowDate.getDate() === filterDate.getDate()
  );
};

function formatDate(date: Date | undefined) {
  if (!date) {
    return "";
  }

  return date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export const columns: ColumnDef<Conversation>[] = [
  {
    accessorKey: "title",
    header: "Conversation Title",
    cell: ({ row }) => {
      const title = row.getValue("title") as string;
      return <div className="font-medium">{title}</div>;
    },
  },
  {
    accessorKey: "userName",
    header: "User Name",
    cell: ({ row }) => {
      const userName = row.getValue("userName") as string;
      return <div>{userName}</div>;
    },
  },
  {
    accessorKey: "messageCount",
    header: "Messages",
    cell: ({ row }) => {
      const count = row.getValue("messageCount") as number;
      return (
        <Badge className="font-mono" variant="secondary">
          {count}
        </Badge>
      );
    },
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => {
      const filterValue = column.getFilterValue() as string | undefined;
      const [open, setOpen] = useState(false);
      const [value, setValue] = useState("");
      const [date, setDate] = useState<Date | undefined>(
        filterValue ? new Date(filterValue) : undefined
      );
      const [month, setMonth] = useState<Date | undefined>(date);

      return (
        <div className="flex items-center gap-2">
          <Button
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            variant="ghost"
          >
            Created At
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>

          <Popover onOpenChange={setOpen} open={open}>
            <PopoverTrigger asChild>
              <Button
                className={cn("h-8 w-8 p-0", date && "bg-accent")}
                size="sm"
                variant="outline"
              >
                <Filter className="h-4 w-4" />
                <span className="sr-only">Filter by date</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-0">
              <div className="border-b p-3">
                <Input
                  className="h-9"
                  onChange={(e) => {
                    setValue(e.target.value);
                    const parsedDate = parseDate(e.target.value);
                    if (parsedDate) {
                      setDate(parsedDate);
                      setMonth(parsedDate);
                      column.setFilterValue(parsedDate.toISOString());
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && date) {
                      setOpen(false);
                    }
                  }}
                  placeholder="yesterday, last week, Oct 15..."
                  value={value}
                />
              </div>
              <Calendar
                initialFocus
                mode="single"
                month={month}
                onMonthChange={setMonth}
                onSelect={(newDate?: Date) => {
                  setDate(newDate ?? undefined);
                  setValue(newDate ? formatDate(newDate) : "");
                  column.setFilterValue(
                    newDate ? newDate.toLocaleDateString() : undefined
                  );

                  if (newDate) {
                    setOpen(false);
                  }
                }}
                required={false}
                selected={date}
              />
              {date && (
                <div className="flex items-center justify-between gap-2 border-t p-3">
                  <p className="text-muted-foreground text-sm">
                    {format(date, "MMM dd, yyyy")}
                  </p>
                  <Button
                    onClick={() => {
                      setDate(undefined);
                      setValue("");
                      setMonth(undefined);
                      column.setFilterValue(undefined);
                    }}
                    size="sm"
                    variant="ghost"
                  >
                    <X className="mr-1 h-3 w-3" />
                    Clear
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>
      );
    },
    cell: ({ row }) => {
      const date = new Date(row.getValue("createdAt"));
      const datePart = date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      const timePart = date.toLocaleTimeString("en-IN", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
      return (
        <div>
          {datePart} [{timePart}]
        </div>
      );
    },
    filterFn: filterByDay,
    sortingFn: "datetime",
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => {
      const conversation = row.original;

      return (
        <Link href={`/admin/conversations/${conversation.id}`}>
          <Button size="sm" variant="outline">
            View
          </Button>
        </Link>
      );
    },
  },
];
