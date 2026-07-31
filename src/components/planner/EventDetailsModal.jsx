"use client";
import React, { useState } from "react";
import { useToast } from "@/components/ui/ToastProvider";

const LEADERSHIP_ROLES = ["CEO", "PM", "CTO", "TEAM_LEAD"];

export default function EventDetailsModal({ isOpen, onClose, event, onEditRequested, onSaved, userRole, currentUserId }) {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);

  if (!isOpen || !event) return null;

  const isCreatorOrLeadership =
    event.createdById === currentUserId || LEADERSHIP_ROLES.includes(userRole);

  const handleSendInstantAlert = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${event.id}/notify-now`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        addToast({
          title: "Announcement Sent",
          message: "All attendees have been notified instantly via in-app alert.",
          variant: "success",
        });
        onSaved(); // Refresh events list
      } else {
        addToast({
          title: "Error",
          message: data?.error || "Failed to send instant announcement.",
          variant: "error",
        });
      }
    } catch (err) {
      console.error(err);
      addToast({ title: "Error", message: "Something went wrong.", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const start = new Date(event.startDateTime);
  const end = event.endDateTime ? new Date(event.endDateTime) : null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[color:var(--color-border)] p-5">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              event.eventType === "MEETING"
                ? "bg-blue-500/10 text-blue-400"
                : "bg-amber-500/10 text-amber-400"
            }`}>
              {event.eventType === "MEETING" ? "Meeting 👥" : "Notice 📢"}
            </span>
            <h3 className="text-lg font-semibold text-[color:var(--color-text)] truncate max-w-[280px]">
              {event.title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-[color:var(--color-text-subtle)] hover:bg-[color:var(--color-surface-muted)] hover:text-[color:var(--color-text)] transition-colors"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Description */}
          {event.description && (
            <div className="space-y-1">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[color:var(--color-text-subtle)]">
                Description
              </h4>
              <p className="text-sm text-[color:var(--color-text-muted)] whitespace-pre-wrap leading-relaxed">
                {event.description}
              </p>
            </div>
          )}

          {/* Timing details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[color:var(--color-text-subtle)]">
                Start Time
              </h4>
              <p className="text-sm font-medium text-[color:var(--color-text)]">
                {start.toLocaleDateString()} <br />
                {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            {end && (
              <div className="space-y-1">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[color:var(--color-text-subtle)]">
                  End Time
                </h4>
                <p className="text-sm font-medium text-[color:var(--color-text)]">
                  {end.toLocaleDateString()} <br />
                  {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            )}
          </div>

          {/* Project relation */}
          <div className="space-y-1">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[color:var(--color-text-subtle)]">
              Scope
            </h4>
            <p className="text-sm text-[color:var(--color-text)]">
              {event.project?.name ? (
                <span className="inline-flex items-center gap-1.5 text-xs bg-[color:var(--color-muted-bg)] px-2.5 py-1 rounded-full text-[color:var(--color-text-subtle)]">
                  📁 Project: {event.project.name}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-full">
                  🌐 Global (All Projects)
                </span>
              )}
            </p>
          </div>

          {/* Attendees list */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[color:var(--color-text-subtle)]">
              Attendees ({event.attendees?.length || 0})
            </h4>
            {event.attendees?.length === 0 ? (
              <p className="text-xs text-[color:var(--color-text-muted)] italic">
                No attendees registered.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {event.attendees.map((attendee) => (
                  <span
                    key={attendee.id}
                    className="inline-flex items-center gap-1 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-card)] px-2.5 py-1 text-xs text-[color:var(--color-text)]"
                  >
                    👤 {attendee.user?.name || "System User"}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Trigger Triggers List */}
          {isCreatorOrLeadership && (
            <div className="border-t border-[color:var(--color-border)] pt-5 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[color:var(--color-text-subtle)]">
                Scheduled Reminders Status
              </h4>
              {event.notifications?.length === 0 ? (
                <p className="text-xs text-[color:var(--color-text-muted)] italic">
                  No notifications scheduled for this event.
                </p>
              ) : (
                <div className="space-y-2">
                  {event.notifications.map((notif) => {
                    const triggerDate = new Date(notif.triggerAt);
                    return (
                      <div
                        key={notif.id}
                        className="flex items-center justify-between rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] px-3 py-2 text-xs"
                      >
                        <span className="text-[color:var(--color-text)]">
                          Trigger at:{" "}
                          <strong>
                            {triggerDate.toLocaleDateString()} {triggerDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </strong>
                        </span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold text-[10px] ${
                          notif.status === "SENT"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : notif.status === "PENDING"
                            ? "bg-amber-500/10 text-amber-400"
                            : "bg-zinc-500/10 text-zinc-400"
                        }`}>
                          {notif.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="border-t border-[color:var(--color-border)] p-5 flex flex-col gap-3 bg-[color:var(--color-surface-muted)]">
          {isCreatorOrLeadership && (
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={handleSendInstantAlert}
                disabled={loading}
                className="flex-1 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-black hover:bg-amber-400 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
              >
                🔔 {loading ? "Sending..." : "Send Announcement Now"}
              </button>
              
              <button
                type="button"
                onClick={() => {
                  onEditRequested(event);
                  onClose();
                }}
                className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] px-4 py-2.5 text-xs font-semibold text-[color:var(--color-text)] hover:border-[color:var(--color-accent)] hover:text-white transition-all"
              >
                Edit Event
              </button>
            </div>
          )}
          
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] px-4 py-2 text-xs font-semibold text-[color:var(--color-text-subtle)] hover:text-[color:var(--color-text)] transition-all w-full text-center"
          >
            Close Window
          </button>
        </div>

      </div>
    </div>
  );
}
