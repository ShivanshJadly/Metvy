// app/admin/requests/page.tsx
"use client";

import {
  ArrowUpDown,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  Filter,
  Loader,
  Mail,
  Phone,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  getAllResumeRequests,
  getCandidatesByIds,
  getResumeRequestsCount,
  getResumesByIds,
  updateResumeRequestStatus,
} from "@/lib/db/actions";
import type { ResumeRequest } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

interface RequestWithDetails extends ResumeRequest {
  userName: string | null;
  userEmail: string | null;
  userPhoneNumber: string | null;
  candidates?: any[];
  resumes?: any[];
}

type StatusFilter = "all" | "pending" | "approved" | "rejected";
type SortOrder = "asc" | "desc";

const ITEMS_PER_PAGE = 20;

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
    // 1. Snapshot previous state (for rollback)
    const previousRequests = [...requests];

    // 2. OPTIMISTIC UPDATE
    setRequests((currentRequests) =>
      currentRequests.map((req) =>
        req.id === id
          ? {
              ...req,
              status,
              // 👇 FIX: Convert 'undefined' to 'null'
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
      // Rollback on error
      setRequests(previousRequests);
      alert("Something went wrong. Reverting changes.");
    } finally {
      setProcessing(null);
    }
  };

  // Filtered and sorted requests (client-side for current page)
  const filteredAndSortedRequests = useMemo(() => {
    let filtered = requests;

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = requests.filter((r) => r.status === statusFilter);
    }

    // Apply sorting
    return [...filtered].sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
    });
  }, [requests, statusFilter, sortOrder]);

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

  if (loading && requests.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader className="h-8 w-8 animate-spin text-slate-600" />
      </div>
    );
  }

  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const approvedCount = requests.filter((r) => r.status === "approved").length;
  const rejectedCount = requests.filter((r) => r.status === "rejected").length;

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6">
      {/* Header */}
      <div className="w-full space-y-2">
        <h1 className="font-bold text-4xl text-slate-900">Resume Requests</h1>
        <p className="text-slate-600">
          Manage and approve resume requests from users
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-blue-200 bg-linear-to-br from-blue-50 to-blue-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-blue-600 text-sm">Pending</p>
              <p className="mt-1 font-bold text-3xl text-blue-900">
                {pendingCount}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-green-200 bg-linear-to-br from-green-50 to-green-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-green-600 text-sm">Approved</p>
              <p className="mt-1 font-bold text-3xl text-green-900">
                {approvedCount}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-red-200 bg-linear-to-br from-red-50 to-red-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-red-600 text-sm">Rejected</p>
              <p className="mt-1 font-bold text-3xl text-red-900">
                {rejectedCount}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500" />
            <Select
              onValueChange={(value: StatusFilter) => setStatusFilter(value)}
              value={statusFilter}
            >
              <SelectTrigger className="w-[180px]">
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

        {/* Pagination Info */}
        <div className="text-slate-600 text-sm">
          Showing {startItem} to {endItem} of {totalCount} requests
        </div>
      </div>

      {/* Data Table */}
      <div className="w-full rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Resumes</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>
                <Button
                  className="h-auto p-0 font-medium hover:bg-transparent"
                  onClick={() =>
                    setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                  }
                  variant="ghost"
                >
                  Created
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell className="text-center" colSpan={6}>
                  <Loader className="mx-auto h-6 w-6 animate-spin text-slate-600" />
                </TableCell>
              </TableRow>
            ) : filteredAndSortedRequests.length > 0 ? (
              filteredAndSortedRequests.map((request) => (
                <RequestRow
                  expandedRow={expandedRow}
                  key={request.id}
                  onExpand={setExpandedRow}
                  onStatusChange={handleStatusChange}
                  processing={processing}
                  request={request}
                />
              ))
            ) : (
              <TableRow>
                <TableCell
                  className="py-16 text-center text-slate-600"
                  colSpan={6}
                >
                  {statusFilter === "all"
                    ? "No resume requests found"
                    : `No ${statusFilter} requests found`}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between">
        <div className="text-slate-600 text-sm">
          Page {currentPage} of {totalPages}
        </div>
        <div className="flex items-center gap-2">
          <Button
            disabled={currentPage === 1 || loading}
            onClick={handlePreviousPage}
            size="sm"
            variant="outline"
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Previous
          </Button>
          <Button
            disabled={currentPage === totalPages || loading}
            onClick={handleNextPage}
            size="sm"
            variant="outline"
          >
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// Helper function to format date as DD/MM/YYYY
function formatDate(date: Date | string): string {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
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
      <TableRow
        className="cursor-pointer hover:bg-slate-50"
        onClick={() => onExpand(isExpanded ? null : request.id)}
      >
        <TableCell>
          <div>
            <p className="font-medium text-slate-900">
              {request.userName || "Unknown"}
            </p>
            <p className="text-slate-500 text-sm">#{request.id.slice(0, 8)}</p>
          </div>
        </TableCell>
        <TableCell>
          <div className="space-y-1 text-sm">
            <div className="flex items-center gap-2 text-slate-600">
              <Mail className="h-3 w-3" />
              {request.userEmail}
            </div>
            {request.userPhoneNumber && (
              <div className="flex items-center gap-2 text-slate-600">
                <Phone className="h-3 w-3" />
                {request.userPhoneNumber}
              </div>
            )}
          </div>
        </TableCell>
        <TableCell>
          <span className="text-slate-700 text-sm">
            {request.resumeIds.length} resume
            {request.resumeIds.length !== 1 ? "s" : ""}
          </span>
        </TableCell>
        <TableCell>
          <Badge
            className={cn({
              "border-yellow-300 bg-yellow-100 text-yellow-800":
                request.status === "pending",
              "border-green-300 bg-green-100 text-green-800":
                request.status === "approved",
              "border-red-300 bg-red-100 text-red-800":
                request.status === "rejected",
            })}
          >
            {request.status === "pending" && (
              <Loader className="mr-1 h-3 w-3" />
            )}
            {request.status === "approved" && (
              <CheckCircle2 className="mr-1 h-3 w-3" />
            )}
            {request.status === "rejected" && (
              <XCircle className="mr-1 h-3 w-3" />
            )}
            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
          </Badge>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1 text-slate-600 text-sm">
            <Calendar className="h-3 w-3" />
            {formatDate(request.createdAt)}
          </div>
        </TableCell>
        <TableCell className="text-right">
          {request.chatId && (
            <Button asChild size="sm" title="View Conversation" variant="ghost">
              <Link
                href={`/admin/conversations/${request.chatId}`}
                rel="noopener noreferrer"
                target="_blank"
              >
                <Eye className="h-4 w-4" />
              </Link>
            </Button>
          )}
        </TableCell>
      </TableRow>

      {/* Expanded Row Details */}
      {isExpanded && (
        <TableRow>
          <TableCell className="bg-slate-50" colSpan={6}>
            <div className="space-y-4 p-4">
              {/* Resumes */}
              {request.resumes && request.resumes.length > 0 && (
                <div>
                  <p className="mb-2 font-semibold text-slate-700 text-sm">
                    Resumes
                  </p>
                  <div className="grid gap-2">
                    {request.resumes.map((resume) => (
                      <a
                        className="flex items-center justify-between rounded border border-slate-200 bg-white p-2 font-mono text-slate-600 text-xs hover:bg-slate-50"
                        href={`https://storage.googleapis.com/${resume.gcsBucket}/${resume.gcsFilePath}`}
                        key={resume.resumeId}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        {resume.resumeId}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions for pending */}
              {request.status === "pending" && (
                <div className="space-y-3 border-slate-200 border-t pt-4">
                  {showNotes && (
                    <textarea
                      className="w-full rounded border border-slate-300 p-2 text-sm"
                      onChange={(e) => setRejectionNotes(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="Rejection notes..."
                      rows={2}
                      value={rejectionNotes}
                    />
                  )}
                  <div className="flex gap-2">
                    <Button
                      className="bg-green-600 hover:bg-green-700"
                      disabled={processing === request.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onStatusChange(request.id, "approved");
                      }}
                      size="sm"
                      type="button"
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setShowNotes(!showNotes);
                      }}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      {showNotes ? "Hide" : "Reject"}
                    </Button>
                    {showNotes && (
                      <Button
                        disabled={processing === request.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          onStatusChange(
                            request.id,
                            "rejected",
                            rejectionNotes
                          );
                        }}
                        size="sm"
                        type="button"
                        variant="destructive"
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Confirm
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Notes for rejected */}
              {request.status === "rejected" && request.notes && (
                <div className="rounded border border-red-200 bg-red-50 p-3">
                  <p className="mb-1 font-semibold text-red-800 text-sm">
                    Rejection Reason
                  </p>
                  <p className="text-red-700 text-sm">{request.notes}</p>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// END app/admin/requests/page.tsx
