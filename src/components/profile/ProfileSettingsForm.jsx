"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import { Clock } from "lucide-react";

const timezoneOptions = [
  { value: "Asia/Karachi", label: "Pakistan Standard Time (GMT+5) - Asia/Karachi" },
  { value: "Asia/Dubai", label: "Gulf Standard Time (GMT+4) - Asia/Dubai" },
  { value: "Asia/Dhaka", label: "Bangladesh Standard Time (GMT+6) - Asia/Dhaka" },
  { value: "Asia/Kolkata", label: "India Standard Time (GMT+5:30) - Asia/Kolkata" },
  { value: "Europe/London", label: "British Time (GMT+0 / GMT+1) - Europe/London" },
  { value: "Europe/Paris", label: "Central European Time (GMT+1 / GMT+2) - Europe/Paris" },
  { value: "UTC", label: "Coordinated Universal Time (UTC) - UTC" },
];

export default function ProfileSettingsForm({ initialUser }) {
  const { addToast } = useToast();
  const router = useRouter();
  const [timezone, setTimezone] = useState(initialUser?.timezone || "Asia/Karachi");
  const [loading, setLoading] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const userId = initialUser?.id;
      if (!userId) {
        throw new Error("User ID not found.");
      }

      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update timezone.");
      }

      addToast({
        title: "Profile Updated",
        message: "Your timezone preference has been saved successfully.",
        variant: "success",
      });

      window.location.reload();
    } catch (err) {
      addToast({
        title: "Update Failed",
        message: err instanceof Error ? err.message : "Unable to save settings.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)] flex items-center gap-1.5">
          <Clock size={14} className="text-[color:var(--color-text-subtle)]" />
          Timezone Preference
        </label>
        <div className="relative">
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            disabled={loading}
            className="w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-sm text-[color:var(--color-text)] outline-none focus:border-[color:var(--color-accent)] transition-all disabled:opacity-50 appearance-none cursor-pointer"
          >
            {timezoneOptions.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-[color:var(--color-card)]">
                {opt.label}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[color:var(--color-text-subtle)]">
            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
              <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
            </svg>
          </div>
        </div>
        <p className="text-[11px] text-[color:var(--color-text-subtle)]">
          All log metrics, timesheets, and activity periods will format relative to this timezone.
        </p>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="rounded-xl bg-[color:var(--color-accent)] hover:bg-[color:var(--color-accent)]/90 px-4 py-2 text-sm font-semibold text-white shadow-md transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading ? "Saving Settings..." : "Save Settings"}
      </button>
    </form>
  );
}
