// app/upload/upload-dialog.tsx
"use client";

import { Upload, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { uploadResume } from "./actions";

export function UploadDialog() {
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>(
    {}
  );
  const [open, setOpen] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      return;
    }

    setIsUploading(true);
    let successCount = 0;
    let errorCount = 0;

    for (const file of files) {
      try {
        setUploadProgress((prev) => ({ ...prev, [file.name]: 10 }));
        toast.info(`Uploading ${file.name} to GCS...`);

        // Convert file to base64
        const base64 = await fileToBase64(file);
        setUploadProgress((prev) => ({ ...prev, [file.name]: 50 }));

        // Upload to GCS (Cloud Function will handle the rest)
        const result = await uploadResume({
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          fileData: base64,
        });

        if (!result.success) {
          throw new Error(result.error || "Upload failed");
        }

        setUploadProgress((prev) => ({ ...prev, [file.name]: 100 }));
        toast.success(`${file.name} uploaded! Cloud Function will process it.`);
        successCount++;
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error);
        toast.error(
          `Failed: ${file.name} - ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
        errorCount++;
      }
    }

    // Show summary
    if (successCount > 0) {
      toast.success(
        `${successCount} file${successCount > 1 ? "s" : ""} uploaded successfully!`
      );
    }
    if (errorCount > 0) {
      toast.error(
        `${errorCount} file${errorCount > 1 ? "s" : ""} failed to upload.`
      );
    }

    // Reset and close
    setIsUploading(false);
    setFiles([]);
    setUploadProgress({});
    setOpen(false);

    // Refresh after a short delay to allow Cloud Function to process
    setTimeout(() => {
      window.location.reload();
    }, 2000);
  };

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button>
          <Upload className="mr-2 h-4 w-4" />
          Upload Resumes
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Upload Resumes</DialogTitle>
          <DialogDescription>
            Upload PDF or DOCX files. The Cloud Function will automatically
            process them.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File Input */}
          <div className="rounded-lg border-2 border-dashed p-6 text-center transition-colors hover:border-primary">
            <input
              accept=".pdf,.doc,.docx"
              className="hidden"
              disabled={isUploading}
              id="file-upload"
              multiple
              onChange={handleFileSelect}
              type="file"
            />
            <label className="cursor-pointer" htmlFor="file-upload">
              <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-2 font-medium text-sm">
                Click to browse or drag and drop
              </p>
              <p className="mt-1 text-muted-foreground text-xs">
                Supports PDF, DOC, DOCX (max 10MB)
              </p>
            </label>
          </div>

          {/* Selected Files List */}
          {files.length > 0 && (
            <div className="space-y-2">
              <p className="font-medium text-sm">
                Selected Files ({files.length}):
              </p>
              <div className="max-h-48 space-y-2 overflow-y-auto">
                {files.map((file, i) => (
                  <div
                    className="flex items-center justify-between rounded bg-muted p-2"
                    key={i}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{file.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      {uploadProgress[file.name] !== undefined && (
                        <Progress
                          className="mt-1"
                          value={uploadProgress[file.name]}
                        />
                      )}
                    </div>
                    {!isUploading && (
                      <Button
                        className="ml-2"
                        onClick={() => removeFile(i)}
                        size="icon"
                        variant="ghost"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload Button */}
          {files.length > 0 && (
            <Button
              className="w-full"
              disabled={isUploading}
              onClick={handleUpload}
            >
              {isUploading
                ? "Uploading to GCS..."
                : `Upload ${files.length} ${files.length === 1 ? "File" : "Files"}`}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Helper function to convert file to base64
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
  });
}
