"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export function StudentNameSearch() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();

  const [searchTerm, setSearchTerm] = useState(searchParams.get("studentName") || "");
  const [isLoading, setIsLoading] = useState(false);

  // Sync searchTerm with URL params
  useEffect(() => {
    const urlSearchTerm = searchParams.get("studentName");
    if (!urlSearchTerm) {
      setSearchTerm("");
    }
  }, [searchParams]);

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      clearSearch();
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/upload/api/search-student?name=${encodeURIComponent(searchTerm)}`);
      const data = await res.json();

      const params = new URLSearchParams(searchParams);

      if (data.resumeIds && data.resumeIds.length > 0) {
        params.set("filterIds", data.resumeIds.join(","));
        params.set("studentName", searchTerm);
        toast.success(`Found ${data.resumeIds.length} students`);
      } else {
        params.delete("filterIds");
        params.delete("studentName");
        toast.error("No students found with that name");
      }

      replace(`${pathname}?${params.toString()}`);
    } catch (error) {
      console.error(error);
      toast.error("Failed to search students");
    } finally {
      setIsLoading(false);
    }
  };

  const clearSearch = () => {
    setSearchTerm("");
    const params = new URLSearchParams(searchParams);
    params.delete("filterIds");
    params.delete("studentName");
    replace(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <Input
          placeholder="Search student name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSearch();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              clearSearch();
            }
          }}
          className="w-[200px] pr-8"
        />
        {searchTerm && (
          <button
            onClick={(e) => {
              e.preventDefault();
              clearSearch();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <Button
        onClick={handleSearch}
        disabled={isLoading}
        variant="secondary"
        size="sm"
        className="flex cursor-pointer items-center transition-all duration-75 ease-in-out hover:scale-105"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <Search className="mr-2 h-4 w-4" />
            Search
          </>
        )}
      </Button>
      {searchParams.get("filterIds") && (
        <Button
          onClick={clearSearch}
          variant="outline"
          size="sm"
          className="text-gray-600"
        >
          Clear
        </Button>
      )}
    </div>
  );
}
