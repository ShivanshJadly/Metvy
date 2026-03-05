"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Download } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { StudentDetailsDialog } from "./student-details-dialog";

export type Resume = {
  id: string;
  uploadDate: string;
  url: string;
  status: string;
  isPaid: boolean;
  error_message: string | null;
  candidateName: string | null;
  candidateEmail: string | null;
};

const MAX_TOOLTIP_LENGTH = 80;

const getStatusColor = (status: string) => {
  switch (status) {
    case "COMPLETED":
      return "bg-green-500";
    case "PROCESSING":
      return "bg-blue-500";
    case "PENDING":
      return "bg-yellow-500";
    case "FAILED":
      return "bg-red-500";
    case "ARCHIVED":
      return "bg-gray-500";
    default:
      return "bg-gray-500";
  }
};

export function ErrorBadgeWithFullError({
  status,
  errorMsg,
  badge,
}: {
  status: string;
  errorMsg: string;
  badge: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  if (status === "FAILED" && errorMsg) {
    const truncated =
      errorMsg.length > MAX_TOOLTIP_LENGTH
        ? `${errorMsg.slice(0, MAX_TOOLTIP_LENGTH)}...`
        : errorMsg;

    return (
      <>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setOpen(true);
                }
              }}
              tabIndex={0}
              type="button"
            >
              {badge}
            </button>
          </TooltipTrigger>
          <TooltipContent style={{ maxWidth: 300, whiteSpace: "pre-line" }}>
            {truncated}
          </TooltipContent>
        </Tooltip>
        <Dialog onOpenChange={setOpen} open={open}>
          <DialogContent>
            <DialogTitle>Error Details</DialogTitle>
            <pre
              style={{
                whiteSpace: "pre-wrap",
                maxHeight: 400,
                overflow: "auto",
                color: "red",
              }}
            >
              {errorMsg}
            </pre>
            <DialogClose>Close</DialogClose>
          </DialogContent>
        </Dialog>
      </>
    );
  }
  return badge;
}

export const columns: ColumnDef<Resume>[] = [
  {
    accessorKey: "id",
    header: "ID",
    cell: ({ row }) => {
      const id = row.getValue("id") as string;
      return <span className="font-mono text-xs">{id}</span>;
    },
  },
  {
    accessorKey: "candidateName",
    header: ({ column }) => {
      return (
        <Button
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          variant="ghost"
        >
          Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const name = row.getValue("candidateName") as string | null;
      return (
        <div className="text-sm">
          {name || <span className="text-gray-400">—</span>}
        </div>
      );
    },
  },
  {
    accessorKey: "candidateEmail",
    header: ({ column }) => {
      return (
        <Button
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          variant="ghost"
        >
          Email
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const email = row.getValue("candidateEmail") as string | null;
      return (
        <div className="text-sm">
          {email || <span className="text-gray-400">—</span>}
        </div>
      );
    },
  },
  {
    accessorKey: "uploadDate",
    header: ({ column }) => {
      return (
        <Button
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          variant="ghost"
        >
          Upload Date
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const uploadDateString = row.getValue("uploadDate") as string;
      if (!uploadDateString) {
        return <div>No date</div>;
      }

      const date = new Date(uploadDateString);
      const formatted = date.toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });

      return <div>{formatted}</div>;
    },
  },
  {
    accessorKey: "status",
    header: ({ column }) => {
      return (
        <Button
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          variant="ghost"
        >
          Status
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      const errorMsg = row.original.error_message || "";
      const badge = <Badge className={getStatusColor(status)}>{status}</Badge>;
      return (
        <ErrorBadgeWithFullError
          badge={badge}
          errorMsg={errorMsg}
          status={status}
        />
      );
    },
  },
  {
    accessorKey: "isPaid",
    header: "Payment",
    cell: ({ row }) => {
      const isPaid = row.getValue("isPaid") as boolean;
      return (
        <Badge variant={isPaid ? "default" : "secondary"}>
          {isPaid ? "Paid" : "Unpaid"}
        </Badge>
      );
    },
  },
  {
    id: "actions",
    header: () => {
      return (
        <div className="flex justify-center">
          <span>Actions</span>
        </div>
      );
    },
    cell: ({ row }) => {
      const url = row.original.url;
      const id = row.original.id;

      return (
        <div className="flex items-center justify-center space-x-2">
          <Button
            className="cursor-pointer"
            onClick={() => window.open(url, "_blank")}
            size="icon"
            title="Download Resume"
            variant="outline"
          >
            <Download className="h-4 w-4" />
          </Button>
          <StudentDetailsDialog id={id} />
        </div>
      );
    },
  },
];
