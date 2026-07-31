import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Textarea = forwardRef(function Textarea({ className, invalid = false, ...props }, ref) {
  return <textarea ref={ref} className={cn("flex min-h-20 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50", invalid && "border-destructive", className)} aria-invalid={invalid || props["aria-invalid"] || undefined} {...props} />;
});

Textarea.displayName = "Textarea";
