"use client";

import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { useToast } from "./ToastProvider";

export const buttonVariants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-[background-color,border-color,color,box-shadow,opacity] duration-150 ease-out outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50", { variants: { variant: { default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90", primary: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90", destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90", outline: "border border-border bg-background hover:border-foreground/20 hover:bg-muted", secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80", success: "bg-emerald-600 text-white hover:bg-emerald-700", warning: "bg-amber-500 text-slate-950 hover:bg-amber-600", info: "bg-sky-600 text-white hover:bg-sky-700", danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90", ghost: "hover:bg-muted hover:text-foreground", link: "text-primary underline-offset-4 hover:underline" }, size: { default: "h-10 px-4 py-2", sm: "h-9 rounded-lg px-3", md: "h-10 px-4", lg: "h-11 rounded-lg px-5", icon: "h-10 w-10" } }, defaultVariants: { variant: "default", size: "default" } });
export function Button({ className, variant, size, label, toast, onClick, disabled, children, ...props }) {
  const { addToast } = useToast();
  const handleClick = (event) => {
    if (disabled) return;
    onClick?.(event);
    if (toast) addToast(toast);
  };
  return <button className={cn(buttonVariants({ variant, size, className }))} disabled={disabled} onClick={handleClick} {...props}>{children ?? label}</button>;
}
