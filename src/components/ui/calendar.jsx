"use client";

import { DayPicker } from "react-day-picker";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Calendar({ className, classNames, ...props }) {
  return (
    <DayPicker
      showOutsideDays
      className={cn("p-1", className)}
      classNames={{
        months: "flex flex-col space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption:
          "relative flex min-h-16 flex-col items-center justify-end gap-2 px-1 pb-1",
        caption_label: "text-sm font-semibold",
        nav: "absolute left-1/2 top-2 flex -translate-x-1/2 ml-20 items-center justify-center gap-2",
        button_previous:
          "inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        button_next:
          "inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday:
          "w-9 rounded-lg text-center text-[0.8rem] font-normal text-muted-foreground",
        week: "mt-2 flex w-full",
        day: "relative h-9 w-9 rounded-lg p-0 text-center text-sm [&[aria-selected=true]>button]:rounded-lg [&[aria-selected=true]>button]:bg-primary [&[aria-selected=true]>button]:text-primary-foreground [&[aria-selected=true]>button:hover]:bg-primary [&[aria-selected=true]>button:hover]:text-primary-foreground",
        day_button:
          "inline-flex h-9 w-9 items-center justify-center rounded-lg font-normal transition-colors hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-disabled:text-muted-foreground/40",
        selected:
          "rounded-lg bg-primary text-primary-foreground",
        today: "rounded-lg border border-primary/50 bg-primary/5 text-primary",
        outside:
          "text-muted-foreground/50 [&[aria-selected=true]>button]:rounded-lg [&[aria-selected=true]>button]:bg-primary [&[aria-selected=true]>button]:text-primary-foreground [&[aria-selected=true]>button:hover]:bg-primary [&[aria-selected=true]>button:hover]:text-primary-foreground",
        disabled: "text-muted-foreground/40",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, ...iconProps }) =>
          orientation === "left" ? (
            <ChevronLeft {...iconProps} className="h-4 w-4" />
          ) : (
            <ChevronRight {...iconProps} className="h-4 w-4" />
          ),
      }}
      {...props}
    />
  );
}
