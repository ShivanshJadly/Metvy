// lib/gcs.ts
import { Storage } from "@google-cloud/storage";

import { env } from "@/lib/env";

let storage: Storage | null = null;

export function getStorageClient() {
  if (storage) {
    return storage;
  }

  // Only initialize when actually needed (runtime)
  storage = new Storage({
    projectId: env.GOOGLE_CLOUD_PROJECT_ID,
  });

  return storage;
}

export function getBucket(bucketName?: string) {
  // Don't validate bucket name at import time
  // Only when the function is actually called
  const name = bucketName || env.GOOGLE_CLOUD_STORAGE_BUCKET;

  if (!name) {
    throw new Error("GCS bucket name not configured");
  }

  return getStorageClient().bucket(name);
}

/**
 * Upload a file to Google Cloud Storage
 */
export async function uploadToGCS(
  bucketName: string,
  filePath: string,
  fileBuffer: Buffer,
  contentType: string
): Promise<void> {
  try {
    storage = getStorageClient();
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(filePath);

    await file.save(fileBuffer, {
      contentType,
      metadata: {
        cacheControl: "public, max-age=31536000",
        uploadedAt: new Date().toISOString(),
        uploadedBy: "frontend",
      },
    });

    // console.log(`✓ File uploaded to gs://${bucketName}/${filePath}`);
  } catch (error) {
    console.error("GCS upload error:", error);
    throw new Error(
      `Failed to upload to GCS: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Test GCS connection - now tries to upload a test file instead
 */
export async function testGCSConnection(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET;
    if (!bucketName) {
      return {
        success: false,
        error: "GOOGLE_CLOUD_STORAGE_BUCKET not configured",
      };
    }

    // Instead of checking if bucket exists (requires storage.buckets.get),
    // try to upload a test file (only requires storage.objects.create)

    storage = getStorageClient();
    const bucket = storage.bucket(bucketName);
    const testFile = bucket.file("test/.connection-test");

    await testFile.save(Buffer.from("test"), {
      contentType: "text/plain",
    });

    // Clean up test file
    await testFile.delete().catch(() => {
      // Ignore deletion errors
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function deleteFromGCS(
  bucketName: string,
  filePath: string
): Promise<void> {
  try {
    storage = getStorageClient();
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(filePath);

    await file.delete();
    // console.log(`✓ File deleted: gs://${bucketName}/${filePath}`);
  } catch (error) {
    console.error("GCS delete error:", error);
    throw new Error(
      `Failed to delete from GCS: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

export async function fileExistsInGCS(
  bucketName: string,
  filePath: string
): Promise<boolean> {
  try {
    storage = getStorageClient();
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(filePath);

    const [exists] = await file.exists();
    return exists;
  } catch (error) {
    console.error("GCS exists check error:", error);
    return false;
  }
}
