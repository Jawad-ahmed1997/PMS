"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

const TIME_ZONE = "Asia/Karachi";

const SEGMENT_COLORS = {
  NO_DUTY: "transparent",
  IDLE: "var(--color-idle)",
  WORK_TASK: "var(--color-work)",
  WORK_MANUAL: "var(--color-work-manual)",
  WORK_MANUAL_RUNNING: "var(--color-work-manual)",
  BREAK: "var(--color-break)",
};

const SEGMENT_LABELS = {
  NO_DUTY: "No duty",
  IDLE: "Idle",
  WORK_TASK: "Task work",
  WORK_MANUAL: "Manual work",
  WORK_MANUAL_RUNNING: "Manual work (running)",
  BREAK: "Break",
};

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatDuration(startAt, endAt) {
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "";
  }
  const seconds = Math.max(0, Math.floor((end - start) / 1000));
  if (!seconds) {
    return "0m";
  }
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours && remainder) {
    return `${hours}h ${remainder}m`;
  }
  if (hours) {
    return `${hours}h`;
  }
  return `${remainder}m`;
}

function formatDurationSeconds(value) {
  const totalSeconds = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  const totalMinutes = Math.round(totalSeconds / 60);
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

function formatBreakReason(reason) {
  if (!reason) {
    return "Other";
  }
  const value = reason.toString();
  if (value.includes(" & ")) {
    return value;
  }
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildBreakLabel(segment) {
  const reason = formatBreakReason(segment.breakReason);
  if (segment.breakType === "TASK_PAUSE") {
    return `Break (Task Pause) \u2013 ${reason}`;
  }
  return segment.breakReason ? `Break (${reason})` : "Break";
}

function getWidthPercent(range, start, end) {
  const total = range.end.getTime() - range.start.getTime();
  if (total <= 0) {
    return { left: 0, width: 0 };
  }
  const left = ((start.getTime() - range.start.getTime()) / total) * 100;
  const width = ((end.getTime() - start.getTime()) / total) * 100;
  return { left: Math.max(0, left), width: Math.max(0, width) };
}

function buildTooltip(segment) {
  const typeLabel =
    segment.type === "BREAK"
      ? buildBreakLabel(segment)
      : SEGMENT_LABELS[segment.type] ?? segment.type;
  const timeRange = `${formatTime(segment.startAt)} - ${formatTime(segment.endAt)}`;
  const duration = formatDuration(segment.startAt, segment.endAt);
  const wfhFlag = segment.isWFH ? " • WFH" : "";
  return `${typeLabel} | ${timeRange} | ${duration}${wfhFlag}`;
}

function buildTimelineChart(row) {
  const visibleSegments = (row.segments ?? []).filter(
    (segment) => segment.type !== "NO_DUTY" && segment.width > 0
  );
  let cursor = 0;
  const values = {};
  const config = {};

  visibleSegments.forEach((segment, index) => {
    const gapKey = `gap_${index}`;
    const segmentKey = `segment_${index}`;
    const gap = Math.max(0, segment.left - cursor);
    values[gapKey] = gap;
    values[segmentKey] = segment.width;
    config[gapKey] = { label: "", color: "transparent", hidden: true };
    config[segmentKey] = {
      label:
        segment.type === "BREAK"
          ? buildBreakLabel(segment)
          : SEGMENT_LABELS[segment.type] ?? segment.type,
      color: SEGMENT_COLORS[segment.type] ?? SEGMENT_COLORS.NO_DUTY,
      segment,
    };
    cursor = Math.max(cursor, segment.left + segment.width);
  });

  values.trailing = Math.max(0, 100 - cursor);
  config.trailing = { label: "", color: "transparent", hidden: true };

  return { data: [{ label: row.user?.name ?? "Activity", ...values }], config };
}

export default function DailyTimelineChart({
  date,
  userId,
  showNames,
  title = "Daily timeline",
}) {
  const [state, setState] = useState({
    status: "idle",
    error: null,
    payload: null,
  });

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setState({ status: "loading", error: null, payload: null });
      try {
        const params = new URLSearchParams();
        if (date) {
          params.set("date", date);
        }
        if (userId) {
          params.set("userId", userId);
        }
        const response = await fetch(
          `/api/analytics/daily-timeline?${params.toString()}`,
          { signal: controller.signal }
        );
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error ?? "Unable to load timeline.");
        }
        setState({ status: "success", error: null, payload: data });
      } catch (error) {
        if (error?.name === "AbortError") {
          return;
        }
        setState({
          status: "error",
          error: error instanceof Error ? error.message : "Unable to load timeline.",
          payload: null,
        });
      }
    };
    load();
    return () => controller.abort();
  }, [date, userId]);

  const payload = state.payload;
  const rows = useMemo(() => payload?.rows ?? [], [payload]);
  const window = useMemo(() => payload?.window ?? null, [payload]);

  const range = useMemo(() => {
    if (!window?.startAt || !window?.endAt) {
      return null;
    }
    const start = new Date(window.startAt);
    const end = new Date(window.endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return null;
    }
    return { start, end };
  }, [window]);

  const ticks = useMemo(() => {
    if (!range || !Array.isArray(window?.ticks)) {
      return [];
    }
    return window.ticks.map((tick) => {
      const time = new Date(tick);
      return {
        value: tick,
        label: formatTime(tick),
        ...getWidthPercent(range, time, time),
      };
    });
  }, [range, window]);

  const rowMarkers = useMemo(() => {
    if (!range) {
      return [];
    }
    return rows.map((row) => ({
      ...row,
      segments: (row.segments ?? []).map((segment) => ({
        ...segment,
        ...getWidthPercent(
          range,
          new Date(segment.startAt),
          new Date(segment.endAt)
        ),
      })),
    }));
  }, [range, rows]);

  if (state.status === "loading") {
    return (
      <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-5 text-sm text-[color:var(--color-text-muted)]">
        Loading timeline...
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 text-sm text-rose-200">
        {state.error}
      </div>
    );
  }

  if (!rows.length || !range) {
    return (
      <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-5">
        <ChartContainer config={{ empty: { label: "No activity", color: "var(--color-border)" } }} className="relative aspect-auto min-h-28 items-center rounded-xl border border-dashed border-border bg-muted/20 px-6">
          <div className="w-full border-t border-dashed border-border" aria-hidden="true" />
          <p className="absolute inset-x-0 text-center text-sm text-muted-foreground">No activity data</p>
        </ChartContainer>
      </div>
    );
  }

  const showUserNames = showNames ?? rows.length > 1;
  const minWidth = Math.max(640, ticks.length * 120);

  return (
    <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[color:var(--color-text)]">{title}</p>
          <p className="text-xs text-[color:var(--color-text-muted)]">
            {formatTime(range.start)} - {formatTime(range.end)} (Asia/Karachi)
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-6">
        {/* Time Ticks Header Row - Static */}
        <div className="px-8 pb-1">
          <div className="relative h-7 text-[11px] text-[#86a0c0]">
            {ticks.map((tick) => (
              <div
                key={tick.value}
                className="absolute top-0 h-full"
                style={{ left: `${tick.left}%` }}
              >
                <span className="absolute left-0 top-0 -translate-x-1/2 whitespace-nowrap">
                  {tick.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* User Rows */}
        <div className="space-y-6">
          {rowMarkers.map((row) => {
            const timelineChart = buildTimelineChart(row);
            return (
            <div
              key={row.user?.id ?? row.user?.name ?? "row"}
              className="space-y-2 border-b border-[color:var(--color-border)]/30 pb-5 last:border-0 last:pb-0"
            >
              {/* Header Row: User Info on Left, Summary Stats on Right - Static */}
              <div className="flex items-center justify-between gap-4 px-8">
                {showUserNames ? (
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#253242] text-sm text-white/90">
                      {(row.user?.name ?? "U").trim().charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white leading-tight">
                        {row.user?.name ?? "Unknown"}
                      </p>
                      <p className="text-xs text-[#7c9fc4]">Developer</p>
                    </div>
                  </div>
                ) : <div />}

                <p className="text-xs text-[#8ea8c8] font-semibold shrink-0">
                  {formatDurationSeconds(row.totals?.dutySeconds)} total
                  <span className="px-2">•</span>
                  {formatDurationSeconds(row.totals?.workTaskSeconds)} task
                  <span className="px-2">•</span>
                  {formatDurationSeconds(row.totals?.workManualSeconds)} manual
                  <span className="px-2">•</span>
                  {formatDurationSeconds(row.totals?.idleSeconds)} idle
                </p>
              </div>

              <div className="px-8">
                <div className="overflow-x-auto hide-scrollbar">
                  <div style={{ minWidth }} className="h-12">
                    <ChartContainer config={timelineChart.config} className="h-full min-h-0 aspect-auto rounded-xl border border-border/60 bg-muted/20 px-2 py-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={timelineChart.data} layout="vertical" margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
                          <CartesianGrid vertical={false} stroke="var(--color-border)" strokeOpacity={0.45} strokeDasharray="3 5" />
                          <XAxis type="number" domain={[0, 100]} hide />
                          <YAxis type="category" dataKey="label" hide />
                          <ChartTooltip
                            cursor={{ fill: "var(--color-muted-bg)" }}
                            content={<ChartTooltipContent labelFormatter={() => row.user?.name ?? "Activity"} formatter={(value, name, entry) => {
                              const segment = timelineChart.config?.[entry.dataKey]?.segment;
                              return segment ? `${formatDuration(segment.startAt, segment.endAt)}${segment.isWFH ? " · WFH" : ""}` : value;
                            }} />}
                          />
                          {Object.entries(timelineChart.config).map(([key, config]) => (
                            <Bar
                              key={key}
                              dataKey={key}
                              stackId="timeline"
                              fill={config.color}
                              fillOpacity={config.hidden ? 0 : 1}
                              radius={config.hidden ? 0 : 6}
                              isAnimationActive
                              animationDuration={520}
                              animationEasing="ease-out"
                            />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  </div>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
