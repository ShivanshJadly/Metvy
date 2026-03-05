import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";

import { getBucket } from "@/lib/gcs";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const bucket = getBucket();

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Generate a unique filename
    const timestamp = Date.now();
    const fileName = `${session.user.id}/${timestamp}-${file.name}`;

    // Create a write stream
    const blob = bucket.file(fileName);
    const blobStream = blob.createWriteStream({
      resumable: false,
      metadata: {
        contentType: file.type,
      },
    });

    // Convert file to buffer
    const buffer = await file.arrayBuffer();

    // Write the file
    await new Promise((resolve, reject) => {
      blobStream.on("error", reject);
      blobStream.on("finish", resolve);
      blobStream.end(Buffer.from(buffer));
    });

    // Make the file public
    await blob.makePublic();

    // Get the public URL
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

    return NextResponse.json({
      url: publicUrl,
      name: file.name,
      path: fileName,
      type: file.type,
      size: file.size,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bucket = getBucket();

    const [files] = await bucket.getFiles({
      prefix: `${session.user.id}/`,
    });

    const fileList = files.map((file) => ({
      name: file.name,
      size: file.metadata.size,
      type: file.metadata.contentType,
      updated: file.metadata.updated,
      url: `https://storage.googleapis.com/${bucket.name}/${file.name}`,
    }));

    return NextResponse.json(fileList);
  } catch (error) {
    console.error("List files error:", error);
    return NextResponse.json(
      { error: "Failed to list files" },
      { status: 500 }
    );
  }
}
