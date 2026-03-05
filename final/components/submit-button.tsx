"use client";

import { useFormStatus } from "react-dom";

import { LoaderIcon } from "@/components/icons";

import { Button } from "./ui/button";

export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();

  return (
    <Button
      aria-disabled={pending}
      className="relative"
      disabled={pending}
      type={pending ? "button" : "submit"}
    >
      {children}

      {pending && (
        <span className="absolute right-4 animate-spin">
          <LoaderIcon />
        </span>
      )}

      <output aria-live="polite" className="sr-only">
        {pending ? "Loading" : "Submit form"}
      </output>
    </Button>
  );
}
