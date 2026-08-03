import { cn } from "@/lib/utils";
export function Skeleton({ className, ...props }) { return <div className={cn("animate-pulse rounded-lg bg-[color:var(--color-skeleton)]", className)} {...props} />; }
