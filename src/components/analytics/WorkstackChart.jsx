"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) {
    return "0m";
  }
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours && minutes) {
    return `${hours}h ${minutes}m`;
  }
  if (hours) {
    return `${hours}h`;
  }
  return `${minutes}m`;
}

function formatDayLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleDateString([], { weekday: "short", day: "numeric" });
}

const chartConfig = {
  workSeconds: { label: "Work", color: "var(--color-work)" },
  breakSeconds: { label: "Break", color: "var(--color-break)" },
  idleSeconds: { label: "Idle", color: "var(--color-idle)" },
};

export default function WorkstackChart({ perDay, minWidth }) {
  const data = useMemo(() => {
    return (perDay ?? []).map((entry) => ({
      date: entry.date,
      workSeconds: entry.totals?.workSeconds ?? 0,
      breakSeconds: entry.totals?.breakSeconds ?? 0,
      idleSeconds: entry.totals?.idleSeconds ?? 0,
    }));
  }, [perDay]);

  return (
    <div className="h-72 w-full overflow-x-auto rounded-xl border border-border/60 bg-muted/10 p-3">
      <div style={{ minWidth: minWidth ?? "100%", height: "100%" }}>
        <ChartContainer config={chartConfig} className="h-full min-h-0 aspect-auto">
          <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            barSize={28}
            barGap={8}
            margin={{ top: 12, right: 20, left: 4, bottom: 12 }}
          >
            <CartesianGrid vertical={false} stroke="var(--color-border)" strokeOpacity={0.55} strokeDasharray="3 5" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDayLabel}
              axisLine={false}
              tickLine={false}
              tickMargin={10}
              tick={{ fill: "var(--color-text-muted)", fontSize: 11 }}
            />
            <YAxis
              tickFormatter={(value) => formatDuration(value)}
              axisLine={false}
              tickLine={false}
              tickMargin={8}
              tick={{ fill: "var(--color-text-muted)", fontSize: 11 }}
            />
            <ChartTooltip
              cursor={{ fill: "var(--color-muted-bg)" }}
              content={<ChartTooltipContent labelFormatter={(label) => formatDayLabel(label)} formatter={(value) => formatDuration(value)} />}
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar
              dataKey="workSeconds"
              stackId="day"
              fill="var(--color-work)"
              name="Work"
              radius={[5, 5, 0, 0]}
              animationDuration={520}
              animationEasing="ease-out"
            />
            <Bar
              dataKey="breakSeconds"
              stackId="day"
              fill="var(--color-break)"
              name="Break"
              radius={[5, 5, 0, 0]}
              animationDuration={520}
              animationEasing="ease-out"
            />
            <Bar
              dataKey="idleSeconds"
              stackId="day"
              fill="var(--color-idle)"
              name="Idle"
              radius={[5, 5, 0, 0]}
              animationDuration={520}
              animationEasing="ease-out"
            />
          </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </div>
    </div>
  );
}
