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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isNotificationSoundMuted } from "@/lib/notificationPreferences";
import { fetchJson } from "@/lib/apiClient";

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
  const queryClient = useQueryClient();

  const playBeep = useCallback(() => {
    if (isNotificationSoundMuted()) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const audioCtx = new AudioContext();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.3);

      // In case browser requires user interaction for audio context
      if (audioCtx.state === "suspended") {
        audioCtx
          .resume()
          .then(() => {
            const source = audioCtx.createBufferSource();
            source.start(0);
          })
          .catch((err) => {
            console.warn("AudioContext play blocked or failed:", err);
          });
      }
    } catch (err) {
      console.error("Failed to play notification beep sound:", err);
    }
  }, []);

  const { data: queryData } = useQuery({
    queryKey: ["notificationCounts"],
    queryFn: async () => {
      try {
        const data = await fetchJson("/api/notifications/unread-counts", {
          cache: "no-store",
        });
        return {
          total: data?.unreadCounts?.total ?? 0,
          taskMovement: data?.unreadCounts?.taskMovement ?? 0,
          creation: data?.unreadCounts?.creation ?? 0,
          log: data?.unreadCounts?.log ?? 0,
        };
      } catch (err) {
        if (err?.message?.includes("401") || err?.message?.includes("Session")) {
          if (typeof window !== "undefined") {
            window.location.href = "/login?denied=1&reason=Session%20expired.%20Please%20sign%20in%20again.";
          }
        }
        throw err;
      }
    },
    refetchInterval: 15000, // Poll every 15 seconds (auto-paused when tab is inactive)
    staleTime: 5000,
  });

  // Sync query data to local counts state
  useEffect(() => {
    if (queryData) {
      setCounts(queryData);
    }
  }, [queryData]);

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
    await queryClient.invalidateQueries({ queryKey: ["notificationCounts"] });
  }, [queryClient]);

  useEffect(() => {
    const handleRefresh = () => {
      refreshCounts();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("pms:refresh-notifications", handleRefresh);
    }

    return () => {
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
