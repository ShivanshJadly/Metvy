"use client";

import {
  ArrowUpDown,
  CheckCircle2,
  // ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Filter,
  Search,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ResumeRequest } from "@/lib/db/schema";

type StatusFilter = "all" | "pending" | "approved" | "rejected";
type SortOrder = "asc" | "desc";

interface RequestWithDetails extends ResumeRequest {
  chatTitle?: string | null;
  resumes: any[]
}

const ITEMS_PER_PAGE = 15;

// Helper function to format date as DD/MM/YYYY
function formatDate(date: Date | string): string {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

// Helper to truncate chat name
function truncateChatName(
  name: string | null | undefined,
  maxLength = 50
): string {
  if (!name) return "—";
  return name.length > maxLength ? `${name.slice(0, maxLength)}...` : name;
}

export function RequestsTable({
  requests,
}: {
  requests: RequestWithDetails[];
}) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");

  // Apply filters and sorting
  const filteredAndSortedRequests = useMemo(() => {
    let filtered = requests;

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((r) => r.status === statusFilter);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((r) => {
        const chatTitle = r.chatTitle?.toLowerCase() || "";
        return chatTitle.includes(query);
      });
    }

    // Apply sorting
    return [...filtered].sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
    });
  }, [requests, statusFilter, sortOrder, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(
    filteredAndSortedRequests.length / ITEMS_PER_PAGE
  );
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedRequests = filteredAndSortedRequests.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE
  );

  // Reset to page 1 when filters change
  const handleFilterChange = (value: StatusFilter) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleSortToggle = () => {
    setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
  };

  return (
    <div className="space-y-6">
      {/* Filters and Controls */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          {/* Search Bar */}
          <div className="relative w-full sm:w-[280px]">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <Input
              type="text"
              placeholder="Search by chat title..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="border-gray-300 pl-9 text-gray-700"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-3">
            <Filter className="h-5 w-5 text-gray-500" />
            <Select value={statusFilter} onValueChange={handleFilterChange}>
              <SelectTrigger className="w-[200px] border-gray-300 text-gray-700">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="text-gray-600 text-sm">
          Showing {Math.min(startIndex + 1, filteredAndSortedRequests.length)}{" "}
          to{" "}
          {Math.min(
            startIndex + ITEMS_PER_PAGE,
            filteredAndSortedRequests.length
          )}{" "}
          of {filteredAndSortedRequests.length} requests
        </div>
      </div>

      {/* Data Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">
        <Table>
          <TableHeader className="bg-gray-100">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12"></TableHead>
              {/*<TableHead className="font-semibold text-gray-700 text-xs uppercase tracking-wider">
                Request ID
              </TableHead>*/}
              <TableHead className="font-semibold text-gray-700 text-xs uppercase tracking-wider">
                Chat Name
              </TableHead>
              <TableHead className="font-semibold text-gray-700 text-xs uppercase tracking-wider">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 font-semibold text-gray-700 text-xs uppercase tracking-wider hover:bg-gray-200 hover:text-gray-900"
                  onClick={handleSortToggle}
                >
                  Date
                  <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
                </Button>
              </TableHead>
              <TableHead className="font-semibold text-gray-700 text-xs uppercase tracking-wider">
                Resumes
              </TableHead>
              <TableHead className="font-semibold text-gray-700 text-xs uppercase tracking-wider">
                Status
              </TableHead>
              <TableHead className="font-semibold text-gray-700 text-xs uppercase tracking-wider text-right">
                {/*Actions*/}
                Download All
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedRequests.length > 0 ? (
              paginatedRequests.map((request) => (
                <RequestRow key={request.id} request={request} />
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="p-12 text-center">
                  <FileText className="mx-auto mb-4 h-16 w-16 text-gray-300" />
                  <p className="text-lg text-gray-900">
                    {searchQuery
                      ? `No requests found for "${searchQuery}"`
                      : statusFilter === "all"
                      ? "No resume requests yet"
                      : `No ${statusFilter} requests found`}
                  </p>
                  <p className="mt-2 text-gray-500 text-sm">
                    {searchQuery
                      ? "Try adjusting your search query"
                      : "Request resumes from your search results to get started."}
                  </p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="text-gray-600 text-sm">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              className="border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() =>
                setCurrentPage((prev) => Math.min(totalPages, prev + 1))
              }
              className="border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function RequestRow({
  request,
}: {
  request: RequestWithDetails;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <>
      <TableRow className="border-gray-100 transition-colors hover:bg-gray-50">
        {/* Expand Button */}
        <TableCell className="w-12">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-8 w-8 p-0 hover:bg-gray-200"
          >
            <ChevronRight
              className={`h-4 w-4 text-gray-600 transition-transform ${
                isExpanded ? "rotate-90" : ""
              }`}
            />
          </Button>
        </TableCell>

        {/*<TableCell className="font-mono text-gray-900 text-sm">
          #{request.id.slice(0, 8).toUpperCase()}
        </TableCell>*/}
        <TableCell className="text-gray-900 text-sm">
          {request.chatId ? (
            <Link
              href={`/chat/${request.chatId}`}
              className="inline-flex items-center gap-1.5 text-blue-700 hover:text-blue-500 hover:underline"
            >
              {truncateChatName(
                request.chatTitle || `Chat ${request.chatId.slice(0, 8)}`
              )}
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <span className="text-gray-400">—</span>
          )}
        </TableCell>
        <TableCell className="whitespace-nowrap text-gray-600 text-sm">
          {formatDate(request.createdAt)}
        </TableCell>
        <TableCell className="text-gray-600 text-sm">
          <div className="flex items-center gap-1.5">
            <FileText className="h-4 w-4" />
            {request.resumeIds.length}
          </div>
        </TableCell>
        <TableCell>
          <Badge
            variant="default"
            className={
              request.status === "pending"
                ? "bg-gray-200 text-gray-800"
                : request.status === "approved"
                ? "bg-green-200 text-gray-800"
                : "bg-red-200 text-gray-800"
            }
          >
            {request.status === "pending" && (
              <Clock className="mr-1.5 h-3 w-3" />
            )}
            {request.status === "approved" && (
              <CheckCircle2 className="mr-1.5 h-3 w-3" />
            )}
            {request.status === "rejected" && (
              <XCircle className="mr-1.5 h-3 w-3" />
            )}
            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
          </Badge>
        </TableCell>
        <TableCell className="text-right">
          {request.status === "approved" && request.resumes.length > 0 && (
            <DownloadAllButton
              resumes={request.resumes}
              candidateIds={request.candidateIds}
            />
          )}
        </TableCell>
      </TableRow>

      {/* Expanded Row Details */}
      {isExpanded && (
        <TableRow>
          <TableCell colSpan={7} className="border-gray-200 border-t bg-gray-50 p-8">
            <div className="space-y-6">
              {/* Rejection Notes */}
              {request.status === "rejected" && request.notes && (
                <div className="rounded-lg border border-gray-300 bg-white p-5 shadow-sm">
                  <p className="mb-2 font-semibold text-gray-900 text-sm">
                    Rejection Reason
                  </p>
                  <p className="text-gray-700 text-sm leading-relaxed">{request.notes}</p>
                </div>
              )}

              {/* Individual Resumes */}
              {request.status === "approved" && request.resumes.length > 0 && (
                <div>
                  <p className="mb-4 font-semibold text-gray-900">
                    Individual Resumes
                  </p>
                  <div className="grid gap-3">
                    {request.resumes.map((resume: any, idx: number) => (
                      <div
                        key={resume.resumeId || idx}
                        className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-gray-300 hover:shadow-md"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="rounded-lg bg-gray-100 p-2.5">
                            <FileText className="h-5 w-5 text-gray-700" />
                          </div>
                          <p className="truncate font-medium text-gray-900 text-sm">
                            {request.candidateIds[idx]}
                          </p>
                        </div>
                        <Button
                          asChild
                          className="ml-4 shrink-0 bg-gray-900 text-white hover:bg-gray-800"
                          size="sm"
                        >
                          <a
                            href={`https://storage.googleapis.com/${resume.gcsBucket}/${resume.gcsFilePath}`}
                            download
                            rel="noopener noreferrer"
                            target="_blank"
                          >
                            <Download className="mr-2 h-4 w-4" />
                            Download
                          </a>
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Candidate IDs for non-approved */}
              {request.status !== "approved" && (
                <div>
                  <p className="mb-4 font-semibold text-gray-900">
                    Requested Candidates
                  </p>
                  <div className="grid gap-2.5">
                    {request.candidateIds.map((id) => (
                      <div
                        key={id}
                        className="rounded-lg border border-gray-200 bg-white p-4 font-mono text-gray-600 text-xs shadow-sm"
                      >
                        {id}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function DownloadAllButton({
  resumes,
  candidateIds,
}: {
  resumes: any[];
  candidateIds: string[];
}) {
  const handleDownloadAll = async () => {
    for (let i = 0; i < resumes.length; i++) {
      const resume = resumes[i];
      const url = `https://storage.googleapis.com/${resume.gcsBucket}/${resume.gcsFilePath}`;
      const fileName = `${candidateIds[i]}.pdf`;

      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (i < resumes.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }
  };

  return (
    <Button
      onClick={handleDownloadAll}
      className="bg-gray-100 text-gray-800 hover:bg-gray-200 border cursor-pointer"
      size="sm"
    >
      <Download className="h-4 w-4" />
      {/*Download All*/}
    </Button>
  );
}
