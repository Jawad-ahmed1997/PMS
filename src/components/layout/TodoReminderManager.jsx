"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/components/ui/ToastProvider";

export default function TodoReminderManager({ session }) {
  const { addToast } = useToast();

  const { data: reminders = [] } = useQuery({
    queryKey: ["todoReminders"],
    queryFn: async () => {
      if (!session?.email) {
        return [];
      }
      const response = await fetch("/api/todos/reminders", { cache: "no-store" });
      if (response.status === 401) {
        if (typeof window !== "undefined") {
          window.location.href = "/login?denied=1&reason=Session%20expired.%20Please%20sign%20in%20again.";
        }
        throw new Error("Session expired");
      }
      if (!response.ok) {
        return [];
      }
      const data = await response.json();
      return data.reminders || [];
    },
    enabled: Boolean(session?.email),
    refetchInterval: 30000, // Check every 30 seconds (paused when tab hidden)
    staleTime: 10000,
  });

  useEffect(() => {
    if (!session?.email || reminders.length === 0) {
      return;
    }

    const showReminders = async () => {
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
    };

    showReminders();
  }, [reminders, addToast, session]);

  return null;
}
