"use client";

import { createContext, useContext } from "react";
import { cn } from "@/lib/utils";

const ToggleGroupContext = createContext(null);

export function ToggleGroup({ type = "single", value, onValueChange, className, children, ...props }) {
  return (
    <ToggleGroupContext.Provider value={{ type, value, onValueChange }}>
      <div role="group" className={cn("inline-flex items-center rounded-lg", className)} {...props}>
        {children}
      </div>
    </ToggleGroupContext.Provider>
  );
}

export function ToggleGroupItem({ value, className, children, ...props }) {
  const group = useContext(ToggleGroupContext);
  const pressed = group?.value === value;
  return (
    <button
      type="button"
      aria-pressed={pressed}
      data-state={pressed ? "on" : "off"}
      className={cn("inline-flex h-9 items-center justify-center gap-2 border border-border bg-transparent px-3 text-xs font-semibold text-muted-foreground transition-colors duration-200 first:rounded-l-lg last:rounded-r-lg first:border-r-0 last:border-l-0 hover:bg-muted hover:text-foreground focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground", className)}
      onClick={() => group?.onValueChange?.(pressed && group.type === "single" ? "" : value)}
      {...props}
    >
      {children}
    </button>
  );
}

