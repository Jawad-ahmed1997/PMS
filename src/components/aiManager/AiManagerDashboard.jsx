"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Calendar,
  User,
  Activity,
  Brain,
  ShieldAlert,
  ArrowRight,
  RefreshCw,
  Zap,
  BookOpen,
  FileText,
  Users,
  CalendarDays,
  ChevronRight,
  Clock3,
  Coffee,
  CheckCheck,
  Eye,
  Trash2,
  Printer,
  Search,
  SlidersHorizontal,
  FileSpreadsheet,
  Download,
  X,
} from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import { fetchJson } from "@/lib/apiClient";
import ReportPdfPrintView from "./ReportPdfPrintView";
import { getDutyDate } from "@/lib/dutyHours";

export default function AiManagerDashboard({ session, initialUsers = [], initialReports = [] }) {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState("grid"); // "grid" (Saved Reports) by default | "generator"
  const [loading, setLoading] = useState(false);
  const [runningDiagnosis, setRunningDiagnosis] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  
  const [reports, setReports] = useState(initialReports || []);
  const [teamUsers, setTeamUsers] = useState(initialUsers || []);
  const [selectedUserId, setSelectedUserId] = useState(
    initialUsers.length > 0 ? initialUsers[0].id : (session?.id || "")
  );
  const [period, setPeriod] = useState("daily"); // "daily" | "weekly" | "monthly" | "custom"
  
  const todayStr = useMemo(() => getDutyDate(new Date()) ?? new Date().toISOString().slice(0, 10), []);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [customStartDate, setCustomStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [customEndDate, setCustomEndDate] = useState(todayStr);
  
  const [selectedReport, setSelectedReport] = useState(
    initialReports?.length > 0 ? initialReports[0] : null
  );

  // Modals state
  const [viewingReport, setViewingReport] = useState(null);
  const [printingReport, setPrintingReport] = useState(null);
  const [reportToDelete, setReportToDelete] = useState(null);

  // Table filter states
  const [tableSearch, setTableSearch] = useState("");
  const [tableUserFilter, setTableUserFilter] = useState("ALL");
  const [tableTypeFilter, setTableTypeFilter] = useState("ALL");

  const fetchReports = async (userId = selectedUserId, type = period) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (userId && activeTab === "generator") params.append("userId", userId);
      if (type && type !== "custom" && activeTab === "generator") params.append("type", type);
      if (type === "custom" && customStartDate) params.append("startDate", customStartDate);
      if (type === "custom" && customEndDate) params.append("endDate", customEndDate);

      const data = await fetchJson(`/api/ai-manager?${params.toString()}`);

      if (data?.ok) {
        const loadedReports = data.reports || data.data?.reports || [];
        const loadedUsers = data.teamUsers || data.data?.teamUsers || [];
        setReports(loadedReports);
        if (loadedUsers.length > 0) {
          setTeamUsers(loadedUsers);
        }
        if (loadedReports.length > 0 && !selectedReport) {
          setSelectedReport(loadedReports[0]);
        }
      }
    } catch (err) {
      console.error("Failed to load AI Manager reports:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedUserId || activeTab === "grid") {
      fetchReports(selectedUserId, period);
    }
  }, [selectedUserId, period, activeTab]);

  const handleRunDiagnosis = async () => {
    if (!selectedUserId) {
      addToast({
        title: "Select Developer",
        message: "Please select a developer from the dropdown to audit.",
        variant: "warning",
      });
      return;
    }

    try {
      setRunningDiagnosis(true);
      const payload = {
        userId: selectedUserId,
        period,
        targetDate: selectedDate ? new Date(selectedDate).toISOString() : new Date().toISOString(),
      };

      if (period === "custom") {
        if (!customStartDate || !customEndDate) {
          addToast({
            title: "Date Range Required",
            message: "Please select both start and end date for custom inspection.",
            variant: "warning",
          });
          setRunningDiagnosis(false);
          return;
        }
        payload.customStartDate = customStartDate;
        payload.customEndDate = customEndDate;
      }

      const data = await fetchJson("/api/ai-manager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (data?.ok) {
        const freshReport = data.report || data.data?.report || data;
        setSelectedReport(freshReport);
        setReports((prev) => [freshReport, ...prev.filter((r) => r.id !== freshReport.id)]);
        addToast({
          title: "⚡ Audit Generated",
          message: `AI Manager successfully evaluated ${freshReport.user?.name || selectedUserObj?.name || "developer"}.`,
          variant: "success",
        });
      } else {
        addToast({
          title: "Audit Failed",
          message: data?.message || "Unable to generate AI Manager report.",
          variant: "error",
        });
      }
    } catch (err) {
      console.error("Error running diagnosis:", err);
      addToast({
        title: "Error",
        message: err instanceof Error ? err.message : "Network error while connecting to AI Manager.",
        variant: "error",
      });
    } finally {
      setRunningDiagnosis(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!reportToDelete?.id) return;
    const reportId = reportToDelete.id;

    try {
      setDeletingId(reportId);
      const data = await fetchJson(`/api/ai-manager?id=${reportId}`, {
        method: "DELETE",
      });

      if (data?.ok) {
        setReports((prev) => prev.filter((r) => r.id !== reportId));
        if (selectedReport?.id === reportId) {
          const remaining = reports.filter((r) => r.id !== reportId);
          setSelectedReport(remaining.length > 0 ? remaining[0] : null);
        }
        if (viewingReport?.id === reportId) {
          setViewingReport(null);
        }
        setReportToDelete(null);
        addToast({
          title: "Report Deleted",
          message: "The audit report has been permanently removed.",
          variant: "success",
        });
      } else {
        addToast({
          title: "Delete Failed",
          message: data?.message || "Could not delete the report.",
          variant: "error",
        });
      }
    } catch (err) {
      console.error("Error deleting report:", err);
      addToast({
        title: "Error",
        message: err instanceof Error ? err.message : "Network error while deleting report.",
        variant: "error",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const selectedUserObj = teamUsers.find((u) => u.id === selectedUserId);

  const getScoreBadge = (score, status) => {
    if (score >= 80) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 text-xs font-black text-emerald-400">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          {score}/100 &bull; {status || "EXCELLENT"}
        </span>
      );
    }
    if (score >= 65) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-1 text-xs font-black text-amber-400">
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          {score}/100 &bull; {status || "GOOD"}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/40 bg-rose-500/15 px-3 py-1 text-xs font-black text-rose-400">
        <span className="h-2 w-2 rounded-full bg-rose-400" />
        {score}/100 &bull; {status || "NEEDS ATTENTION"}
      </span>
    );
  };

  const getSeverityBadge = (severity) => {
    switch (severity?.toUpperCase()) {
      case "HIGH":
        return <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40">HIGH RISK</span>;
      case "MEDIUM":
        return <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">MEDIUM RISK</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-500/40">LOW RISK</span>;
    }
  };

  // Filtered reports for the data table
  const filteredTableReports = useMemo(() => {
    return reports.filter((r) => {
      if (tableUserFilter !== "ALL" && r.userId !== tableUserFilter) return false;
      if (tableTypeFilter !== "ALL" && r.type !== tableTypeFilter) return false;
      if (tableSearch.trim()) {
        const q = tableSearch.toLowerCase();
        const nameMatch = r.user?.name?.toLowerCase().includes(q);
        const summaryMatch = r.clinicalSummary?.toLowerCase().includes(q);
        return nameMatch || summaryMatch;
      }
      return true;
    });
  }, [reports, tableUserFilter, tableTypeFilter, tableSearch]);

  return (
    <div className="space-y-6 pb-16">
      
      {/* Top Header & Navigation Tabs */}
      <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/50 via-slate-900/80 to-slate-950 p-6 shadow-2xl backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/20 border border-indigo-400/40 text-indigo-400 shadow-inner">
              <Brain className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-indigo-400">
                  Engineering Manager Intelligence
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                  <Sparkles className="h-3 w-3" /> Gemini 2.5 Flash
                </span>
              </div>
              <h1 className="text-2xl font-black text-slate-100 tracking-tight">
                PMS AI Manager &bull; Developer Activity &amp; Quality Reporting Suite
              </h1>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center rounded-xl border border-slate-800 bg-slate-950/80 p-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab("generator")}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 transition-all ${
                activeTab === "generator"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Zap className="h-3.5 w-3.5" />
              <span>Generate Audit</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("grid")}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 transition-all ${
                activeTab === "grid"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Saved Reports ({reports.length})</span>
            </button>
          </div>
        </div>

        {/* Tab 1 Filter Bar (Generator) */}
        {activeTab === "generator" && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-800/80 pt-4">
            <div className="flex flex-wrap items-center gap-3">
              
              {/* Developer Selector */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-indigo-400" />
                  Developer:
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="rounded-xl border border-slate-700 bg-slate-800/90 px-3 py-1.5 text-xs font-bold text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {teamUsers.length === 0 && (
                    <option value="">No developers found</option>
                  )}
                  {teamUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role?.replace(/_/g, " ")})
                    </option>
                  ))}
                </select>
              </div>

              {/* Period Switcher */}
              <div className="flex items-center rounded-xl border border-slate-800 bg-slate-900/90 p-1 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setPeriod("daily")}
                  className={`rounded-lg px-3 py-1 transition-colors ${
                    period === "daily" ? "bg-indigo-600 text-white font-bold" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Daily
                </button>
                <button
                  type="button"
                  onClick={() => setPeriod("weekly")}
                  className={`rounded-lg px-3 py-1 transition-colors ${
                    period === "weekly" ? "bg-indigo-600 text-white font-bold" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Weekly
                </button>
                <button
                  type="button"
                  onClick={() => setPeriod("monthly")}
                  className={`rounded-lg px-3 py-1 transition-colors ${
                    period === "monthly" ? "bg-indigo-600 text-white font-bold" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setPeriod("custom")}
                  className={`rounded-lg px-3 py-1 transition-colors ${
                    period === "custom" ? "bg-indigo-600 text-white font-bold" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Custom Range
                </button>
              </div>

              {/* Sub-controls based on period */}
              {period === "daily" && (
                <div className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/90 px-3 py-1 text-xs">
                  <CalendarDays className="h-3.5 w-3.5 text-indigo-400" />
                  <span className="text-slate-400 text-[11px] font-medium">Target Date:</span>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-transparent text-slate-200 text-xs font-semibold focus:outline-none cursor-pointer"
                  />
                </div>
              )}

              {period === "custom" && (
                <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/90 px-3 py-1 text-xs">
                  <CalendarDays className="h-3.5 w-3.5 text-indigo-400" />
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 text-[11px]">From:</span>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="bg-transparent text-slate-200 text-xs font-semibold focus:outline-none cursor-pointer"
                    />
                  </div>
                  <span className="text-slate-500">&rarr;</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 text-[11px]">To:</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="bg-transparent text-slate-200 text-xs font-semibold focus:outline-none cursor-pointer"
                    />
                  </div>
                </div>
              )}

            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleRunDiagnosis}
                disabled={runningDiagnosis || !selectedUserId}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-indigo-500/30 transition-all hover:from-indigo-500 hover:to-indigo-400 active:scale-[0.98] disabled:opacity-50"
              >
                {runningDiagnosis ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Evaluating with AI...</span>
                  </>
                ) : (
                  <>
                    <Brain className="h-3.5 w-3.5" />
                    <span>⚡ Run AI Audit Now</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ================= TAB 1: AUDIT GENERATOR & ACTIVE VIEW ================= */}
      {activeTab === "generator" && (
        <>
          {loading ? (
            <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-12 text-center">
              <RefreshCw className="mx-auto h-8 w-8 animate-spin text-indigo-400" />
              <p className="text-sm font-semibold text-slate-400">Loading AI Manager evaluation...</p>
            </div>
          ) : selectedReport ? (
            <div className="space-y-6">
              
              {/* Report Header Card */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl backdrop-blur-md">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 font-bold border border-indigo-500/30">
                      {selectedReport.user?.name ? selectedReport.user.name.charAt(0).toUpperCase() : "D"}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold text-slate-100">
                          {selectedReport.user?.name || selectedUserObj?.name || "Developer Audit Report"}
                        </h2>
                        <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-400 font-medium">
                          {(selectedReport.user?.role || selectedUserObj?.role || "Developer")?.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                        <span>Cadence: <strong className="text-slate-300">{selectedReport.type || period.toUpperCase()}</strong></span>
                        <span>&bull;</span>
                        <span>Period: <strong className="text-slate-300">{selectedReport.date ? new Date(selectedReport.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : selectedDate}</strong></span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={() => setPrintingReport(selectedReport)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/90 px-3.5 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700 hover:text-white transition-all"
                    >
                      <Printer className="h-3.5 w-3.5 text-indigo-400" />
                      <span>Export PDF</span>
                    </button>
                    {getScoreBadge(selectedReport.healthScore || 80, selectedReport.statusLabel)}
                  </div>
                </div>

                {/* Vitals Row */}
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3.5">
                    <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                      <span>Duty Span</span>
                      <Clock className="h-3.5 w-3.5 text-sky-400" />
                    </div>
                    <div className="text-xl font-black text-sky-400 mt-1">
                      {selectedReport.vitals?.totalDutyHours ?? 0} <span className="text-xs font-normal text-slate-400">hrs</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Checked-in shift time</div>
                  </div>

                  <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3.5">
                    <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                      <span>Active Work</span>
                      <Activity className="h-3.5 w-3.5 text-emerald-400" />
                    </div>
                    <div className="text-xl font-black text-emerald-400 mt-1">
                      {selectedReport.vitals?.totalWorkHours ?? 0} <span className="text-xs font-normal text-slate-400">hrs</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Tasks & development sessions</div>
                  </div>

                  <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3.5">
                    <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                      <span>All Breaks</span>
                      <Coffee className="h-3.5 w-3.5 text-amber-400" />
                    </div>
                    <div className="text-xl font-black text-amber-400 mt-1">
                      {selectedReport.vitals?.totalBreakHours ?? 0} <span className="text-xs font-normal text-slate-400">hrs</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Namaz, meals & refreshments</div>
                  </div>

                  <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3.5">
                    <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                      <span>Idle Gap</span>
                      <Clock3 className="h-3.5 w-3.5 text-slate-400" />
                    </div>
                    <div className="text-xl font-black text-slate-300 mt-1">
                      {selectedReport.vitals?.totalIdleHours ?? 0} <span className="text-xs font-normal text-slate-400">hrs</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Unallocated duty time</div>
                  </div>
                </div>
              </div>

              {/* Section 1: Executive Assessment */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl backdrop-blur-md">
                <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-indigo-400 mb-3">
                  <FileText className="h-4 w-4" /> Executive Performance &amp; Delivery Assessment
                </div>
                <div className="rounded-xl border border-indigo-500/20 bg-indigo-950/20 p-4 text-slate-200 text-sm leading-relaxed font-medium">
                  "{selectedReport.clinicalSummary || "No executive summary recorded."}"
                </div>
              </div>

              {/* Section 2: Learning Topics & Focus Areas */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl backdrop-blur-md">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                  <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-indigo-400">
                    <BookOpen className="h-4 w-4" /> Analyzed Technical Knowledge &amp; Learning Domains
                  </div>
                  <span className="text-xs font-bold text-slate-400">
                    {(selectedReport.learningTopics || []).length} Domain{((selectedReport.learningTopics || []).length === 1) ? "" : "s"} Evaluated
                  </span>
                </div>

                {(!selectedReport.learningTopics || selectedReport.learningTopics.length === 0) ? (
                  <div className="text-xs text-slate-400 p-4 text-center rounded-xl bg-slate-950/40 border border-slate-800">
                    No distinct learning topics identified in activity descriptions for this timeframe.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedReport.learningTopics.map((topic, i) => (
                      <div key={i} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-2.5 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500/20 text-[10px] font-bold text-indigo-400 shrink-0">
                                {i + 1}
                              </span>
                              <span>{topic.topic}</span>
                            </h4>
                            <span className="rounded-full bg-sky-500/15 px-2.5 py-0.5 text-xs font-bold text-sky-400 border border-sky-500/20 shrink-0">
                              ~{topic.estimatedHours || 0} hrs
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed mt-2 pl-7">
                            {topic.assessment}
                          </p>
                        </div>

                        {topic.evidenceDescriptions?.length > 0 && (
                          <div className="pt-2.5 pl-7 border-t border-slate-800/80">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                              Key Work &amp; Deliverables:
                            </div>
                            <ul className="space-y-1 text-[11px] text-slate-300">
                              {topic.evidenceDescriptions.map((desc, idx) => (
                                <li key={idx} className="flex items-start gap-1.5 leading-normal">
                                  <span className="text-indigo-400 font-bold shrink-0">&bull;</span>
                                  <span>{desc}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 3 & 4: Anomalies + Prescriptions Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Workflow Flags */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl backdrop-blur-md">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                    <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-rose-400">
                      <ShieldAlert className="h-4 w-4" /> Workflow Flags &amp; Compliance Risks
                    </div>
                    <span className="text-xs font-bold text-slate-400">
                      {(selectedReport.anomaliesDetected || []).length} Flags
                    </span>
                  </div>

                  {(!selectedReport.anomaliesDetected || selectedReport.anomaliesDetected.length === 0) ? (
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-5 text-xs text-emerald-300 font-semibold flex items-center gap-2.5">
                      <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                      <span>No workflow anomalies or compliance risks detected. Excellent discipline!</span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedReport.anomaliesDetected.map((anomaly, i) => (
                        <div key={i} className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
                              <span className="text-xs font-bold text-slate-200">{anomaly.type?.replace(/_/g, " ")}</span>
                            </div>
                            {getSeverityBadge(anomaly.severity)}
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed">
                            {anomaly.description}
                          </p>
                          {anomaly.prescription && (
                            <div className="rounded-lg bg-slate-950/70 border border-slate-800/80 p-2.5 text-xs text-amber-300 flex items-start gap-2">
                              <span className="font-bold text-amber-400 shrink-0">Remedy:</span>
                              <span>{anomaly.prescription}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Manager Action Items */}
                <div className="rounded-2xl border border-indigo-500/20 bg-slate-900/80 p-6 shadow-xl backdrop-blur-md">
                  <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-indigo-400 border-b border-slate-800 pb-3 mb-4">
                    <Brain className="h-4 w-4" /> Manager Action Items &amp; Next Sprint Strategy
                  </div>

                  {(!selectedReport.doctorPrescriptions || selectedReport.doctorPrescriptions.length === 0) ? (
                    <div className="text-xs text-slate-400 p-4 text-center rounded-xl bg-slate-950/40 border border-slate-800">
                      No action items recorded.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedReport.doctorPrescriptions.map((action, i) => (
                        <div key={i} className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 text-xs text-slate-200">
                          <span className="font-mono text-xs font-bold text-indigo-400 shrink-0 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                            #{i + 1}
                          </span>
                          <span className="leading-relaxed font-medium">{action}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-14 text-center space-y-3">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                <Brain className="h-8 w-8 text-indigo-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-200">No Diagnosis Generated Yet</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                Click <strong className="text-indigo-400">"⚡ Run AI Audit Now"</strong> above to run an instant Google Gemini AI analysis on <strong className="text-slate-200">{selectedUserObj?.name || "the selected developer"}</strong> for the selected <strong className="text-slate-200">{period}</strong> period.
              </p>
            </div>
          )}
        </>
      )}

      {/* ================= TAB 2: REPORTS DATA GRID & PDF EXPORTS ================= */}
      {activeTab === "grid" && (
        <div className="space-y-5">
          
          {/* Table Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl">
            <div className="flex flex-wrap items-center gap-3">
              
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search reports by developer or keyword..."
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  className="rounded-xl border border-slate-700 bg-slate-950/80 pl-9 pr-4 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64 sm:w-80"
                />
              </div>

              {/* Filter by Developer */}
              <select
                value={tableUserFilter}
                onChange={(e) => setTableUserFilter(e.target.value)}
                className="rounded-xl border border-slate-700 bg-slate-800/90 px-3 py-1.5 text-xs font-semibold text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">All Developers ({teamUsers.length})</option>
                {teamUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>

              {/* Filter by Cadence */}
              <select
                value={tableTypeFilter}
                onChange={(e) => setTableTypeFilter(e.target.value)}
                className="rounded-xl border border-slate-700 bg-slate-800/90 px-3 py-1.5 text-xs font-semibold text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">All Periods</option>
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
                <option value="CUSTOM">Custom</option>
              </select>

            </div>

            <div className="text-xs text-slate-400 font-medium">
              Showing <strong>{filteredTableReports.length}</strong> of <strong>{reports.length}</strong> reports
            </div>
          </div>

          {/* Data Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70 shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 bg-slate-950/80 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-5 py-3.5">Developer</th>
                    <th className="px-4 py-3.5">Cadence</th>
                    <th className="px-4 py-3.5">Inspected Date</th>
                    <th className="px-4 py-3.5">Productivity Score</th>
                    <th className="px-4 py-3.5">Work / Duty</th>
                    <th className="px-4 py-3.5">Generated On</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredTableReports.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-10 text-center text-slate-500">
                        No AI Manager audit reports match your search or filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredTableReports.map((report) => (
                      <tr
                        key={report.id}
                        className="hover:bg-slate-800/40 transition-colors group cursor-pointer"
                        onClick={() => setViewingReport(report)}
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20 text-xs font-bold text-indigo-400 border border-indigo-500/30 shrink-0">
                              {report.user?.name ? report.user.name.charAt(0).toUpperCase() : "D"}
                            </div>
                            <div>
                              <div className="font-bold text-slate-200">{report.user?.name || "Developer"}</div>
                              <div className="text-[10px] text-slate-400">{report.user?.role?.replace(/_/g, " ")}</div>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-300 border border-slate-700">
                            {report.type}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 font-medium text-slate-300">
                          {report.date ? new Date(report.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "N/A"}
                        </td>

                        <td className="px-4 py-3.5">
                          {getScoreBadge(report.healthScore, report.statusLabel)}
                        </td>

                        <td className="px-4 py-3.5 text-slate-300 font-mono">
                          <strong className="text-emerald-400">{report.vitals?.totalWorkHours ?? 0}h</strong>
                          <span className="text-slate-500"> / </span>
                          <span className="text-slate-400">{report.vitals?.totalDutyHours ?? 0}h</span>
                        </td>

                        <td className="px-4 py-3.5 text-slate-400">
                          {new Date(report.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </td>

                        <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            {/* View Full Report */}
                            <button
                              onClick={() => setViewingReport(report)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs font-bold text-slate-200 hover:bg-indigo-600 hover:border-indigo-500 hover:text-white transition-all shadow-sm"
                              title="View Full Report"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span>View</span>
                            </button>

                            {/* Export PDF */}
                            <button
                              onClick={() => setPrintingReport(report)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs font-bold text-indigo-300 hover:bg-indigo-600 hover:border-indigo-500 hover:text-white transition-all shadow-sm"
                              title="Download / Print PDF"
                            >
                              <Printer className="h-3.5 w-3.5" />
                              <span>PDF</span>
                            </button>

                            {/* Delete */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setReportToDelete(report);
                              }}
                              disabled={deletingId === report.id}
                              className="inline-flex items-center justify-center rounded-lg border border-slate-700/80 bg-slate-800/60 p-1.5 text-slate-400 hover:border-rose-500/50 hover:bg-rose-500/20 hover:text-rose-300 transition-all cursor-pointer"
                              title="Delete Report"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= VIEW REPORT DETAILS MODAL ================= */}
      {viewingReport && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setViewingReport(null);
          }}
          className="fixed inset-0 z-[99999] overflow-y-auto bg-slate-950/85 backdrop-blur-md pt-24 sm:pt-28 pb-16 px-4 sm:px-6 flex items-start justify-center"
        >
          <div className="w-full max-w-4xl rounded-2xl border border-slate-700/80 bg-slate-900/95 p-6 sm:p-8 shadow-2xl space-y-6 max-h-[85vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 font-bold border border-indigo-500/30 shrink-0">
                  {viewingReport.user?.name ? viewingReport.user.name.charAt(0).toUpperCase() : "D"}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-100">{viewingReport.user?.name} &bull; {viewingReport.type} Audit</h3>
                  <p className="text-xs text-slate-400">Date: {new Date(viewingReport.date || viewingReport.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setPrintingReport(viewingReport)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-indigo-500 active:scale-95 transition-all cursor-pointer shadow"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Print PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setReportToDelete(viewingReport)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-1.5 text-xs font-bold text-rose-300 hover:bg-rose-500 hover:text-white transition-all cursor-pointer shadow"
                  title="Delete Report"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingReport(null)}
                  className="inline-flex items-center justify-center rounded-xl bg-slate-800 border border-slate-700 p-2 text-slate-300 hover:text-white hover:bg-slate-700 active:scale-95 transition-all cursor-pointer shadow"
                  title="Close (Esc)"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Score & Vitals */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <span className="text-[10px] uppercase font-bold text-slate-500">Quality Score</span>
                <div className="mt-1">{getScoreBadge(viewingReport.healthScore, viewingReport.statusLabel)}</div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <span className="text-[10px] uppercase font-bold text-slate-500">Productive Work</span>
                <div className="text-lg font-black text-emerald-400 mt-1">{viewingReport.vitals?.totalWorkHours ?? 0} hrs</div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <span className="text-[10px] uppercase font-bold text-slate-500">Duty Checked-in</span>
                <div className="text-lg font-black text-sky-400 mt-1">{viewingReport.vitals?.totalDutyHours ?? 0} hrs</div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <span className="text-[10px] uppercase font-bold text-slate-500">Idle Gap</span>
                <div className="text-lg font-black text-slate-400 mt-1">{viewingReport.vitals?.totalIdleHours ?? 0} hrs</div>
              </div>
            </div>

            {/* Executive Assessment */}
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-950/20 p-4 text-xs text-slate-200 leading-relaxed font-medium">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 block mb-1">Executive Summary:</span>
              "{viewingReport.clinicalSummary}"
            </div>

            {/* Learning Topics */}
            {viewingReport.learningTopics?.length > 0 && (
              <div className="space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 block">Technical Knowledge &amp; Domains:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {viewingReport.learningTopics.map((topic, i) => (
                    <div key={i} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs space-y-1">
                      <div className="flex items-center justify-between font-bold text-slate-200">
                        <span>{i + 1}. {topic.topic}</span>
                        <span className="text-indigo-400">~{topic.estimatedHours}h</span>
                      </div>
                      <p className="text-slate-400 leading-relaxed">{topic.assessment}</p>
                      {topic.evidenceDescriptions?.length > 0 && (
                        <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
                          <strong className="text-slate-300 block mb-0.5">Key Deliverables:</strong>
                          <ul className="list-disc list-inside space-y-0.5">
                            {topic.evidenceDescriptions.map((d, idx) => (
                              <li key={idx}>{d}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Manager Action Items */}
            {viewingReport.doctorPrescriptions?.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 block">Manager Action Items &amp; Next Sprint Strategy:</span>
                {viewingReport.doctorPrescriptions.map((action, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-xs text-slate-300 bg-slate-950/60 border border-slate-800 p-2.5 rounded-lg">
                    <span className="font-bold text-indigo-400 shrink-0">#{i + 1}</span>
                    <span>{action}</span>
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>
      )}

      {/* ================= CONFIRM DELETE REPORT MODAL ================= */}
      {reportToDelete && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget && !deletingId) setReportToDelete(null);
          }}
          className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/95 p-6 shadow-2xl space-y-5">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/15 text-rose-400">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-100">Delete Audit Report</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Are you sure you want to delete the <span className="font-bold text-slate-200">{reportToDelete.type}</span> audit report for <strong className="text-indigo-400">{reportToDelete.user?.name || "Developer"}</strong>?
                </p>
                <div className="mt-2 rounded-lg border border-slate-800 bg-slate-950/70 p-2.5 text-[11px] text-slate-400">
                  <div className="flex justify-between">
                    <span>Audit Date:</span>
                    <strong className="text-slate-200">{reportToDelete.date ? new Date(reportToDelete.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "N/A"}</strong>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span>Productivity Score:</span>
                    <strong className="text-emerald-400">{reportToDelete.healthScore ?? 0}/100</strong>
                  </div>
                </div>
                <p className="text-[11px] text-rose-400/90 font-medium pt-1">
                  This action is permanent and cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-800/80 pt-4">
              <button
                type="button"
                disabled={Boolean(deletingId)}
                onClick={() => setReportToDelete(null)}
                className="rounded-xl border border-slate-700 bg-slate-800/90 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition-all disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={Boolean(deletingId)}
                onClick={handleConfirmDelete}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-500 active:scale-95 transition-all shadow-lg shadow-rose-600/30 disabled:opacity-50 cursor-pointer"
              >
                {deletingId ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete Report</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= PRINT / PDF VIEW OVERLAY ================= */}
      {printingReport && (
        <ReportPdfPrintView
          report={printingReport}
          onClose={() => setPrintingReport(null)}
        />
      )}

    </div>
  );
}
