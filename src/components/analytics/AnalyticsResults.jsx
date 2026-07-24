"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import TimelineCard from "@/components/analytics/TimelineCard";
import WorkstackChart from "@/components/analytics/WorkstackChart";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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

function formatPercent(value) {
  if (!value || Number.isNaN(value)) {
    return "0%";
  }
  return `${Math.round(value * 100)}%`;
}

function buildDateParam(value) {
  if (!value) {
    return new Date().toISOString().slice(0, 10);
  }
  return value;
}

const EMPTY_TOTALS = {
  dutySeconds: 0,
  workSeconds: 0,
  breakSeconds: 0,
  idleSeconds: 0,
  wfhSeconds: 0,
  noDutySeconds: 0,
  utilization: 0,
};

function normalizeTotals(totals) {
  const dutySeconds = totals?.dutySeconds ?? 0;
  const workSeconds = totals?.workSeconds ?? 0;
  const breakSeconds = totals?.breakSeconds ?? 0;
  const idleSeconds =
    totals?.idleSeconds ?? Math.max(0, dutySeconds - workSeconds - breakSeconds);
  const wfhSeconds = totals?.wfhSeconds ?? 0;
  const noDutySeconds = totals?.noDutySeconds ?? 0;
  const utilization =
    dutySeconds > 0 ? totals?.utilization ?? workSeconds / dutySeconds : 0;
  return {
    dutySeconds,
    workSeconds,
    breakSeconds,
    idleSeconds,
    wfhSeconds,
    noDutySeconds,
    utilization,
  };
}

function AnalyticsSkeleton() {
  return (
    <Card><CardContent className="space-y-3 p-5"><div className="h-4 w-1/3 animate-pulse rounded bg-muted" /><div className="h-3 w-1/2 animate-pulse rounded bg-muted" /><div className="h-24 w-full animate-pulse rounded-lg bg-muted" /></CardContent></Card>
  );
}

function UserTotals({ totals }) {
  const safeTotals = normalizeTotals(totals ?? EMPTY_TOTALS);
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <div className="rounded-lg border border-border/70 bg-muted/40 p-4">
        <p className="text-xs font-medium text-muted-foreground">
          Work
        </p>
        <p className="mt-2 text-xl font-semibold tracking-tight text-foreground">
          {formatDuration(safeTotals.workSeconds)}
        </p>
      </div>
      <div className="rounded-lg border border-border/70 bg-muted/40 p-4">
        <p className="text-xs font-medium text-muted-foreground">
          Break
        </p>
        <p className="mt-2 text-xl font-semibold tracking-tight text-foreground">
          {formatDuration(safeTotals.breakSeconds)}
        </p>
      </div>
      <div className="rounded-lg border border-border/70 bg-muted/40 p-4">
        <p className="text-xs font-medium text-muted-foreground">
          Idle
        </p>
        <p className="mt-2 text-xl font-semibold tracking-tight text-foreground">
          {formatDuration(safeTotals.idleSeconds)}
        </p>
      </div>
      <div className="rounded-lg border border-border/70 bg-muted/40 p-4">
        <p className="text-xs font-medium text-muted-foreground">
          Utilization
        </p>
        <p className="mt-2 text-xl font-semibold tracking-tight text-foreground">
          {formatPercent(safeTotals.utilization)}
        </p>
      </div>
    </div>
  );
}

function DailyUsersTooltip({ active, payload }) {
  if (!active || !payload?.length) {
    return null;
  }
  const entry = payload[0]?.payload;
  return (
    <div className="rounded-lg border border-border bg-popover p-3 text-xs text-popover-foreground shadow-lg">
      <p className="text-xs font-semibold text-popover-foreground">
        {entry?.name ?? "User"}
      </p>
      <div className="mt-2 space-y-1 text-muted-foreground">
        <p>Work: {formatDuration(entry.workSeconds)}</p>
        <p>Break: {formatDuration(entry.breakSeconds)}</p>
        <p>Idle: {formatDuration(entry.idleSeconds)}</p>
        <p>Utilization: {formatPercent(entry.utilization)}</p>
      </div>
    </div>
  );
}

function UsersSummaryTable({ users }) {
  if (!users?.length) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        No users to summarize.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table className="min-w-full text-left text-sm text-muted-foreground">
        <TableHeader><TableRow>
          <TableHead>User</TableHead><TableHead>Work</TableHead><TableHead>Break</TableHead><TableHead>Idle</TableHead><TableHead>Utilization</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {users.map((entry) => {
            const totals = normalizeTotals(entry?.totals ?? EMPTY_TOTALS);
            return (
              <TableRow key={entry.user.id}>
                <TableCell className="font-semibold text-foreground">
                  {entry.user.name}
                </TableCell>
                <TableCell>{formatDuration(totals.workSeconds)}</TableCell><TableCell>{formatDuration(totals.breakSeconds)}</TableCell><TableCell>{formatDuration(totals.idleSeconds)}</TableCell><TableCell>{formatPercent(totals.utilization)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function DailyUsersStackedChart({ users }) {
  const data = useMemo(() => {
    return [...(users ?? [])]
      .map((entry) => {
        const totals = normalizeTotals(entry?.totals ?? EMPTY_TOTALS);
        return {
          id: entry.user.id,
          name: entry.user.name,
          dutySeconds: totals.dutySeconds,
          workSeconds: totals.workSeconds,
          breakSeconds: totals.breakSeconds,
          idleSeconds: totals.idleSeconds,
          utilization: totals.utilization,
        };
      })
      .sort((a, b) => b.dutySeconds - a.dutySeconds);
  }, [users]);

  const height = Math.max(220, data.length * 44);

  if (!data.length) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        No daily activity yet.
      </div>
    );
  }

  return (
    <div className="h-full min-h-[220px] w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 10, right: 20, left: 40 }}>
          <XAxis
            type="number"
            tickFormatter={(value) => formatDuration(value)}
            tick={{ fill: "var(--color-text-muted)", fontSize: 12 }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={120}
            tick={{ fill: "var(--color-text-muted)", fontSize: 12 }}
          />
          <Tooltip content={<DailyUsersTooltip />} />
          <Bar
            dataKey="workSeconds"
            stackId="user"
            fill="var(--color-work)"
            name="Work"
            radius={0}
          />
          <Bar
            dataKey="breakSeconds"
            stackId="user"
            fill="var(--color-break)"
            name="Break"
            radius={0}
          />
          <Bar
            dataKey="idleSeconds"
            stackId="user"
            fill="var(--color-idle)"
            name="Idle"
            radius={0}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function AnalyticsResults({ period, date, userId }) {
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
        params.set("period", period);
        params.set("date", buildDateParam(date));
        if (userId) {
          params.set("userId", userId);
        }
        const response = await fetch(`/api/analytics?${params.toString()}`, {
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error ?? "Unable to load analytics.");
        }
        setState({ status: "success", error: null, payload: data });
      } catch (error) {
        if (error?.name === "AbortError") {
          return;
        }
        setState({
          status: "error",
          error: error instanceof Error ? error.message : "Unable to load analytics.",
          payload: null,
        });
      }
    };
    load();
    return () => controller.abort();
  }, [period, date, userId]);

  const payload = useMemo(() => state.payload ?? {}, [state.payload]);
  const results = useMemo(() => payload?.users ?? [], [payload]);
  const teamTotals = normalizeTotals(payload?.teamTotals ?? EMPTY_TOTALS);
  const teamPerDay = payload?.perDayTotals ?? payload?.teamPerDay ?? [];
  const mode = payload?.mode ?? "single";

  if (state.status === "loading") {
    return (
      <AnalyticsSkeleton />
    );
  }

  if (state.status === "error") {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">
        {state.error}
      </div>
    );
  }

  if (!results.length) {
    return (
    <Card><CardContent className="p-5 text-sm text-muted-foreground">
      No analytics to display.
    </CardContent></Card>
    );
  }

  if (period === "daily") {
    if (mode === "all") {
      return (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">
                Team totals
              </p>
              <span className="text-xs font-medium text-muted-foreground">
                Daily
              </span>
            </div>
            <div className="mt-4">
              <UserTotals totals={teamTotals} />
            </div>
            </CardContent>
          </Card>
          <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
            <Card><CardContent className="p-5">
              <p className="text-sm font-semibold text-foreground">
                Daily work mix
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Work, break, and idle time per user.
              </p>
              <div className="mt-4">
                <DailyUsersStackedChart users={results} />
              </div>
            </CardContent></Card>
            <Card><CardContent className="p-5">
              <p className="text-sm font-semibold text-foreground">
                User totals
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Work, break, idle, and utilization.
              </p>
              <div className="mt-4">
                <UsersSummaryTable users={results} />
              </div>
            </CardContent></Card>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {results.map((entry) => (
          <TimelineCard
            key={entry.user.id}
            user={entry.user}
            timeline={{
              segments: entry.segments ?? [],
              dutyWindows: entry.dutyWindows ?? [],
              wfhWindows: entry.wfhWindows ?? [],
              details: entry.details ?? {},
              totals: normalizeTotals(entry.totals ?? EMPTY_TOTALS),
              message: entry.message ?? null,
              dayWindowStart: entry.dayWindowStart ?? payload?.dayWindowStart ?? null,
              dayWindowEnd: entry.dayWindowEnd ?? payload?.dayWindowEnd ?? null,
            }}
          />
        ))}
      </div>
    );
  }

  if (mode === "all") {
    return (
      <div className="space-y-4">
        <Card><CardContent className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">
              Team totals
            </p>
            <span className="text-xs font-medium text-muted-foreground">
              {period}
            </span>
          </div>
          <div className="mt-4">
            <UserTotals totals={teamTotals} />
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">
              Team daily totals
            </p>
            <span className="text-xs font-medium text-muted-foreground">
              {period}
            </span>
          </div>
          <div className="mt-4">
            <WorkstackChart
              perDay={teamPerDay}
              minWidth={
                period === "monthly"
                  ? Math.max(720, (teamPerDay?.length ?? 0) * 28)
                  : 640
              }
            />
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <p className="text-sm font-semibold text-foreground">
            User totals
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Total work, break, idle, and utilization for the team.
          </p>
          <div className="mt-4">
            <UsersSummaryTable users={results} />
          </div>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {results.map((entry) => (
        <Card
          key={entry.user.id}
          className="p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">
                {entry.user.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {entry.user.role}
              </p>
            </div>
            <p className="text-xs font-medium text-muted-foreground">
              {period}
            </p>
          </div>
          <div className="mt-4">
            <UserTotals totals={entry.totals} />
          </div>
          <div className="mt-4">
            {(() => {
              const perDayTotals = entry.perDayTotals ?? entry.perDay ?? [];
              return (
            <WorkstackChart
              perDay={perDayTotals}
              minWidth={
                period === "monthly"
                  ? Math.max(720, perDayTotals.length * 28)
                  : 640
              }
            />
              );
            })()}
          </div>
        </Card>
      ))}
    </div>
  );
}
