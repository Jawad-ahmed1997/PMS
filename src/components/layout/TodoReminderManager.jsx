"use client";

import { useEffect, useCallback } from "react";
import { useToast } from "@/components/ui/ToastProvider";

export default function TodoReminderManager({ session }) {
  const { addToast } = useToast();

  const checkReminders = useCallback(async () => {
    if (!session?.email) {
      return;
    }

    try {
      const response = await fetch("/api/todos/reminders", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        return;
      }

      const reminders = data.reminders || [];
      for (const item of reminders) {
        addToast({
          title: "To-Do Reminder",
          message: item.content,
          variant: "info",
        });

        // Acknowledge reminder sent to database
        await fetch(`/api/todos/reminders/${item.id}/sent`, {
          method: "PATCH",
        });
      }
    } catch (error) {
      // Fail silently in background
    }
  }, [addToast, session]);

  useEffect(() => {
    if (!session?.email) {
      return;
    }

    checkReminders();

    const interval = setInterval(() => {
      checkReminders();
    }, 30000); // Check every 30 seconds for higher responsiveness

    const onFocus = () => checkReminders();
    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [checkReminders, session]);

  return null;
}
