"use client";

import { useEffect, useState, useMemo } from "react";
import ActionButton from "@/components/ui/ActionButton";
import Avatar from "@/components/ui/Avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, RefreshCw, AlertTriangle, CheckCircle2, Clock, Calendar, Users, Briefcase, Trophy, Zap, Percent } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";

export default function ReportingDashboard({ session }) {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [selectedUser, setSelectedUser] = useState("");
  const [dateRange, setDateRange] = useState("30"); // 7, 30, all

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      let url = "/api/reports/analytics?";
      if (selectedUser) url += `userId=${selectedUser}&`;
      if (dateRange !== "all") {
        const start = new Date();
        start.setDate(start.getDate() - Number(dateRange));
        url += `startDate=${start.toISOString().slice(0, 10)}&`;
      }
      const response = await fetch(url);
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Failed to load analytics");
      setData(json);
    } catch (err) {
      addToast({
        title: "Analytics error",
        message: err instanceof Error ? err.message : "Unable to load analytics",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [selectedUser, dateRange]);

  // CSV Export handler
  const handleExportCSV = () => {
    if (!data?.userScorecards?.length) {
      addToast({
        title: "No data to export",
        message: "No user scorecards available in the selected range.",
        variant: "warning",
      });
      return;
    }

    const headers = [
      "Rank",
      "User Name",
      "Role",
      "Performance Score (pts)",
      "Assigned Tasks",
      "Completed Tasks",
      "Completed On-Time",
      "Completed Late",
      "Rework Revisions",
      "Late Check-Ins (Total / Late)",
      "Utilization Rate (%)",
      "Total Duty Hours",
      "Daily Avg Duty Hours",
      "Time Breakdown Distribution",
    ];

    const rows = data.userScorecards.map((item, index) => {
      const distStr = item.distribution
        ?.map((d) => `${d.percent}% ${d.label}`)
        .join(" | ");
      return [
        index + 1,
        `"${item.user.name}"`,
        `"${item.user.role}"`,
        item.performanceScore ?? 0,
        item.totalAssigned,
        item.completedTasks,
        item.completedOnTime,
        item.completedLate,
        item.reworkCount,
        `"${item.attendanceDays} / ${item.lateArrivals}"`,
        `"${item.utilizationPercent}%"`,
        item.totalDutyHours ?? item.officeHours,
        item.avgDutyHoursPerDay ?? 0,
        `"${distStr || "N/A"}"`,
      ];
    });

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `PMS_Performance_Accountability_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addToast({
      title: "Report Exported",
      message: "CSV performance report has been downloaded successfully.",
      variant: "success",
    });
  };

  const kpi = data?.kpi;
  const userScorecards = data?.userScorecards ?? [];
  const stageTypeHours = data?.stageTypeHours ?? {};
  const categoryHours = data?.categoryHours ?? {};
  const milestoneImpact = data?.milestoneImpact ?? [];

  // Team average utilization
  const avgTeamUtilization = useMemo(() => {
    if (!userScorecards.length) return 0;
    const sum = userScorecards.reduce((acc, u) => acc + (u.utilizationPercent ?? 0), 0);
    return Math.round(sum / userScorecards.length);
  }, [userScorecards]);

  return (
    <div className="space-y-6">
      {/* Top Filter Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[color:var(--color-text-muted)]" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-1.5 text-xs font-semibold text-[color:var(--color-text)] outline-none focus:border-[color:var(--color-accent)]"
            >
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="90">Last 90 Days</option>
              <option value="all">All Time</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-[color:var(--color-text-muted)]" />
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-1.5 text-xs font-semibold text-[color:var(--color-text)] outline-none focus:border-[color:var(--color-accent)]"
            >
              <option value="">All Team Members (Sorted by Performance)</option>
              {userScorecards.map((sc) => (
                <option key={sc.user.id} value={sc.user.id}>
                  {sc.user.name} ({sc.performanceScore} pts)
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchAnalytics}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-muted-bg)] px-3 py-1.5 text-xs font-semibold text-[color:var(--color-text-muted)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-text)] transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <ActionButton
            label="Export Performance CSV"
            variant="secondary"
            onClick={handleExportCSV}
            className="text-xs"
          />
        </div>
      </div>

      {/* KPI Overview Cards */}
      {loading && !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {/* Card 1: Completed Tasks */}
          <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-4 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[color:var(--color-text-muted)]">Completed Tasks</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-bold text-[color:var(--color-text)]">{kpi?.totalCompletedTasks ?? 0}</p>
            <p className="text-[11px] text-[color:var(--color-text-subtle)]">
              Across all assigned initiatives
            </p>
          </div>

          {/* Card 2: Completed Late */}
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/[0.04] p-4 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-rose-300">Completed Late</span>
              <AlertTriangle className="h-4 w-4 text-rose-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold text-rose-400">{kpi?.totalCompletedLateTasks ?? 0}</p>
              <span className="text-xs font-bold text-rose-300 bg-rose-500/20 px-2 py-0.5 rounded-full">
                {kpi?.completedLatePercentage ?? 0}% Late
              </span>
            </div>
            <p className="text-[11px] text-rose-300/80">
              Exceeded initial time estimate
            </p>
          </div>

          {/* Card 3: Team Time Utilization % */}
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.04] p-4 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-300">Time Utilization Rate</span>
              <Zap className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold text-emerald-400">{avgTeamUtilization}%</p>
              <span className="text-[10px] font-semibold text-emerald-300">Productive Duty</span>
            </div>
            <p className="text-[11px] text-emerald-300/80">
              Task & learning hours vs total duty
            </p>
          </div>

          {/* Card 4: Late Check-Ins */}
          <div className="rounded-2xl border border-sky-500/30 bg-sky-500/[0.04] p-4 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-sky-300">Late Check-Ins</span>
              <Clock className="h-4 w-4 text-sky-400" />
            </div>
            <p className="text-2xl font-bold text-sky-400">{kpi?.totalLateArrivals ?? 0}</p>
            <p className="text-[11px] text-sky-300/80">
              Check-ins past 3:15 PM shift cutoff
            </p>
          </div>

          {/* Card 5: Total Duty Hours */}
          <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-4 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[color:var(--color-text-muted)]">Total Duty Logged</span>
              <Briefcase className="h-4 w-4 text-indigo-400" />
            </div>
            <p className="text-2xl font-bold text-[color:var(--color-text)]">{kpi?.totalSpentHours ?? 0} hrs</p>
            <p className="text-[11px] text-[color:var(--color-text-subtle)]">
              Est: {kpi?.totalEstimatedHours ?? 0} hrs
            </p>
          </div>
        </div>
      )}

      {/* User Performance Leaderboard Table */}
      <div className="space-y-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-400" />
              <h2 className="text-base font-semibold text-[color:var(--color-text)]">User Performance & Accountability Leaderboard</h2>
            </div>
            <p className="text-xs text-[color:var(--color-text-muted)]">
              Automatically sorted by performance score (on-time delivery, punctuality, utilization, and low rework). Top performers rank on top.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[color:var(--color-border)] text-[11px] uppercase tracking-wider text-[color:var(--color-text-subtle)]">
              <tr>
                <th className="py-3 px-3">Rank & Team Member</th>
                <th className="py-3 px-3">Completed</th>
                <th className="py-3 px-3">Late Ratio</th>
                <th className="py-3 px-3">Check-In (Days/Late)</th>
                <th className="py-3 px-3">Utilization & Avg Duty</th>
                <th className="py-3 px-3">Time Distribution Breakdown</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--color-border)]/50">
              {userScorecards.map((item, index) => {
                const latePercent = item.completedTasks > 0
                  ? Math.round((item.completedLate / item.completedTasks) * 100)
                  : 0;

                const rank = index + 1;
                let rankBadge = `#${rank}`;
                let rankStyle = "bg-[color:var(--color-muted-bg)] text-[color:var(--color-text-muted)] border-[color:var(--color-border)]";
                if (rank === 1) {
                  rankBadge = "🥇 1st";
                  rankStyle = "bg-amber-500/15 text-amber-300 border-amber-500/40 font-bold";
                } else if (rank === 2) {
                  rankBadge = "🥈 2nd";
                  rankStyle = "bg-slate-300/15 text-slate-200 border-slate-300/40 font-semibold";
                } else if (rank === 3) {
                  rankBadge = "🥉 3rd";
                  rankStyle = "bg-amber-700/15 text-amber-400 border-amber-700/40 font-semibold";
                }

                return (
                  <tr key={item.user.id} className="hover:bg-[color:var(--color-muted-bg)]/40 transition">
                    {/* Member & Rank */}
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-[10px] shrink-0 ${rankStyle}`}>
                          {rankBadge}
                        </span>
                        <Avatar
                          src={item.user.image}
                          name={item.user.name}
                          alt={`${item.user.name} avatar`}
                          className="h-8 w-8 text-xs shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-semibold text-[color:var(--color-text)] truncate">{item.user.name}</p>
                            <span className="rounded border border-[color:var(--color-accent)]/30 bg-[color:var(--color-accent)]/10 px-1.5 py-0.2 text-[10px] font-bold text-[color:var(--color-accent)]">
                              {item.performanceScore ?? 0} pts
                            </span>
                          </div>
                          <p className="text-[10px] text-[color:var(--color-text-subtle)]">{item.user.role}</p>
                        </div>
                      </div>
                    </td>

                    {/* Completed Tasks */}
                    <td className="py-3.5 px-3 font-semibold text-[color:var(--color-text)]">
                      {item.completedTasks} / {item.totalAssigned}
                    </td>

                    {/* Late Delivery Ratio */}
                    <td className="py-3.5 px-3">
                      {item.completedLate > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-400">
                          🚨 {item.completedLate} ({latePercent}%)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                          ✓ On Time
                        </span>
                      )}
                    </td>

                    {/* Check-In (Total Days / Late Days) */}
                    <td className="py-3.5 px-3">
                      <span className="font-semibold text-[color:var(--color-text)]" title={`${item.lateArrivals} late check-ins out of ${item.attendanceDays} days`}>
                        {item.attendanceDays} /{" "}
                        <span className={item.lateArrivals > 0 ? "text-rose-400 font-bold" : "text-emerald-400"}>
                          {item.lateArrivals}
                        </span>
                      </span>
                    </td>

                    {/* Utilization Rate & Daily Avg Duty */}
                    <td className="py-3.5 px-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-bold ${item.utilizationPercent >= 70 ? "text-emerald-400" : "text-amber-400"}`}>
                            ⚡ {item.utilizationPercent}%
                          </span>
                          <span className="text-[10px] text-[color:var(--color-text-subtle)]">Utilized</span>
                        </div>
                        <div className="text-[11px] text-[color:var(--color-text-muted)] font-medium">
                          {item.totalDutyHours ?? item.officeHours}h <span className="text-[color:var(--color-text-subtle)]">({item.avgDutyHoursPerDay ?? 0}h/day avg)</span>
                        </div>
                      </div>
                    </td>

                    {/* Time Distribution Percentages */}
                    <td className="py-3.5 px-3">
                      {item.distribution?.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {item.distribution.map((d) => (
                            <span
                              key={d.label}
                              className="rounded border border-[color:var(--color-border)] bg-[color:var(--color-muted-bg)] px-1.5 py-0.5 text-[10px] font-semibold text-[color:var(--color-text)]"
                              title={`${d.hours} hours logged`}
                            >
                              {d.percent}% {d.label}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[color:var(--color-text-subtle)] italic">No time breakdown</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stage-Wise & Activity Breakdown */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-5 shadow-sm">
          <div>
            <h2 className="text-base font-semibold text-[color:var(--color-text)]">Team-Wide Task Type & Category Distribution</h2>
            <p className="text-xs text-[color:var(--color-text-muted)]">Hours spent across task categories team-wide.</p>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--color-text-subtle)]">Task Type Hours</p>
            {Object.entries(stageTypeHours).map(([type, hours]) => (
              <div key={type} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[color:var(--color-text)]">{type} Tasks</span>
                  <span className="font-mono text-[color:var(--color-text-muted)]">{hours} hrs</span>
                </div>
                <div className="h-2 w-full rounded-full bg-[color:var(--color-muted-bg)] overflow-hidden">
                  <div
                    className="h-full bg-[color:var(--color-accent)] rounded-full"
                    style={{ width: `${Math.min(100, (hours / (kpi?.totalSpentHours || 1)) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-5 shadow-sm">
          <div>
            <h2 className="text-base font-semibold text-[color:var(--color-text)]">Manual Activity Ratio</h2>
            <p className="text-xs text-[color:var(--color-text-muted)]">Research & learning activity logs.</p>
          </div>
          <div className="space-y-2 pt-1">
            {Object.entries(categoryHours).map(([cat, hours]) => (
              <div key={cat} className="flex items-center justify-between text-xs rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-muted-bg)]/40 p-2.5">
                <span className="font-medium text-[color:var(--color-text)]">{cat}</span>
                <span className="font-mono font-semibold text-[color:var(--color-text-muted)]">{hours} hrs</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Milestone Impact Analysis */}
      <div className="space-y-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-5 shadow-sm">
        <div>
          <h2 className="text-base font-semibold text-[color:var(--color-text)]">Milestone Impact & Risk Analysis</h2>
          <p className="text-xs text-[color:var(--color-text-muted)]">Schedule compliance and user task completion impact on project milestones.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[color:var(--color-border)] text-[11px] uppercase tracking-wider text-[color:var(--color-text-subtle)]">
              <tr>
                <th className="py-3 px-3">Milestone</th>
                <th className="py-3 px-3">Project</th>
                <th className="py-3 px-3">End Date</th>
                <th className="py-3 px-3">Completed Tasks</th>
                <th className="py-3 px-3">Late Tasks</th>
                <th className="py-3 px-3">Schedule Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--color-border)]/50">
              {milestoneImpact.map((m) => (
                <tr key={m.id} className="hover:bg-[color:var(--color-muted-bg)]/40 transition">
                  <td className="py-3 px-3 font-semibold text-[color:var(--color-text)]">{m.title}</td>
                  <td className="py-3 px-3 text-[color:var(--color-text-muted)]">{m.project?.name ?? "General"}</td>
                  <td className="py-3 px-3 font-mono text-[color:var(--color-text-subtle)]">
                    {new Date(m.endDate).toISOString().slice(0, 10)}
                  </td>
                  <td className="py-3 px-3 font-medium text-[color:var(--color-text)]">
                    {m.completedTasks} / {m.totalTasks}
                  </td>
                  <td className="py-3 px-3">
                    {m.lateTasksCount > 0 ? (
                      <span className="text-rose-400 font-bold">⚠️ {m.lateTasksCount} late</span>
                    ) : (
                      <span className="text-emerald-400 font-medium">0</span>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    {m.isPastDue && m.completedTasks < m.totalTasks ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-500/10 px-2.5 py-0.5 text-[10px] font-bold text-rose-400">
                        🚨 Delayed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                        ✓ On Track
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
