// app/upload/api/students/[id]/route.ts
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { db } from "@/lib/db";
import {
  candidates,
  education,
  internships,
  jobs,
  projects,
  resumes,
} from "@/lib/db/schema";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json(
      {
        code: "unauthorized",
        message: "You must be an admin to access this resource",
      },
      { status: 401 }
    );
  }

  const { id } = await context.params;

  try {
    // Get resume data
    const [resume] = await db
      .select()
      .from(resumes)
      .where(eq(resumes.resumeId, id))
      .limit(1);

    if (!resume) {
      return NextResponse.json(
        { code: "not_found", message: "Resume not found" },
        { status: 404 }
      );
    }

    // Check if resume has an associated candidate
    if (!resume.candidateId) {
      return NextResponse.json(
        { code: "processing", message: "Resume is still being processed" },
        { status: 202 } // 202 Accepted
      );
    }

    // Now resume.candidateId is guaranteed to be non-null
    const [student] = await db
      .select()
      .from(candidates)
      .where(eq(candidates.candidateId, resume.candidateId))
      .limit(1);

    if (!student) {
      return NextResponse.json(
        { code: "not_found", message: "Student not found" },
        { status: 404 }
      );
    }

    // Get all related data
    const [
      educationHistory,
      workExperience,
      internshipHistory,
      projectHistory,
    ] = await Promise.all([
      db
        .select()
        .from(education)
        .where(eq(education.candidateId, student.candidateId)),
      db.select().from(jobs).where(eq(jobs.candidateId, student.candidateId)),
      db
        .select()
        .from(internships)
        .where(eq(internships.candidateId, student.candidateId)),
      db
        .select()
        .from(projects)
        .where(eq(projects.candidateId, student.candidateId)),
    ]);

    return NextResponse.json({
      ...student,
      education: educationHistory,
      jobs: workExperience,
      internships: internshipHistory,
      projects: projectHistory,
    });
  } catch (error) {
    console.error("Failed to fetch student details:", error);
    return NextResponse.json(
      {
        code: "bad_request:database",
        message: "Failed to fetch student details",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json(
      { code: "unauthorized", message: "Unauthorized" },
      { status: 401 }
    );
  }

  const { id } = await context.params;

  try {
    const [resume] = await db
      .select()
      .from(resumes)
      .where(eq(resumes.resumeId, id))
      .limit(1);

    if (!resume) {
      return NextResponse.json(
        { code: "not_found", message: "Resume not found" },
        { status: 404 }
      );
    }

    // Delete all related data in a transaction
    const candidateId = resume.candidateId;

    if (!candidateId) {
      throw new Error("Cannot delete resume without associated candidate");
    }

    await db.transaction(async (tx) => {
      await tx.delete(education).where(eq(education.candidateId, candidateId));
      await tx.delete(jobs).where(eq(jobs.candidateId, candidateId));
      await tx
        .delete(internships)
        .where(eq(internships.candidateId, candidateId));
      await tx.delete(projects).where(eq(projects.candidateId, candidateId));
      await tx.delete(resumes).where(eq(resumes.candidateId, candidateId));
      await tx
        .delete(candidates)
        .where(eq(candidates.candidateId, candidateId));
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete student:", error);
    return NextResponse.json(
      {
        code: "bad_request:database",
        message: "Failed to delete student data",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
