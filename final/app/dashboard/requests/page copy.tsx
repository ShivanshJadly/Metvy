import {
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  MessageCircle,
  XCircle,
} from "lucide-react";
import Link from "next/link";
// import { redirect } from "next/navigation";

import { auth } from "@/app/(auth)/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getResumeRequestsByUserId, getResumesByIds } from "@/lib/db/actions";
import type { ResumeRequest } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

// Helper function to format date as DD/MM/YYYY
function formatDate(date: Date | string): string {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export default async function UserResumes() {
  const session = await auth();

  if (!session?.user?.id) {
    // Optionally redirect to login immediately
    // redirect("/login");
    return (
      <div className="py-16 text-center">
        <p className="text-slate-600">Please log in to view your requests.</p>
      </div>
    );
  }

  // --- Server-Side Data Fetching ---
  let requests: (ResumeRequest & { resumes: any[] })[] = [];

  try {
    const allRequests = (await getResumeRequestsByUserId(
      session.user.id
    )) as ResumeRequest[];

    // OPTIMIZATION: Batch fetch all resumes at once
    const approvedRequests = allRequests.filter(
      (req) => req.status === "approved"
    );
    const allResumeIds = Array.from(
      new Set(approvedRequests.flatMap((req) => req.resumeIds))
    );

    const allResumes =
      allResumeIds.length > 0 ? await getResumesByIds(allResumeIds) : [];

    // Create a lookup map for O(1) access
    const resumesMap = new Map(allResumes.map((r) => [r.resumeId, r]));

    // Map resumes to requests
    requests = allRequests.map((req) => {
      if (req.status === "approved") {
        const resumes = req.resumeIds
          .map((id) => resumesMap.get(id))
          .filter((r): r is NonNullable<typeof r> => r !== undefined);
        return { ...req, resumes };
      }
      return { ...req, resumes: [] };
    });
  } catch (error) {
    console.error("Failed to load requests:", error);
    // You could render an error state here if desired
  }

  // Calculate stats
  const pendingRequests = requests.filter((r) => r.status === "pending");
  const approvedRequests = requests.filter((r) => r.status === "approved");
  const rejectedRequests = requests.filter((r) => r.status === "rejected");

  return (
    <div className="mx-auto space-y-8 p-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="font-bold text-4xl text-slate-900">Your Requests</h1>
        <p className="text-slate-600">View and manage your resume requests</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border-blue-200 bg-linear-to-br from-blue-50 to-blue-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-blue-600 text-sm">Pending</p>
              <p className="mt-1 font-bold text-3xl text-blue-900">
                {pendingRequests.length}
              </p>
            </div>
            <Clock className="h-10 w-10 text-blue-300" />
          </div>
        </Card>

        <Card className="border-green-200 bg-linear-to-br from-green-50 to-green-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-green-600 text-sm">Approved</p>
              <p className="mt-1 font-bold text-3xl text-green-900">
                {approvedRequests.length}
              </p>
            </div>
            <CheckCircle2 className="h-10 w-10 text-green-300" />
          </div>
        </Card>

        <Card className="border-red-200 bg-linear-to-br from-red-50 to-red-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-red-600 text-sm">Rejected</p>
              <p className="mt-1 font-bold text-3xl text-red-900">
                {rejectedRequests.length}
              </p>
            </div>
            <XCircle className="h-10 w-10 text-red-300" />
          </div>
        </Card>
      </div>

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-bold text-2xl text-slate-900">
            Pending Approval
          </h2>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {pendingRequests.map((request) => (
              <RequestCard key={request.id} request={request} />
            ))}
          </div>
        </div>
      )}

      {/* Approved Requests */}
      {approvedRequests.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-bold text-2xl text-slate-900">
            Approved Requests
          </h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {approvedRequests.map((request) => (
              <RequestCard key={request.id} request={request} />
            ))}
          </div>
        </div>
      )}

      {/* Rejected Requests */}
      {rejectedRequests.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-bold text-2xl text-slate-900">
            Rejected Requests
          </h2>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {rejectedRequests.map((request) => (
              <RequestCard key={request.id} request={request} />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {requests.length === 0 && (
        <Card className="p-16 text-center">
          <FileText className="mx-auto mb-4 h-12 w-12 text-slate-300" />
          <p className="text-lg text-slate-600">No resume requests yet</p>
          <p className="mt-2 text-slate-500 text-sm">
            Request resumes from your search results to get started.
          </p>
        </Card>
      )}
    </div>
  );
}

function RequestCard({
  request,
}: {
  request: ResumeRequest & { resumes: any[] };
}) {
  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-lg">
      {/* Header */}
      <div className="border-slate-200 border-b bg-linear-to-r from-slate-50 to-slate-100 px-6 py-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h2 className="font-semibold text-lg text-slate-900">
                Request #{request.id.slice(0, 8).toUpperCase()}
              </h2>
              <Badge
                className={cn({
                  "border-yellow-300 bg-yellow-100 text-yellow-800":
                    request.status === "pending",
                  "border-green-300 bg-green-100 text-green-800":
                    request.status === "approved",
                  "border-red-300 bg-red-100 text-red-800":
                    request.status === "rejected",
                })}
                variant="default"
              >
                {request.status === "pending" && (
                  <Clock className="mr-1 h-3 w-3" />
                )}
                {request.status === "approved" && (
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                )}
                {request.status === "rejected" && (
                  <XCircle className="mr-1 h-3 w-3" />
                )}
                {request.status.charAt(0).toUpperCase() +
                  request.status.slice(1)}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-slate-600 text-sm">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {formatDate(request.createdAt)}
              </div>
              <div className="flex items-center gap-1">
                <FileText className="h-4 w-4" />
                {request.resumeIds.length} resume
                {request.resumeIds.length !== 1 ? "s" : ""}
              </div>
            </div>
          </div>

          {request.chatId && (
            <Button asChild size="sm" variant="outline">
              <Link href={`/chat/${request.chatId}`}>
                <MessageCircle className="mr-2 h-4 w-4" />
                Chat
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="space-y-4 px-6 py-4">
        {/* Admin Notes for Rejected */}
        {request.status === "rejected" && request.notes && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="mb-2 font-semibold text-red-800 text-sm">
              Rejection Reason
            </p>
            <p className="text-red-700 text-sm">{request.notes}</p>
          </div>
        )}

        {/* Pending Message */}
        {request.status === "pending" && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="text-blue-700 text-sm">
              Your request is being reviewed by our team. You'll be notified
              once it's processed.
            </p>
          </div>
        )}

        {/* Resumes (only for approved) */}
        {request.status === "approved" && request.resumes.length > 0 && (
          <div>
            <p className="mb-3 font-semibold text-slate-700 text-sm">Resumes</p>
            <div className="grid gap-3">
              {request.resumes.map((resume: any, idx: number) => (
                <div
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-slate-300"
                  key={resume.resumeId || idx}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <FileText className="h-5 w-5 shrink-0 text-slate-400" />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900 text-sm">
                        {request.candidateIds[idx]}
                      </p>
                    </div>
                  </div>

                  <Button
                    asChild
                    className="ml-4 shrink-0 bg-blue-600 text-white hover:bg-blue-700"
                    size="sm"
                  >
                    <a
                      href={`https://storage.googleapis.com/${resume.gcsBucket}/${resume.gcsFilePath}`}
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
            <p className="mb-3 font-semibold text-slate-700 text-sm">
              Requested Resumes
            </p>
            <div className="grid gap-2">
              {request.candidateIds.map((id) => (
                <div
                  className="rounded border border-slate-200 bg-slate-50 p-3 font-mono text-slate-600 text-xs"
                  key={id}
                >
                  {id}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
