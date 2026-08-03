"use client";

import { useCallback, useRef } from "react";
import { isNotificationSoundMuted } from "@/lib/notificationPreferences";

export function useNotificationSound() {
  const audioContextRef = useRef(null);

  return useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (isNotificationSoundMuted()) {
      return;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return;
    }

    try {
      const context =
        audioContextRef.current ?? new AudioContextClass({ latencyHint: "interactive" });
      audioContextRef.current = context;

      if (context.state === "suspended") {
        context.resume();
      }

      const now = context.currentTime;
      const masterGain = context.createGain();
      masterGain.gain.setValueAtTime(0.0001, now);
      masterGain.gain.exponentialRampToValueAtTime(0.08, now + 0.018);
      masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
      masterGain.connect(context.destination);

      [
        { frequency: 660, start: 0, duration: 0.22 },
        { frequency: 880, start: 0.055, duration: 0.24 },
      ].forEach(({ frequency, start, duration }) => {
        const oscillator = context.createOscillator();
        const toneGain = context.createGain();
        const startAt = now + start;
        const stopAt = startAt + duration;

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency, startAt);
        oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.94, stopAt);

        toneGain.gain.setValueAtTime(0.0001, startAt);
        toneGain.gain.exponentialRampToValueAtTime(0.9, startAt + 0.02);
        toneGain.gain.exponentialRampToValueAtTime(0.0001, stopAt);

        oscillator.connect(toneGain);
        toneGain.connect(masterGain);
        oscillator.start(startAt);
        oscillator.stop(stopAt);
      });
    } catch {
      // Audio feedback is optional; uploads should never fail because sound is blocked.
    }
  }, []);
}
