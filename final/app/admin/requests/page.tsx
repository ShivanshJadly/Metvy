// app/admin/requests/page.tsx
"use client";

import {
  ArrowUpDown,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronRight as ChevronRightExpand,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Filter,
  Loader,
  Mail,
  Phone,
  Search,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

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
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getAllResumeRequests,
  getCandidatesByIds,
  getResumeRequestsCount,
  getResumesByIds,
  updateResumeRequestStatus,
} from "@/lib/db/actions";
import type { ResumeRequest } from "@/lib/db/schema";

interface RequestWithDetails extends ResumeRequest {
  userName: string | null;
  userEmail: string | null;
  userPhoneNumber: string | null;
  chatTitle: string | null;
  candidates?: any[];
  resumes?: any[];
}

type StatusFilter = "all" | "pending" | "approved" | "rejected";
type SortOrder = "asc" | "desc";

const ITEMS_PER_PAGE = 15;

// Helper function to format date as DD/MM/YYYY
function formatDate(date: Date | string): string {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export default function AdminRequests() {
  const [requests, setRequests] = useState<RequestWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filters and sorting
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [searchQuery, setSearchQuery] = useState("");

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const offset = (currentPage - 1) * ITEMS_PER_PAGE;

      // Fetch requests and total count in parallel
      const [allRequests, total] = await Promise.all([
        getAllResumeRequests({ limit: ITEMS_PER_PAGE, offset }),
        getResumeRequestsCount(),
      ]);

      setTotalCount(total);

      const allCandidateIds = Array.from(
        new Set(allRequests.flatMap((req) => req.candidateIds))
      );
      const allResumeIds = Array.from(
        new Set(allRequests.flatMap((req) => req.resumeIds))
      );

      const [allCandidates, allResumes] = await Promise.all([
        getCandidatesByIds(allCandidateIds),
        getResumesByIds(allResumeIds),
      ]);

      const candidatesMap = new Map(
        allCandidates.map((c) => [c.candidateId, c])
      );
      const resumesMap = new Map(allResumes.map((r) => [r.resumeId, r]));

      const withDetails = allRequests.map((req) => ({
        ...req,
        candidates: req.candidateIds
          .map((id) => candidatesMap.get(id))
          .filter((c): c is NonNullable<typeof c> => c !== undefined),
        resumes: req.resumeIds
          .map((id) => resumesMap.get(id))
          .filter((r): r is NonNullable<typeof r> => r !== undefined),
      }));

      setRequests(withDetails);
    } catch (error) {
      console.error("Failed to load requests:", error);
    } finally {
      setLoading(false);
    }
  }, [currentPage]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleStatusChange = async (
    id: string,
    status: "approved" | "rejected",
    notes?: string
  ) => {
    const previousRequests = [...requests];

    // Optimistic update
    setRequests((currentRequests) =>
      currentRequests.map((req) =>
        req.id === id
          ? {
              ...req,
              status,
              notes: notes ?? null,
            }
          : req
      )
    );

    setExpandedRow(null);
    setProcessing(id);

    try {
      await updateResumeRequestStatus({ id, status, notes });
    } catch (error) {
      console.error("Failed to update request:", error);
      setRequests(previousRequests);
      alert("Something went wrong. Reverting changes.");
    } finally {
      setProcessing(null);
    }
  };

  // Filtered and sorted requests
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
        const userName = r.userName?.toLowerCase() || "";
        const userEmail = r.userEmail?.toLowerCase() || "";
        const chatTitle = r.chatTitle?.toLowerCase() || "";
        return (
          userName.includes(query) ||
          userEmail.includes(query) ||
          chatTitle.includes(query)
        );
      });
    }

    // Apply sorting
    return [...filtered].sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
    });
  }, [requests, statusFilter, sortOrder, searchQuery]);

  // Pagination calculations
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  const startItem = (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endItem = Math.min(currentPage * ITEMS_PER_PAGE, totalCount);

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };

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

  if (loading && requests.length === 0) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const approvedCount = requests.filter((r) => r.status === "approved").length;
  const rejectedCount = requests.filter((r) => r.status === "rejected").length;

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-8 px-6 py-8 lg:px-12">
      {/* Header */}
      <div className="space-y-3">
        <h1 className="font-bold text-4xl text-gray-900 lg:text-4xl">
          Resume Requests
        </h1>
        <p className="text-gray-600">
          Manage and approve resume requests from users
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 shadow-sm transition-shadow hover:shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-600 text-sm uppercase tracking-wide">
                Pending
              </p>
              <p className="mt-2 font-bold text-4xl text-gray-900">
                {pendingCount}
              </p>
            </div>
            <div className="rounded-full bg-gray-200 p-4">
              <Clock className="h-8 w-8 text-gray-600" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 shadow-sm transition-shadow hover:shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-600 text-sm uppercase tracking-wide">
                Approved
              </p>
              <p className="mt-2 font-bold text-4xl text-gray-900">
                {approvedCount}
              </p>
            </div>
            <div className="rounded-full bg-gray-200 p-4">
              <CheckCircle2 className="h-8 w-8 text-gray-600" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 shadow-sm transition-shadow hover:shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-600 text-sm uppercase tracking-wide">
                Rejected
              </p>
              <p className="mt-2 font-bold text-4xl text-gray-900">
                {rejectedCount}
              </p>
            </div>
            <div className="rounded-full bg-gray-200 p-4">
              <XCircle className="h-8 w-8 text-gray-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          {/* Search Bar */}
          <div className="relative w-full sm:w-[300px]">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <Input
              type="text"
              placeholder="Search by name, email, or chat..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="border-gray-300 pl-9 text-gray-700"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-3">
            <Filter className="h-5 w-5 text-gray-500" />
            <Select value={statusFilter} onValueChange={handleFilterChange}>
              <SelectTrigger className="w-[180px] border-gray-300 text-gray-700">
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
          Showing {startItem} to {endItem} of {totalCount} requests
        </div>
      </div>

      {/* Data Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">
        <Table>
          <TableHeader className="bg-gray-100">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12"></TableHead>
              <TableHead className="font-semibold text-gray-700 text-xs uppercase tracking-wider">
                User
              </TableHead>
              <TableHead className="font-semibold text-gray-700 text-xs uppercase tracking-wider">
                Contact
              </TableHead>
              <TableHead className="font-semibold text-gray-700 text-xs uppercase tracking-wider">
                Chat
              </TableHead>
              <TableHead className="font-semibold text-gray-700 text-xs uppercase tracking-wider">
                Resumes
              </TableHead>
              <TableHead className="font-semibold text-gray-700 text-xs uppercase tracking-wider">
                Status
              </TableHead>
              <TableHead className="font-semibold text-gray-700 text-xs uppercase tracking-wider">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 font-semibold text-gray-700 text-xs uppercase tracking-wider hover:bg-gray-200 hover:text-gray-900"
                  onClick={handleSortToggle}
                >
                  Created
                  <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
                </Button>
              </TableHead>
              <TableHead className="font-semibold text-gray-700 text-xs uppercase tracking-wider text-right">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="p-12 text-center">
                  <Loader className="mx-auto mb-4 h-8 w-8 animate-spin text-gray-400" />
                  <p className="text-gray-600 text-sm">Loading requests...</p>
                </TableCell>
              </TableRow>
            ) : filteredAndSortedRequests.length > 0 ? (
              filteredAndSortedRequests.map((request) => (
                <RequestRow
                  key={request.id}
                  request={request}
                  processing={processing}
                  onStatusChange={handleStatusChange}
                  expandedRow={expandedRow}
                  onExpand={setExpandedRow}
                />
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="p-12 text-center">
                  <FileText className="mx-auto mb-4 h-16 w-16 text-gray-300" />
                  <p className="text-lg text-gray-900">
                    {searchQuery
                      ? `No requests found for "${searchQuery}"`
                      : statusFilter === "all"
                      ? "No resume requests found"
                      : `No ${statusFilter} requests found`}
                  </p>
                  <p className="mt-2 text-gray-500 text-sm">
                    {searchQuery
                      ? "Try adjusting your search query"
                      : "Requests will appear here when users submit them."}
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
              onClick={handlePreviousPage}
              className="border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={handleNextPage}
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
  processing,
  onStatusChange,
  expandedRow,
  onExpand,
}: {
  request: RequestWithDetails;
  processing: string | null;
  onStatusChange: (
    id: string,
    status: "approved" | "rejected",
    notes?: string
  ) => Promise<void>;
  expandedRow: string | null;
  onExpand: (id: string | null) => void;
}) {
  const [rejectionNotes, setRejectionNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);

  const isExpanded = expandedRow === request.id;

  return (
    <>
      <TableRow className="border-gray-100 transition-colors hover:bg-gray-50">
        {/* Expand Button */}
        <TableCell className="w-12">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onExpand(isExpanded ? null : request.id)}
            className="h-8 w-8 p-0 hover:bg-gray-200"
          >
            <ChevronRightExpand
              className={`h-4 w-4 text-gray-600 transition-transform ${
                isExpanded ? "rotate-90" : ""
              }`}
            />
          </Button>
        </TableCell>

        <TableCell className="text-gray-900 text-sm">
          <div className="font-medium">{request.userName || "Unknown"}</div>
          <div className="font-mono text-gray-500 text-xs">
            #{request.id.slice(0, 8)}
          </div>
        </TableCell>

        <TableCell className="text-gray-700 text-sm">
          <div className="flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-xs">{request.userEmail}</span>
          </div>
          {request.userPhoneNumber && (
            <div className="mt-1 flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-gray-400" />
              <span className="text-xs">{request.userPhoneNumber}</span>
            </div>
          )}
        </TableCell>

        <TableCell className="text-gray-900 text-sm">
          {request.chatId ? (
            <Link
              href={`/chat/${request.chatId}`}
              className="inline-flex items-center gap-1.5 text-blue-700 hover:text-blue-500 hover:underline"
            >
              {request.chatTitle?.slice(0, 30) ||
                `Chat ${request.chatId.slice(0, 8)}`}
              {(request.chatTitle?.length || 0) > 30 && "..."}
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <span className="text-gray-400">—</span>
          )}
        </TableCell>

        <TableCell className="text-gray-600 text-sm">
          <div className="flex items-center gap-1.5">
            <FileText className="h-4 w-4" />
            {request.resumeIds.length} resume
            {request.resumeIds.length !== 1 ? "s" : ""}
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

        <TableCell className="whitespace-nowrap text-gray-600 text-sm">
          {formatDate(request.createdAt)}
        </TableCell>

        <TableCell className="text-right">
          {request.chatId && (
            <Button asChild variant="ghost" size="sm">
              <Link href={`/chat/${request.chatId}`}>
                <ExternalLink className="h-4 w-4" />
              </Link>
            </Button>
          )}
        </TableCell>
      </TableRow>

      {/* Expanded Row Details */}
      {isExpanded && (
        <TableRow>
          <TableCell
            colSpan={8}
            className="border-gray-200 border-t bg-gray-50 p-8"
          >
            <div className="space-y-6">
              {/* Resumes */}
              {request.resumes && request.resumes.length > 0 && (
                <div>
                  <p className="mb-4 font-semibold text-gray-900">Resumes</p>
                  <div className="grid gap-3">
                    {request.resumes.map((resume) => (
                      <div
                        key={resume.resumeId}
                        className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-all hover:border-gray-300 hover:shadow-md"
                      >
                        <div className="flex items-center gap-3">
                          <div className="rounded-lg bg-gray-100 p-2.5">
                            <FileText className="h-5 w-5 text-gray-700" />
                          </div>
                          <span className="font-mono text-gray-600 text-xs">
                            {resume.resumeId}
                          </span>
                        </div>
                        <Button
                          asChild
                          className="bg-gray-900 text-white hover:bg-gray-800"
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

              {/* Actions for pending */}
              {request.status === "pending" && (
                <div className="space-y-4">
                  {showNotes && (
                    <Textarea
                      className="border-gray-300"
                      onChange={(e) => setRejectionNotes(e.target.value)}
                      placeholder="Rejection notes..."
                      rows={3}
                      value={rejectionNotes}
                    />
                  )}

                  <div className="flex gap-3">
                    <Button
                      disabled={processing === request.id}
                      onClick={() => onStatusChange(request.id, "approved")}
                      className="bg-green-600 text-white hover:bg-green-700"
                      size="sm"
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Approve
                    </Button>

                    <Button
                      onClick={() => setShowNotes(!showNotes)}
                      variant="outline"
                      size="sm"
                      className="border-gray-300"
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      {showNotes ? "Hide Notes" : "Reject"}
                    </Button>

                    {showNotes && (
                      <Button
                        disabled={processing === request.id}
                        onClick={() =>
                          onStatusChange(request.id, "rejected", rejectionNotes)
                        }
                        className="bg-red-600 text-white hover:bg-red-700"
                        size="sm"
                      >
                        Confirm Rejection
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Notes for rejected */}
              {request.status === "rejected" && request.notes && (
                <div className="rounded-lg border border-gray-300 bg-white p-5 shadow-sm">
                  <p className="mb-2 font-semibold text-gray-900 text-sm">
                    Rejection Reason
                  </p>
                  <p className="text-gray-700 text-sm leading-relaxed">
                    {request.notes}
                  </p>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
