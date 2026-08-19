"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useNotificationCounts } from "@/components/notifications/NotificationCountsContext";

function formatHHMMSS(totalSeconds = 0) {
  const value = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(value / 3600).toString().padStart(2, "0");
  const minutes = Math.floor((value % 3600) / 60).toString().padStart(2, "0");
  const seconds = Math.floor(value % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function cleanRawTitle(rawStr) {
  if (!rawStr) return "PMS";
  return rawStr
    .replace(/^\(\d+\)\s*/, "")
    .replace(/^[▶⏸]\s*\d{2}:\d{2}:\d{2}\s*-\s*/, "")
    .replace(/\s*\(Paused\)/g, "")
    .trim();
}

export default function TabTitleTimerManager({ session }) {
  const pathname = usePathname();
  const { counts } = useNotificationCounts();
  const baseTitleRef = useRef("PMS");
  const [tick, setTick] = useState(() => Date.now());

  // Active Task Session State
  const [taskSession, setTaskSession] = useState(null);

  // Active Manual Activity State
  const [manualState, setManualState] = useState(null);

  // Fetch / Sync Task Session
  const fetchTaskSession = useCallback(async () => {
    if (!session) return;
    try {
      const res = await fetch("/api/tasks/active-session", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setTaskSession(data?.active ? data : null);
      } else {
        setTaskSession(null);
      }
    } catch (e) {
      setTaskSession(null);
    }
  }, [session]);

  // Sync Manual Activity from LocalStorage
  const syncManualState = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem("activity_timer_state");
      if (stored) {
        const parsed = JSON.parse(stored);
        setManualState(parsed?.running ? parsed : null);
      } else {
        setManualState(null);
      }
    } catch (e) {
      setManualState(null);
    }
  }, []);

  // Update baseTitleRef whenever route / page title changes
  useEffect(() => {
    if (typeof document === "undefined") return;
    const raw = document.title;
    const cleaned = cleanRawTitle(raw);
    if (cleaned && cleaned !== "PMS") {
      baseTitleRef.current = cleaned;
    }
  }, [pathname]);

  // Polling & Event Listeners for Session States
  useEffect(() => {
    fetchTaskSession();
    syncManualState();

    const handleTimerChange = (e) => {
      const payload = e?.detail?.activeSession;
      if (payload !== undefined) {
        setTaskSession(payload?.active ? payload : null);
      } else {
        fetchTaskSession();
      }
    };

    const handleStorageChange = () => {
      syncManualState();
    };

    window.addEventListener("pms:timer-changed", handleTimerChange);
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("focus", fetchTaskSession);
    window.addEventListener("focus", syncManualState);

    // Poll task session every 10 seconds
    const pollInterval = setInterval(() => {
      fetchTaskSession();
      syncManualState();
    }, 10000);

    return () => {
      window.removeEventListener("pms:timer-changed", handleTimerChange);
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("focus", fetchTaskSession);
      window.removeEventListener("focus", syncManualState);
      clearInterval(pollInterval);
    };
  }, [fetchTaskSession, syncManualState]);

  // Tick interval every 1 second when any timer is active
  useEffect(() => {
    const isTaskRunning = Boolean(taskSession?.active);
    const isManualRunning = Boolean(manualState?.running);

    if (!isTaskRunning && !isManualRunning) {
      return undefined;
    }

    const interval = setInterval(() => {
      setTick(Date.now());
      syncManualState();
    }, 1000);

    return () => clearInterval(interval);
  }, [taskSession, manualState, syncManualState]);

  // Master Document Title Update
  useEffect(() => {
    if (typeof document === "undefined") return;

    const notifPrefix = counts.total > 0 ? `(${counts.total}) ` : "";
    const base = baseTitleRef.current || "PMS";

    // 1. Task Timer Priority
    if (taskSession?.active && taskSession?.task) {
      const taskTitle = taskSession.task.title || "Task";
      const isPaused = Boolean(taskSession.isPaused);
      let spentSec = Number(taskSession.accumulatedSeconds ?? 0);

      if (!isPaused && taskSession.runningStartedAt && taskSession.serverNow) {
        const serverNowMs = new Date(taskSession.serverNow).getTime();
        const startedMs = new Date(taskSession.runningStartedAt).getTime();
        if (Number.isFinite(serverNowMs) && Number.isFinite(startedMs) && serverNowMs >= startedMs) {
          const baseline = spentSec + Math.floor((serverNowMs - startedMs) / 1000);
          const sinceTick = Math.max(0, Math.floor((tick - serverNowMs) / 1000));
          spentSec = baseline + sinceTick;
        }
      }

      const timeFormatted = formatHHMMSS(spentSec);
      const icon = isPaused ? "⏸" : "▶";
      const statusText = isPaused ? " (Paused)" : "";
      document.title = `${notifPrefix}${icon} ${timeFormatted} - ${taskTitle}${statusText} · PMS`;
      return;
    }

    // 2. Manual Activity Timer
    if (manualState?.running) {
      const desc = manualState.description || "Manual Activity";
      const isPaused = Boolean(manualState.paused);
      let spentSec = Number(manualState.accumulatedSeconds ?? 0);

      if (!isPaused && manualState.startTime) {
        spentSec += Math.floor((tick - manualState.startTime) / 1000);
      }

      const timeFormatted = formatHHMMSS(spentSec);
      const icon = isPaused ? "⏸" : "▶";
      const statusText = isPaused ? " (Paused)" : "";
      document.title = `${notifPrefix}${icon} ${timeFormatted} - ${desc}${statusText} · PMS`;
      return;
    }

    // 3. Fallback: Restore Default Document Title
    document.title = `${notifPrefix}${base}`;
  }, [taskSession, manualState, tick, counts.total]);

  return null;
}
