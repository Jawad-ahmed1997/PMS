"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import { 
  Play, 
  Pause, 
  Square, 
  History, 
  Clock, 
  ChevronDown, 
  ChevronUp, 
  Activity,
  AlertCircle,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogRoot as Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const STORAGE_KEY_POS_X = "activity_timer_pos_x";
const STORAGE_KEY_POS_Y = "activity_timer_pos_y";
const STORAGE_KEY_STATE = "activity_timer_state";

const BREAK_TYPES = [
  { value: "NAMAZ", label: "Namaz" },
  { value: "LUNCH", label: "Lunch" },
  { value: "DINNER", label: "Dinner" },
  { value: "REFRESHMENT", label: "Refreshment" },
  { value: "OTHER", label: "Other" },
];

const MANUAL_CATEGORIES = [
  { value: "LEARNING", label: "Learning" },
  { value: "RESEARCH", label: "Research" },
  { value: "OTHER", label: "Other" },
];

function clamp(n, min, max) {
  return Math.min(Math.max(n, min), max);
}

function formatHHMMSS(totalSeconds = 0) {
  const value = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(value / 3600).toString().padStart(2, "0");
  const minutes = Math.floor((value % 3600) / 60).toString().padStart(2, "0");
  const seconds = Math.floor(value % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

export default function FloatingActivityTimer({ session }) {
  const { addToast } = useToast();
  const userTimeZone = session?.user?.timezone || "Asia/Karachi";

  // Persistent States
  const [timerState, setTimerState] = useState(() => {
    if (typeof window === "undefined") {
      return { 
        running: false, 
        paused: false, 
        startTime: null, 
        accumulatedSeconds: 0, 
        description: "",
        currentBreak: null, // { type, notes, startAt }
        breaks: [] // array of completed breaks { type, notes, durationSeconds, startAt, endAt }
      };
    }
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY_STATE);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error("Error reading activity timer state", e);
    }
    return { running: false, paused: false, startTime: null, accumulatedSeconds: 0, description: "", currentBreak: null, breaks: [] };
  });

  const [position, setPosition] = useState(() => {
    if (typeof window === "undefined") {
      return { x: 24, y: 380 };
    }
    const storedX = window.localStorage.getItem(STORAGE_KEY_POS_X);
    const storedY = window.localStorage.getItem(STORAGE_KEY_POS_Y);
    if (storedX !== null && storedY !== null) {
      const x = Number(storedX);
      const y = Number(storedY);
      if (Number.isFinite(x) && Number.isFinite(y)) {
        return { x, y };
      }
    }
    return { x: 24, y: 380 };
  });

  // UI States
  const [activeSeconds, setActiveSeconds] = useState(0);
  const [breakSeconds, setBreakSeconds] = useState(0);
  const [showStartModal, setShowStartModal] = useState(false);
  const [showStopModal, setShowStopModal] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectingBreak, setSelectingBreak] = useState(false);

  // Form States
  const [startForm, setStartForm] = useState({ description: "" });
  const [stopForm, setStopForm] = useState({
    category: "LEARNING",
  });
  const [breakForm, setBreakForm] = useState({
    breakType: "NAMAZ",
    otherText: "",
  });

  // Intercept Action Warning State
  const [warningAction, setWarningAction] = useState(null);

  // History / Summary State
  const [todayLogs, setTodayLogs] = useState([]);
  const [todayBreaks, setTodayBreaks] = useState([]);
  const [activeAttendanceId, setActiveAttendanceId] = useState(null);
  const [onDuty, setOnDuty] = useState(false);

  const containerRef = useRef(null);
  const dragPointerIdRef = useRef(null);
  const dragStartOffsetRef = useRef({ x: 0, y: 0 });

  // Helper to format date key in user timezone
  const getTodayDateStr = useCallback(() => {
    try {
      return new Intl.DateTimeFormat("fr-CA", { timeZone: userTimeZone }).format(new Date());
    } catch (e) {
      return new Date().toISOString().slice(0, 10);
    }
  }, [userTimeZone]);

  // Save state to localStorage helper
  const saveState = (state) => {
    setTimerState(state);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(state));
    }
  };

  // Dragging logic
  const onPointerDownDrag = (event) => {
    if (event.button !== 0) return;
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    dragPointerIdRef.current = event.pointerId;

    const clientX = event.clientX;
    const clientY = event.clientY;
    dragStartOffsetRef.current = {
      x: clientX - position.x,
      y: clientY - position.y,
    };
  };

  const onPointerMoveDrag = (event) => {
    if (dragPointerIdRef.current !== event.pointerId) return;
    const clientX = event.clientX;
    const clientY = event.clientY;

    const newX = clamp(clientX - dragStartOffsetRef.current.x, 0, window.innerWidth - 336);
    const newY = clamp(clientY - dragStartOffsetRef.current.y, 0, window.innerHeight - 80);

    const nextPos = { x: newX, y: newY };
    setPosition(nextPos);
    window.localStorage.setItem(STORAGE_KEY_POS_X, String(newX));
    window.localStorage.setItem(STORAGE_KEY_POS_Y, String(newY));
  };

  const onPointerUpDrag = (event) => {
    if (dragPointerIdRef.current !== event.pointerId) return;
    dragPointerIdRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  // Sync log summary for the day
  const fetchTodayData = useCallback(async () => {
    if (!session) return;
    try {
      const todayDateStr = getTodayDateStr();
      
      // Fetch Activity logs
      const actRes = await fetch(`/api/activity?startDate=${todayDateStr}&endDate=${todayDateStr}`, { cache: "no-store" });
      if (actRes.ok) {
        const actData = await actRes.json();
        const logs = actData?.activityLogs || [];
        setTodayLogs(logs.filter(l => l.type === "MANUAL"));
      }

      // Fetch active attendance status (handles Auto-Off logic)
      const statusRes = await fetch(`/api/attendance/current-status`, { cache: "no-store" });
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setOnDuty(Boolean(statusData?.onDuty));
      }

      // Fetch Attendance records for today (returns correct breaks list and ID)
      const attRes = await fetch(`/api/attendance?from=${todayDateStr}&to=${todayDateStr}`, { cache: "no-store" });
      if (attRes.ok) {
        const attData = await attRes.json();
        const records = attData?.attendance || [];
        if (records.length > 0) {
          setActiveAttendanceId(records[0].id);
          setTodayBreaks(records[0].breaks || []);
        } else {
          setActiveAttendanceId(null);
          setTodayBreaks([]);
        }
      }
    } catch (e) {
      console.error("Error fetching today summary data", e);
    }
  }, [session, getTodayDateStr]);

  // Load and tick timer
  useEffect(() => {
    fetchTodayData();
  }, [fetchTodayData]);

  // Intercept warning listener
  useEffect(() => {
    const handleInterceptWarning = (e) => {
      if (timerState.running) {
        setWarningAction(e.detail);
        setShowWarningModal(true);
      }
    };
    window.addEventListener("pms:show-manual-warning", handleInterceptWarning);
    return () => {
      window.removeEventListener("pms:show-manual-warning", handleInterceptWarning);
    };
  }, [timerState]);

  useEffect(() => {
    let interval = null;
    if (timerState.running) {
      interval = setInterval(() => {
        if (!timerState.paused) {
          // Working: increment overall counter
          const elapsed = Math.floor((Date.now() - timerState.startTime) / 1000);
          setActiveSeconds(timerState.accumulatedSeconds + elapsed);
        } else if (timerState.currentBreak) {
          // On Break: increment break counter
          const elapsedBreak = Math.floor((Date.now() - timerState.currentBreak.startAt) / 1000);
          setBreakSeconds(elapsedBreak);
        }
      }, 1000);
    } else {
      setActiveSeconds(0);
      setBreakSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerState]);

  // Total Summary stats
  const totalWorkSeconds = useMemo(() => {
    return todayLogs.reduce((acc, log) => acc + (log.durationSeconds || 0), 0);
  }, [todayLogs]);

  const totalBreakSeconds = useMemo(() => {
    return todayBreaks.reduce((acc, brk) => acc + ((brk.durationMinutes || 0) * 60), 0);
  }, [todayBreaks]);

  // Actions
  const handleStartTimerClick = async () => {
    if (!onDuty) {
      addToast({
        title: "Action Blocked",
        message: "You must check in (be on duty) first before starting a manual activity.",
        variant: "error"
      });
      return;
    }

    // Block if task timer is currently active on server
    try {
      const activeTaskRes = await fetch("/api/tasks/active-session", { cache: "no-store" });
      if (activeTaskRes.ok) {
        const activeTaskData = await activeTaskRes.json();
        if (activeTaskData?.active) {
          addToast({
            title: "Task Timer Running",
            message: "Please pause or stop your active task timer before starting a manual activity.",
            variant: "error"
          });
          return;
        }
      }
    } catch (e) {
      console.error(e);
    }

    setStartForm({ description: "" });
    setShowStartModal(true);
  };

  const handleConfirmStart = (e) => {
    e.preventDefault();
    if (!startForm.description.trim()) {
      addToast({ title: "Input Required", message: "Please provide a description of the activity.", variant: "error" });
      return;
    }

    const state = {
      running: true,
      paused: false,
      startTime: Date.now(),
      accumulatedSeconds: 0,
      description: startForm.description.trim(),
      currentBreak: null,
      breaks: []
    };
    saveState(state);
    setShowStartModal(false);
    addToast({ title: "Activity Started", message: "Manual activity timer is running.", variant: "success" });
  };

  // Pause Work -> Start Break
  const handleTriggerPause = () => {
    setBreakForm({ breakType: "NAMAZ", otherText: "" });
    setSelectingBreak(true);
  };

  const handleConfirmPauseBreak = () => {
    const elapsed = Math.floor((Date.now() - timerState.startTime) / 1000);
    const state = {
      ...timerState,
      paused: true,
      accumulatedSeconds: timerState.accumulatedSeconds + elapsed,
      startTime: null,
      currentBreak: {
        type: breakForm.breakType,
        notes: breakForm.breakType === "OTHER" ? breakForm.otherText.trim() : "",
        startAt: Date.now()
      }
    };
    saveState(state);
    setSelectingBreak(false);
  };

  // Resume Work -> End Break
  const handleResumeWork = () => {
    if (!timerState.running || !timerState.paused || !timerState.currentBreak) return;

    const breakDurationSeconds = Math.max(0, Math.floor((Date.now() - timerState.currentBreak.startAt) / 1000));
    
    // Discard break interval if less than 30 seconds
    if (breakDurationSeconds < 30) {
      addToast({
        title: "Break Discarded",
        message: "Breaks must be at least 30 seconds long to be recorded.",
        variant: "warning"
      });
      const state = {
        ...timerState,
        paused: false,
        startTime: Date.now(),
        currentBreak: null
      };
      saveState(state);
      setBreakSeconds(0);
      return;
    }

    const completedBreak = {
      type: timerState.currentBreak.type,
      notes: timerState.currentBreak.notes,
      startAt: timerState.currentBreak.startAt,
      endAt: Date.now(),
      durationSeconds: breakDurationSeconds
    };

    const state = {
      ...timerState,
      paused: false,
      startTime: Date.now(),
      currentBreak: null,
      breaks: [...(timerState.breaks || []), completedBreak]
    };
    saveState(state);
    setBreakSeconds(0);
  };

  // Stop Timer
  const handleStopClick = () => {
    setShowStopModal(true);
  };

  const handleConfirmSave = async () => {
    setLoading(true);

    try {
      let finalWorkSeconds = timerState.accumulatedSeconds;
      let finalBreaks = [...(timerState.breaks || [])];

      // If active working when stopped
      if (!timerState.paused && timerState.startTime) {
        finalWorkSeconds += Math.floor((Date.now() - timerState.startTime) / 1000);
      }

      // If on break when stopped, evaluate break interval first
      if (timerState.paused && timerState.currentBreak) {
        const breakDurationSeconds = Math.max(0, Math.floor((Date.now() - timerState.currentBreak.startAt) / 1000));
        if (breakDurationSeconds >= 30) {
          finalBreaks.push({
            type: timerState.currentBreak.type,
            notes: timerState.currentBreak.notes,
            startAt: timerState.currentBreak.startAt,
            endAt: Date.now(),
            durationSeconds: breakDurationSeconds
          });
        }
      }

      // Activity duration must be at least 30 seconds
      if (finalWorkSeconds < 30) {
        addToast({
          title: "Session Too Short",
          message: "Activity work duration must be at least 30 seconds to save.",
          variant: "error"
        });
        setLoading(false);
        return;
      }

      const totalBreakTimeSeconds = finalBreaks.reduce((acc, b) => acc + b.durationSeconds, 0);

      // Save overall Work Log boundaries
      const now = new Date();
      const totalElapsedSeconds = finalWorkSeconds + totalBreakTimeSeconds;
      const startMs = now.getTime() - (totalElapsedSeconds * 1000);
      const startDate = new Date(startMs);

      const formatTimeStr = (d) => {
        const pad = (v) => String(v).padStart(2, "0");
        return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
      };

      const startTimeStr = formatTimeStr(startDate);
      const endTimeStr = formatTimeStr(now);

      // Create manual activity log (excluding breaks)
      const res = await fetch("/api/activity/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: timerState.description.trim(),
          categories: [stopForm.category],
          startTime: startTimeStr,
          endTime: endTimeStr,
          date: now.toISOString().slice(0, 10),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save activity log.");
      }

      // Automatically post breaks to attendance
      if (finalBreaks.length > 0 && activeAttendanceId) {
        for (const brk of finalBreaks) {
          const brkStart = new Date(brk.startAt);
          const brkEnd = new Date(brk.endAt);
          const minutes = Math.max(1, Math.round(brk.durationSeconds / 60));

          await fetch(`/api/attendance/${activeAttendanceId}/breaks`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              types: [brk.type],
              type: brk.type === "OTHER" && brk.notes ? `OTHER: ${brk.notes}` : brk.type,
              startTime: formatTimeStr(brkStart),
              endTime: formatTimeStr(brkEnd),
              notes: timerState.description.trim(),
              durationMinutes: minutes
            }),
          });
        }
      }

      addToast({
        title: "Activity Saved",
        message: "Activity work log and any break intervals have been saved.",
        variant: "success",
      });

      // Clear timer state
      const state = { running: false, paused: false, startTime: null, accumulatedSeconds: 0, description: "", currentBreak: null, breaks: [] };
      saveState(state);
      setActiveSeconds(0);
      setBreakSeconds(0);
      setShowStopModal(false);
      setShowWarningModal(false); // Close warning modal if open
      fetchTodayData();

      // Trigger dispatch if warning intercepted
      if (warningAction) {
        window.dispatchEvent(new CustomEvent("pms:manual-activity-saved", { detail: warningAction }));
        setWarningAction(null);
      }
    } catch (err) {
      addToast({
        title: "Save Failed",
        message: err instanceof Error ? err.message : "Unable to save activity.",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDiscardClick = () => {
    setShowDiscardModal(true);
  };

  const handleConfirmDiscard = () => {
    const state = { running: false, paused: false, startTime: null, accumulatedSeconds: 0, description: "", currentBreak: null, breaks: [] };
    saveState(state);
    setActiveSeconds(0);
    setBreakSeconds(0);
    setShowDiscardModal(false);
    setShowStopModal(false);
    setShowWarningModal(false); // Close warning modal if open

    if (warningAction) {
      window.dispatchEvent(new CustomEvent("pms:manual-activity-saved", { detail: warningAction }));
      setWarningAction(null);
    }
  };

  if (!session) return null;

  return (
    <>
      <section
        ref={containerRef}
        className="fixed z-[70] w-[320px] max-w-[calc(100vw-16px)] rounded-2xl border bg-[color:var(--color-surface)] p-3 shadow-2xl transition-all"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          borderColor: "var(--color-border)",
        }}
      >
        {/* Header Drag Area */}
        <div
          className="mb-2 flex cursor-grab items-center justify-between border-b pb-2 active:cursor-grabbing"
          style={{ borderColor: "var(--color-border)" }}
          onPointerDown={onPointerDownDrag}
          onPointerMove={onPointerMoveDrag}
          onPointerUp={onPointerUpDrag}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <Activity size={14} className="text-[color:var(--color-accent)] shrink-0" />
            <p className="truncate text-xs font-semibold uppercase tracking-wider text-[color:var(--color-text-subtle)]">
              {timerState.running ? "Active Activity" : "Activity Tracker"}
            </p>
          </div>
          <button 
            type="button" 
            onClick={() => setHistoryOpen(!historyOpen)}
            className="border-none border-0 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none rounded p-0.5 hover:bg-[color:var(--color-input)] text-[color:var(--color-text-subtle)] transition-colors bg-transparent"
          >
            {historyOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {/* Counter and Main UI */}
        <div className="space-y-3">
          {timerState.running ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-[color:var(--color-text)] truncate">
                {timerState.description}
              </p>
              
              {/* Dynamic Break Selector / Indicators inside panel */}
              {selectingBreak ? (
                <div className="rounded-lg bg-[color:var(--color-input)] p-2.5 space-y-2 border border-[color:var(--color-border)] animate-in fade-in zoom-in-95">
                  <p className="text-[10px] font-semibold text-[color:var(--color-text-subtle)] uppercase">Select Break Type</p>
                  <div className="grid grid-cols-2 gap-1">
                    {BREAK_TYPES.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setBreakForm({ ...breakForm, breakType: opt.value })}
                        className={`rounded-lg px-2 py-1 text-[11px] font-medium border text-left truncate transition-all ${
                          breakForm.breakType === opt.value
                            ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)] font-semibold"
                            : "border-[color:var(--color-border)] bg-[color:var(--color-card)] text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-input)]"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {breakForm.breakType === "OTHER" && (
                    <Input
                      value={breakForm.otherText}
                      onChange={(e) => setBreakForm({ ...breakForm, otherText: e.target.value })}
                      placeholder="e.g. Tea Break"
                      className="h-7 text-xs rounded-lg border-[color:var(--color-border)] bg-[color:var(--color-card)]"
                    />
                  )}
                  <div className="flex gap-2 justify-end pt-1">
                    <Button size="xs" variant="outline" onClick={() => setSelectingBreak(false)} className="h-6 text-[10px] rounded-lg">Cancel</Button>
                    <Button size="xs" onClick={handleConfirmPauseBreak} className="h-6 text-[10px] rounded-lg bg-[color:var(--color-accent)] text-white hover:bg-[color:var(--color-accent)]/95">Confirm Break</Button>
                  </div>
                </div>
              ) : timerState.paused ? (
                // On Break Layout
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold text-amber-500 uppercase tracking-wider">On Break</p>
                    <p className="text-xs text-[color:var(--color-text-muted)] truncate">
                      {timerState.currentBreak?.type === "OTHER" && timerState.currentBreak?.notes 
                        ? timerState.currentBreak.notes 
                        : timerState.currentBreak?.type}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs font-semibold tabular-nums text-amber-500">
                      {formatHHMMSS(breakSeconds)}
                    </span>
                    <button
                      type="button"
                      onClick={handleResumeWork}
                      className="rounded-lg p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-all text-xs font-semibold flex items-center gap-1"
                      title="Resume Work"
                    >
                      <Play size={10} fill="currentColor" />
                      Resume
                    </button>
                  </div>
                </div>
              ) : (
                // Normal running counter
                <div className="flex items-center justify-between">
                  <p className="text-2xl font-bold tabular-nums text-[color:var(--color-text)] animate-pulse">
                    {formatHHMMSS(activeSeconds)}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleTriggerPause}
                      className="rounded-lg p-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 transition-all"
                      title="Pause (Start Break)"
                    >
                      <Pause size={14} fill="currentColor" />
                    </button>
                    <button
                      type="button"
                      onClick={handleStopClick}
                      className="rounded-lg p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all"
                      title="End Activity"
                    >
                      <Square size={14} fill="currentColor" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                onClick={handleStartTimerClick}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-[color:var(--color-accent)] text-white hover:bg-[color:var(--color-accent)]/90"
              >
                <Play size={14} fill="currentColor" />
                Start Activity
              </Button>
              {!onDuty && (
                <p className="text-[10px] text-amber-500 text-center flex items-center gap-1 justify-center bg-amber-500/10 p-1.5 rounded-lg border border-amber-500/20">
                  <AlertCircle size={12} />
                  You must check in (on duty) first.
                </p>
              )}
            </div>
          )}

          {/* Today's summary label */}
          <div className="flex items-center justify-between text-[11px] border-t pt-2 text-[color:var(--color-text-subtle)]" style={{ borderColor: "var(--color-border)" }}>
            <span className="flex items-center gap-1">
              <Clock size={11} />
              Today Summary:
            </span>
            <span>
              Work: {Math.round(totalWorkSeconds / 60)}m | Break: {Math.round(totalBreakSeconds / 60)}m
            </span>
          </div>

          {/* Expandable History Dropdown */}
          {historyOpen && (
            <div className="mt-2 border-t pt-2 max-h-[180px] overflow-y-auto space-y-2 text-xs text-[color:var(--color-text-muted)]" style={{ borderColor: "var(--color-border)" }}>
              <p className="font-semibold text-[10px] uppercase tracking-wider text-[color:var(--color-text-subtle)] flex items-center gap-1">
                <History size={11} />
                Today's History
              </p>
              
              {todayLogs.length === 0 && todayBreaks.length === 0 ? (
                <p className="text-center text-[11px] py-4 text-[color:var(--color-text-subtle)]">
                  No sessions recorded today.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {/* Activity Logs */}
                  {todayLogs.map(log => (
                    <div key={log.id} className="rounded border bg-[color:var(--color-input)] px-2 py-1 flex flex-col gap-0.5 border-[color:var(--color-border)]">
                      <div className="flex items-center justify-between font-medium">
                        <span className="truncate max-w-[160px] text-[color:var(--color-text)]">{log.description}</span>
                        <span className="text-[10px] text-emerald-400">Work ({Math.round(log.durationSeconds / 60)}m)</span>
                      </div>
                      <span className="text-[10px] text-[color:var(--color-text-subtle)]">
                        {new Date(log.startAt).toLocaleTimeString("en-US", { timeZone: userTimeZone, hour: "2-digit", minute: "2-digit" })} - {new Date(log.endAt).toLocaleTimeString("en-US", { timeZone: userTimeZone, hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  ))}

                  {/* Attendance Breaks */}
                  {todayBreaks.map(brk => (
                    <div key={brk.id} className="rounded border bg-[color:var(--color-input)] px-2 py-1 flex flex-col gap-0.5 border-[color:var(--color-border)]">
                      <div className="flex items-center justify-between font-medium">
                        <span className="truncate max-w-[160px] text-[color:var(--color-text)]">{brk.notes || brk.type}</span>
                        <span className="text-[10px] text-amber-400">Break ({brk.durationMinutes}m)</span>
                      </div>
                      <span className="text-[10px] text-[color:var(--color-text-subtle)]">
                        {new Date(brk.startAt).toLocaleTimeString("en-US", { timeZone: userTimeZone, hour: "2-digit", minute: "2-digit" })} - {new Date(brk.endAt).toLocaleTimeString("en-US", { timeZone: userTimeZone, hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Start Activity Input Modal */}
      <Dialog open={showStartModal} onOpenChange={setShowStartModal}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)] animate-in fade-in zoom-in-95 duration-200">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-[color:var(--color-text)] flex items-center gap-2">
              <Activity className="text-[color:var(--color-accent)]" />
              What are you working on?
            </DialogTitle>
            <DialogDescription className="text-xs text-[color:var(--color-text-subtle)]">Provide a brief description to begin your manual activity log.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleConfirmStart} className="space-y-4 pt-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[color:var(--color-text-muted)]">Description</label>
              <Textarea
                value={startForm.description}
                onChange={(e) => setStartForm({ ...startForm, description: e.target.value })}
                placeholder="e.g. Researching architectural patterns for layout providers..."
                required
                rows={3}
                className="rounded-xl border-[color:var(--color-border)] bg-[color:var(--color-input)] text-[color:var(--color-text)] text-sm"
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setShowStartModal(false)} className="rounded-xl border-[color:var(--color-border)]">
                Cancel
              </Button>
              <Button type="submit" className="rounded-xl bg-[color:var(--color-accent)] text-white hover:bg-[color:var(--color-accent)]/90">
                Start Timer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* End Activity Confirmation Modal */}
      <Dialog open={showStopModal} onOpenChange={setShowStopModal}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-[color:var(--color-text)]">
              End & Save Activity
            </DialogTitle>
            <DialogDescription className="text-xs text-[color:var(--color-text-subtle)]">
              Are you sure you want to end this manual session? This will log your active work time and any break intervals automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="rounded-xl bg-[color:var(--color-input)] p-3 border border-[color:var(--color-border)] text-xs text-[color:var(--color-text-muted)]">
              <p>Total logged session: <span className="font-bold text-[color:var(--color-text)] text-sm">{formatHHMMSS(activeSeconds)}</span></p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-[color:var(--color-text-muted)]">Category</label>
              <select
                value={stopForm.category}
                onChange={(e) => setStopForm({ category: e.target.value })}
                className="w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-xs text-[color:var(--color-text)] outline-none focus:border-[color:var(--color-accent)] transition-all cursor-pointer"
              >
                {MANUAL_CATEGORIES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t" style={{ borderColor: "var(--color-border)" }}>
              <Button type="button" variant="ghost" onClick={handleDiscardClick} className="rounded-xl text-rose-400 hover:bg-rose-500/10">
                Discard Session
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setShowStopModal(false)} className="rounded-xl border-[color:var(--color-border)]">
                  Cancel
                </Button>
                <Button 
                  onClick={handleConfirmSave}
                  disabled={loading}
                  className="rounded-xl bg-[color:var(--color-accent)] text-white hover:bg-[color:var(--color-accent)]/90"
                >
                  {loading ? "Saving..." : "End & Save"}
                </Button>
              </div>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Discard Confirmation Modal */}
      <Dialog open={showDiscardModal} onOpenChange={setShowDiscardModal}>
        <DialogContent className="sm:max-w-[360px] rounded-2xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)]">
          <DialogHeader>
            <DialogTitle className="text-md font-semibold text-[color:var(--color-text)] flex items-center gap-1.5">
              <AlertCircle className="text-rose-400" size={18} />
              Discard session?
            </DialogTitle>
            <DialogDescription className="text-xs text-[color:var(--color-text-subtle)]">
              This action cannot be undone. All active time tracked in this manual activity session will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowDiscardModal(false)} className="rounded-xl border-[color:var(--color-border)]">
              Cancel
            </Button>
            <Button onClick={handleConfirmDiscard} className="rounded-xl bg-rose-500 text-white hover:bg-rose-600">
              Discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Intercept Task Running Warning Modal */}
      <Dialog open={showWarningModal} onOpenChange={setShowWarningModal}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)]">
          <DialogHeader>
            <DialogTitle className="text-md font-semibold text-[color:var(--color-text)] flex items-center gap-2">
              <AlertCircle className="text-amber-500" />
              Manual Activity Running
            </DialogTitle>
            <DialogDescription className="text-xs text-[color:var(--color-text-subtle)]">
              You are currently running a manual activity timer. You cannot track a task session while a manual activity is running. Select an action below:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="rounded-xl bg-[color:var(--color-input)] p-3 border border-[color:var(--color-border)] text-xs text-[color:var(--color-text)]">
              <p className="font-semibold">Current Activity Description:</p>
              <p className="text-[color:var(--color-text-muted)] mt-1">{timerState.description}</p>
            </div>
            <DialogFooter className="flex flex-wrap gap-2 pt-2 border-t sm:justify-between" style={{ borderColor: "var(--color-border)" }}>
              <Button type="button" variant="ghost" onClick={handleConfirmDiscard} className="rounded-xl text-rose-400 hover:bg-rose-500/10">
                Discard Activity
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setShowWarningModal(false)} className="rounded-xl border-[color:var(--color-border)]">
                  Cancel
                </Button>
                <Button 
                  onClick={handleConfirmSave}
                  className="rounded-xl bg-[color:var(--color-accent)] text-white hover:bg-[color:var(--color-accent)]/95"
                >
                  Save & End Activity
                </Button>
              </div>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
