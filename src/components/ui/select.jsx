"use client";

import * as SelectPrimitive from "@radix-ui/react-select";
import { Children } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function Select({ children, className, onChange, onValueChange, ...props }) {
  const childList = Children.toArray(children);
  const isNative = childList.some((child) => child?.type === "option");
  if (isNative) return <select className={cn("h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring", className)} onChange={(event) => { onChange?.(event); onValueChange?.(event.target.value); }} {...props}>{children}</select>;
  return <SelectPrimitive.Root onValueChange={onValueChange} {...props}>{children}</SelectPrimitive.Root>;
}
export const SelectGroup = SelectPrimitive.Group;
export const SelectLabel = ({ className, ...props }) => <SelectPrimitive.Label className={cn("px-2 py-1.5 text-xs font-semibold text-muted-foreground", className)} {...props} />;
export const SelectValue = SelectPrimitive.Value;
export const SelectTrigger = ({ className, children, ...props }) => <SelectPrimitive.Trigger className={cn("flex h-10 w-full items-center justify-between rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50", className)} {...props}>{children}<SelectPrimitive.Icon asChild><ChevronDown className="h-4 w-4 opacity-50" /></SelectPrimitive.Icon></SelectPrimitive.Trigger>;
export const SelectContent = ({ className, children, position = "popper", ...props }) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      position={position}
      className={cn(
        "relative z-[150] max-h-60 min-w-[10rem] overflow-hidden rounded-xl border border-border/80 bg-popover text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        position === "popper" &&
          "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        className
      )}
      {...props}
    >
      <SelectPrimitive.Viewport
        className={cn(
          "p-1.5",
          position === "popper" &&
            "w-full min-w-[var(--radix-select-trigger-width)]"
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
);
export const SelectItem = ({ className, children, ...props }) => <SelectPrimitive.Item className={cn("relative flex w-full cursor-default select-none items-center rounded-lg py-2 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50", className)} {...props}><span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center"><SelectPrimitive.ItemIndicator><Check className="h-4 w-4" /></SelectPrimitive.ItemIndicator></span><SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText></SelectPrimitive.Item>;
