// app/upload/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/app/(auth)/auth";
import { uploadToGCS } from "@/lib/gcs";

type UploadResumeParams = {
  fileName: string;
  fileType: string;
  fileSize: number;
  fileData: string;
};

export async function uploadResume(params: UploadResumeParams) {
  const session = await auth();

  if (!session?.user || session.user.role !== "admin") {
    return { success: false, error: "Unauthorized" };
  }

  const { fileName, fileType, fileSize, fileData } = params;

  // Validation
  if (!fileName || !fileType || !fileData) {
    return { success: false, error: "Invalid file data" };
  }

  const allowedTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];

  if (!allowedTypes.includes(fileType)) {
    return {
      success: false,
      error: "Invalid file type. Only PDF and DOCX allowed.",
    };
  }

  if (fileSize > 10 * 1024 * 1024) {
    return { success: false, error: "File too large. Max 10MB." };
  }

  const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET;
  if (!bucketName) {
    return {
      success: false,
      error: "GOOGLE_CLOUD_STORAGE_BUCKET not configured.",
    };
  }

  try {
    // Create unique file path
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const gcsFilePath = `resumes/${timestamp}-${sanitizedFileName}`;

    // Convert base64 to buffer
    const buffer = Buffer.from(fileData, "base64");

    // Upload to GCS directly (no pre-check)
    await uploadToGCS(bucketName, gcsFilePath, buffer, fileType);

    // Revalidate
    revalidatePath("/upload");

    return {
      success: true,
      message:
        "Resume uploaded successfully. Cloud Function will process it shortly.",
    };
  } catch (error) {
    console.error("Failed to upload resume:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
}
