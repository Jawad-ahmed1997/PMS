"use client";

import { useEffect } from "react";
import { Printer, X, Download, ShieldCheck, Clock, CheckCircle2, AlertTriangle, BookOpen, Brain, Activity } from "lucide-react";

export default function ReportPdfPrintView({ report, onClose }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!report) return null;

  const handlePrint = () => {
    window.print();
  };

  const getScoreClass = (score) => {
    if (score >= 80) return "text-emerald-700 bg-emerald-50 border-emerald-300";
    if (score >= 65) return "text-amber-700 bg-amber-50 border-amber-300";
    return "text-rose-700 bg-rose-50 border-rose-300";
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      className="fixed inset-0 z-[99999] overflow-y-auto bg-slate-950/85 backdrop-blur-md pt-24 sm:pt-28 pb-16 px-4 sm:px-6 print:p-0 print:bg-white print:static"
    >
      
      {/* Top Floating Action Bar (hidden during print) */}
      <div className="mx-auto max-w-4xl flex items-center justify-between bg-slate-900/95 border border-slate-700/80 rounded-2xl p-4 mb-5 shadow-2xl backdrop-blur-md print:hidden">
        <div className="flex items-center gap-2.5 text-slate-100 text-sm font-bold">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600/30 text-indigo-400 border border-indigo-500/40">
            <Printer className="h-4 w-4" />
          </div>
          <div>
            <span>Executive PDF Print Preview</span>
            <span className="text-slate-400 text-xs font-normal ml-2">({report.user?.name} &bull; {report.type})</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 active:scale-95 transition-all cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            <span>Print / Save as PDF</span>
          </button>
          
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-xl bg-slate-800 border border-slate-700 p-2 text-slate-300 hover:text-white hover:bg-slate-700 active:scale-95 transition-all cursor-pointer shadow"
            title="Close Preview (Esc)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Printable Paper Document (A4/Letter Optimized) */}
      <div className="mx-auto max-w-4xl bg-white text-slate-900 rounded-2xl p-8 sm:p-12 shadow-2xl print:shadow-none print:p-6 print:rounded-none print:max-w-none print:w-full border border-slate-200">
        
        {/* Document Header */}
        <div className="border-b-2 border-slate-900 pb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.25em] text-indigo-600">
              GATEKOD SOLUTIONS &bull; PMS CLOUD
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-950 mt-1">
              AI Engineering Management &amp; Delivery Audit Report
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              Generated automatically via Gemini Intelligence Engine &bull; Confidential
            </p>
          </div>
          
          <div className="text-right">
            <div className={`inline-block px-4 py-1.5 rounded-xl border-2 font-black text-sm ${getScoreClass(report.healthScore)}`}>
              QUALITY SCORE: {report.healthScore}/100 &bull; {report.statusLabel || "GOOD"}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Audit Date: {new Date(report.date || report.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </div>
          </div>
        </div>

        {/* Developer & Cadence Meta Box */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
          <div>
            <span className="text-slate-500 font-semibold uppercase text-[10px] block">Engineer</span>
            <span className="font-bold text-slate-900 text-sm">{report.user?.name || "Developer"}</span>
          </div>
          <div>
            <span className="text-slate-500 font-semibold uppercase text-[10px] block">Designation / Role</span>
            <span className="font-bold text-slate-900">{(report.user?.role || "Developer")?.replace(/_/g, " ")}</span>
          </div>
          <div>
            <span className="text-slate-500 font-semibold uppercase text-[10px] block">Audit Period</span>
            <span className="font-bold text-indigo-600">{report.type || "WEEKLY"}</span>
          </div>
          <div>
            <span className="text-slate-500 font-semibold uppercase text-[10px] block">Report ID</span>
            <span className="font-mono text-slate-700 text-[11px]">{report.id ? report.id.slice(-8) : "N/A"}</span>
          </div>
        </div>

        {/* Shift & Work Vitals Grid */}
        <div className="mt-6">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-2 mb-3">
            1. Shift &amp; Delivery Vitals
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
              <div className="text-[10px] font-bold uppercase text-slate-500">Duty Checked-in</div>
              <div className="text-lg font-black text-slate-900 mt-0.5">{report.vitals?.totalDutyHours ?? 0} hrs</div>
            </div>
            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
              <div className="text-[10px] font-bold uppercase text-slate-500">Productive Work</div>
              <div className="text-lg font-black text-emerald-700 mt-0.5">{report.vitals?.totalWorkHours ?? 0} hrs</div>
            </div>
            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
              <div className="text-[10px] font-bold uppercase text-slate-500">Breaks (Namaz/Meal)</div>
              <div className="text-lg font-black text-amber-700 mt-0.5">{report.vitals?.totalBreakHours ?? 0} hrs</div>
            </div>
            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
              <div className="text-[10px] font-bold uppercase text-slate-500">Unaccounted Idle</div>
              <div className="text-lg font-black text-slate-700 mt-0.5">{report.vitals?.totalIdleHours ?? 0} hrs</div>
            </div>
          </div>
        </div>

        {/* Executive Assessment */}
        <div className="mt-6">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-2 mb-3">
            2. Executive Performance &amp; Delivery Assessment
          </h2>
          <div className="border border-indigo-100 bg-indigo-50/50 p-4 rounded-xl text-slate-800 text-xs leading-relaxed font-medium">
            "{report.clinicalSummary || "Executive summary not available."}"
          </div>
        </div>

        {/* Learning & Knowledge Domains Table */}
        <div className="mt-6">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-2 mb-3">
            3. Analyzed Technical Knowledge &amp; Learning Domains
          </h2>
          {(!report.learningTopics || report.learningTopics.length === 0) ? (
            <p className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-lg">No separate learning topics recorded for this period.</p>
          ) : (
            <div className="space-y-3">
              {report.learningTopics.map((topic, i) => (
                <div key={i} className="border border-slate-200 rounded-xl p-3.5 bg-slate-50 text-xs">
                  <div className="flex items-center justify-between font-bold text-slate-900 mb-1">
                    <span>{i + 1}. {topic.topic}</span>
                    <span className="text-indigo-600 font-mono">~{topic.estimatedHours || 0} hrs</span>
                  </div>
                  <p className="text-slate-700 leading-relaxed">{topic.assessment}</p>
                  {topic.evidenceDescriptions?.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-slate-200 text-[11px] text-slate-600">
                      <strong className="text-slate-700 block mb-1">Key Deliverables &amp; Work Evidence:</strong>
                      <ul className="list-disc list-inside space-y-0.5 pl-1">
                        {topic.evidenceDescriptions.map((desc, idx) => (
                          <li key={idx} className="leading-normal">{desc}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Workflow Flags & Anomalies */}
        <div className="mt-6">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-2 mb-3">
            4. Workflow Flags &amp; Compliance Risks
          </h2>
          {(!report.anomaliesDetected || report.anomaliesDetected.length === 0) ? (
            <div className="border border-emerald-200 bg-emerald-50 p-3 rounded-xl text-xs text-emerald-800 font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Clean execution &bull; No discipline or compliance anomalies detected.</span>
            </div>
          ) : (
            <div className="space-y-2.5">
              {report.anomaliesDetected.map((anomaly, i) => (
                <div key={i} className="border border-slate-200 rounded-xl p-3 bg-slate-50 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900">{anomaly.type?.replace(/_/g, " ")}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">{anomaly.severity || "MEDIUM"}</span>
                  </div>
                  <p className="text-slate-700">{anomaly.description}</p>
                  {anomaly.prescription && (
                    <p className="text-slate-800 font-medium mt-1"><strong>Action:</strong> {anomaly.prescription}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Manager Action Items & Next Sprint Strategy */}
        <div className="mt-6">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-2 mb-3">
            5. Manager Action Items &amp; Next Sprint Strategy
          </h2>
          {(!report.doctorPrescriptions || report.doctorPrescriptions.length === 0) ? (
            <p className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-lg">No action items recorded.</p>
          ) : (
            <div className="space-y-2">
              {report.doctorPrescriptions.map((action, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-slate-800 bg-slate-50 border border-slate-200 p-2.5 rounded-lg">
                  <span className="font-bold text-indigo-600 shrink-0">#{i + 1}</span>
                  <span className="leading-relaxed font-medium">{action}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sign-off Footer */}
        <div className="mt-10 pt-6 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-400">
          <div>GateKod Solutions PMS &bull; AI Management Intelligence</div>
          <div>Printed on {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
        </div>

      </div>
    </div>
  );
}
