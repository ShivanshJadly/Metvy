import {
  CheckCircle2,
  Clock,
  // FileText,
  XCircle,
} from "lucide-react";

import { auth } from "@/app/(auth)/auth";
import { Card } from "@/components/ui/card";
import { getResumeRequestsByUserId, getResumesByIds } from "@/lib/db/actions";
import type { ResumeRequest } from "@/lib/db/schema";
import { RequestsTable } from "./requests-table";

export default async function UserResumes() {
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <div className="py-16 text-center">
        <p className="text-gray-600">Please log in to view your requests.</p>
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
  }

  // Calculate stats
  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const approvedCount = requests.filter((r) => r.status === "approved").length;
  const rejectedCount = requests.filter((r) => r.status === "rejected").length;

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-8 px-6 py-8 lg:px-12">
      <div className="space-y-3">
        <h1 className="font-bold text-4xl text-gray-900 lg:text-4xl">Your Requests</h1>
        <p className="text-gray-600">View and manage your resume requests</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <Card className="border-gray-200 bg-gray-50 p-8 transition-shadow hover:shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-600 text-sm uppercase tracking-wide">Pending</p>
              <p className="mt-2 font-bold text-4xl text-gray-900">
                {pendingCount}
              </p>
            </div>
            <div className="rounded-full bg-gray-200 p-4">
              <Clock className="h-8 w-8 text-gray-600" />
            </div>
          </div>
        </Card>

        <Card className="border-gray-200 bg-green-100 p-8 transition-shadow hover:shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-600 text-sm uppercase tracking-wide">Approved</p>
              <p className="mt-2 font-bold text-4xl text-gray-900">
                {approvedCount}
              </p>
            </div>
            <div className="rounded-full bg-gray-200 p-4">
              <CheckCircle2 className="h-8 w-8 text-gray-600" />
            </div>
          </div>
        </Card>

        <Card className="border-gray-200 bg-red-100 p-8 transition-shadow hover:shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-600 text-sm uppercase tracking-wide">Rejected</p>
              <p className="mt-2 font-bold text-4xl text-gray-900">
                {rejectedCount}
              </p>
            </div>
            <div className="rounded-full bg-gray-200 p-4">
              <XCircle className="h-8 w-8 text-gray-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Client-side Table with Filtering & Sorting */}
      <RequestsTable requests={requests} />
    </div>
  );
}
