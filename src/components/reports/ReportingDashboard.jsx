"use client";

import { useEffect, useState, useMemo } from "react";
import ActionButton from "@/components/ui/ActionButton";
import Avatar from "@/components/ui/Avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, RefreshCw, AlertTriangle, CheckCircle2, Clock, Calendar, Users, Briefcase, Trophy, Zap, Percent, Mail } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import { getDutyDate } from "@/lib/dutyHours";

export default function ReportingDashboard({ session }) {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [selectedUser, setSelectedUser] = useState("");
  const [dateRange, setDateRange] = useState("month"); // "month", "week", "today", "30", "custom"
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      let url = "/api/reports/analytics?";
      if (selectedUser) url += `userId=${selectedUser}&`;

      const now = new Date();
      if (dateRange === "today") {
        const todayStr = getDutyDate(now) ?? now.toISOString().slice(0, 10);
        url += `startDate=${todayStr}&endDate=${todayStr}&`;
      } else if (dateRange === "week") {
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(now);
        monday.setDate(diff);
        url += `startDate=${monday.toISOString().slice(0, 10)}&`;
      } else if (dateRange === "month") {
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        url += `startDate=${firstDay.toISOString().slice(0, 10)}&`;
      } else if (dateRange === "30") {
        const start = new Date();
        start.setDate(start.getDate() - 30);
        url += `startDate=${start.toISOString().slice(0, 10)}&`;
      } else if (dateRange === "custom" && customStartDate) {
        url += `startDate=${customStartDate}&`;
        if (customEndDate) url += `endDate=${customEndDate}&`;
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
  }, [selectedUser, dateRange, customStartDate, customEndDate]);

  const kpi = data?.kpi;
  const userScorecards = data?.userScorecards ?? [];
  const developerScorecards = data?.developerScorecards ?? userScorecards.filter((s) => s.user?.role !== "JUNIOR_INTERN");
  const internScorecards = data?.internScorecards ?? userScorecards.filter((s) => s.user?.role === "JUNIOR_INTERN");

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
        item.isUnranked ? "Unranked" : index + 1,
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
    link.setAttribute("download", `performance_report_${dateRange}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addToast({
      title: "Report Exported",
      message: "CSV performance report has been downloaded successfully.",
      variant: "success",
    });
  };

  const [sendingEmailUserId, setSendingEmailUserId] = useState(null);

  const handleSendEmailReport = async (userId = null, userName = "All Team Members") => {
    setSendingEmailUserId(userId || "all");
    try {
      const response = await fetch("/api/reports/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userId || undefined,
          period: dateRange === "month" ? "monthly" : "weekly",
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Failed to send email report");

      addToast({
        title: "Email Report Sent",
        message: `Performance email report sent successfully for ${userName}.`,
        variant: "success",
      });
    } catch (err) {
      addToast({
        title: "Email Send Error",
        message: err instanceof Error ? err.message : "Unable to send email report",
        variant: "error",
      });
    } finally {
      setSendingEmailUserId(null);
    }
  };

  const stageTypeHours = data?.stageTypeHours ?? {};
  const categoryHours = data?.categoryHours ?? {};
  const milestoneImpact = data?.milestoneImpact ?? [];

  // Team average utilization
  const avgTeamUtilization = useMemo(() => {
    if (!userScorecards.length) return 0;
    const sum = userScorecards.reduce((acc, u) => acc + (u.utilizationPercent ?? 0), 0);
    return Math.round(sum / userScorecards.length);
  }, [userScorecards]);

  // Render Leaderboard Table helper
  const renderScorecardTable = (scorecards, title, subtitle) => (
    <div className="space-y-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-400" />
            <h2 className="text-base font-semibold text-[color:var(--color-text)]">{title}</h2>
          </div>
          <p className="text-xs text-[color:var(--color-text-muted)]">
            {subtitle}
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
              <th className="py-3 px-3">Professionalism & Discipline</th>
              <th className="py-3 px-3">Utilization & Avg Duty</th>
              <th className="py-3 px-3">Time Distribution Breakdown</th>
              <th className="py-3 px-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--color-border)]/50">
            {scorecards.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-xs text-[color:var(--color-text-subtle)] italic">
                  No members in this section for the selected period.
                </td>
              </tr>
            ) : (
              scorecards.map((item, index) => {
                const latePercent = item.completedTasks > 0
                  ? Math.round((item.completedLate / item.completedTasks) * 100)
                  : 0;

                const rankBadge = item.isUnranked ? "# -" : `#${index + 1}`;
                const rankStyle = "bg-[color:var(--color-muted-bg)] text-[color:var(--color-text-muted)] border-[color:var(--color-border)] font-semibold";

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
                            {item.isUnranked ? (
                              <span className="rounded border border-slate-500/30 bg-slate-500/10 px-1.5 py-0.2 text-[10px] font-bold text-slate-400">
                                Unranked
                              </span>
                            ) : (
                              <span className="rounded border border-[color:var(--color-accent)]/30 bg-[color:var(--color-accent)]/10 px-1.5 py-0.2 text-[10px] font-bold text-[color:var(--color-accent)]">
                                {item.performanceScore ?? 0} pts
                              </span>
                            )}
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

                    {/* Professionalism & Discipline Rating */}
                    <td className="py-3.5 px-3">
                      {item.isUnranked ? (
                        <span className="text-[10px] text-[color:var(--color-text-subtle)] font-medium">N/A</span>
                      ) : (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                                item.professionalismPercent >= 85
                                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                                  : item.professionalismPercent >= 70
                                  ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                                  : "border-rose-500/40 bg-rose-500/10 text-rose-400"
                              }`}
                            >
                              {item.professionalismPercent >= 85 ? "⭐" : item.professionalismPercent >= 70 ? "⚡" : "⚠️"}{" "}
                              {item.professionalismPercent}% Rating
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-1 text-[10px]">
                            {item.autoOffCount > 0 ? (
                              <span className="rounded border border-rose-500/30 bg-rose-500/10 px-1 py-0.2 font-bold text-rose-400" title="Forgot to check out (System Auto-Off)">
                                🚨 {item.autoOffCount} Auto-Off
                              </span>
                            ) : null}
                            {item.lateArrivals > 0 ? (
                              <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1 py-0.2 font-semibold text-amber-400" title="Check-ins past shift cutoff">
                                ⏰ {item.lateArrivals} Late
                              </span>
                            ) : null}
                            {item.lateManualDumpsCount > 0 ? (
                              <span className="rounded border border-rose-500/30 bg-rose-500/10 px-1 py-0.2 font-bold text-rose-400" title="Manual activity retroactively logged long after completion / end of day">
                                ⚠️ {item.lateManualDumpsCount} Late Dump
                              </span>
                            ) : null}
                            {item.autoOffCount === 0 && item.lateArrivals === 0 && (item.lateManualDumpsCount ?? 0) === 0 ? (
                              <span className="text-[10px] text-emerald-400 font-medium">✓ High Discipline</span>
                            ) : null}
                          </div>
                        </div>
                      )}
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

                    {/* Send Individual Email Action */}
                    <td className="py-3.5 px-3">
                      <button
                        type="button"
                        onClick={() => handleSendEmailReport(item.user.id, item.user.name)}
                        disabled={sendingEmailUserId === item.user.id}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-muted-bg)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--color-text)] hover:border-sky-500 hover:text-sky-400 transition disabled:opacity-50"
                        title={`Send individual performance email report to ${item.user.name}`}
                      >
                        <Mail className="h-3.5 w-3.5 text-sky-400" />
                        {sendingEmailUserId === item.user.id ? "Sending..." : "Send Email"}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

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
              <option value="month">Current Month</option>
              <option value="week">This Week</option>
              <option value="today">Today</option>
              <option value="30">Last 30 Days</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {dateRange === "custom" ? (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-2.5 py-1 text-xs text-[color:var(--color-text)] outline-none"
              />
              <span className="text-xs text-[color:var(--color-text-subtle)]">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-2.5 py-1 text-xs text-[color:var(--color-text)] outline-none"
              />
            </div>
          ) : null}

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
            onClick={() => handleSendEmailReport(null, "All Active Team Members")}
            disabled={sendingEmailUserId === "all"}
            className="inline-flex items-center gap-1.5 rounded-xl border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-400 hover:bg-sky-500/20 transition disabled:opacity-50"
            title="Bulk send individual performance email reports to all team members"
          >
            <Mail className="h-3.5 w-3.5" />
            {sendingEmailUserId === "all" ? "Sending Emails..." : "Send Bulk Team Emails"}
          </button>
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

      {/* Main Developer Performance & Accountability Leaderboard */}
      {renderScorecardTable(
        developerScorecards,
        "Team Performance & Accountability Leaderboard",
        "Automatically sorted by performance score (attendance volume, punctuality, task velocity, utilization, low rework, and zero auto-offs). Top performers rank on top."
      )}

      {/* Junior Interns Performance & Accountability Table */}
      {renderScorecardTable(
        internScorecards,
        "Junior Interns Performance & Accountability",
        "Evaluated against custom intern shift start times (e.g. Saad 6:30 PM, Sabir 9:00 PM)."
      )}

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
