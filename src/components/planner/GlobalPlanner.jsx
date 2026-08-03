"use client";
import React, { useState, useEffect, useMemo } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import EventCreationModal from "./EventCreationModal";
import EventDetailsModal from "./EventDetailsModal";
import DeleteConfirmationDialog from "@/components/ui/DeleteConfirmationDialog";

const LEADERSHIP_ROLES = ["CEO", "PM", "CTO", "TEAM_LEAD"];

export default function GlobalPlanner({ role, currentUser }) {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState("calendar"); // "calendar" | "manage"
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // Date navigation
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  const isLeadership = LEADERSHIP_ROLES.includes(role);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/events");
      const data = await res.json();
      if (res.ok) {
        setEvents(data?.events ?? []);
      }
    } catch (err) {
      console.error(err);
      addToast({ title: "Error", message: "Failed to load events.", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const confirmDelete = async () => {
    if (!confirmDeleteId) return;
    try {
      const res = await fetch(`/api/events/${confirmDeleteId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        addToast({ title: "Deleted", message: "Event deleted successfully.", variant: "success" });
        loadEvents();
      } else {
        const data = await res.json();
        addToast({ title: "Error", message: data?.error || "Failed to delete event.", variant: "error" });
      }
    } catch (err) {
      console.error(err);
      addToast({ title: "Error", message: "Something went wrong.", variant: "error" });
    } finally {
      setConfirmDeleteId(null);
    }
  };

  // Calendar math
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth(); // 0-indexed

  const daysInMonth = useMemo(() => {
    return new Date(currentYear, currentMonth + 1, 0).getDate();
  }, [currentYear, currentMonth]);

  const firstDayIndex = useMemo(() => {
    return new Date(currentYear, currentMonth, 1).getDay();
  }, [currentYear, currentMonth]);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  // Map events to dates for easy highlighting
  const eventsByDate = useMemo(() => {
    const map = {};
    events.forEach((event) => {
      const start = new Date(event.startDateTime);
      const dateKey = `${start.getFullYear()}-${start.getMonth()}-${start.getDate()}`;
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(event);
    });
    return map;
  }, [events]);

  // Selected Day's Events
  const selectedDayEvents = useMemo(() => {
    const dateKey = `${selectedDate.getFullYear()}-${selectedDate.getMonth()}-${selectedDate.getDate()}`;
    return eventsByDate[dateKey] ?? [];
  }, [selectedDate, eventsByDate]);

  return (
    <div className="space-y-6 p-1 sm:p-4">
      {/* Top Banner Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[color:var(--color-border)] pb-5">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[color:var(--color-text)]">
            Planner & Schedule Hub
          </h2>
          <p className="text-sm text-[color:var(--color-text-muted)] mt-1">
            Coordinate meetings, announcements, and track automated triggers.
          </p>
        </div>
        {isLeadership && (
          <button
            onClick={() => {
              setEditingEvent(null);
              setIsCreateOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-[color:var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[color:var(--color-accent)]/90 transition-all shadow-lg shadow-[color:var(--color-accent-transparent)]"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 5v14M5 12h14" />
            </svg>
            Create Event
          </button>
        )}
      </div>

      {/* Tabs Row */}
      <div className="flex border-b border-[color:var(--color-border)] pb-0">
        <button
          onClick={() => setActiveTab("calendar")}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition duration-150 ${
            activeTab === "calendar"
              ? "border-[color:var(--color-accent)] text-[color:var(--color-accent)]"
              : "border-transparent text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]"
          }`}
        >
          Calendar View 📅
        </button>
        {isLeadership && (
          <button
            onClick={() => setActiveTab("manage")}
            className={`px-5 py-3 text-sm font-semibold border-b-2 transition duration-150 ${
              activeTab === "manage"
                ? "border-[color:var(--color-accent)] text-[color:var(--color-accent)]"
                : "border-transparent text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]"
            }`}
          >
            Manage Events (List View) 📋
          </button>
        )}
      </div>

      {/* Content Tabs */}
      {loading && events.length === 0 ? (
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-8 text-center text-sm text-[color:var(--color-text-muted)]">
          <svg className="mx-auto h-8 w-8 animate-spin text-[color:var(--color-accent)] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89" />
          </svg>
          Loading scheduled events...
        </div>
      ) : activeTab === "calendar" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Calendar Box */}
          <div className="lg:col-span-2 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-5 space-y-4">
            {/* Calendar Month Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[color:var(--color-text)]">
                {monthNames[currentMonth]} {currentYear}
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={handlePrevMonth}
                  className="rounded-lg p-1.5 border border-[color:var(--color-border)] hover:bg-[color:var(--color-surface-muted)] text-[color:var(--color-text-subtle)]"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={handleNextMonth}
                  className="rounded-lg p-1.5 border border-[color:var(--color-border)] hover:bg-[color:var(--color-surface-muted)] text-[color:var(--color-text-subtle)]"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-[color:var(--color-text-subtle)] border-b border-[color:var(--color-border)] pb-2">
              <span>Sun</span>
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
            </div>

            <div className="grid grid-cols-7 gap-2">
              {/* Empty leading indices */}
              {Array.from({ length: firstDayIndex }).map((_, i) => (
                <div key={`empty-${i}`} className="h-12 bg-transparent" />
              ))}

              {/* Month dates */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const isSelected =
                  selectedDate.getDate() === dayNum &&
                  selectedDate.getMonth() === currentMonth &&
                  selectedDate.getFullYear() === currentYear;
                const dateKey = `${currentYear}-${currentMonth}-${dayNum}`;
                const dayEvents = eventsByDate[dateKey] ?? [];

                return (
                  <button
                    key={`day-${dayNum}`}
                    type="button"
                    onClick={() => setSelectedDate(new Date(currentYear, currentMonth, dayNum))}
                    className={`h-12 relative flex flex-col items-center justify-center rounded-xl transition-all border ${
                      isSelected
                        ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/15 text-[color:var(--color-accent)] font-bold scale-[1.03]"
                        : "border-transparent hover:bg-[color:var(--color-surface-muted)] text-[color:var(--color-text)]"
                    }`}
                  >
                    <span>{dayNum}</span>
                    {/* Event indicators */}
                    {dayEvents.length > 0 && (
                      <div className="absolute bottom-1.5 flex gap-1 justify-center w-full">
                        {dayEvents.slice(0, 3).map((ev, index) => (
                          <span
                            key={index}
                            className={`h-1.5 w-1.5 rounded-full ${
                              ev.eventType === "MEETING" ? "bg-blue-400" : "bg-amber-400"
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Day Events Sidebar */}
          <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-5 space-y-4 flex flex-col h-full min-h-[300px]">
            <div>
              <h3 className="text-sm font-bold text-[color:var(--color-text)]">
                Events on {selectedDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
              </h3>
              <p className="text-xs text-[color:var(--color-text-muted)]">
                Click an event to view full details.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {selectedDayEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-8 text-[color:var(--color-text-muted)]">
                  <span>🏖️</span>
                  <span className="text-xs mt-1">No events scheduled for this day.</span>
                </div>
              ) : (
                selectedDayEvents.map((event) => {
                  const startTime = new Date(event.startDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  return (
                    <button
                      key={event.id}
                      onClick={() => {
                        setSelectedEvent(event);
                        setIsDetailsOpen(true);
                      }}
                      className="w-full text-left rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] p-3 hover:border-[color:var(--color-accent)]/50 transition-all space-y-2 group"
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${
                          event.eventType === "MEETING" ? "text-blue-400" : "text-amber-400"
                        }`}>
                          {event.eventType}
                        </span>
                        <span className="text-[10px] text-[color:var(--color-text-muted)] font-medium">
                          🕒 {startTime}
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold text-[color:var(--color-text)] group-hover:text-[color:var(--color-accent)] transition-colors line-clamp-1">
                        {event.title}
                      </h4>
                      {event.project && (
                        <div className="text-[10px] text-[color:var(--color-text-subtle)] truncate">
                          📁 Project: {event.project.name}
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

        </div>
      ) : (
        /* List / Management View */
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] text-xs font-semibold uppercase tracking-wider text-[color:var(--color-text-subtle)]">
                  <th className="px-6 py-4">Title</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Timings</th>
                  <th className="px-6 py-4">Scope</th>
                  <th className="px-6 py-4">Attendees</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--color-border)] text-sm text-[color:var(--color-text)]">
                {events.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-[color:var(--color-text-muted)]">
                      No events created yet.
                    </td>
                  </tr>
                ) : (
                  events.map((event) => {
                    const start = new Date(event.startDateTime);
                    const end = event.endDateTime ? new Date(event.endDateTime) : null;
                    return (
                      <tr key={event.id} className="hover:bg-[color:var(--color-surface-muted)]/40 transition-colors">
                        <td className="px-6 py-4 font-semibold">
                          {event.title}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                            event.eventType === "MEETING"
                              ? "bg-blue-500/10 text-blue-400"
                              : "bg-amber-500/10 text-amber-400"
                          }`}>
                            {event.eventType}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs">
                          <div>
                            <strong>Start:</strong> {start.toLocaleString()}
                          </div>
                          {end && (
                            <div>
                              <strong>End:</strong> {end.toLocaleString()}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs">
                          {event.project?.name ? (
                            <span className="bg-[color:var(--color-muted-bg)] px-2.5 py-0.5 rounded-full text-[color:var(--color-text-subtle)]">
                              📁 {event.project.name}
                            </span>
                          ) : (
                            <span className="bg-emerald-500/10 text-emerald-400 px-2.5 py-0.5 rounded-full">
                              🌐 Global
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs">
                          <div className="relative group inline-block">
                            <span className="cursor-help hover:text-[color:var(--color-accent)] transition-colors underline decoration-dotted font-medium">
                              👥 {event.attendees?.length || 0} Members
                            </span>
                            {event.attendees?.length > 0 && (
                              <div className="absolute left-1/2 bottom-full mb-2 -translate-x-1/2 hidden group-hover:block bg-zinc-950/95 text-white text-xs rounded-xl p-3 shadow-xl border border-zinc-800 w-48 z-[250] pointer-events-none animate-in fade-in zoom-in-95 duration-150">
                                <div className="font-bold border-b border-zinc-800 pb-1 mb-1 text-[color:var(--color-accent)] text-left">Attendees</div>
                                <div className="max-h-24 overflow-y-auto space-y-1 text-left">
                                  {event.attendees.map((att) => (
                                    <div key={att.id} className="truncate">
                                      • {att.user?.name || "System User"}
                                    </div>
                                  ))}
                                </div>
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-950/95"></div>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="inline-flex gap-2">
                            <button
                              onClick={() => {
                                setSelectedEvent(event);
                                setIsDetailsOpen(true);
                              }}
                              className="rounded-lg border border-[color:var(--color-border)] px-2.5 py-1.5 text-xs font-medium text-[color:var(--color-text-subtle)] hover:border-[color:var(--color-accent)] hover:text-white transition-colors"
                            >
                              View
                            </button>
                            <button
                              onClick={() => {
                                setEditingEvent(event);
                                setIsCreateOpen(true);
                              }}
                              className="rounded-lg border border-[color:var(--color-border)] px-2.5 py-1.5 text-xs font-medium text-blue-400 hover:border-blue-400/50 hover:bg-blue-400/10 transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(event.id)}
                              className="rounded-lg border border-[color:var(--color-border)] px-2.5 py-1.5 text-xs font-medium text-red-400 hover:border-red-400/50 hover:bg-red-400/10 transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Creation/Edit Modal */}
      <EventCreationModal
        isOpen={isCreateOpen}
        onClose={() => {
          setIsCreateOpen(false);
          setEditingEvent(null);
        }}
        event={editingEvent}
        onSaved={loadEvents}
        currentUserId={currentUser?.id}
      />

      {/* Details Modal */}
      <EventDetailsModal
        isOpen={isDetailsOpen}
        onClose={() => {
          setIsDetailsOpen(false);
          setSelectedEvent(null);
        }}
        event={selectedEvent}
        userRole={role}
        currentUserId={currentUser?.id}
        onEditRequested={(ev) => {
          setEditingEvent(ev);
          setIsCreateOpen(true);
        }}
        onSaved={loadEvents}
      />

      <DeleteConfirmationDialog
        open={Boolean(confirmDeleteId)}
        onOpenChange={(open) => { if (!open) setConfirmDeleteId(null); }}
        onConfirm={confirmDelete}
      />

    </div>
  );
}
