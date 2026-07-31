"use client";

import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "./input";
import { Button } from "./button";
import { cn } from "@/lib/utils";

export const PasswordInput = forwardRef(function PasswordInput({ className, invalid = false, ...props }, ref) {
  const [visible, setVisible] = useState(false);
  return <div className="relative"><Input ref={ref} type={visible ? "text" : "password"} invalid={invalid} className={cn("pr-10", className)} {...props} /><Button type="button" variant="ghost" size="icon" aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} onClick={() => setVisible((value) => !value)} className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground">{visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button></div>;
});

PasswordInput.displayName = "PasswordInput";
