"use client";

import { ExternalLink, X } from "lucide-react";
import { useState } from "react";
import type { Resume } from "@/app/upload/columns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type UuidTag = {
  id: string;
  uuid: string;
};

type UuidBulkSelectorProps = {
  data: Resume[];
};

export function UuidBulkSelector({ data }: UuidBulkSelectorProps) {
  const [input, setInput] = useState("");
  const [tags, setTags] = useState<UuidTag[]>([]);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: "success" | "error" | "warning";
    message: string;
  } | null>(null);

  // UUID validation regex
  const isValidUuid = (str: string) => {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str.trim());
  };

  // Find resume by ID
  const findResumeById = (id: string): Resume | undefined => {
    return data.find((resume) => resume.id === id);
  };

  // Show feedback message for 3 seconds
  const showFeedback = (
    type: "success" | "error" | "warning",
    message: string
  ) => {
    setFeedbackMessage({ type, message });
    setTimeout(() => setFeedbackMessage(null), 3000);
  };

  // Parse input and extract UUIDs (handle space, comma, or newline separated)
  const parseUuids = (inputStr: string): string[] => {
    // Split by comma, space, or newline
    const uuids = inputStr
      .split(/[\s,\n]+/) // Split by whitespace, commas, or newlines
      .map((uuid) => uuid.trim())
      .filter((uuid) => uuid.length > 0);

    return uuids;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && input.trim()) {
      e.preventDefault();

      const uuidsToAdd = parseUuids(input);

      let addedCount = 0;
      let duplicateCount = 0;
      let notFoundCount = 0;
      let invalidCount = 0;
      const failedUuids: string[] = [];

      const newTags: UuidTag[] = [];

      uuidsToAdd.forEach((uuid) => {
        // Validate UUID format
        if (!isValidUuid(uuid)) {
          invalidCount++;
          failedUuids.push(`${uuid.slice(0, 8)}... (invalid format)`);
          return;
        }

        // Check for duplicates in existing tags
        if (tags.some((tag) => tag.uuid === uuid)) {
          duplicateCount++;
          failedUuids.push(`${uuid.slice(0, 8)}... (duplicate)`);
          return;
        }

        // Check if UUID exists in data
        const resume = findResumeById(uuid);
        if (!resume) {
          notFoundCount++;
          failedUuids.push(`${uuid.slice(0, 8)}... (not found)`);
          return;
        }

        // Add valid UUID
        const newTag: UuidTag = {
          id: Math.random().toString(36).substr(2, 9),
          uuid,
        };
        newTags.push(newTag);
        addedCount++;
      });

      // Add all valid tags at once
      if (newTags.length > 0) {
        setTags([...tags, ...newTags]);

        // Show success message
        let message = `Added ${addedCount} resume${addedCount !== 1 ? "s" : ""}`;
        if (duplicateCount > 0 || notFoundCount > 0 || invalidCount > 0) {
          message += ` • ${duplicateCount + notFoundCount + invalidCount} skipped`;
        }
        showFeedback("success", message);
      } else if (uuidsToAdd.length > 0) {
        // All entries failed
        showFeedback(
          "error",
          `Failed to add any resumes: ${failedUuids.join(", ")}`
        );
      }

      setInput("");
    }
  };

  const removeTag = (id: string) => {
    setTags(tags.filter((tag) => tag.id !== id));
    setSelectedTags((prev) => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  const toggleSelection = (id: string) => {
    setSelectedTags((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    setSelectedTags(new Set(tags.map((tag) => tag.id)));
  };

  const clearSelection = () => {
    setSelectedTags(new Set());
  };

  const bulkOpen = () => {
    const selectedUuids = tags
      .filter((tag) => selectedTags.has(tag.id))
      .map((tag) => tag.uuid);

    if (selectedUuids.length === 0) {
      alert("Please select at least one UUID");
      return;
    }

    // Open each resume URL with a small delay to prevent browser popup blocking
    selectedUuids.forEach((uuid, index) => {
      setTimeout(() => {
        const resume = findResumeById(uuid);
        if (resume?.url) {
          window.open(resume.url, "_blank");
        }
      }, index * 200); // 200ms delay between each open
    });

    showFeedback(
      "success",
      `Opening ${selectedUuids.length} resume${selectedUuids.length !== 1 ? "s" : ""}...`
    );
  };

  // Get selected resumes for table display
  const selectedResumes = tags
    .filter((tag) => selectedTags.has(tag.id))
    .map((tag) => findResumeById(tag.uuid))
    .filter((resume) => resume !== undefined) as Resume[];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "bg-green-500";
      case "PROCESSING":
        return "bg-blue-500";
      case "PENDING":
        return "bg-yellow-500";
      case "FAILED":
        return "bg-red-500";
      case "ARCHIVED":
        return "bg-gray-500";
      default:
        return "bg-gray-500";
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "No date";

    if (dateString.includes("/")) {
      const [day, month, year] = dateString.split("/");
      const date = new Date(
        Number.parseInt(year, 10),
        Number.parseInt(month, 10) - 1,
        Number.parseInt(day, 10)
      );
      return date.toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    }

    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="w-full space-y-6">
      {/* Input Section */}
      <div className="space-y-2">
        <Input
          className="w-full"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Paste UUIDs (space, comma, or newline separated) and press Enter"
          type="text"
          value={input}
        />

        {feedbackMessage && (
          <div
            className={`rounded p-2 text-xs ${
              feedbackMessage.type === "success"
                ? "bg-green-50 text-green-700"
                : feedbackMessage.type === "error"
                  ? "bg-red-50 text-red-700"
                  : "bg-yellow-50 text-yellow-700"
            }`}
          >
            {feedbackMessage.message}
          </div>
        )}
      </div>

      {/* Tags Display */}
      {tags.length > 0 && (
        <div className="space-y-3 rounded-lg border bg-secondary/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span className="font-medium text-sm">
              {tags.length} Resume{tags.length !== 1 ? "s" : ""} added •{" "}
              {selectedTags.size} selected
            </span>
            <div className="flex flex-wrap gap-2">
              {selectedTags.size > 0 && (
                <>
                  <Button onClick={clearSelection} size="sm" variant="outline">
                    Clear Selection ({selectedTags.size})
                  </Button>
                  <Button className="gap-2" onClick={bulkOpen} size="sm">
                    <ExternalLink className="h-4 w-4" />
                    Open Selected ({selectedTags.size})
                  </Button>
                </>
              )}
              {selectedTags.size === 0 && (
                <Button onClick={selectAll} size="sm" variant="outline">
                  Select All
                </Button>
              )}
            </div>
          </div>

          {/* UUID Tags with Checkboxes */}
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <div
                className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 transition-colors hover:bg-accent"
                key={tag.id}
              >
                <Checkbox
                  checked={selectedTags.has(tag.id)}
                  onCheckedChange={() => toggleSelection(tag.id)}
                />
                <Badge
                  className="cursor-pointer font-mono text-xs"
                  onClick={() => toggleSelection(tag.id)}
                  variant="outline"
                >
                  {tag.uuid.slice(0, 8)}...
                </Badge>
                <button
                  className="ml-1 rounded-full p-0.5 hover:bg-destructive/20"
                  onClick={() => removeTag(tag.id)}
                  title="Remove UUID"
                  type="button"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selected Resumes Table */}
      {selectedResumes.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg">
              Selected Resumes ({selectedResumes.length})
            </h3>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedTags.size === tags.length}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          selectAll();
                        } else {
                          clearSelection();
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Upload Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedResumes.map((resume) => {
                  const tagId = tags.find((t) => t.uuid === resume.id)?.id;
                  const isChecked = tagId && selectedTags.has(tagId);

                  return (
                    <TableRow key={resume.id}>
                      <TableCell>
                        {tagId && (
                          <Checkbox
                            checked={isChecked || false}
                            onCheckedChange={() => toggleSelection(tagId)}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs">
                          {resume.id.slice(0, 8)}...
                        </span>
                      </TableCell>
                      <TableCell>{formatDate(resume.uploadDate)}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(resume.status)}>
                          {resume.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={resume.isPaid ? "default" : "secondary"}
                        >
                          {resume.isPaid ? "Paid" : "Unpaid"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          onClick={() => window.open(resume.url, "_blank")}
                          size="icon"
                          title="Download Resume"
                          variant="ghost"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
