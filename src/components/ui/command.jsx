"use client";

import { createContext, useContext, useState } from "react";
import { cn } from "@/lib/utils";

const CommandContext = createContext(null);

export function Command({ className, children, onKeyDown, value, onValueChange, ...props }) {
  const [internalQuery, setInternalQuery] = useState("");
  const query = value ?? internalQuery;
  const setQuery = onValueChange ?? setInternalQuery;
  const [activeIndex, setActiveIndex] = useState(0);
  const context = { query, setQuery, activeIndex, setActiveIndex };

  const handleKeyDown = (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const items = event.currentTarget.querySelectorAll("[data-command-item]");
      const next = Math.max(0, Math.min(items.length - 1, activeIndex + direction));
      setActiveIndex(next);
      items[next]?.focus?.();
    }
    onKeyDown?.(event);
  };

  return (
    <CommandContext.Provider value={context}>
      <div
        role="application"
        className={cn("flex h-full w-full flex-col overflow-hidden rounded-xl bg-popover text-popover-foreground", className)}
        onKeyDown={handleKeyDown}
        {...props}
      >
        {children}
      </div>
    </CommandContext.Provider>
  );
}

export function CommandInput({ className, ...props }) {
  const { query, setQuery } = useContext(CommandContext);
  return (
    <input
      value={query}
      onChange={(event) => setQuery(event.target.value)}
      className={cn("flex h-10 w-full border-b border-border bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/20", className)}
      {...props}
    />
  );
}

export function CommandGroup({ className, ...props }) {
  return <div className={cn("overflow-hidden p-1.5 text-foreground", className)} {...props} />;
}

export function CommandItem({ className, value, onSelect, children, ...props }) {
  const context = useContext(CommandContext);
  const label = value ?? (typeof children === "string" ? children : "");
  const visible = !context.query || label.toLowerCase().includes(context.query.toLowerCase());

  if (!visible) return null;

  const selected = false;
  return (
    <div
      data-command-item
      role="option"
      tabIndex={0}
      aria-selected={selected}
      className={cn("relative flex cursor-pointer select-none items-center rounded-lg px-3 py-2 text-sm outline-none transition-colors duration-200 hover:bg-muted focus:bg-muted", selected && "bg-muted", className)}
      onMouseEnter={() => undefined}
      onClick={() => onSelect?.(value)}
      {...props}
    >
      {children}
    </div>
  );
}

export function CommandEmpty({ className, ...props }) {
  return <div className={cn("py-6 text-center text-sm text-muted-foreground", className)} {...props} />;
}
