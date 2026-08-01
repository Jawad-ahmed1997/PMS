"use client";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotificationCounts } from "@/components/notifications/NotificationCountsContext";

const TABS = [
  { id: "all", label: "All", query: null },
  { id: "taskMovement", label: "Movements", query: "taskMovement" },
  { id: "creation", label: "Assignments", query: "creation" },
  { id: "log", label: "Comments", query: "log" },
];

const ICONS = {
  TASK_MOVEMENT: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M7 7h10M7 12h10M7 17h10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  CREATION_ASSIGNMENT: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  TASK_ASSIGNED: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 4v8m0 0h8m-8 0H4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  USER_LOG_COMMENT: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 6h16v9H7l-3 3V6Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  TIME_REQUEST: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 6v6l3 3M12 3a9 9 0 1 0 9 9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

function formatTimeAgo(value) {
  if (!value) return "";
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  if (Number.isNaN(diffMs)) return "";
  const seconds = Math.max(1, Math.floor(diffMs / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function NotificationListSkeleton() {
  return (
    <div className="space-y-2" aria-label="Loading notifications">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="flex items-start gap-3 rounded-lg p-3">
          <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2 pt-0.5">
            <Skeleton className="h-3.5 w-[88%]" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function NotificationSheet({ isOpen, onClose }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("all");
  const [notifications, setNotifications] = useState([]);
  const { counts, setCounts } = useNotificationCounts();
  const [isLoading, setIsLoading] = useState(false);

  const activeQuery = useMemo(
    () => TABS.find((tab) => tab.id === activeTab)?.query ?? null,
    [activeTab]
  );

  const loadNotifications = async () => {
    setIsLoading(true);
    const query = activeQuery ? `?tab=${activeQuery}` : "";
    const response = await fetch(`/api/notifications${query}`, {
      cache: "no-store",
    });
    if (!response.ok) {
      setIsLoading(false);
      return;
    }
    const data = await response.json();
    if (data?.ok) {
      setNotifications(data.notifications ?? []);
      setCounts({
        total: data.unreadCounts?.total ?? 0,
        taskMovement: data.unreadCounts?.taskMovement ?? 0,
        creation: data.unreadCounts?.creation ?? 0,
        log: data.unreadCounts?.log ?? 0,
      });
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [activeQuery, isOpen]);

  const handleMarkAllRead = async () => {
    const response = await fetch("/api/notifications/mark-all-read", {
      method: "PATCH",
    });
    if (!response.ok) {
      return;
    }
    await loadNotifications();
  };

  const resolveNotificationLink = async (notification) => {
    if (!notification) {
      return null;
    }
    const { taskId, milestoneId, projectId } = notification;
    if (taskId) {
      if (projectId && milestoneId) {
        return `/projects/${projectId}/milestones/${milestoneId}?taskId=${taskId}&tab=overview`;
      }
      try {
        const response = await fetch(`/api/tasks/${taskId}`);
        const data = await response.json();
        const taskMilestone = data?.task?.milestone;
        if (response.ok && taskMilestone?.projectId && taskMilestone?.id) {
          return `/projects/${taskMilestone.projectId}/milestones/${taskMilestone.id}?taskId=${taskId}&tab=overview`;
        }
      } catch (error) {
        return null;
      }
    }
    if (milestoneId) {
      if (projectId) {
        return `/projects/${projectId}/milestones/${milestoneId}`;
      }
      try {
        const response = await fetch(`/api/milestones/${milestoneId}`);
        const data = await response.json();
        if (response.ok && data?.milestone?.projectId) {
          return `/projects/${data.milestone.projectId}/milestones/${milestoneId}`;
        }
      } catch (error) {
        return null;
      }
    }
    if (projectId) {
      return `/projects/${projectId}`;
    }
    return null;
  };

  const handleNotificationClick = async (notification) => {
    if (!notification?.readAt) {
      await fetch(`/api/notifications/${notification.id}/read`, {
        method: "PATCH",
      });
      await loadNotifications();
    }

    const link = await resolveNotificationLink(notification);

    if (link) {
      window.dispatchEvent(new CustomEvent("pms:navigation-start"));
      router.push(link);
      onClose?.();
    }
  };

  // Group notifications
  const groupedNotifications = useMemo(() => {
    const groups = { today: [], yesterday: [], older: [] };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    notifications.forEach((n) => {
      const d = new Date(n.createdAt);
      if (d >= today) groups.today.push(n);
      else if (d >= yesterday) groups.yesterday.push(n);
      else groups.older.push(n);
    });
    return groups;
  }, [notifications]);

  const renderGroup = (label, items) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-6 animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both">
        <h3 className="mb-3 px-1 text-xs font-semibold uppercase tracking-wider text-[color:var(--color-text-subtle)]">
          {label}
        </h3>
        <div className="space-y-2.5">
          {items.map((notification, idx) => {
            const isUnread = !notification.readAt;
            return (
              <button
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                style={{ animationDelay: `${idx * 40}ms` }}
                className={`group flex w-full items-start gap-3 rounded-lg border border-transparent p-3 text-left transition-colors duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring animate-in fade-in slide-in-from-bottom-2 fill-mode-both ${
                  isUnread
                    ? "bg-muted/60"
                    : "bg-transparent"
                }`}
              >
                {/* Icon Container */}
                <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
                  isUnread
                    ? "bg-background text-foreground"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {ICONS[notification.type] || ICONS.USER_LOG_COMMENT}
                </div>
                
                {/* Content */}
                <div className="min-w-0 flex-1 space-y-1">
                  <p className={`text-sm leading-snug ${isUnread ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                    {notification.message}
                  </p>
                  <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
                    <span>{formatTimeAgo(notification.createdAt)}</span>
                    {notification.actor?.name && (
                      <>
                        <span className="h-1 w-1 rounded-full bg-border"></span>
                        <span className="max-w-[120px] truncate">{notification.actor.name}</span>
                      </>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <Sheet isOpen={isOpen} title="Notifications" onClose={onClose} width="28rem">
      <div className="flex h-full flex-col space-y-5">
        
        {/* Header Actions */}
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap gap-1.5">
            {TABS.map((tab) => {
              const count =
                tab.id === "all"
                  ? counts.total
                  : tab.id === "taskMovement"
                    ? counts.taskMovement
                    : tab.id === "creation"
                      ? counts.creation
                      : counts.log;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-semibold transition-all duration-200 cursor-pointer ${
                    isActive
                      ? "bg-[color:var(--color-text)] text-[color:var(--color-card)] shadow-sm"
                      : "bg-transparent text-[color:var(--color-text-subtle)] hover:bg-[color:var(--color-surface-muted)] hover:text-[color:var(--color-text)]"
                  }`}
                >
                  <span>{tab.label}</span>
                  {count > 0 && (
                    <span className={`flex h-4 items-center justify-center rounded-full px-1.5 text-[9px] font-bold ${
                      isActive ? "bg-[color:var(--color-card)]/20 text-current" : "bg-[color:var(--color-accent)] text-white"
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Status Bar */}
        <div className="flex items-center justify-between px-1">
          <p className="text-[11px] font-medium text-muted-foreground">{isLoading ? "" : "All caught up"}</p>
          <div className="flex items-center gap-3">
            <button
              onClick={handleMarkAllRead}
              className="text-[11px] font-semibold text-[color:var(--color-text-subtle)] transition-colors hover:text-[color:var(--color-text)] cursor-pointer"
            >
              Mark all read
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto pb-10 pr-1 -mr-1 custom-scrollbar">
          {isLoading ? (
            <NotificationListSkeleton />
          ) : notifications.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[color:var(--color-border)]/60 bg-[color:var(--color-surface-muted)]/30 text-center animate-in fade-in">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--color-surface)] text-[color:var(--color-text-subtle)] shadow-sm">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="text-sm font-medium text-[color:var(--color-text-subtle)]">
                You&apos;re all caught up!
              </p>
            </div>
          ) : (
            <>
              {renderGroup("Today", groupedNotifications.today)}
              {renderGroup("Yesterday", groupedNotifications.yesterday)}
              {renderGroup("Older", groupedNotifications.older)}
            </>
          )}
        </div>
      </div>
    </Sheet>
  );
}
