"use client";

import { createContext, useContext } from "react";
import { Legend, Tooltip } from "recharts";
import { cn } from "@/lib/utils";

const ChartContext = createContext(null);

export function ChartContainer({ config, className, children, ...props }) {
  const style = Object.fromEntries(
    Object.entries(config ?? {}).flatMap(([key, value]) => {
      const color = value?.color;
      return color ? [[`--color-${key}`, color]] : [];
    })
  );

  return (
    <ChartContext.Provider value={config ?? {}}>
      <div className={cn("flex aspect-video w-full justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line]:stroke-border/60 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border", className)} style={style} {...props}>
        {children}
      </div>
    </ChartContext.Provider>
  );
}

export function ChartTooltip({ content, ...props }) {
  return <Tooltip {...props} content={content ?? <ChartTooltipContent />} />;
}

export function ChartTooltipContent({ active, payload, label, className, labelFormatter, formatter, ...props }) {
  const config = useContext(ChartContext);
  if (!active || !payload?.length) return null;
  return (
    <div className={cn("grid min-w-[9rem] gap-2 rounded-xl border border-border/80 bg-popover px-3 py-2.5 text-xs text-popover-foreground shadow-md transition-opacity duration-200", className)} {...props}>
      <div className="font-medium text-foreground">{labelFormatter ? labelFormatter(label, payload) : label}</div>
      <div className="grid gap-1">
        {payload.filter((entry) => !config?.[entry.dataKey]?.hidden).map((entry) => {
          const item = config?.[entry.dataKey] ?? {};
          const value = formatter ? formatter(entry.value, entry.name, entry, payload) : entry.value;
          return (
            <div key={entry.dataKey ?? entry.name} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-2 text-muted-foreground">
                <span className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: item.color ?? entry.color }} />
                {item.label ?? entry.name}
              </span>
              <span className="font-medium tabular-nums">{value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ChartLegend({ content, ...props }) {
  return <Legend {...props} content={content ?? <ChartLegendContent />} />;
}

export function ChartLegendContent({ className, payload }) {
  const config = useContext(ChartContext);
  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pt-4 text-xs text-muted-foreground", className)}>
      {payload?.map((entry) => {
        const item = config?.[entry.dataKey] ?? {};
        return (
          <span key={entry.dataKey} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: item.color ?? entry.color }} />
            {item.label ?? entry.value}
          </span>
        );
      })}
    </div>
  );
}
