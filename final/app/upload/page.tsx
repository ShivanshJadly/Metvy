// app/upload/page.tsx
import {
  and,
  count,
  desc,
  eq,
  ilike,
  inArray,
  ne,
  or,
  type SQL,
} from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { Card } from "@/components/ui/card";
import { db } from "@/lib/db";
import { resumes, candidates } from "@/lib/db/schema";
import { columns } from "./columns";
import { DataTable } from "./data-table";
import { StatusFilter } from "./status-filter";
import { StudentNameSearch } from "./student-name-search";
import { UploadDialog } from "./upload-dialog";

export default async function UploadDashboard({
  searchParams,
}: {
  searchParams: Promise<{
    query?: string;
    showArchived?: string;
    status?: string;
    resumeId?: string;
    filterIds?: string;
    studentName?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/");
  }

  const params = await searchParams;
  const query = params?.query;
  const showArchived = params?.showArchived === "true";
  const statusFilter = params?.status;
  const resumeIdFilter = params?.resumeId;

  const filterIds = params?.filterIds ? params.filterIds.split(",") : [];

  // Build where conditions
  const whereConditions: SQL[] = [];

  if (resumeIdFilter) {
    whereConditions.push(eq(resumes.resumeId, resumeIdFilter));
  }
  if (filterIds.length > 0) {
    whereConditions.push(inArray(resumes.resumeId, filterIds));
  } else {
    if (!showArchived) {
      whereConditions.push(ne(resumes.status, "ARCHIVED"));
    }

    if (statusFilter && statusFilter !== "all") {
      whereConditions.push(eq(resumes.status, statusFilter));
    }

    if (query) {
      whereConditions.push(
        or(
          ilike(resumes.gcsFilePath, `%${query}%`),
          ilike(resumes.resumeId, `%${query}%`)
        ) as SQL
      );
    }
  }

  const where =
    whereConditions.length > 0 ? and(...whereConditions) : undefined;

  // Get counts
  const [totalResumes] = await db
    .select({ count: count() })
    .from(resumes)
    .where(where);

  const [pendingCount] = await db
    .select({ count: count() })
    .from(resumes)
    .where(eq(resumes.status, "PROCESSING"));

  const [completedCount] = await db
    .select({ count: count() })
    .from(resumes)
    .where(eq(resumes.status, "COMPLETED"));

  // Query resumes with candidate data using LEFT JOIN
  const resumeData = await db
    .select({
      resume: resumes,
      candidate: candidates,
    })
    .from(resumes)
    .leftJoin(candidates, eq(resumes.candidateId, candidates.candidateId))
    .where(where)
    .orderBy(desc(resumes.createdAt));

  // console.log("Resume Data:", resumeData);

  // Transform resume data for the table
  const tableData = resumeData.map(({ resume: r, candidate: c }) => {
    return {
      id: r.resumeId,
      uploadDate: r.createdAt ? r.createdAt.toISOString() : "N/A",
      url: `https://storage.googleapis.com/${r.gcsBucket}/${r.gcsFilePath}`,
      status: r.status,
      isPaid: r.isPaid,
      error_message: r.errorMessage,
      candidateName: c ? `${c.firstName || ""} ${c.lastName || ""}`.trim() : null,
      candidateEmail: c?.email || null,
    };
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl">Resume Management</h1>
          {resumeIdFilter && (
            <p className="mt-1 text-muted-foreground">
              Filtered by Resume ID: {resumeIdFilter.slice(0, 8)}...
            </p>
          )}
        </div>
        <UploadDialog />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-6">
          <h3 className="font-medium text-muted-foreground text-sm">
            Total Resumes
          </h3>
          <p className="mt-2 font-bold text-3xl">{totalResumes?.count ?? 0}</p>
        </Card>

        <Card className="p-6">
          <h3 className="font-medium text-muted-foreground text-sm">
            Pending Processing
          </h3>
          <p className="mt-2 font-bold text-3xl">{pendingCount?.count ?? 0}</p>
        </Card>

        <Card className="p-6">
          <h3 className="font-medium text-muted-foreground text-sm">
            Completed
          </h3>
          <p className="mt-2 font-bold text-3xl">
            {completedCount?.count ?? 0}
          </p>
        </Card>
      </div>

      <Card className="p-6">
        <div className="mb-4 flex flex-wrap gap-4">
          <div className="min-w-[200px] flex-1">
            <StatusFilter />
          </div>
          <StudentNameSearch />
        </div>
        <DataTable columns={columns} data={tableData} />
      </Card>
    </div>
  );
}
