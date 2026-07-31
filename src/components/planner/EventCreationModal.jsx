"use client";
import React, { useState, useEffect } from "react";
import { useToast } from "@/components/ui/ToastProvider";

export default function EventCreationModal({ isOpen, onClose, event = null, onSaved, currentUserId }) {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);

  // Form Fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState("MEETING");
  const [projectId, setProjectId] = useState("");
  const [startDateTime, setStartDateTime] = useState("");
  const [endDateTime, setEndDateTime] = useState("");
  const [selectedAttendees, setSelectedAttendees] = useState([]);

  // Notifications Fields
  const [enableNotifications, setEnableNotifications] = useState(false);
  const [customTriggers, setCustomTriggers] = useState([]); // Array of ISO strings
  const [customTriggerInput, setCustomTriggerInput] = useState("");

  // Load Projects on mount
  useEffect(() => {
    async function loadProjects() {
      try {
        const res = await fetch("/api/projects");
        const data = await res.json();
        if (res.ok) {
          setProjects(data?.projects ?? []);
        }
      } catch (err) {
        console.error("Failed to load projects:", err);
      }
    }
    if (isOpen) {
      loadProjects();
    }
  }, [isOpen]);

  // Load Users depending on selected projectId
  useEffect(() => {
    async function loadUsers() {
      try {
        const url = projectId
          ? `/api/users?isActive=true&projectId=${projectId}`
          : "/api/users?isActive=true";
        const res = await fetch(url);
        const data = await res.json();
        if (res.ok) {
          setUsers(data?.users ?? []);
        }
      } catch (err) {
        console.error("Failed to load users:", err);
      }
    }
    if (isOpen) {
      loadUsers();
    }
  }, [isOpen, projectId]);

  // Prefill when editing
  useEffect(() => {
    if (isOpen) {
      if (event) {
        setTitle(event.title || "");
        setDescription(event.description || "");
        setEventType(event.eventType || "MEETING");
        setProjectId(event.projectId || "");
        
        // Format dates for input type datetime-local (YYYY-MM-DDTHH:MM)
        if (event.startDateTime) {
          const startDate = new Date(event.startDateTime);
          const offset = startDate.getTimezoneOffset() * 60000;
          const localISO = new Date(startDate.getTime() - offset).toISOString().slice(0, 16);
          setStartDateTime(localISO);
        } else {
          setStartDateTime("");
        }

        if (event.endDateTime) {
          const endDate = new Date(event.endDateTime);
          const offset = endDate.getTimezoneOffset() * 60000;
          const localISO = new Date(endDate.getTime() - offset).toISOString().slice(0, 16);
          setEndDateTime(localISO);
        } else {
          setEndDateTime("");
        }

        setSelectedAttendees(event.attendees?.map((a) => a.userId) || []);
        
        // Prefill notifications
        const pendingNotifs = event.notifications?.filter((n) => n.status === "PENDING") || [];
        if (pendingNotifs.length > 0) {
          setEnableNotifications(true);
          setCustomTriggers(pendingNotifs.map((n) => n.triggerAt));
        } else {
          setEnableNotifications(false);
          setCustomTriggers([]);
        }
      } else {
        // Reset fields for creation mode
        setTitle("");
        setDescription("");
        setEventType("MEETING");
        setProjectId("");
        setStartDateTime("");
        setEndDateTime("");
        setSelectedAttendees([]);
        setEnableNotifications(false);
        setCustomTriggers([]);
      }
    }
  }, [isOpen, event]);

  if (!isOpen) return null;

  // Handles adding quick alert presets relative to startDateTime
  const addTriggerPreset = (offsetHours) => {
    if (!startDateTime) {
      addToast({
        title: "Warning",
        message: "Please set the event start time first before scheduling triggers.",
        variant: "warning",
      });
      return;
    }

    const start = new Date(startDateTime);
    const triggerDate = new Date(start.getTime() - offsetHours * 60 * 60 * 1000);
    const triggerISO = triggerDate.toISOString();

    if (triggerDate <= new Date()) {
      addToast({
        title: "Warning",
        message: "Calculated trigger time is in the past. Try a different preset.",
        variant: "warning",
      });
      return;
    }

    if (customTriggers.includes(triggerISO)) return;
    setCustomTriggers([...customTriggers, triggerISO]);
  };

  const addCustomTrigger = () => {
    if (!customTriggerInput) return;
    const triggerDate = new Date(customTriggerInput);
    if (isNaN(triggerDate.getTime())) {
      addToast({
        title: "Error",
        message: "Invalid custom trigger date format.",
        variant: "error",
      });
      return;
    }
    if (triggerDate <= new Date()) {
      addToast({
        title: "Warning",
        message: "Trigger time must be in the future.",
        variant: "warning",
      });
      return;
    }

    const triggerISO = triggerDate.toISOString();
    if (customTriggers.includes(triggerISO)) return;
    setCustomTriggers([...customTriggers, triggerISO]);
    setCustomTriggerInput("");
  };

  const removeTrigger = (index) => {
    setCustomTriggers(customTriggers.filter((_, i) => i !== index));
  };

  const handleAttendeeToggle = (userId) => {
    if (selectedAttendees.includes(userId)) {
      setSelectedAttendees(selectedAttendees.filter((id) => id !== userId));
    } else {
      setSelectedAttendees([...selectedAttendees, userId]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      addToast({ title: "Error", message: "Title is required.", variant: "error" });
      return;
    }
    if (!startDateTime) {
      addToast({ title: "Error", message: "Start time is required.", variant: "error" });
      return;
    }
    if (endDateTime && new Date(startDateTime) >= new Date(endDateTime)) {
      addToast({ title: "Error", message: "Start time must be before end time.", variant: "error" });
      return;
    }

    setLoading(true);
    const payload = {
      title: title.trim(),
      description: description.trim(),
      eventType,
      projectId: projectId || null,
      startDateTime: new Date(startDateTime).toISOString(),
      endDateTime: endDateTime ? new Date(endDateTime).toISOString() : null,
      attendeeUserIds: selectedAttendees,
      notificationTriggers: enableNotifications ? customTriggers : [],
    };

    try {
      const url = event ? `/api/events/${event.id}` : "/api/events";
      const method = event ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        addToast({
          title: "Success",
          message: event ? "Event updated successfully." : "Event created successfully.",
          variant: "success",
        });
        onSaved();
        onClose();
      } else {
        addToast({
          title: "Error",
          message: data?.error || "Failed to save event.",
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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[color:var(--color-border)] p-5">
          <h3 className="text-lg font-semibold text-[color:var(--color-text)]">
            {event ? "📝 Edit Planner Event" : "📅 Create Planner Event"}
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-[color:var(--color-text-subtle)] hover:bg-[color:var(--color-surface-muted)] hover:text-[color:var(--color-text)] transition-colors"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Title & Description */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[color:var(--color-text-subtle)] mb-2">
                Event Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Sprint Kickoff / Product Demo"
                required
                className="w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-4 py-2.5 text-sm text-[color:var(--color-text)] placeholder-[color:var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-accent)]/30 focus:border-[color:var(--color-accent)]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[color:var(--color-text-subtle)] mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Details, agendas, links or call info..."
                rows="3"
                className="w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-4 py-2.5 text-sm text-[color:var(--color-text)] placeholder-[color:var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-accent)]/30 focus:border-[color:var(--color-accent)]"
              />
            </div>
          </div>

          {/* Type & Project Selector */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[color:var(--color-text-subtle)] mb-2">
                Event Type
              </label>
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                className="w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-4 py-2.5 text-sm text-[color:var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-accent)]/30 focus:border-[color:var(--color-accent)]"
              >
                <option value="MEETING">Meeting 👥</option>
                <option value="NOTICE">Notice 📢</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[color:var(--color-text-subtle)] mb-2">
                Associated Project
              </label>
              <select
                value={projectId}
                onChange={(e) => {
                  setProjectId(e.target.value);
                  setSelectedAttendees([]); // Reset attendees on project change
                }}
                className="w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-4 py-2.5 text-sm text-[color:var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-accent)]/30 focus:border-[color:var(--color-accent)]"
              >
                <option value="">No Project (Global Event) 🌐</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Timings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[color:var(--color-text-subtle)] mb-2">
                Start Date & Time *
              </label>
              <input
                type="datetime-local"
                value={startDateTime}
                onChange={(e) => setStartDateTime(e.target.value)}
                required
                className="w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-4 py-2.5 text-sm text-[color:var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-accent)]/30"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[color:var(--color-text-subtle)] mb-2">
                End Date & Time (Optional)
              </label>
              <input
                type="datetime-local"
                value={endDateTime}
                onChange={(e) => setEndDateTime(e.target.value)}
                className="w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-4 py-2.5 text-sm text-[color:var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-accent)]/30"
              />
            </div>
          </div>

          {/* Attendees Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[color:var(--color-text-subtle)]">
                Select Attendees ({selectedAttendees.length} selected)
              </label>
              <div className="flex gap-2.5 items-center">
                <button
                  type="button"
                  onClick={() => setSelectedAttendees(users.map((u) => u.id))}
                  className="text-xs font-semibold text-[color:var(--color-accent)] hover:underline"
                >
                  Select All
                </button>
                <span className="text-[10px] text-[color:var(--color-border)]">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedAttendees([])}
                  className="text-xs font-semibold text-[color:var(--color-text-subtle)] hover:underline"
                >
                  Deselect All
                </button>
              </div>
            </div>
            <div className="max-h-40 overflow-y-auto rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] p-3 space-y-2">
              {users.length === 0 ? (
                <p className="text-xs text-[color:var(--color-text-muted)] text-center py-4">
                  No active users found.
                </p>
              ) : (
                users.map((user) => {
                  const isChecked = selectedAttendees.includes(user.id);
                  return (
                    <label
                      key={user.id}
                      className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-[color:var(--color-surface-muted)] cursor-pointer text-sm text-[color:var(--color-text)] transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleAttendeeToggle(user.id)}
                        className="rounded border-[color:var(--color-border)] text-[color:var(--color-accent)] focus:ring-[color:var(--color-accent)]"
                      />
                      <span>
                        {user.name} <span className="text-xs text-[color:var(--color-text-muted)]">({user.role})</span>
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {/* Scheduled Notification Alerts */}
          <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-[color:var(--color-text)]">
                  Custom Notification Triggers
                </h4>
                <p className="text-xs text-[color:var(--color-text-muted)]">
                  Schedule reminders to be fired automatically before the event starts.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableNotifications}
                  onChange={(e) => setEnableNotifications(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-zinc-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[color:var(--color-accent)]"></div>
              </label>
            </div>

            {enableNotifications && (
              <div className="space-y-4 pt-2 border-t border-[color:var(--color-border)] animate-in slide-in-from-top-2 duration-200">
                {/* Presets */}
                <div>
                  <span className="block text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-subtle)] mb-2">
                    Quick Preset Offsets:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => addTriggerPreset(24)}
                      className="rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-card)] px-3 py-1 text-xs text-[color:var(--color-text-subtle)] hover:border-[color:var(--color-accent)] hover:text-white transition-all"
                    >
                      +1 Day Before
                    </button>
                    <button
                      type="button"
                      onClick={() => addTriggerPreset(2)}
                      className="rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-card)] px-3 py-1 text-xs text-[color:var(--color-text-subtle)] hover:border-[color:var(--color-accent)] hover:text-white transition-all"
                    >
                      +2 Hours Before
                    </button>
                    <button
                      type="button"
                      onClick={() => addTriggerPreset(1)}
                      className="rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-card)] px-3 py-1 text-xs text-[color:var(--color-text-subtle)] hover:border-[color:var(--color-accent)] hover:text-white transition-all"
                    >
                      +1 Hour Before
                    </button>
                  </div>
                </div>

                {/* Custom Trigger Selector */}
                <div className="flex gap-2">
                  <input
                    type="datetime-local"
                    value={customTriggerInput}
                    onChange={(e) => setCustomTriggerInput(e.target.value)}
                    className="flex-1 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-1.5 text-xs text-[color:var(--color-text)] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={addCustomTrigger}
                    className="rounded-xl bg-[color:var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[color:var(--color-accent)]/80 transition-colors"
                  >
                    Add Trigger
                  </button>
                </div>

                {/* Selected Triggers List */}
                <div className="space-y-1.5">
                  <span className="block text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-subtle)]">
                    Scheduled Alerts List:
                  </span>
                  {customTriggers.length === 0 ? (
                    <p className="text-xs text-[color:var(--color-text-muted)] italic">
                      No reminders scheduled yet. Add one above.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 gap-2">
                      {customTriggers.map((triggerISO, idx) => {
                        const dateObj = new Date(triggerISO);
                        return (
                          <div
                            key={idx}
                            className="flex items-center justify-between rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-card)] px-3 py-2 text-xs text-[color:var(--color-text)]"
                          >
                            <span>
                              🔔 Alert at:{" "}
                              <strong>
                                {dateObj.toLocaleDateString()} {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </strong>
                            </span>
                            <button
                              type="button"
                              onClick={() => removeTrigger(idx)}
                              className="text-red-400 hover:text-red-300 transition-colors"
                            >
                              Remove
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="border-t border-[color:var(--color-border)] p-5 flex items-center justify-end gap-3 bg-[color:var(--color-surface-muted)]">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[color:var(--color-border)] px-4 py-2 text-sm font-semibold text-[color:var(--color-text-subtle)] hover:bg-[color:var(--color-card)] hover:text-[color:var(--color-text)] transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="rounded-xl bg-[color:var(--color-accent)] px-5 py-2 text-sm font-semibold text-white hover:bg-[color:var(--color-accent)]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-[color:var(--color-accent-transparent)]"
          >
            {loading ? "Saving..." : event ? "Update Event" : "Create Event"}
          </button>
        </div>

      </div>
    </div>
  );
}
