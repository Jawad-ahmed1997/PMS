"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const DEFAULT_COUNTS = {
  total: 0,
  taskMovement: 0,
  creation: 0,
  log: 0,
};

const NotificationCountsContext = createContext(null);

export function NotificationCountsProvider({ children }) {
  const [counts, setCounts] = useState(DEFAULT_COUNTS);
  const prevTotalRef = useRef(0);
  const isFirstLoad = useRef(true);

  const playBeep = useCallback(() => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const audioCtx = new AudioContext();
      fetch("/notification.mp3")
        .then((response) => response.arrayBuffer())
        .then((arrayBuffer) => audioCtx.decodeAudioData(arrayBuffer))
        .then((audioBuffer) => {
          const source = audioCtx.createBufferSource();
          source.buffer = audioBuffer;
          // Set playbackRate.value to 0.55 to lower pitch even further and soften the beep
          source.playbackRate.value = 0.55;
          source.connect(audioCtx.destination);
          source.start(0);
        })
        .catch((err) => {
          console.warn("AudioContext play blocked or failed:", err);
        });
    } catch (err) {
      console.error("Failed to play notification beep sound:", err);
    }
  }, []);

  useEffect(() => {
    const currentTotal = counts.total;
    if (isFirstLoad.current) {
      prevTotalRef.current = currentTotal;
      if (currentTotal > 0) {
        isFirstLoad.current = false;
      }
      return;
    }

    if (currentTotal > prevTotalRef.current) {
      playBeep();
    }
    prevTotalRef.current = currentTotal;
  }, [counts.total, playBeep]);

  const refreshCounts = useCallback(async () => {
    const response = await fetch("/api/notifications/unread-counts", {
      cache: "no-store",
    });
    if (!response.ok) {
      return;
    }
    const data = await response.json();
    if (data?.ok) {
      setCounts({
        total: data.unreadCounts?.total ?? 0,
        taskMovement: data.unreadCounts?.taskMovement ?? 0,
        creation: data.unreadCounts?.creation ?? 0,
        log: data.unreadCounts?.log ?? 0,
      });
    }
  }, []);

  useEffect(() => {
    refreshCounts();
    const interval = setInterval(refreshCounts, 10000);

    const handleRefresh = () => {
      refreshCounts();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("pms:refresh-notifications", handleRefresh);
    }

    return () => {
      clearInterval(interval);
      if (typeof window !== "undefined") {
        window.removeEventListener("pms:refresh-notifications", handleRefresh);
      }
    };
  }, [refreshCounts]);

  const value = useMemo(
    () => ({
      counts,
      refreshCounts,
      setCounts,
    }),
    [counts, refreshCounts]
  );

  return (
    <NotificationCountsContext.Provider value={value}>
      {children}
    </NotificationCountsContext.Provider>
  );
}

export function useNotificationCounts() {
  const context = useContext(NotificationCountsContext);
  if (!context) {
    throw new Error(
      "useNotificationCounts must be used within NotificationCountsProvider."
    );
  }
  return context;
}
