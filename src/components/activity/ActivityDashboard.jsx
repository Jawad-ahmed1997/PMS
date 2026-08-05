"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import RefreshButton from "@/components/ui/RefreshButton";
import { Sheet } from "@/components/ui/sheet";
import { Dialog } from "@/components/ui/dialog";
import { Check, ChevronDown, Info, Search, X } from "lucide-react";
import CommentThread from "@/components/comments/CommentThread";
import { useToast } from "@/components/ui/ToastProvider";
import PageHeader from "@/components/layout/PageHeader";
import useOutsideClick from "@/hooks/useOutsideClick";
import AnalyticsResults from "@/components/analytics/AnalyticsResults";
import DailyTimelineChart from "@/components/analytics/DailyTimelineChart";
import ClientOnly from "@/components/ui/ClientOnly";
import Avatar from "@/components/ui/Avatar";
import { TimePicker } from "@/components/ui/time-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import {
  DEFAULT_TIME_ZONE,
  formatDateInTimeZone,
  formatDateTimeInTimeZone,
  formatTimeInTimeZone,
} from "@/lib/attendanceTimes";
import {
  getManualLogDateBounds,
  getManualTodayDateKey,
  isManualLogDateAllowed,
  isManualLogInFuture,
} from "@/lib/manualLogs";

const periodOptions = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
];

const badgeOptions = [
  { id: "all", label: "All" },
  { id: "task", label: "Task" },
  { id: "manual", label: "Manual Log" },
];

const manualCategories = [
  { id: "LEARNING", label: "Learning" },
  { id: "RESEARCH", label: "Research" },
  { id: "OTHER", label: "Other" },
];

const manualCategoryLabelMap = new Map(
  manualCategories.map((category) => [category.id, category.label])
);

function formatDateTime(value, timeZone = DEFAULT_TIME_ZONE) {
  return formatDateTimeInTimeZone(value, timeZone) ?? "-";
}

function formatDateOnly(value, timeZone = DEFAULT_TIME_ZONE) {
  return formatDateInTimeZone(value, timeZone) ?? "";
}

function formatTimeOnly(value, timeZone = DEFAULT_TIME_ZONE) {
  return formatTimeInTimeZone(value, timeZone) ?? "";
}

function formatDateInputValue(date) {
  if (!date) return "";
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}



function getManualStatus(log) {
  if (!log || log.taskId) {
    return null;
  }
  if (log.status === "RUNNING" || !log.endAt) {
    return "RUNNING";
  }
  return "COMPLETED";
}

function getRunningDurationLabel(startAt, now = new Date()) {
  if (!startAt) {
    return null;
  }
  const start = new Date(startAt);
  if (Number.isNaN(start.getTime())) {
    return null;
  }
  const minutes = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 60000));
  return `Started ${minutes} min ago`;
}


function getPeriodRange(period, baseDate = new Date()) {
  const now = new Date(baseDate);
  const start = new Date(now);
  const end = new Date(now);

  if (period === "weekly") {
    const day = now.getDay();
    const diff = (day + 6) % 7;
    start.setDate(now.getDate() - diff);
    end.setDate(start.getDate() + 6);
  } else if (period === "monthly") {
    start.setDate(1);
    end.setMonth(start.getMonth() + 1, 0);
  }

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

const MANAGEMENT_ROLES = ["CEO", "PM", "CTO", "TEAM_LEAD"];

function normalizeRole(role) {
  if (!role) {
    return null;
  }

  return role
    .toString()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_")
    .toUpperCase();
}

const ActivityMenu = ({ items }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useOutsideClick(menuRef, () => setIsOpen(false), isOpen);

  if (!items?.length) {
    return null;
  }

  return (
    <div className="relative" ref={menuRef}>
      <Button
        variant="outline"
        size="icon"
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className="h-8 w-8 rounded-full text-[color:var(--color-text-muted)]"
        aria-label="Activity actions"
        title="Activity actions"
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <span className="text-lg leading-none">⋮</span>
      </Button>
      {isOpen ? (
        <div
          className="absolute right-0 z-10 mt-2 w-44 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-2 text-xs text-[color:var(--color-text)] shadow-xl"
          onClick={(event) => event.stopPropagation()}
        >
          {items.map((item) => (
            <Button
              key={item.label}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setIsOpen(false);
                item.onClick?.();
              }}
              variant={item.variant === "danger" ? "destructive" : "ghost"}
              className={`h-auto w-full justify-start rounded-md px-2 py-2 text-left text-xs ${item.variant === "danger" ? "" : "text-[color:var(--color-text)]"
                }`}
            >
              <span>{item.label}</span>
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
};

const ActivityActionMenu = ({ items }) => {
  const [isOpen, setIsOpen] = useState(false);
  if (!items?.length) return null;
  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" type="button" className="h-8 w-8 rounded-full text-[color:var(--color-text-muted)]" aria-label="Activity actions">
          <span className="text-lg leading-none">⋮</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {items.map((item) => (
          <DropdownMenuItem
            key={item.label}
            onSelect={() => {
              setIsOpen(false);
              item.onClick?.();
            }}
            className={item.variant === "danger" ? "text-destructive focus:text-destructive" : ""}
          >
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default function ActivityDashboard({
  initialLogs,
  users,
  currentUser,
}) {
  const { addToast } = useToast();
  const userTimeZone = currentUser?.timezone || DEFAULT_TIME_ZONE;
  const isManager = MANAGEMENT_ROLES.includes(normalizeRole(currentUser?.role));
  const [period, setPeriod] = useState("daily");
  const [selectedDate, setSelectedDate] = useState("");
  const [activeBadge, setActiveBadge] = useState("all");
  const [selectedUser, setSelectedUser] = useState(null);
  const [userQuery, setUserQuery] = useState("");
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [commentCounts, setCommentCounts] = useState({});
  const [taskSheet, setTaskSheet] = useState({ open: false, task: null });
  const [logDialog, setLogDialog] = useState({ open: false, mode: "create" });
  const [activeLog, setActiveLog] = useState(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const categoryMenuRef = useRef(null);
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const [categoryQuery, setCategoryQuery] = useState("");
  const [isSavingLog, setIsSavingLog] = useState(false);
  const queryClient = useQueryClient();

  const [logForm, setLogForm] = useState({
    categories: ["LEARNING"],
    date: "",
    startTime: "",
    endTime: "",
    description: "",
    taskId: "",
  });

  useOutsideClick(
    categoryMenuRef,
    () => setIsCategoryMenuOpen(false),
    isCategoryMenuOpen
  );

  useEffect(() => {
    setIsHydrated(true);
    const today = getManualTodayDateKey();
    setSelectedDate(today);
    setLogForm((prev) => ({ ...prev, date: today }));
  }, []);

  const filteredUsers = useMemo(() => {
    const query = userQuery.toLowerCase();
    if (!query) {
      return users;
    }
    return users.filter(
      (user) =>
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query)
    );
  }, [userQuery, users]);

  const filteredCategories = useMemo(() => {
    const query = categoryQuery.trim().toLowerCase();
    if (!query) {
      return manualCategories;
    }
    return manualCategories.filter((category) =>
      category.label.toLowerCase().includes(query)
    );
  }, [categoryQuery]);

  const { data: rawLogs, isLoading: logsLoading, error: logsError, refetch: refetchLogs } = useQuery({
    queryKey: ["activityLogs", period, selectedDate, selectedUser?.id, isManager],
    queryFn: async () => {
      if (!selectedDate) return [];
      const { start, end } = getPeriodRange(period, selectedDate);
      const params = new URLSearchParams();
      params.set("startDate", formatDateInputValue(start));
      params.set("endDate", formatDateInputValue(end));
      params.set("scope", isManager ? "all" : "mine");
      if (selectedUser?.id && isManager) {
        params.set("userId", selectedUser.id);
      }
      const response = await fetch(`/api/activity?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "Unable to load activity logs.");
      }
      return data?.activityLogs ?? [];
    },
    enabled: Boolean(isHydrated && selectedDate),
    initialData: (!selectedUser?.id && (!selectedDate || selectedDate === getManualTodayDateKey(new Date(), userTimeZone)))
      ? initialLogs
      : undefined,
    staleTime: 1000 * 10,
  });

  const logs = useMemo(() => {
    if (rawLogs !== undefined) {
      return rawLogs;
    }
    const isInitialState = !selectedUser?.id && (!selectedDate || selectedDate === getManualTodayDateKey(new Date(), userTimeZone));
    return isInitialState ? initialLogs : [];
  }, [rawLogs, selectedUser?.id, selectedDate, userTimeZone, initialLogs]);

  useEffect(() => {
    if (logsError) {
      addToast({
        title: "Activity unavailable",
        message: logsError.message || "Unable to load activity logs.",
        variant: "error",
      });
    }
  }, [logsError, addToast]);

  useEffect(() => {
    const manualLogIds = logs
      .filter((log) => !log.taskId)
      .map((log) => log.id);
    if (manualLogIds.length === 0) {
      setCommentCounts({});
      return;
    }

    const loadCounts = async () => {
      try {
        const response = await fetch(
          `/api/comments?entityType=MANUAL_LOG&entityIds=${manualLogIds.join(",")}`
        );
        const data = await response.json();
        if (!response.ok) {
          return;
        }
        const counts = {};
        (data?.comments ?? []).forEach((comment) => {
          counts[comment.entityId] = (counts[comment.entityId] ?? 0) + 1;
        });
        setCommentCounts(counts);
      } catch (error) {
        setCommentCounts({});
      }
    };

    loadCounts();
  }, [logs]);

  const badgeCounts = useMemo(() => {
    const counts = { all: logs.length, task: 0, manual: 0 };
    logs.forEach((log) => {
      if (log.taskId) {
        counts.task += 1;
      } else {
        counts.manual += 1;
      }
    });
    return counts;
  }, [logs]);

  const filteredLogs = useMemo(() => {
    if (activeBadge === "task") {
      return logs.filter((log) => log.taskId);
    }
    if (activeBadge === "manual") {
      return logs.filter((log) => !log.taskId);
    }
    return logs;
  }, [activeBadge, logs]);

  const sortedLogs = useMemo(() => {
    return [...filteredLogs].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );
  }, [filteredLogs]);

  const handleLogChange = (event) => {
    const { name, value } = event.target;
    setLogForm((prev) => ({ ...prev, [name]: value }));
  };

  const toggleCategory = (categoryId) => {
    setLogForm((prev) => {
      const next = prev.categories.includes(categoryId)
        ? prev.categories.filter((entry) => entry !== categoryId)
        : [...prev.categories, categoryId];
      return { ...prev, categories: next };
    });
  };

  const openCreateLogModal = () => {
    const today = getManualTodayDateKey(new Date(), userTimeZone);
    setLogForm({
      categories: ["LEARNING"],
      date: today,
      startTime: "",
      endTime: "",
      description: "",
      taskId: "",
    });
    setActiveLog(null);
    setCategoryQuery("");
    setLogDialog({ open: true, mode: "create" });
  };

  const openEditLogDialog = (log) => {
    setActiveLog(log);
    setLogForm({
      categories:
        Array.isArray(log.categories) && log.categories.length
          ? log.categories
          : ["OTHER"],
      date: formatDateOnly(log.date, userTimeZone),
      startTime: formatTimeOnly(log.startAt, userTimeZone),
      endTime: formatTimeOnly(log.endAt, userTimeZone),
      description: log.description ?? "",
      taskId: log.taskId ?? "",
    });
    setCategoryQuery("");
    setLogDialog({ open: true, mode: "edit" });
  };

  const closeLogDialog = () => {
    setLogDialog({ open: false, mode: "create" });
    setActiveLog(null);
    setIsCategoryMenuOpen(false);
    setCategoryQuery("");
  };

  const handleDeleteLog = async (log) => {
    if (!log?.id) {
      return;
    }
    try {
      const response = await fetch(`/api/activity-logs/${log.id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "Unable to delete activity log.");
      }
      addToast({
        title: "Log deleted",
        message: "Manual activity removed.",
        variant: "success",
      });
      await refetchLogs();
      queryClient.invalidateQueries({ queryKey: ["activityLogs"] });
    } catch (error) {
      addToast({
        title: "Delete failed",
        message:
          error instanceof Error
            ? error.message
            : "Unable to delete activity log.",
        variant: "error",
      });
    }
  };

  const handleSubmitLog = async (event) => {
    event.preventDefault();
    if (!logForm.description.trim()) {
      addToast({
        title: "Description required",
        message: "Please enter a summary before saving the log.",
        variant: "warning",
      });
      return;
    }
    if (!logForm.startTime) {
      addToast({
        title: "Time required",
        message: "Please provide a start time.",
        variant: "warning",
      });
      return;
    }
    if (logForm.endTime && logForm.startTime >= logForm.endTime) {
      addToast({
        title: "Invalid time range",
        message: "End time must be after start time.",
        variant: "warning",
      });
      return;
    }
    if (
      isManualLogInFuture({
        date: logForm.date,
        startTime: logForm.startTime,
        endTime: logForm.endTime || undefined,
      })
    ) {
      addToast({
        title: "Future time not allowed",
        message: "Manual logs cannot be in the future.",
        variant: "error",
      });
      return;
    }
    if (!isManualLogDateAllowed(logForm.date)) {
      addToast({
        title: "Date not allowed",
        message:
          "Manual logs can only be added/edited for today or last 2 days.",
        variant: "error",
      });
      return;
    }
    if (!logForm.categories.length) {
      addToast({
        title: "Category required",
        message: "Select at least one category for the manual log.",
        variant: "warning",
      });
      return;
    }
    const payload = {
      date: logForm.date,
      description: logForm.description,
      startTime: logForm.startTime,
      endTime: logForm.endTime || null,
    };
    payload.categories = logForm.categories;

    setIsSavingLog(true);
    try {
      const response = await fetch(
        logDialog.mode === "edit" && activeLog
          ? `/api/activity/manual/${activeLog.id}`
          : "/api/activity/manual",
        {
          method: logDialog.mode === "edit" ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "Unable to save activity log.");
      }
      addToast({
        title: logDialog.mode === "edit" ? "Log updated" : "Log created",
        message:
          logDialog.mode === "edit"
            ? logForm.endTime
              ? "Manual activity completed"
              : "Manual activity updated."
            : logForm.endTime
              ? "Manual activity logged"
              : "Manual activity started",
        variant: "success",
      });
      closeLogDialog();
      await refetchLogs();
      queryClient.invalidateQueries({ queryKey: ["activityLogs"] });
    } catch (error) {
      addToast({
        title: "Log failed",
        message:
          error instanceof Error
            ? error.message
            : "Unable to save activity log.",
        variant: "error",
      });
    } finally {
      setIsSavingLog(false);
    }
  };

  const dateBounds = getManualLogDateBounds();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Accountability"
        title="Activity & comment timeline"
        subtitle="Track daily logs, task auto-activity, and leadership feedback."
        actions={
          <div className="flex items-center gap-2">
            <RefreshButton onClick={() => {
              refetchLogs();
              setRefreshTrigger((prev) => prev + 1);
            }} ariaLabel="Refresh activity logs" />
            <Button
              label="Manual Log Activity"
              variant="default"
              onClick={openCreateLogModal}
            />
          </div>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup type="single" value={activeBadge} onValueChange={(value) => value && setActiveBadge(value)}>
            {badgeOptions.map((badge) => (
              <ToggleGroupItem key={badge.id} value={badge.id}>
                <span>{badge.label}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  {badgeCounts[badge.id] ?? 0}
                </span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <div className="ml-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="h-9 w-[7.5rem] rounded-lg border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-text-muted)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
              {periodOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
              </SelectContent>
            </Select>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-9 rounded-lg px-3 text-xs font-semibold text-muted-foreground">
                {selectedDate || "Select date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2">
              <Calendar
                mode="single"
                selected={selectedDate ? new Date(`${selectedDate}T00:00:00`) : undefined}
                onSelect={(date) => {
                  if (date) setSelectedDate(formatDateInputValue(date));
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {isManager ? (
          <Popover open={isUserMenuOpen} onOpenChange={setIsUserMenuOpen}>
            <PopoverAnchor asChild>
            <div className="relative w-full max-w-xs">
            <Input
              value={userQuery}
              onChange={(event) => {
                setUserQuery(event.target.value);
                setIsUserMenuOpen(true);
                if (!event.target.value) {
                  setSelectedUser(null);
                }
              }}
              onFocus={() => setIsUserMenuOpen(true)}
              onClick={() => setIsUserMenuOpen(true)}
              placeholder="Search user"
              className="w-full rounded-lg border-[color:var(--color-border)] pl-10 pr-10 text-sm text-[color:var(--color-text)]"
            />
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            {selectedUser ? (
              <Button
                type="button"
                onClick={() => {
                  setSelectedUser(null);
                  setUserQuery("");
                  setIsUserMenuOpen(false);
                }}
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-[color:var(--color-text-muted)]"
                aria-label="Clear user filter"
              >
                ×
              </Button>
            ) : null}
            </div>
            </PopoverAnchor>
            <PopoverContent align="end" className="w-[min(20rem,calc(100vw-2rem))] p-0">
              <Command value={userQuery} onValueChange={setUserQuery}>
                <CommandInput placeholder="Search users" autoFocus />
                <CommandGroup className="max-h-56 overflow-y-auto">
                  {filteredUsers.map((user) => (
                    <CommandItem
                      key={user.id}
                      value={`${user.name} ${user.email}`}
                      onSelect={() => {
                        setSelectedUser(user);
                        setUserQuery(user.name);
                        setIsUserMenuOpen(false);
                      }}
                      className="flex flex-col items-start gap-1"
                    >
                      <span className="text-sm font-semibold">{user.name}</span>
                      <span className="text-[11px] text-muted-foreground">{user.role}</span>
                    </CommandItem>
                  ))}
                  <CommandEmpty>No users found.</CommandEmpty>
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>
        ) : null}
      </div>

      {logsLoading ? (
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-6 text-sm text-[color:var(--color-text-muted)] animate-pulse">
          Loading activity...
        </div>
      ) : logsError ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-200">
          {logsError.message || "Unable to load activity logs."}
        </div>
      ) : (
        <div className="space-y-4">
          <ClientOnly
            fallback={
              <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-5 text-sm text-[color:var(--color-text-muted)]">
                Loading analytics...
              </div>
            }
          >
            <AnalyticsResults
              period={period}
              date={selectedDate}
              userId={selectedUser?.id ?? null}
              refreshTrigger={refreshTrigger}
            />
            {period === "daily" ? (
              <DailyTimelineChart
                date={selectedDate}
                userId={selectedUser?.id ?? null}
                showNames={isManager}
                title="Daily working timeline"
                refreshTrigger={refreshTrigger}
              />
            ) : null}
          </ClientOnly>
          {sortedLogs.length === 0 ? (
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-5 text-sm text-[color:var(--color-text-subtle)]">
              No activity in this range.
            </div>
          ) : (
            sortedLogs.map((log) => {
              const isManualLog = !log.taskId;
              const manualCategoryLabels = Array.isArray(log.categories)
                ? log.categories
                  .map((category) => manualCategoryLabelMap.get(category) ?? category)
                  .filter(Boolean)
                : [];
              const badgeLabel = isManualLog
                ? manualCategoryLabels.join(", ") || "Manual"
                : "TASK";
              const commentCount = isManualLog
                ? commentCounts[log.id] ?? 0
                : 0;
              const manualStatus = getManualStatus(log);
              const isRunningManual = isManualLog && manualStatus === "RUNNING";
              const runningDurationLabel = isRunningManual
                ? getRunningDurationLabel(log.startAt)
                : null;
              return (
                <div
                  key={log.id}
                  className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar
                        src={log.user?.image}
                        name={log.user?.name ?? log.user?.email ?? "Unknown user"}
                        alt={`${log.user?.name ?? "Unknown user"} avatar`}
                        className="h-10 w-10 text-sm"
                      />
                      <div>
                        <p className="text-sm font-semibold text-[color:var(--color-text)]">
                          {log.user?.name ?? "Unknown user"}
                        </p>
                        <p className="text-xs text-[color:var(--color-text-subtle)]">
                          {log.user?.role ?? ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {commentCount > 0 ? (
                        <Button
                          type="button"
                          onClick={() => openEditLogDialog(log)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[color:var(--color-border)] text-[color:var(--color-text-muted)] hover:border-[color:var(--color-accent)]"
                          aria-label="View comments"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                          >
                            <path
                              d="M7 8h10M7 12h7M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8l-4 4v-4H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </Button>
                      ) : null}
                      <span className="rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-card)] px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-[color:var(--color-text-muted)]">
                        {badgeLabel}
                      </span>
                      {isRunningManual ? (
                        <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-300">
                          Running
                        </span>
                      ) : null}
                      <ActivityActionMenu
                        items={
                          isManualLog
                            ? [
                              {
                                label: "Edit",
                                onClick: () => openEditLogDialog(log),
                              },
                              {
                                label: "Delete",
                                onClick: () => handleDeleteLog(log),
                                variant: "danger",
                              },
                            ]
                            : [
                              {
                                label: "Leave Comment",
                                onClick: () => {
                                  if (log.taskId && log.task) {
                                    setTaskDrawer({
                                      open: true,
                                      task: log.task,
                                    });
                                  }
                                },
                              },
                            ]
                        }
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[color:var(--color-text-subtle)]">
                    <span suppressHydrationWarning>
                      {isHydrated ? formatDateTime(log.date, userTimeZone) : ""}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-[color:var(--color-text)]">
                    {log.description}
                  </p>
                  {log.task ? (
                    <p className="mt-2 text-xs text-[color:var(--color-text-muted)]">
                      Task: {log.task.title}
                    </p>
                  ) : null}
                  {isManualLog && log.startAt && log.endAt ? (
                    <p className="mt-2 text-xs text-[color:var(--color-text-muted)]">
                      Time: {formatTimeOnly(log.startAt, userTimeZone)} -{" "}
                      {formatTimeOnly(log.endAt, userTimeZone)}
                    </p>
                  ) : null}
                  {isRunningManual && log.startAt ? (
                    <p className="mt-2 text-xs text-[color:var(--color-text-muted)]">
                      Time: {formatTimeOnly(log.startAt, userTimeZone)} • Running
                      {runningDurationLabel ? ` • ${runningDurationLabel}` : ""}
                    </p>
                  ) : null}
                  {isManualLog && manualCategoryLabels.length ? (
                    <p className="mt-2 text-xs text-[color:var(--color-text-muted)]">
                      Categories: {manualCategoryLabels.join(", ")}
                    </p>
                  ) : null}
                  {isManualLog ? (
                    <p className="mt-2 text-xs text-[color:var(--color-text-subtle)]">
                      Status: {manualStatus === "RUNNING" ? "Running" : "Completed"}
                    </p>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      )}

      <Dialog
        isOpen={logDialog.open}
        title={logDialog.mode === "edit" ? "Edit manual log" : "Manual log activity"}
        description={
          logDialog.mode === "edit"
            ? "Update your manual activity log and review comments."
            : "Capture a manual activity entry for the timeline."
        }
        onClose={closeLogDialog}
      >
        <form
          onSubmit={handleSubmitLog}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="mt-4 flex-1 space-y-4 overflow-y-auto pr-1 hide-scrollbar">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3  ">
              <div
                className="flex flex-col gap-1 text-xs text-[color:var(--color-text-muted)] sm:col-span-2"
                ref={categoryMenuRef}
              >
                Categories
                <Popover open={isCategoryMenuOpen} onOpenChange={setIsCategoryMenuOpen}>
                  <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-[42px] w-full flex-wrap justify-between gap-2 rounded-xl bg-[color:var(--color-input)] px-3 py-2 text-left text-sm font-normal text-[color:var(--color-text)]"
                    aria-haspopup="listbox"
                  >
                    <div className="flex flex-wrap gap-2">
                      {logForm.categories.length ? (
                        logForm.categories.map((category) => (
                          <span
                            key={category}
                            className="rounded-full bg-[color:var(--color-accent-muted)] px-2 py-1 text-[11px] font-semibold text-[color:var(--color-accent)]"
                          >
                            {manualCategoryLabelMap.get(category) ?? category}
                          </span>
                        ))
                      ) : (
                        <span className="text-[color:var(--color-text-subtle)]">
                          Select categories
                        </span>
                      )}
                    </div>
                   <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-2">
                      <Input
                        type="text"
                        value={categoryQuery}
                        onChange={(event) => setCategoryQuery(event.target.value)}
                        placeholder="Search categories"
                        className="mb-2 h-9 text-xs"
                      />
                      <div className="max-h-40 space-y-1 overflow-y-auto pr-1 hide-scrollbar">
                        {filteredCategories.length ? (
                          filteredCategories.map((category) => {
                            const isSelected = logForm.categories.includes(
                              category.id
                            );
                            return (
                              <Button
                                key={category.id}
                                type="button"
                                onClick={() => toggleCategory(category.id)}
                                variant="ghost"
                                className={`flex h-auto w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs ${isSelected
                                  ? "bg-[color:var(--color-accent-muted)] text-[color:var(--color-accent)]"
                                  : "text-[color:var(--color-text)] hover:bg-[color:var(--color-muted-bg)]"
                                  }`}
                                role="option"
                                aria-selected={isSelected}
                              >
                                <span>{category.label}</span>
                                {isSelected ? (
                                  <Check className="h-3.5 w-3.5" />
                                ) : null}
                              </Button>
                            );
                          })
                        ) : (
                          <p className="px-3 py-2 text-xs text-[color:var(--color-text-subtle)]">
                            No categories found.
                          </p>
                        )}
                      </div>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex flex-col gap-1">
                <label className="flex items-center gap-1.5 text-xs text-[color:var(--color-text-muted)]">
                  Date
                  <div className="group relative flex items-center">
                    <Info size={14} className="cursor-help text-[color:var(--color-text-subtle)] hover:text-[color:var(--color-text)] transition-colors" />
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-48 -translate-x-1/2 rounded-lg bg-[color:var(--color-surface)] border border-[color:var(--color-border)] p-2 text-[11px] text-[color:var(--color-text)] opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
                      Only today or the last 2 days are allowed.
                    </div>
                  </div>
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={logDialog.mode === "edit"}
                      className="w-full justify-start font-normal"
                    >
                      {logForm.date || "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-2">
                    <Calendar
                      mode="single"
                      selected={logForm.date ? new Date(`${logForm.date}T00:00:00`) : undefined}
                      disabled={[
                        ...(dateBounds.min ? [{ before: new Date(`${dateBounds.min}T00:00:00`) }] : []),
                        ...(dateBounds.max ? [{ after: new Date(`${dateBounds.max}T00:00:00`) }] : []),
                      ]}
                      onSelect={(date) => {
                        if (date) {
                          handleLogChange({ target: { name: "date", value: formatDateInputValue(date) } });
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <label className="grid gap-2 text-xs text-[color:var(--color-text-muted)]">
                Start time
                <TimePicker
                  name="startTime"
                  value={logForm.startTime}
                  onChange={handleLogChange}
                  disabled={logDialog.mode === "edit"}
                />
              </label>
              <div className="flex flex-col gap-1">
                <label className="flex items-center gap-1.5 text-xs text-[color:var(--color-text-muted)]">
                  End time
                  <div className="group relative flex items-center">
                    <Info size={14} className="cursor-help text-[color:var(--color-text-subtle)] hover:text-[color:var(--color-text)] transition-colors" />
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-48 -translate-x-1/2 rounded-lg bg-[color:var(--color-surface)] border border-[color:var(--color-border)] p-2 text-[11px] text-[color:var(--color-text)] opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
                      Leave empty to keep this manual activity running.
                    </div>
                  </div>
                </label>
                <TimePicker
                  name="endTime"
                  value={logForm.endTime}
                  onChange={handleLogChange}
                />
              </div>
            </div>
            <label className="grid gap-2 text-xs text-[color:var(--color-text-muted)]">
              Description
              <Textarea
                name="description"
                value={logForm.description}
                onChange={handleLogChange}
                rows={4}
                placeholder="Summarize what you worked on."
                className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-sm text-[color:var(--color-text)] outline-none focus:border-[color:var(--color-accent)]"
              />
            </label>

            {logDialog.mode === "edit" && activeLog ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
                  Comments
                </p>
                <CommentThread
                  entityType="MANUAL_LOG"
                  entityId={activeLog.id}
                  currentUser={currentUser}
                  variant="chat"
                  onCommentAdded={(comment) =>
                    setCommentCounts((prev) => ({
                      ...prev,
                      [comment.entityId]:
                        (prev[comment.entityId] ?? 0) + 1,
                    }))
                  }
                />
              </div>
            ) : null}
          </div>
          <div className="sticky bottom-0 mt-4 flex flex-wrap items-center justify-end gap-3 border-t border-[color:var(--color-border)] bg-[color:var(--color-card)] pt-4">
            <Button
              label={isSavingLog ? "Saving..." : logDialog.mode === "edit" ? "Save changes" : "Save log"}
              variant="primary"
              type="submit"
              className="min-w-[140px]"
              disabled={isSavingLog || !isManualLogDateAllowed(logForm.date)}
            />
          </div>
        </form>
      </Dialog>

      <Sheet
        isOpen={taskSheet.open}
        title={taskSheet.task?.title ? "Task comments" : "Task"}
        onClose={() => setTaskSheet({ open: false, task: null })}
        width="28rem"
      >
        {taskSheet.task ? (
          <div className="space-y-4">
            <p className="text-sm text-[color:var(--color-text-muted)]">
              Leave feedback on the task activity below.
            </p>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
                Comments
              </p>
              <CommentThread
                entityType="TASK"
                entityId={taskSheet.task.id}
                currentUser={currentUser}
                autoFocus
                users={users}
              />
            </div>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
