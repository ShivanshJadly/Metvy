// components/selected-resume-bar.tsx
// "use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronUp, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SelectedResumesBarProps = {
  uuids: string[];
  onSubmit: () => void;
  onClear: () => void;
  onToggle: (uuid: string) => void;
};

const truncateUuid = (uuid: string, start = 8, end = 4) => {
  return `${uuid.substring(0, start)}…${uuid.substring(uuid.length - end)}`;
};

export function SelectedResumesBar({
  uuids,
  onSubmit,
  onClear,
  onToggle,
}: SelectedResumesBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (uuids.length === 0) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="fixed right-4 bottom-4 left-4 z-40 md:right-4 md:left-auto md:w-96"
        exit={{ opacity: 0, y: 20 }}
        initial={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.2 }}
      >
        {/* Collapsed Header */}
        <motion.div
          className={cn(
            "rounded-lg border border-slate-200 bg-white shadow-lg",
            "cursor-pointer transition-all duration-200",
            isExpanded && "rounded-b-none border-b-0"
          )}
          onClick={() => !isExpanded && setIsExpanded(true)}
          whileHover={{ boxShadow: "0 12px 24px rgba(0,0,0,0.1)" }}
        >
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100">
                <span className="font-bold text-blue-600 text-sm">
                  {uuids.length}
                </span>
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 text-sm">
                  {uuids.length === 1
                    ? "1 Resume Selected"
                    : `${uuids.length} Resumes Selected`}
                </p>
                <p className="text-slate-500 text-xs">
                  {isExpanded ? "Click to collapse" : "Click to expand"}
                </p>
              </div>
            </div>
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronUp className="h-5 w-5 text-slate-600" />
            </motion.div>
          </div>
        </motion.div>

        {/* Expanded Content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              animate={{ opacity: 1, height: "auto" }}
              className="rounded-b-lg border border-slate-200 border-t-0 bg-white shadow-lg"
              exit={{ opacity: 0, height: 0 }}
              initial={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              {/* UUID List */}
              <div className="max-h-64 space-y-2 overflow-y-auto border-slate-100 border-b px-4 py-3">
                {uuids.map((uuid) => (
                  <motion.div
                    animate={{ opacity: 1, x: 0 }}
                    className="group flex items-center justify-between rounded-lg bg-slate-50 p-3 transition-colors hover:bg-slate-100"
                    exit={{ opacity: 0, x: -10 }}
                    initial={{ opacity: 0, x: -10 }}
                    key={uuid}
                  >
                    <code className="font-mono text-slate-700 text-xs">
                      {truncateUuid(uuid)}
                    </code>
                    <button
                      className={cn(
                        "rounded p-1.5 transition-colors",
                        "opacity-0 group-hover:opacity-100 md:opacity-100",
                        "text-red-600 hover:bg-red-100"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggle(uuid);
                      }}
                      title="Remove resume"
                      type="button"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </motion.div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-2 bg-slate-50 p-4">
                <Button
                  className="flex-1 bg-blue-600 text-white hover:bg-blue-700"
                  onClick={() => {
                    onSubmit();
                    setIsExpanded(false);
                  }}
                  size="sm"
                >
                  <Check className="mr-2 h-4 w-4" />
                  Send Request
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => {
                    onClear();
                    setIsExpanded(false);
                  }}
                  size="sm"
                  variant="outline"
                >
                  Clear All
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}

// END components/selected-resume-bar.tsx
