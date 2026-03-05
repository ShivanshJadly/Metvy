import { auth } from "@/app/(auth)/auth";
import { db } from "@/lib/db";
import { candidates, resumes } from "@/lib/db/schema";
import { and, eq, ilike, or } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");

  if (!name || name.length < 2) {
    return NextResponse.json({ resumeIds: [] });
  }

  try {
    // 1. Find candidates with matching names (partial match)
    // We only select the candidateId to keep it fast
    const matchingCandidates = await db
      .select({ candidateId: candidates.candidateId })
      .from(candidates)
      .where(
        or(
          ilike(candidates.firstName, `%${name}%`),
          ilike(candidates.lastName, `%${name}%`)
        )
      )
      .limit(50); // Limit results for performance

    const candidateIds = matchingCandidates.map((c) => c.candidateId);

    if (candidateIds.length === 0) {
      return NextResponse.json({ resumeIds: [] });
    }

    // 2. Get resume IDs for these candidates
    // This is a simple indexed lookup
    const matchingResumes = await db
      .select({ resumeId: resumes.resumeId })
      .from(resumes)
      .where(
        and(
          // In Drizzle, checking "IN array" requires a bit of care if array is empty,
          // but we checked length > 0 above.
          // Note: Drizzle's `inArray` import is needed if not using raw SQL
          // but here is a raw way or simple map if you prefer.
          // Better to use the proper helper:
        )
      );

    // Optimized single query approach:
    // Join only what's necessary to get resume IDs.
    // This is much lighter than your dashboard query because it selects ONE column.
    const results = await db
      .select({ resumeId: resumes.resumeId })
      .from(resumes)
      .innerJoin(candidates, eq(resumes.candidateId, candidates.candidateId))
      .where(
        or(
          ilike(candidates.firstName, `%${name}%`),
          ilike(candidates.lastName, `%${name}%`)
        )
      )
      .limit(50);

    const resumeIds = results.map((r) => r.resumeId);

    return NextResponse.json({ resumeIds });
  } catch (error) {
    console.error("Search failed:", error);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
