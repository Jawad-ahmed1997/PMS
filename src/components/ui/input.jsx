import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef(function Input({ className, invalid = false, ...props }, ref) {
  return <input ref={ref} className={cn("flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/70 transition-[border-color,box-shadow] duration-150 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50", invalid && "border-destructive focus-visible:ring-destructive/20", className)} aria-invalid={invalid || props["aria-invalid"] || undefined} {...props} />;
});

Input.displayName = "Input";
