"use client";

import { useCallback, useEffect, useMemo, useState, useRef, Fragment } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import ActionButton from "@/components/ui/ActionButton";
import { Sheet } from "@/components/ui/sheet";
import CommentThread from "@/components/comments/CommentThread";
import { useToast } from "@/components/ui/ToastProvider";
import { TASK_STATUSES, getNextStatuses, getStatusLabel, isDeveloperOnlyTransition, isManagementOnlyTransition } from "@/lib/kanban";
import { canMarkTaskDone, normalizeRoleId, roles } from "@/lib/roles";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ScrollArea from "@/components/ui/ScrollArea";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BREAK_TYPES, formatBreakTypes } from "@/lib/breakTypes";
import { useNotificationSound } from "@/lib/useNotificationSound";

const COLLAPSED_WIDTH = 64;
const DEFAULT_EXPANDED_WIDTH = 320;
const MIN_EXPANDED_WIDTH = 220;
const MAX_EXPANDED_WIDTH = 600;

const clampExpandedWidth = (value) =>
  Math.min(
    MAX_EXPANDED_WIDTH,
    Math.max(MIN_EXPANDED_WIDTH, Number(value ?? DEFAULT_EXPANDED_WIDTH))
  );

const formatDurationShort = (totalSeconds = 0) => {
  const seconds = Math.max(0, Number(totalSeconds) || 0);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  return `${minutes}m`;
};

const formatEstimatedTime = (hoursValue = 0) => {
  const hours = Math.max(0, Number(hoursValue) || 0);
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  if (wholeHours > 0 && minutes > 0) {
    return `${wholeHours}h ${minutes}m`;
  }
  if (wholeHours > 0) {
    return `${wholeHours}h`;
  }
  return minutes > 0 ? `${minutes}m` : "0m";
};

const formatBreakReason = (reasons, fallback = null) => formatBreakTypes(reasons, fallback);

const getPresenceLabel = (task) => {
  const status = task?.presenceStatusNow;
  if (status === "IN_OFFICE") {
    return "In office";
  }
  if (status === "WFH") {
    return "WFH";
  }
  if (status === "OFF_DUTY") {
    return "Off duty";
  }
  return task?.isWFHNow
    ? "WFH"
    : task?.isOnDutyNow
      ? "In office"
      : "Off duty";
};

const getProgressState = (task) => {
  if (task.status === "DONE") {
    return "completed";
  }
  const estimatedSeconds = Math.max(0, (task.estimatedHours ?? 0) * 3600);
  const spentSeconds = Number(
    task.spentTimeSeconds ?? task.totalTimeSpent ?? 0
  );
  if (estimatedSeconds > 0 && spentSeconds > estimatedSeconds) {
    return "overdue";
  }
  return "onTrack";
};

const getProgressColor = (state) => {
  if (state === "completed") {
    return "stroke-emerald-400";
  }
  if (state === "overdue") {
    return "stroke-rose-400";
  }
  return "stroke-sky-400";
};

const getTypeBadge = (type) => {
  switch (type) {
    case "AUTH":
      return "bg-amber-500/20 text-amber-300 border-amber-500/30";
    case "API":
      return "bg-sky-500/20 text-sky-300 border-sky-500/30";
    case "REFACTOR":
      return "bg-rose-500/20 text-rose-300 border-rose-500/30";
    case "CHART":
      return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
    default:
      return "bg-violet-500/20 text-violet-300 border-violet-500/30";
  }
};

const WorkflowStepper = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  const steps = [
    { id: "BACKLOG", label: "Backlog", desc: "Grooming/Backlog queue" },
    { id: "READY", label: "Ready", desc: "Ready for development" },
    { id: "IN_PROGRESS", label: "In Progress", desc: "Active work in progress" },
    { id: "DEV_TEST", label: "Dev Test", desc: "Developer self-testing" },
    { id: "TESTING", label: "Testing", desc: "Quality assurance testing" },
    { id: "DONE", label: "Done / Rejected", desc: "Completed or rejected" }
  ];

  if (!isExpanded) {
    return (
      <div className="mb-4 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-card)]/30 backdrop-blur py-2 px-4 flex flex-wrap items-center justify-between gap-3 transition-all">
        <div className="flex flex-wrap items-center gap-1 text-[11px] text-[color:var(--color-text-muted)]">
          <span className="font-semibold text-xs text-[color:var(--color-text)] mr-2 flex items-center gap-1 shrink-0">
            <span>🔄</span> Workflow:
          </span>
          {steps.map((step, idx) => (
            <Fragment key={step.id}>
              <span className="px-2 py-0.5 rounded bg-[color:var(--color-surface-muted)]/20 border border-[color:var(--color-border)] font-medium text-[color:var(--color-text-subtle)] text-[10px] shrink-0">
                {step.label}
              </span>
              {idx < steps.length - 1 && <span className="text-[color:var(--color-text-muted)] text-[10px] mx-0.5 shrink-0">➔</span>}
            </Fragment>
          ))}
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setIsExpanded(true)}
          className="h-7 px-2.5 text-[10px] font-bold uppercase tracking-wider text-primary hover:bg-primary/10 rounded-lg flex items-center gap-1 shrink-0"
        >
          Permissions Details ▾
        </Button>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)]/50 backdrop-blur p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 border-b border-[color:var(--color-border)] pb-3">
        <div>
          <h2 className="text-sm font-semibold text-[color:var(--color-text)] flex items-center gap-2">
            <span>🔄</span> Task Workflow & Move Permissions
          </h2>
          <p className="text-xs text-[color:var(--color-text-subtle)] mt-0.5">
            Guideline on who is authorized to transition tasks between board columns.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex flex-wrap gap-x-4 gap-y-1 text-[10px] uppercase tracking-wider font-semibold">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-blue-500"></span>
              <span className="text-blue-400">Leads Only</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              <span className="text-emerald-400">Assignee (User)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-purple-500"></span>
              <span className="text-purple-400">Both (Lead & User)</span>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setIsExpanded(false)}
            className="h-7 px-2 text-[10px] font-bold uppercase tracking-wider text-primary hover:bg-primary/10 rounded-lg flex items-center gap-1 shrink-0"
          >
            Collapse ▲
          </Button>
        </div>
      </div>

      {/* Main horizontal/vertical workflow path */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 overflow-x-auto hide-scrollbar py-2">
        {steps.map((step, idx) => {
          const isLast = idx === steps.length - 1;
          
          let rightsLabel = "";
          let rightsClass = "";
          let rightsDesc = "";

          if (idx === 0) {
            rightsLabel = "Leads Only";
            rightsClass = "bg-blue-500/10 text-blue-400 border-blue-500/20";
            rightsDesc = "PM, CTO, Team Lead";
          } else if (idx === 1 || idx === 3) {
            rightsLabel = "Assignee";
            rightsClass = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
            rightsDesc = "Assigned developer";
          } else if (idx === 2) {
            rightsLabel = "Assignee";
            rightsClass = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
            rightsDesc = "Assigned developer";
          } else if (idx === 4) {
            rightsLabel = "Leads Only";
            rightsClass = "bg-blue-500/10 text-blue-400 border-blue-500/20";
            rightsDesc = "PM, CTO, Team Lead";
          }

          return (
            <div key={step.id} className="flex flex-col lg:flex-row items-center gap-4">
              {/* Step item */}
              <div className="flex flex-row lg:flex-col items-center gap-3 lg:gap-1.5 p-3 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)]/10 hover:bg-[color:var(--color-surface-muted)]/20 transition-all w-full lg:w-44 shrink-0">
                <div className="flex items-center justify-center h-7 w-7 rounded-full bg-[color:var(--color-muted-bg)] text-xs font-bold text-[color:var(--color-text)]">
                  {idx + 1}
                </div>
                <div className="text-left lg:text-center">
                  <p className="text-xs font-semibold text-[color:var(--color-text)]">{step.label}</p>
                  <p className="text-[10px] text-[color:var(--color-text-subtle)] mt-0.5">{step.desc}</p>
                </div>
              </div>

              {/* Connector */}
              {!isLast && (
                <div className="flex flex-col items-center justify-center shrink-0 py-1 lg:py-0">
                  {/* Visual Arrow */}
                  <div className="hidden lg:block w-16 h-[2px] bg-[color:var(--color-border)] relative">
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 border-t-[5px] border-b-[5px] border-l-[6px] border-t-transparent border-b-transparent border-l-[color:var(--color-border)]"></div>
                  </div>
                  <div className="lg:hidden h-6 w-[2px] bg-[color:var(--color-border)] relative">
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-[color:var(--color-border)]"></div>
                  </div>

                  {/* Rights badge */}
                  <div 
                    className={`mt-1.5 lg:mt-2 text-[9px] font-bold px-2 py-0.5 rounded-full border ${rightsClass} cursor-help`}
                    title={rightsDesc}
                  >
                    {rightsLabel}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Auxiliary transition details (On Hold / Blocked) */}
      <div className="mt-4 pt-4 border-t border-[color:var(--color-border)] grid gap-4 sm:grid-cols-2">
        <div className="flex items-start gap-3 p-3 rounded-xl border border-dashed border-amber-500/30 bg-amber-500/5">
          <span className="text-lg">⏸</span>
          <div>
            <h4 className="text-xs font-semibold text-amber-400">On Hold Transition</h4>
            <p className="text-[10px] text-[color:var(--color-text-subtle)] mt-1">
              Tasks in <strong className="text-[color:var(--color-text)]">In Progress / Dev Test</strong> can be moved to <strong className="text-amber-400">On Hold</strong> by <strong className="text-purple-400">Both (Lead & User)</strong>. Resuming from Hold is also allowed by both.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 p-3 rounded-xl border border-dashed border-rose-500/30 bg-rose-500/5">
          <span className="text-lg">🚫</span>
          <div>
            <h4 className="text-xs font-semibold text-rose-400">Blocked Transition</h4>
            <p className="text-[10px] text-[color:var(--color-text-subtle)] mt-1">
              Any task can be marked as <strong className="text-rose-400">Blocked</strong> by <strong className="text-purple-400">Both (Lead & User)</strong>. Resolving a block can be done by the assignee or lead.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function TaskBoard({
  tasks,
  role,
  currentUserId,
  onEditTask,
  hideFilterButton = false,
}) {
  const { addToast } = useToast();
  const playNotificationSound = useNotificationSound();
  const searchParams = useSearchParams();

  const [taskItems, setTaskItems] = useState(tasks);
  const queryClient = useQueryClient();
  const invalidateAllTaskQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    queryClient.invalidateQueries({ queryKey: ["milestone"] });
  }, [queryClient]);
  const [pendingTaskId, setPendingTaskId] = useState(null);
  const [pendingChecklistId, setPendingChecklistId] = useState(null);
  const [draggingTaskId, setDraggingTaskId] = useState(null);
  const [dragOverStatus, setDragOverStatus] = useState(null);
  // Default to all tasks so milestone boards don't appear empty for managers.
  const [scope, setScope] = useState("all");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [ownerFilter, setOwnerFilter] = useState("ALL");
  const [milestoneFilter, setMilestoneFilter] = useState("ALL");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [timeRequestOpen, setTimeRequestOpen] = useState(false);
  const [timeRequestForm, setTimeRequestForm] = useState({
    hours: "",
    minutes: "",
    reason: "",
  });
  const [timeRequests, setTimeRequests] = useState([]);
  const [timeRequestsLoading, setTimeRequestsLoading] = useState(false);
  const [timeRequestActionId, setTimeRequestActionId] = useState(null);
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [breakForm, setBreakForm] = useState({
    reasons: ["NAMAZ"],
    note: "",
  });
  const [breakPanelOpen, setBreakPanelOpen] = useState(false);
  const [breakSubmitting, setBreakSubmitting] = useState(false);
  const [columnPrefs, setColumnPrefs] = useState({});
  const [resizeState, setResizeState] = useState(null);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [hasSavedPrefs, setHasSavedPrefs] = useState(false);

  const scrollContainerRef = useRef(null);

  useEffect(() => {
    if (!draggingTaskId) return;

    let animationFrameId;
    let scrollSpeed = 0;

    const handleDragOver = (event) => {
      const container = scrollContainerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const x = event.clientX - rect.left;

      const threshold = 100;
      const maxSpeed = 15;

      if (x < threshold) {
        const ratio = (threshold - x) / threshold;
        scrollSpeed = -ratio * maxSpeed;
      } else if (x > rect.width - threshold) {
        const ratio = (x - (rect.width - threshold)) / threshold;
        scrollSpeed = ratio * maxSpeed;
      } else {
        scrollSpeed = 0;
      }
    };

    const scrollTick = () => {
      const container = scrollContainerRef.current;
      if (container && scrollSpeed !== 0) {
        container.scrollLeft += scrollSpeed;
      }
      animationFrameId = requestAnimationFrame(scrollTick);
    };

    window.addEventListener("dragover", handleDragOver);
    animationFrameId = requestAnimationFrame(scrollTick);

    return () => {
      window.removeEventListener("dragover", handleDragOver);
      cancelAnimationFrame(animationFrameId);
    };
  }, [draggingTaskId]);

  useEffect(() => {
    setTaskItems(tasks);
  }, [tasks]);

  const milestoneId = tasks?.[0]?.milestoneId ?? "unknown";
  const prefKey = `kanbanColumnPrefs:${currentUserId ?? "guest"}:${milestoneId}`;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    setPrefsLoaded(false);
    const raw = window.localStorage.getItem(prefKey);
    setHasSavedPrefs(Boolean(raw));
    if (!raw) {
      setColumnPrefs({});
      setPrefsLoaded(true);
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      setColumnPrefs(parsed && typeof parsed === "object" ? parsed : {});
    } catch {
      setColumnPrefs({});
    }
    setPrefsLoaded(true);
  }, [prefKey]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(prefKey, JSON.stringify(columnPrefs));
  }, [prefKey, columnPrefs]);

  useEffect(() => {
    if (!resizeState) {
      return;
    }
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (event) => {
      const delta = event.clientX - resizeState.startX;
      const width = clampExpandedWidth(resizeState.startWidth + delta);
      setColumnPrefs((prev) => ({
        ...prev,
        [resizeState.statusId]: {
          ...prev?.[resizeState.statusId],
          width,
          collapsed: false,
          userTouched: true,
        },
      }));
    };
    const onUp = () => {
      setColumnPrefs((prev) => {
        const current = prev?.[resizeState.statusId] ?? {};
        const committedWidth = clampExpandedWidth(
          current.width ?? resizeState.startWidth ?? DEFAULT_EXPANDED_WIDTH
        );

        return {
          ...prev,
          [resizeState.statusId]: {
            ...current,
            collapsed: false,
            width: committedWidth,
            expandedWidth: committedWidth,
            userTouched: true,
          },
        };
      });
      setResizeState(null);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
    };
  }, [resizeState]);

  const taskCountsByStatus = useMemo(() => {
    const counts = {};
    TASK_STATUSES.forEach((status) => {
      counts[status.id] = 0;
    });
    taskItems.forEach((task) => {
      counts[task.status] = (counts[task.status] ?? 0) + 1;
    });
    return counts;
  }, [taskItems]);

  useEffect(() => {
    if (!prefsLoaded) {
      return;
    }

    setColumnPrefs((prev) => {
      let changed = false;
      const next = { ...prev };

      TASK_STATUSES.forEach((status) => {
        const count = taskCountsByStatus[status.id] ?? 0;
        const existing = prev?.[status.id] ?? {};
        const userTouched = Boolean(existing.userTouched);
        const safeExpandedWidth = clampExpandedWidth(
          existing.expandedWidth ?? existing.width ?? DEFAULT_EXPANDED_WIDTH
        );

        const shouldDefaultCollapse = !hasSavedPrefs && count === 0;
        const collapsed =
          typeof existing.collapsed === "boolean"
            ? existing.collapsed
            : shouldDefaultCollapse;
        const width = collapsed ? COLLAPSED_WIDTH : safeExpandedWidth;

        if (
          existing.collapsed !== collapsed ||
          existing.width !== width ||
          existing.expandedWidth !== safeExpandedWidth ||
          existing.userTouched !== userTouched
        ) {
          changed = true;
          next[status.id] = {
            collapsed,
            width,
            expandedWidth: safeExpandedWidth,
            userTouched,
          };
        }
      });

      return changed ? next : prev;
    });
  }, [prefsLoaded, taskCountsByStatus, hasSavedPrefs]);

  useEffect(() => {
    const taskId = searchParams?.get("taskId");
    if (!taskId) {
      return;
    }
    setSelectedTaskId(taskId);
  }, [searchParams]);

  const ownerOptions = useMemo(() => {
    const owners = new Map();
    taskItems.forEach((task) => {
      if (task.owner) {
        owners.set(task.owner.id, task.owner.name);
      }
    });
    return Array.from(owners.entries()).map(([id, name]) => ({ id, name }));
  }, [taskItems]);

  const mentionUsers = useMemo(() => {
    const users = new Map();
    taskItems.forEach((task) => {
      if (task.owner) {
        users.set(task.owner.id, task.owner);
      }
    });
    return Array.from(users.values());
  }, [taskItems]);

  const selectedTask = useMemo(
    () => taskItems.find((task) => task.id === selectedTaskId) ?? null,
    [taskItems, selectedTaskId]
  );
  const selectedSpentSeconds = Number(selectedTask?.spentTimeSeconds ?? 0);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [dodLink, setDodLink] = useState("");
  const [pushToProjectDocs, setPushToProjectDocs] = useState(true);
  const [savingDod, setSavingDod] = useState(false);

  useEffect(() => {
    if (selectedTask) {
      setDodLink(selectedTask.ktLink ?? "");
    } else {
      setDodLink("");
    }
    setPushToProjectDocs(true);
  }, [selectedTask]);

  // Mock states for Trello Task Modal features
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isRemovingCover, setIsRemovingCover] = useState(false);
  const [uploadCoverProgress, setUploadCoverProgress] = useState(0);
  const [attachments, setAttachments] = useState([]);
  const [isLoadingAttachments, setIsLoadingAttachments] = useState(false);
  const [isDeletingAttachmentId, setIsDeletingAttachmentId] = useState(null);
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [uploadAttachmentProgress, setUploadAttachmentProgress] = useState(0);
  const [lightboxAttachment, setLightboxAttachment] = useState(null);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [newSubtaskText, setNewSubtaskText] = useState("");
  const [pendingCoverFile, setPendingCoverFile] = useState(null);
  const [pendingCoverPreview, setPendingCoverPreview] = useState(null);
  

  useEffect(() => {
    setMounted(true);
  }, []);

  const [activeTab, setActiveTab] = useState("overview");
 
 
 
  useEffect(() => {
    setTaskItems(tasks ?? []);
  }, [tasks]);

  useEffect(() => {
    if (!draggingTaskId) return undefined;

    let animationFrameId;
    let scrollSpeed = 0;
    const handleDragOver = (event) => {
      const container = scrollContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const threshold = 100;
      const maxSpeed = 15;
      if (x < threshold) scrollSpeed = -((threshold - x) / threshold) * maxSpeed;
      else if (x > rect.width - threshold) scrollSpeed = ((x - (rect.width - threshold)) / threshold) * maxSpeed;
      else scrollSpeed = 0;
    };
    const scrollTick = () => {
      const container = scrollContainerRef.current;
      if (container && scrollSpeed !== 0) container.scrollLeft += scrollSpeed;
      animationFrameId = requestAnimationFrame(scrollTick);
    };
    window.addEventListener("dragover", handleDragOver);
    animationFrameId = requestAnimationFrame(scrollTick);
    return () => {
      window.removeEventListener("dragover", handleDragOver);
      cancelAnimationFrame(animationFrameId);
    };
  }, [draggingTaskId]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    setPrefsLoaded(false);
    const raw = window.localStorage.getItem(prefKey);
    setHasSavedPrefs(Boolean(raw));
    if (!raw) {
      setColumnPrefs({});
      setPrefsLoaded(true);
      return undefined;
    }
    try {
      const parsed = JSON.parse(raw);
      setColumnPrefs(parsed && typeof parsed === "object" ? parsed : {});
    } catch {
      setColumnPrefs({});
    }
    setPrefsLoaded(true);
    return undefined;
  }, [prefKey]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(prefKey, JSON.stringify(columnPrefs));
    }
  }, [prefKey, columnPrefs]);

  useEffect(() => {
    if (!resizeState) return undefined;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const onMove = (event) => {
      const delta = event.clientX - resizeState.startX;
      const width = clampExpandedWidth(resizeState.startWidth + delta);
      setColumnPrefs((prev) => ({
        ...prev,
        [resizeState.statusId]: { ...prev?.[resizeState.statusId], width, collapsed: false, userTouched: true },
      }));
    };
    const onUp = () => {
      setColumnPrefs((prev) => {
        const current = prev?.[resizeState.statusId] ?? {};
        const committedWidth = clampExpandedWidth(current.width ?? resizeState.startWidth ?? DEFAULT_EXPANDED_WIDTH);
        return { ...prev, [resizeState.statusId]: { ...current, collapsed: false, width: committedWidth, expandedWidth: committedWidth, userTouched: true } };
      });
      setResizeState(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
    };
  }, [resizeState]);



  useEffect(() => {
    if (!prefsLoaded) return;
    setColumnPrefs((prev) => {
      let changed = false;
      const next = { ...prev };
      TASK_STATUSES.forEach((status) => {
        const count = taskCountsByStatus[status.id] ?? 0;
        const existing = prev?.[status.id] ?? {};
        const userTouched = Boolean(existing.userTouched);
        const safeExpandedWidth = clampExpandedWidth(existing.expandedWidth ?? existing.width ?? DEFAULT_EXPANDED_WIDTH);
        const collapsed = typeof existing.collapsed === "boolean" ? existing.collapsed : !hasSavedPrefs && count === 0;
        const width = collapsed ? COLLAPSED_WIDTH : safeExpandedWidth;
        if (existing.collapsed !== collapsed || existing.width !== width || existing.expandedWidth !== safeExpandedWidth || existing.userTouched !== userTouched) {
          changed = true;
          next[status.id] = { collapsed, width, expandedWidth: safeExpandedWidth, userTouched };
        }
      });
      return changed ? next : prev;
    });
  }, [prefsLoaded, taskCountsByStatus, hasSavedPrefs]);

  useEffect(() => {
    const taskId = searchParams?.get("taskId");
    if (taskId) setSelectedTaskId(taskId);
  }, [searchParams]);

  useEffect(() => {
    const handleManualSaved = (e) => {
      if (e.detail?.action === "move-task" && e.detail?.taskId && e.detail?.statusId) {
        const task = taskItems.find((item) => item.id === e.detail.taskId);
        if (task) {
          handleStatusChange(task, e.detail.statusId);
        }
      }
    };
    window.addEventListener("pms:manual-activity-saved", handleManualSaved);
    return () => {
      window.removeEventListener("pms:manual-activity-saved", handleManualSaved);
    };
  }, [taskItems]);

  useEffect(() => {
    setDodLink(selectedTask?.ktLink ?? "");
    setPushToProjectDocs(true);
  }, [selectedTask]);




  const handleCancelPendingAttachment = useCallback(() => {
    pendingAttachments.forEach((item) => {
      if (item.preview) {
        URL.revokeObjectURL(item.preview);
      }
    });
    setPendingAttachments([]);
  }, [pendingAttachments]);

  const handlePendingAttachmentsSelect = useCallback((files) => {
    const allowedPrefixes = ["image/", "video/", "application/pdf", "text/plain"];
    const validFiles = Array.from(files).filter((file) =>
      allowedPrefixes.some((pref) => file.type.startsWith(pref))
    );

    if (validFiles.length === 0) {
      addToast({
        title: "No valid files",
        message: "Only images, videos, PDFs, and plain text files are allowed.",
        variant: "error",
      });
      return;
    }

    const newPendingItems = validFiles.map((file) => {
      const preview = URL.createObjectURL(file);
      const item = {
        id: Math.random().toString(36).substring(2, 9),
        file,
        preview,
        progress: 0,
        isUploading: false,
        textSnippet: "",
      };

      if (file.type === "text/plain") {
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target.result || "";
          item.textSnippet = text.substring(0, 120) + (file.size > 120 ? "..." : "");
          setPendingAttachments((prev) =>
            prev.map((p) => (p.id === item.id ? { ...p, textSnippet: item.textSnippet } : p))
          );
        };
        reader.readAsText(file.slice(0, 300));
      }

      return item;
    });

    setPendingAttachments((prev) => [...prev, ...newPendingItems]);
  }, [addToast]);

  const handleAddAttachment = (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    handlePendingAttachmentsSelect(files);
    event.target.value = "";
  };

  const handleRemovePendingItem = (itemId) => {
    setPendingAttachments((prev) => {
      const item = prev.find((p) => p.id === itemId);
      if (item && item.preview) {
        URL.revokeObjectURL(item.preview);
      }
      return prev.filter((p) => p.id !== itemId);
    });
  };

  const handleSavePendingAttachments = async (taskId) => {
    const itemsToUpload = pendingAttachments.filter((item) => !item.isUploading);
    if (itemsToUpload.length === 0) return;

    setIsUploadingAttachment(true);

    for (const item of itemsToUpload) {
      setPendingAttachments((prev) =>
        prev.map((p) => (p.id === item.id ? { ...p, isUploading: true } : p))
      );

      const file = item.file;
      const fileSizeStr = (file.size / 1024).toFixed(1) + " KB";

      try {
        const res = await fetch("/api/upload/presigned", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            fileType: file.type,
            uploadType: "task",
          }),
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData?.message || "Failed to get upload signature.");
        }

        const { uploadUrl, fileUrl, fileKey } = await res.json();

        await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", uploadUrl, true);
          xhr.setRequestHeader("Content-Type", file.type);

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const percent = Math.round((event.loaded / event.total) * 100);
              setPendingAttachments((prev) =>
                prev.map((p) => (p.id === item.id ? { ...p, progress: percent } : p))
              );
            }
          };

          xhr.onload = () => {
            if (xhr.status === 200) {
              resolve();
            } else {
              reject(new Error(`S3 upload failed with status ${xhr.status}`));
            }
          };

          xhr.onerror = () => reject(new Error("Network error during S3 upload."));
          xhr.send(file);
        });

        const saveRes = await fetch(`/api/tasks/${taskId}/attachments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: file.name,
            size: fileSizeStr,
            type: file.type,
            url: fileUrl,
            key: fileKey,
          }),
        });

        if (!saveRes.ok) {
          const errData = await saveRes.json();
          throw new Error(errData?.message || "Failed to save attachment metadata.");
        }

        const { attachment } = await saveRes.json();

        setAttachments((prev) => [attachment, ...prev]);

        setTaskItems((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? { ...t, attachmentCount: (t.attachmentCount ?? 0) + 1 }
              : t
          )
        );

        setPendingAttachments((prev) => {
          const filtered = prev.filter((p) => p.id !== item.id);
          URL.revokeObjectURL(item.preview);
          return filtered;
        });
      } catch (err) {
        console.error("Attachment upload error for:", file.name, err);
        addToast({
          title: "Upload failed",
          message: `Failed to upload "${file.name}".`,
          variant: "error",
        });
        setPendingAttachments((prev) =>
          prev.map((p) => (p.id === item.id ? { ...p, isUploading: false, progress: 0 } : p))
        );
      }
    }

    setIsUploadingAttachment(false);
    playNotificationSound();
  };

  const handleDeleteAttachment = async (taskId, attachmentId) => {
    setIsDeletingAttachmentId(attachmentId);
    try {
      const deleteRes = await fetch(`/api/tasks/${taskId}/attachments/${attachmentId}`, {
        method: "DELETE",
      });

      if (!deleteRes.ok) {
        const errData = await deleteRes.json();
        throw new Error(errData?.message || "Failed to delete attachment.");
      }

      setAttachments((prev) => prev.filter((att) => att.id !== attachmentId));

      setTaskItems((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, attachmentCount: Math.max(0, (t.attachmentCount ?? 0) - 1) }
            : t
        )
      );

      addToast({
        title: "Attachment removed",
        message: "File attachment removed.",
        variant: "info",
      });
    } catch (err) {
      console.error("Delete attachment error:", err);
      addToast({
        title: "Action failed",
        message: err instanceof Error ? err.message : "Failed to delete attachment.",
        variant: "error",
      });
    } finally {
      setIsDeletingAttachmentId(null);
    }
  };

  const fetchAttachments = useCallback(async (taskId) => {
    if (!taskId) return;
    setIsLoadingAttachments(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/attachments`);
      if (res.ok) {
        const data = await res.json();
        setAttachments(data.attachments || []);
      }
    } catch (err) {
      console.error("Failed to load attachments:", err);
    } finally {
      setIsLoadingAttachments(false);
    }
  }, []);

  useEffect(() => {
    if (selectedTaskId) {
      fetchAttachments(selectedTaskId);
    } else {
      setAttachments([]);
    }
  }, [selectedTaskId, fetchAttachments]);

  useEffect(() => {
    if (!selectedTaskId) {
      handleCancelPendingAttachment();
    }
  }, [selectedTaskId, handleCancelPendingAttachment]);

  const handleAddSubtask = async (e, taskId) => {
    e.preventDefault();
    if (!newSubtaskText.trim()) return;

    try {
      const response = await fetch("/api/checklist-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: newSubtaskText.trim(),
          taskId,
          isCompleted: false,
          isCustom: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        addToast({
          title: "Failed to add subtask",
          message: data?.error ?? "Unable to add subtask.",
          variant: "error",
        });
        return;
      }

      setTaskItems((prev) =>
        prev.map((task) => {
          if (task.id !== taskId) return task;
          return {
            ...task,
            checklistItems: [...(task.checklistItems ?? []), data.checklistItem],
          };
        })
      );

      setNewSubtaskText("");
      addToast({
        title: "Subtask added",
        message: "Custom subtask added successfully.",
        variant: "success",
      });
      invalidateAllTaskQueries();
    } catch (err) {
      addToast({
        title: "Error",
        message: "Unable to add subtask due to connection error.",
        variant: "error",
      });
    }
  };

  const handleDeleteSubtask = async (taskId, subtaskId) => {
    try {
      const response = await fetch(`/api/checklist-items/${subtaskId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        addToast({
          title: "Failed to delete subtask",
          message: data?.error ?? "Unable to delete subtask.",
          variant: "error",
        });
        return;
      }

      setTaskItems((prev) =>
        prev.map((task) => {
          if (task.id !== taskId) return task;
          return {
            ...task,
            checklistItems: (task.checklistItems ?? []).filter((item) => item.id !== subtaskId),
          };
        })
      );

      addToast({
        title: "Subtask deleted",
        message: "Custom subtask deleted successfully.",
        variant: "info",
      });
      invalidateAllTaskQueries();
    } catch (err) {
      addToast({
        title: "Error",
        message: "Unable to delete subtask due to connection error.",
        variant: "error",
      });
    }
  };

  const handleSaveDodLink = async () => {
    if (!selectedTask) return;
    setSavingDod(true);
    try {
      const taskRes = await fetch(`/api/tasks/${selectedTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ktLink: dodLink }),
      });
      const taskData = await taskRes.json();
      if (!taskRes.ok) throw new Error(taskData.error || "Failed to update task");

      setTaskItems((prev) =>
        prev.map((t) => (t.id === selectedTask.id ? { ...t, ktLink: dodLink } : t))
      );

      const projectId = selectedTask.projectId || selectedTask.milestone?.projectId;
      if (pushToProjectDocs && dodLink.trim() && projectId) {
        const ktRes = await fetch(`/api/projects/${projectId}/kt`);
        const ktData = await ktRes.json();
        if (ktRes.ok && ktData.kt) {
          const existingVideos = typeof ktData.kt.videoWalkthroughs === "string"
            ? JSON.parse(ktData.kt.videoWalkthroughs)
            : ktData.kt.videoWalkthroughs ?? [];

          const exists = existingVideos.some((v) => v.url === dodLink.trim());
          if (!exists) {
            const newVideo = {
              id: Math.random().toString(36).substring(2, 9),
              title: `KT: ${selectedTask.title}`,
              url: dodLink.trim(),
              createdAt: new Date().toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              }),
            };
            const updatedVideos = [...existingVideos, newVideo];

            await fetch(`/api/projects/${projectId}/kt`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ videoWalkthroughs: updatedVideos }),
            });
          }
        }
      }

      addToast({
        title: "DoD Link Saved",
        message: "Definition of Done link updated successfully.",
        variant: "success",
      });
    } catch (error) {
      addToast({
        title: "Failed to save link",
        message: error instanceof Error ? error.message : "Unable to save link.",
        variant: "error",
      });
    } finally {
      setSavingDod(false);
    }
  };

  const normalizedRole = useMemo(() => normalizeRoleId(role), [role]);

  const isManager = useMemo(
    () => [roles.PM, roles.CTO, roles.CEO, roles.TEAM_LEAD].includes(normalizedRole),
    [normalizedRole]
  );

  const isTaskOwner = (task) => {
    if (!currentUserId || !task) {
      return false;
    }

    return task.ownerId === currentUserId;
  };

  const loadTimeRequests = useCallback(async (taskId) => {
    if (!taskId) {
      setTimeRequests([]);
      return;
    }
    setTimeRequestsLoading(true);
    try {
      const response = await fetch(`/api/tasks/${taskId}/time-requests`);
      const data = await response.json();
      if (response.ok) {
        setTimeRequests(data?.requests ?? []);
      } else {
        setTimeRequests([]);
      }
    } catch (error) {
      setTimeRequests([]);
    } finally {
      setTimeRequestsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedTask?.id) {
      const tab = searchParams?.get("tab") || "overview";
      setActiveTab(tab);
      setTimeRequestOpen(false);
      setBreakPanelOpen(false);
    }
  }, [selectedTask?.id, searchParams]);

  useEffect(() => {
    if (!selectedTask?.id) {
      setTimeRequests([]);
      return;
    }
    const isOwner = selectedTask.ownerId === currentUserId;
    if (!isManager && !isOwner) {
      setTimeRequests([]);
      return;
    }
    loadTimeRequests(selectedTask.id);
  }, [
    selectedTask?.id,
    selectedTask?.ownerId,
    isManager,
    currentUserId,
    loadTimeRequests,
  ]);

  useEffect(() => {
    if (selectedTaskId && !selectedTask && taskItems.length > 0) {
      setSelectedTaskId(null);
    }
  }, [selectedTaskId, selectedTask, taskItems.length]);

  const milestoneOptions = useMemo(() => {
    const map = new Map();
    let hasNoMilestone = false;
    taskItems.forEach((task) => {
      if (task.milestone) {
        map.set(task.milestone.id, task.milestone.title);
      } else {
        hasNoMilestone = true;
      }
    });
    const options = Array.from(map.entries()).map(([id, title]) => ({ id, title }));
    if (hasNoMilestone) {
      options.push({ id: "NONE", title: "General Tasks (No Milestone)" });
    }
    return options;
  }, [taskItems]);

  const filteredTasks = useMemo(() => {
    return taskItems.filter((task) => {
      if (scope === "mine" && currentUserId) {
        if (task.ownerId !== currentUserId) {
          return false;
        }
      }

      if (statusFilter !== "ALL" && task.status !== statusFilter) {
        return false;
      }

      if (ownerFilter !== "ALL" && task.ownerId !== ownerFilter) {
        return false;
      }

      if (milestoneFilter !== "ALL") {
        if (milestoneFilter === "NONE") {
          if (task.milestoneId) return false;
        } else if (task.milestoneId !== milestoneFilter) {
          return false;
        }
      }

      return true;
    });
  }, [taskItems, scope, currentUserId, statusFilter, ownerFilter, milestoneFilter]);

  const groupedTasks = useMemo(() => {
    const buckets = {};
    TASK_STATUSES.forEach((status) => {
      buckets[status.id] = [];
    });
    filteredTasks.forEach((task) => {
      if (!buckets[task.status]) {
        buckets[task.status] = [];
      }
      buckets[task.status].push(task);
    });
    return buckets;
  }, [filteredTasks]);

  const handleStatusChange = async (task, nextStatus) => {
    if (!nextStatus) {
      return;
    }

    if (nextStatus === "IN_PROGRESS") {
      const stored = typeof window !== "undefined" ? localStorage.getItem("activity_timer_state") : null;
      const parsed = stored ? JSON.parse(stored) : null;
      if (parsed && parsed.running) {
        window.dispatchEvent(new CustomEvent("pms:show-manual-warning", { 
          detail: { action: "move-task", taskId: task.id, statusId: nextStatus } 
        }));
        return;
      }
    }

    if (!canMoveTaskForTask(task, nextStatus)) {
      const message = isManagementOnlyTransition(task.status, nextStatus)
        ? "Only PMs, CTOs, or Team Leads can move tasks from Backlog to Ready."
        : isDeveloperOnlyTransition(task.status, nextStatus)
        ? "Only the assigned developer can move their task through this stage."
        : "You can only move tasks assigned to you.";
      addToast({ title: "Move blocked", message, variant: "error" });
      return;
    }

    const payload = { toStatus: nextStatus };
    if (nextStatus === "BLOCKED") {
      const typeInput = window
        .prompt("Blocked type (CLIENT | TEAM | OTHER)", "CLIENT")
        ?.toUpperCase();
      const reasonInput = window.prompt("Blocked reason", "")?.trim();
      if (!typeInput || !reasonInput) {
        addToast({
          title: "Blocked reason required",
          message: "Please provide blocked type and reason.",
          variant: "error",
        });
        return;
      }
      payload.blockedType = typeInput;
      payload.blockedReason = reasonInput;
    }

    if (nextStatus === "ON_HOLD") {
      const holdReasonInput = window
        .prompt("Hold reason (SWITCH_TASK | BREAK | WAITING | OTHER) optional", "")
        ?.toUpperCase();
      const holdNoteInput = window.prompt("Optional hold note", "")?.trim();
      if (holdReasonInput) {
        payload.holdReason = holdReasonInput;
      }
      if (holdNoteInput) {
        payload.note = holdNoteInput;
      }
    }

    const previousTaskItems = [...taskItems];

    setTaskItems((prev) =>
      prev.map((item) => (item.id === task.id ? { ...item, status: nextStatus } : item))
    );

    setPendingTaskId(task.id);

    try {
      const response = await fetch(`/api/tasks/${task.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      let data = null;
      if (responseText) {
        try {
          data = JSON.parse(responseText);
        } catch (error) {
          data = null;
        }
      }

      if (!response.ok) {
        setTaskItems(previousTaskItems);
        addToast({
          title: "Action blocked",
          message: data?.error ?? "This action is not permitted.",
          variant: "error",
        });
        return;
      }

      if (!data?.task) {
        setTaskItems(previousTaskItems);
        addToast({
          title: "Update failed",
          message: "Unable to refresh task details after the move.",
          variant: "error",
        });
        return;
      }

      if (Array.isArray(data?.updatedTasks) && data.updatedTasks.length > 0) {
        setTaskItems((prev) => {
          const map = new Map(prev.map((item) => [item.id, item]));
          data.updatedTasks.forEach((updatedTask) => {
            map.set(updatedTask.id, updatedTask);
          });
          return Array.from(map.values());
        });
      } else {
        setTaskItems((prev) =>
          prev.map((item) => (item.id === task.id ? data.task : item))
        );
      }

      if (data?.warning) {
        addToast({
          title: "Off duty",
          message: data.warning,
          variant: "warning",
        });
      }

      // Timer status toasts
      if (nextStatus === "DEV_TEST") {
        addToast({
          title: "⏱ Timer stopped",
          message: "Task moved to Dev Test — timer has been paused.",
          variant: "info",
        });
      } else if (nextStatus === "IN_PROGRESS" && task.status === "DEV_TEST") {
        addToast({
          title: "⏱ Timer restarted",
          message: "Task returned to In Progress — timer is running again.",
          variant: "success",
        });
      }

      setColumnPrefs((prev) => {
        const current = prev?.[nextStatus] ?? {};
        const expandedWidth = clampExpandedWidth(
          current.expandedWidth ?? current.width ?? DEFAULT_EXPANDED_WIDTH
        );

        return {
          ...prev,
          [nextStatus]: {
            ...current,
            collapsed: false,
            width: expandedWidth,
            expandedWidth,
          },
        };
      });

      invalidateAllTaskQueries();

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("pms:refresh-notifications"));
        
        let activeSessionPayload = null;
        if (nextStatus === "IN_PROGRESS" && data?.task) {
          activeSessionPayload = {
            active: true,
            task: {
              id: data.task.id,
              title: data.task.title,
              estimatedSeconds: Math.round((data.task.estimatedHours ?? 0) * 3600),
              status: data.task.status,
              milestoneId: data.task.milestoneId,
              projectId: data.task.projectId || data.task.milestone?.projectId || null,
            },
            accumulatedSeconds: data.task.spentTimeSeconds ?? 0,
            runningStartedAt: data.task.lastStartedAt,
            isPaused: false,
            activeBreak: null,
            serverNow: new Date().toISOString(),
          };
        }

        window.dispatchEvent(
          new CustomEvent("pms:timer-changed", {
            detail: { activeSession: activeSessionPayload },
          })
        );
      }
    } catch (error) {
      setTaskItems(previousTaskItems);
      addToast({
        title: "Network error",
        message: "Failed to update task status.",
        variant: "error",
      });
    } finally {
      setPendingTaskId(null);
    }
  };

  const updateTaskState = (taskId, updater) => {
    setTaskItems((prev) =>
      prev.map((item) => (item.id === taskId ? updater(item) : item))
    );
  };

  const handlePersonalTodoToggle = async (todo, isCompleted) => {
    updateTaskState(selectedTask.id, (task) => ({
      ...task,
      personalTodos: (task.personalTodos ?? []).map((t) =>
        t.id === todo.id ? { ...t, isCompleted } : t
      ),
    }));

    try {
      const response = await fetch(`/api/todos/${todo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCompleted }),
      });
      if (!response.ok) {
        throw new Error("Unable to update personal to-do.");
      }
    } catch (err) {
      addToast({
        title: "To-Do update failed",
        message: "Failed to update personal to-do status.",
        variant: "error",
      });
      // Revert state
      updateTaskState(selectedTask.id, (task) => ({
        ...task,
        personalTodos: (task.personalTodos ?? []).map((t) =>
          t.id === todo.id ? { ...t, isCompleted: !isCompleted } : t
        ),
      }));
    }
  };

  const refreshTask = useCallback(async (taskId) => {
    if (!taskId) {
      return null;
    }
    try {
      const response = await fetch(`/api/tasks/${taskId}`);
      const data = await response.json();
      if (!response.ok || !data?.task) {
        return null;
      }
      setTaskItems((prev) =>
        prev.map((item) => (item.id === taskId ? data.task : item))
      );
      return data.task;
    } catch (error) {
      return null;
    }
  }, []);

  const triggerCoverUpload = useCallback(async (file, taskId) => {
    if (!file.type.startsWith("image/")) {
      addToast({
        title: "Invalid file",
        message: "Only image files are allowed for cover banner.",
        variant: "error",
      });
      return;
    }

    setIsUploadingCover(true);
    setUploadCoverProgress(0);

    try {
      // 1. Get presigned URL
      const res = await fetch("/api/upload/presigned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name || "pasted-image.png",
          fileType: file.type,
          uploadType: "task",
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData?.message || "Failed to get upload signature.");
      }

      const { uploadUrl, fileUrl } = await res.json();

      // 2. Direct upload to S3 with progress tracking
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl, true);
        xhr.setRequestHeader("Content-Type", file.type);

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            setUploadCoverProgress(percent);
          }
        };

        xhr.onload = () => {
          if (xhr.status === 200) {
            resolve();
          } else {
            reject(new Error(`S3 upload failed with status ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error("Network error during S3 upload."));
        xhr.send(file);
      });

      // 3. Save to database
      const patchRes = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coverImage: fileUrl }),
      });

      if (!patchRes.ok) {
        const errData = await patchRes.json();
        throw new Error(errData?.message || "Failed to update cover image in database.");
      }

      // 4. Refresh local task details
      await refreshTask(taskId);

      addToast({
        title: "Cover updated",
        message: "Task cover photo uploaded and updated successfully.",
        variant: "success",
      });
      playNotificationSound();
    } catch (err) {
      console.error("Cover upload error:", err);
      addToast({
        title: "Upload failed",
        message: err instanceof Error ? err.message : "Failed to upload cover banner.",
        variant: "error",
      });
    } finally {
      setIsUploadingCover(false);
      setUploadCoverProgress(0);
    }
  }, [addToast, refreshTask, playNotificationSound]);

  const handleCancelPendingCover = useCallback(() => {
    if (pendingCoverPreview) {
      URL.revokeObjectURL(pendingCoverPreview);
    }
    setPendingCoverFile(null);
    setPendingCoverPreview(null);
  }, [pendingCoverPreview]);

  const handlePendingCoverSelect = useCallback((file) => {
    if (!file.type.startsWith("image/")) {
      addToast({
        title: "Invalid file",
        message: "Only image files are allowed for cover banner.",
        variant: "error",
      });
      return;
    }
    if (pendingCoverPreview) {
      URL.revokeObjectURL(pendingCoverPreview);
    }
    setPendingCoverFile(file);
    setPendingCoverPreview(URL.createObjectURL(file));
  }, [pendingCoverPreview, addToast]);

  const handleCoverUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    handlePendingCoverSelect(file);
    event.target.value = "";
  };

  const handleSavePendingCover = async (taskId) => {
    if (!pendingCoverFile) return;
    await triggerCoverUpload(pendingCoverFile, taskId);
    handleCancelPendingCover();
  };

  const handleRemoveCover = async (taskId) => {
    setIsRemovingCover(true);
    try {
      const patchRes = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coverImage: null }),
      });

      if (!patchRes.ok) {
        const errData = await patchRes.json();
        throw new Error(errData?.message || "Failed to remove cover image.");
      }

      await refreshTask(taskId);

      addToast({
        title: "Cover removed",
        message: "Task cover photo removed.",
        variant: "info",
      });
    } catch (err) {
      console.error("Remove cover error:", err);
      addToast({
        title: "Action failed",
        message: err instanceof Error ? err.message : "Failed to remove cover image.",
        variant: "error",
      });
    } finally {
      setIsRemovingCover(false);
    }
  };

  useEffect(() => {
    if (!selectedTaskId) return;

    const handlePaste = async (event) => {
      const clipboardItems = event.clipboardData?.items;
      if (!clipboardItems) return;

      const items = Array.from(clipboardItems);
      const imageItem = items.find((item) => item.type.indexOf("image") !== -1);
      if (!imageItem) return;

      const file = imageItem.getAsFile();
      if (!file) return;

      event.preventDefault();
      handlePendingCoverSelect(file);
    };

    window.addEventListener("paste", handlePaste);
    return () => {
      window.removeEventListener("paste", handlePaste);
    };
  }, [selectedTaskId, handlePendingCoverSelect]);

  useEffect(() => {
    if (!selectedTaskId) {
      handleCancelPendingCover();
    }
  }, [selectedTaskId, handleCancelPendingCover]);

  const handleRequestTimeSubmit = async (task) => {
    if (!task) {
      return;
    }
    const hours = Number(timeRequestForm.hours || 0);
    const minutes = Number(timeRequestForm.minutes || 0);
    const totalSeconds = Math.max(0, Math.round(hours * 3600 + minutes * 60));
    if (!totalSeconds) {
      addToast({
        title: "Time needed",
        message: "Add hours or minutes to request more time.",
        variant: "error",
      });
      return;
    }
    if (!timeRequestForm.reason.trim()) {
      addToast({
        title: "Reason required",
        message: "Please share a reason for the extra time.",
        variant: "error",
      });
      return;
    }
    setRequestSubmitting(true);
    const response = await fetch(`/api/tasks/${task.id}/time-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestedSeconds: totalSeconds,
        reason: timeRequestForm.reason.trim(),
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      addToast({
        title: "Request failed",
        message: data?.error ?? "Unable to request more time.",
        variant: "error",
      });
      setRequestSubmitting(false);
      return;
    }
    addToast({
      title: "Request sent",
      message: "PM/CTO have been notified.",
      variant: "success",
    });
    setTimeRequests((prev) => [data.request, ...prev]);
    setTimeRequestForm({ hours: "", minutes: "", reason: "" });
    setTimeRequestOpen(false);
    setRequestSubmitting(false);
    invalidateAllTaskQueries();
  };

  const handleReviewTimeRequest = async (request, nextStatus) => {
    if (!request?.id || !selectedTask?.id) {
      return;
    }
    setTimeRequestActionId(request.id);
    const response = await fetch(`/api/time-requests/${request.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    const data = await response.json();
    if (!response.ok) {
      addToast({
        title: "Review failed",
        message: data?.error ?? "Unable to review time request.",
        variant: "error",
      });
      setTimeRequestActionId(null);
      return;
    }

    setTimeRequests((prev) =>
      prev.map((item) => (item.id === request.id ? data.request : item))
    );

    if (nextStatus === "APPROVED") {
      const addedHours = Number(request.requestedSeconds ?? 0) / 3600;
      updateTaskState(selectedTask.id, (item) => ({
        ...item,
        estimatedHours: (item.estimatedHours ?? 0) + addedHours,
      }));
    }

    addToast({
      title: "Request updated",
      message:
        nextStatus === "APPROVED"
          ? "Extra time approved."
          : "Request rejected.",
      variant: "success",
    });
    setTimeRequestActionId(null);
    invalidateAllTaskQueries();
  };

  const handlePause = async (task) => {
    if (!task?.id) {
      return;
    }
    if (!breakForm.reasons.length) {
      addToast({
        title: "Select break types",
        message: "Please select at least one break type.",
        variant: "error",
      });
      return;
    }
    setBreakSubmitting(true);
    const response = await fetch(`/api/tasks/${task.id}/breaks/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reasons: breakForm.reasons,
        note: breakForm.note?.trim() || null,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      const message =
        response.status === 403
          ? "You are not allowed."
          : response.status === 409
            ? "Task is already paused."
            : data?.error ?? "Unable to start break.";
      addToast({
        title: "Pause failed",
        message,
        variant: "error",
      });
      setBreakSubmitting(false);
      return;
    }
    const refreshedTask = await refreshTask(task.id);
    if (!refreshedTask) {
      updateTaskState(task.id, (item) => ({
        ...item,
        breaks: [data.break, ...(item.breaks ?? [])],
        activeBreak: data.break,
      }));
    }
    setBreakPanelOpen(false);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pms:timer-changed"));
    }
    setBreakSubmitting(false);
    invalidateAllTaskQueries();
  };

  const handleResume = async (task) => {
    if (!task?.id) {
      return;
    }
    setBreakSubmitting(true);
    const response = await fetch(`/api/tasks/${task.id}/breaks/end`, {
      method: "POST",
    });
    const data = await response.json();
    if (!response.ok) {
      const message =
        response.status === 403
          ? "You are not allowed."
          : response.status === 404
            ? "Task is not paused."
            : data?.error ?? "Unable to resume task.";
      addToast({
        title: "Resume failed",
        message,
        variant: "error",
      });
      setBreakSubmitting(false);
      return;
    }
    const refreshedTask = await refreshTask(task.id);
    if (!refreshedTask) {
      updateTaskState(task.id, (item) => ({
        ...item,
        breaks: data.break
          ? (item.breaks ?? []).map((brk) =>
            brk.id === data.break.id ? data.break : brk
          )
          : item.breaks ?? [],
        activeBreak: null,
      }));
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pms:timer-changed"));
    }
    setBreakSubmitting(false);
    invalidateAllTaskQueries();
  };

  const handleChecklistToggle = async (taskId, item, nextValue) => {
    setPendingChecklistId(item.id);
    const response = await fetch(`/api/checklist-items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isCompleted: nextValue }),
    });

    const data = await response.json();

    if (!response.ok) {
      addToast({
        title: "Checklist update failed",
        message: data?.error ?? "Unable to update checklist item.",
        variant: "error",
      });
      setPendingChecklistId(null);
      return;
    }

    setTaskItems((prev) =>
      prev.map((task) => {
        if (task.id !== taskId) {
          return task;
        }

        return {
          ...task,
          checklistItems: task.checklistItems.map((existing) =>
            existing.id === item.id ? data.checklistItem : existing
          ),
        };
      })
    );

    setPendingChecklistId(null);
    invalidateAllTaskQueries();
  };

  const isChecklistComplete = (task) =>
    task.checklistItems?.length > 0 &&
    task.checklistItems.every((item) => item.isCompleted);

  const canEditTask = (task) => {
    return Boolean(task) && isManager;
  };

  const canToggleChecklist = (task) => {
    if (!task) {
      return false;
    }

    return isManager || isTaskOwner(task);
  };

  const canMoveTaskForTask = (task, toStatus = null) => {
    if (!currentUserId || !task) {
      return false;
    }

    const isManagerRole = [roles.PM, roles.CTO, roles.CEO, roles.TEAM_LEAD].includes(normalizedRole);
    const isOwner = task.ownerId === currentUserId;

    if (toStatus) {
      // Management-only transitions (e.g. BACKLOG → READY)
      // Assignees cannot self-promote tasks out of the backlog.
      if (isManagementOnlyTransition(task.status, toStatus) && !isManagerRole) {
        return false;
      }
      // Developer-only transitions — managers cannot drag tasks through these
      // unless they are also the assignee.
      if (isDeveloperOnlyTransition(task.status, toStatus) && isManagerRole && !isOwner) {
        return false;
      }
    }

    return isManagerRole || isOwner;
  };

  const canRequestMoreTime = (task) => {
    if (!task) {
      return false;
    }

    return isTaskOwner(task) && [roles.DEV, roles.SENIOR_DEV, roles.INTERN, roles.JUNIOR_INTERN].includes(normalizedRole);
  };

  const canControlBreaks = (task) =>
    isTaskOwner(task) && ![roles.PM, roles.CTO, roles.CEO, roles.TEAM_LEAD].includes(normalizedRole);

  const handleDragStart = (event, task) => {
    // For developer-only transitions we need the target column, which we don't
    // know yet at drag-start. We allow the drag to begin and block at drop.
    if (!canMoveTaskForTask(task)) {
      event.preventDefault();
      addToast({
        title: "Move blocked",
        message: "You can only move tasks assigned to you.",
        variant: "error",
      });
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", task.id);
    setDraggingTaskId(task.id);
  };

  const handleDragEnd = () => {
    setDraggingTaskId(null);
    setDragOverStatus(null);
  };

  const handleDrop = (event, statusId) => {
    event.preventDefault();
    const taskId = event.dataTransfer.getData("text/plain");
    const task = taskItems.find((item) => item.id === taskId);
    setDragOverStatus(null);

    if (!task || task.status === statusId) {
      return;
    }

    if (!canMoveTaskForTask(task, statusId)) {
      const message = isManagementOnlyTransition(task.status, statusId)
        ? "Only PMs, CTOs, or Team Leads can move tasks from Backlog to Ready."
        : isDeveloperOnlyTransition(task.status, statusId)
        ? "Only the assigned developer can move their task through this stage."
        : "You can only move tasks assigned to you.";
      addToast({ title: "Move blocked", message, variant: "error" });
      return;
    }

    handleStatusChange(task, statusId);
  };

  const expandColumn = (statusId) => {
    setColumnPrefs((prev) => {
      const current = prev?.[statusId] ?? {};
      const expandedWidth = clampExpandedWidth(
        current.expandedWidth ?? current.width ?? DEFAULT_EXPANDED_WIDTH
      );

      return {
        ...prev,
        [statusId]: {
          ...current,
          collapsed: false,
          width: expandedWidth,
          expandedWidth,
          userTouched: true,
        },
      };
    });
  };

  const collapseColumn = (statusId) => {
    setColumnPrefs((prev) => {
      const current = prev?.[statusId] ?? {};
      const expandedWidth = clampExpandedWidth(
        current.width ?? current.expandedWidth ?? DEFAULT_EXPANDED_WIDTH
      );

      return {
        ...prev,
        [statusId]: {
          ...current,
          collapsed: true,
          width: COLLAPSED_WIDTH,
          expandedWidth,
          userTouched: true,
        },
      };
    });
  };

  const renderActions = (task) => {
    const isPending = pendingTaskId === task.id;
    const buttonClass = isPending ? "pointer-events-none opacity-60" : "";

    if (task.status === "TESTING") {
      if (canMarkTaskDone(normalizedRole)) {
        return (
          <div className="flex flex-wrap gap-2">
            <Button
              label={isPending ? "Approving..." : "Approve"}
              size="sm"
              variant="success"
              className={buttonClass}
              onClick={() => handleStatusChange(task, "DONE")}
            />
            <Button
              label={isPending ? "Rejecting..." : "Reject"}
              size="sm"
              variant="danger"
              className={buttonClass}
              onClick={() => handleStatusChange(task, "REJECTED")}
            />
          </div>
        );
      }

      return (
        <p className="text-xs text-[color:var(--color-text-subtle)]">
          Awaiting PM/CTO approval for testing.
        </p>
      );
    }

    if (task.status === "DONE") {
      return <p className="text-xs text-emerald-300">Completed</p>;
    }

    if (task.status === "REJECTED") {
      if (!canMoveTaskForTask(task)) {
        return (
          <p className="text-xs text-[color:var(--color-text-subtle)]">
            Rework required before resubmission.
          </p>
        );
      }

      return (
        <Button
          label={isPending ? "Restarting..." : "Resume work"}
          size="sm"
          variant="warning"
          className={buttonClass}
          onClick={() => handleStatusChange(task, "IN_PROGRESS")}
        />
      );
    }

    if (!canMoveTaskForTask(task)) {
      return (
        <p className="text-xs text-[color:var(--color-text-subtle)]">
          You do not have permission to move this task.
        </p>
      );
    }

    const nextStatus = getNextStatuses(task.status)[0];

    if (task.status === "DEV_TEST" && !isChecklistComplete(task)) {
      return (
        <p className="text-xs text-amber-500">
          Complete the checklist before moving to testing.
        </p>
      );
    }

    return (
      <Button
        label={isPending ? "Moving..." : "Move forward"}
        size="sm"
        variant="secondary"
        className={buttonClass}
        onClick={() => handleStatusChange(task, nextStatus)}
      />
    );
  };

  const ProgressRing = ({ progress, state }) => {
    const radius = 16;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference * (1 - Math.min(Math.max(progress, 0), 1));
    return (
      <svg
        viewBox="0 0 40 40"
        className="h-10 w-10 -rotate-90"
        aria-hidden="true"
      >
        <circle
          cx="20"
          cy="20"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className="text-[color:var(--color-border)]"
        />
        <circle
          cx="20"
          cy="20"
          r={radius}
          fill="none"
          strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={getProgressColor(state)}
        />
      </svg>
    );
  };

  const portalTarget = typeof document !== "undefined" ? document.getElementById("project-board-filter-button-portal") : null;
  const hasActiveFilters = isFilterOpen || ownerFilter !== "ALL" || statusFilter !== "ALL";
  const filterButton = (
    <Button
      type="button"
      variant={hasActiveFilters ? "secondary" : "outline"}
      size="sm"
      onClick={() => setIsFilterOpen((prev) => !prev)}
      className="h-8 rounded-xl px-3 text-xs"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <path
          d="M4 5h16l-6 7v5l-4 2v-7L4 5Z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span>Filters</span>
    </Button>
  );

  return (
    <div className="space-y-4">
      {!hideFilterButton && (
        <div className="space-y-3">
          {mounted && portalTarget ? (
            createPortal(filterButton, portalTarget)
          ) : (
            <div className="flex justify-end">{filterButton}</div>
          )}

          {isFilterOpen && (
            <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm transition-all duration-200">
              <div className="flex items-center gap-3">
                {/* Owner Filter Dropdown */}
                <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                  <SelectTrigger className="h-8 min-w-[120px] rounded-xl bg-background px-3 text-xs font-semibold ">
                    <SelectValue placeholder="All Assignees" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Assignees</SelectItem>
                    {ownerOptions.map((owner) => (
                      <SelectItem key={owner.id} value={owner.id}>{owner.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Status Filter Dropdown */}
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-8 min-w-[120px] rounded-xl bg-background px-3 text-xs font-semibold">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <ScrollArea
                      type="always"
                      className="h-[300px] max-h-[calc(100vh-10rem)] w-full"
                      viewportClassName="pr-2"
                    >
                      <SelectItem value="ALL">All Statuses</SelectItem>
                      {TASK_STATUSES.map((statusOpt) => (
                        <SelectItem key={statusOpt.id} value={statusOpt.id}>{statusOpt.label}</SelectItem>
                      ))}
                    </ScrollArea>
                  </SelectContent>
                </Select>

                {/* Milestone Filter Dropdown */}
                {milestoneOptions.length > 0 && (
                  <Select value={milestoneFilter} onValueChange={setMilestoneFilter}>
                    <SelectTrigger className="h-8 min-w-[120px] rounded-xl bg-background px-3 text-xs font-semibold">
                      <SelectValue placeholder="All Milestones" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Milestones</SelectItem>
                      {milestoneOptions.map((milestoneOpt) => (
                        <SelectItem key={milestoneOpt.id} value={milestoneOpt.id}>
                          {milestoneOpt.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* Reset Button */}
                {(ownerFilter !== "ALL" || statusFilter !== "ALL" || milestoneFilter !== "ALL") && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setOwnerFilter("ALL");
                      setStatusFilter("ALL");
                      setMilestoneFilter("ALL");
                    }}
                    className="h-8 px-2 text-xs text-primary"
                  >
                    Reset Filters
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <WorkflowStepper />

      <div
        ref={scrollContainerRef}
        className="flex gap-4 overflow-x-auto pb-2 items-start hide-scrollbar"
      >
        {TASK_STATUSES.map((status) => {
          const pref = columnPrefs?.[status.id] ?? {};
          const isCollapsed = Boolean(pref.collapsed);
          const isResizing = resizeState?.statusId === status.id;
          const taskCount = groupedTasks[status.id]?.length ?? 0;
          const expandedWidth = clampExpandedWidth(
            pref.expandedWidth ?? pref.width ?? DEFAULT_EXPANDED_WIDTH
          );
          const width = isCollapsed ? COLLAPSED_WIDTH : expandedWidth;

          return (
            <div
              key={status.id}
              style={{
                width,
                minWidth: width,
                maxWidth: width,
                willChange: "width",
                transition: isResizing ? "none" : "width 180ms ease",
              }}
              className={`relative flex-none rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] p-4 ${dragOverStatus === status.id
                ? "border-[color:var(--color-accent)] bg-[color:var(--color-card)]"
                : ""
                }`}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOverStatus(status.id);
              }}
              onDragLeave={() => setDragOverStatus(null)}
              onDrop={(event) => handleDrop(event, status.id)}
            >
              <div
                className={`mb-3 overflow-hidden ${isCollapsed
                  ? "flex min-h-[140px] flex-col items-center justify-start gap-2"
                  : "flex h-8 items-center justify-between gap-2"
                  }`}
              >
                {isCollapsed ? (
                  <>
                    <span className="inline-flex h-5 min-w-5 max-w-10 items-center justify-center overflow-hidden rounded-full border border-[color:var(--color-border)] px-1.5 text-[11px] leading-none text-[color:var(--color-text-muted)]">
                      {taskCount}
                    </span>
                    <h3 className="max-h-[86px] overflow-hidden text-xs font-semibold text-[color:var(--color-text)] [writing-mode:vertical-rl] [transform:rotate(180deg)]">
                      {status.label}
                    </h3>
                    <button
                      type="button"
                      className="inline-flex h-6 w-6 items-center justify-center rounded border border-[color:var(--color-border)] text-sm font-semibold text-[color:var(--color-text)] transition hover:border-[color:var(--color-accent)] hover:bg-[color:var(--color-accent-muted)]"
                      aria-label={`Expand ${status.label} column`}
                      title="Expand column"
                      onClick={() => expandColumn(status.id)}
                    >
                      +
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex min-w-0 items-center gap-1.5">
                      <h3 className="truncate text-sm font-semibold text-[color:var(--color-text)]">
                        {status.label}
                      </h3>
                      <span className="inline-flex h-5 min-w-5 max-w-10 items-center justify-center overflow-hidden rounded-full border border-[color:var(--color-border)] px-1.5 text-[11px] leading-none text-[color:var(--color-text-muted)]">
                        {taskCount}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="inline-flex h-6 w-6 items-center justify-center rounded border border-[color:var(--color-border)] text-sm font-semibold text-[color:var(--color-text)] transition hover:border-[color:var(--color-accent)] hover:bg-[color:var(--color-accent-muted)]"
                      aria-label={`Collapse ${status.label} column`}
                      title="Collapse column"
                      onClick={() => collapseColumn(status.id)}
                    >
                      -
                    </button>
                  </>
                )}
              </div>
              {!isCollapsed && <div className="min-w-0 space-y-3 overflow-hidden">
                {(groupedTasks[status.id] ?? []).map((task) => {
                  const predefinedItems = (task.checklistItems ?? []).filter((item) => !item.isCustom);
                  const completedChecklistCount =
                    predefinedItems.filter((item) => item.isCompleted).length;
                  const checklistTotal = predefinedItems.length;
                  const estimatedSeconds = Math.max(
                    0,
                    (task.estimatedHours ?? 0) * 3600
                  );
                  const effectiveSpentSeconds = Number(
                    task.spentTimeSeconds ?? 0
                  );
                  const estimatedLabel =
                    estimatedSeconds > 0
                      ? formatEstimatedTime(task.estimatedHours)
                      : "No estimate";
                  const progress =
                    estimatedSeconds > 0
                      ? effectiveSpentSeconds / estimatedSeconds
                      : 0;
                  const progressState = getProgressState(task);
                  return (
                    <div
                      key={task.id}
                      className={`min-w-0 cursor-pointer overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-2.5 transition hover:border-[color:var(--color-accent)] sm:p-3 ${pendingTaskId === task.id ? "opacity-60" : ""
                        } ${draggingTaskId === task.id ? "opacity-70" : ""}`}
                      draggable={Boolean(currentUserId)}
                      onDragStart={(event) => handleDragStart(event, task)}
                      onDragEnd={handleDragEnd}
                      onClick={() => setSelectedTaskId(task.id)}
                    >
                      {task.coverImage && (
                        <div className="mb-2 -mx-2.5 -mt-2.5 overflow-hidden rounded-t-xl bg-[color:var(--color-muted-bg)] sm:-mx-3 sm:-mt-3 border-b border-[color:var(--color-border)]">
                          <img
                            src={task.coverImage}
                            alt=""
                            className="w-full h-32 object-cover transition-transform duration-300 hover:scale-[1.03]"
                          />
                        </div>
                      )}
                      <p className="truncate text-sm font-semibold text-[color:var(--color-text)]">
                        {task.title}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {task.status === "BLOCKED" && (
                          <span className="rounded border border-rose-500/40 px-1.5 py-0.5 text-[10px] text-rose-300">🔒 {task.blockedType}: {task.blockedReason}</span>
                        )}
                        {task.status === "ON_HOLD" && task.holdReason && (
                          <span className="rounded border border-amber-500/40 px-1.5 py-0.5 text-[10px] text-amber-300">⏸ {task.holdReason}</span>
                        )}
                        {Number(task.reworkCount ?? 0) > 0 && (
                          <span className="rounded border border-rose-500/40 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-rose-400">
                            ⚠️ Rework ({task.reworkCount})
                          </span>
                        )}
                      </div>
                      {/* Custom Subtasks Mini List */}
                      {(() => {
                        const items = (task.checklistItems ?? []).filter((item) => item.isCustom);
                        if (items.length === 0) return null;
                        return (
                          <div className="mt-2.5 space-y-1 border-t border-[color:var(--color-border)]/30 pt-2">
                            {items.map((sub) => (
                              <div key={sub.id} className="flex items-center gap-1.5 text-[10.5px] text-[color:var(--color-text-muted)]">
                                <span className={`h-1.5 w-1.5 rounded-full ${sub.isCompleted ? "bg-emerald-400" : "bg-zinc-500"}`} />
                                <span className={`truncate ${sub.isCompleted ? "line-through text-[color:var(--color-text-subtle)]" : ""}`}>
                                  {sub.label}
                                </span>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                      <div className="mt-3 flex min-w-0 items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2 overflow-hidden">
                          <span
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-muted-bg)] text-[10px] font-semibold text-[color:var(--color-text)]"
                            title={task.owner?.name ?? "Unassigned"}
                          >
                            {(task.owner?.name ?? "U").charAt(0).toUpperCase()}
                          </span>
                          <div className="flex flex-col min-w-0">
                            <span className="truncate text-[11px] font-medium text-[color:var(--color-text-subtle)] leading-tight">
                              {task.owner?.name ?? "Unassigned"}
                            </span>
                            <div className="flex min-w-0 items-center gap-0.5 text-[10px] text-[color:var(--color-text-subtle)]">
                              <svg
                                viewBox="0 0 24 24"
                                className="h-3 w-3 shrink-0"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                              >
                                <path
                                  d="M9 12h8M9 7h8M5 7h.01M5 12h.01M5 17h.01M9 17h8"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                              <span>
                                {completedChecklistCount}/{checklistTotal}
                              </span>
                              {task.personalTodos && task.personalTodos.length > 0 && (
                                <span
                                  className="ml-1.5 inline-flex items-center gap-0.5 text-[9.5px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-md"
                                  title="Your Personal To-Dos linked to this task"
                                >
                                  ☑ {task.personalTodos.filter((t) => t.isCompleted).length}/{task.personalTodos.length}
                                </span>
                              )}
                              {task.personalNotes && task.personalNotes.length > 0 && (
                                <span
                                  className="ml-1 inline-flex items-center gap-0.5 text-[9.5px] font-semibold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-1.5 py-0.5 rounded-md"
                                  title="Your Personal Notes linked to this task"
                                >
                                  📝 {task.personalNotes.length}
                                </span>
                              )}
                              {task.attachmentCount > 0 && (
                                <span
                                  className="ml-1.5 inline-flex items-center gap-0.5 text-[9.5px] font-semibold text-violet-400 bg-violet-500/10 border border-violet-500/20 px-1.5 py-0.5 rounded-md"
                                  title="Attachments linked to this task"
                                >
                                  📎 {task.attachmentCount}
                                </span>
                              )}
                              {(() => {
                                const items = (task.checklistItems ?? []).filter((item) => item.isCustom);
                                if (items.length === 0) return null;
                                return (
                                  <span
                                    className="ml-1.5 inline-flex items-center gap-0.5 text-[9.5px] font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded-md"
                                    title="Custom Subtasks progress"
                                  >
                                    ⎇ {items.filter((s) => s.isCompleted).length}/{items.length}
                                  </span>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-center text-[10px] text-[color:var(--color-text-subtle)]">
                          <ProgressRing
                            progress={progress}
                            state={progressState}
                          />
                          <span>{estimatedLabel}</span>
                          <span>{formatDurationShort(effectiveSpentSeconds)}</span>
                          <span>{getPresenceLabel(task)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {taskCount === 0 && (
                  <p className="text-xs text-[color:var(--color-text-subtle)]">
                    No tasks here.
                  </p>
                )}
              </div>}
              {!isCollapsed && (
                <div
                  role="separator"
                  aria-label={`Resize ${status.label} column`}
                  className={`group absolute right-0 top-0 h-full w-2 cursor-col-resize rounded-r-2xl transition ${isResizing
                    ? "bg-[color:var(--color-accent-muted)]"
                    : "hover:bg-[color:var(--color-accent-muted)]"
                    }`}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    setResizeState({
                      statusId: status.id,
                      startX: event.clientX,
                      startWidth: expandedWidth,
                    });
                  }}
                >
                  <div className="pointer-events-none absolute inset-y-0 left-0 w-px bg-[color:var(--color-border)] transition group-hover:bg-[color:var(--color-accent)]" />
                  <div className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col gap-1 opacity-0 transition group-hover:opacity-80">
                    <span className="h-1 w-1 rounded-full bg-[color:var(--color-text-subtle)]" />
                    <span className="h-1 w-1 rounded-full bg-[color:var(--color-text-subtle)]" />
                    <span className="h-1 w-1 rounded-full bg-[color:var(--color-text-subtle)]" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>


      {mounted && selectedTask ? createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 md:p-8">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedTaskId(null)}
          />

          {/* Modal Container */}
          <div className="relative z-10 flex h-[90vh] max-h-[850px] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] shadow-2xl transition-all">

            {/* Cover Banner Section */}
            {selectedTask.coverImage ? (
              <div className="relative h-48 w-full bg-[color:var(--color-muted-bg)] overflow-hidden shrink-0 group">
                <img
                  src={selectedTask.coverImage}
                  alt="Task Cover Banner"
                  className="h-full w-full object-cover cursor-zoom-in transition-transform duration-300 hover:scale-[1.01]"
                  onClick={() => setLightboxImage(selectedTask.coverImage)}
                />
                <button
                  onClick={() => handleRemoveCover(selectedTask.id)}
                  disabled={isRemovingCover}
                  className="absolute right-4 top-4 rounded-lg bg-black/60 px-3 py-1.5 text-xs font-semibold text-white/90 hover:bg-black/80 hover:text-white transition-colors disabled:opacity-50"
                >
                  {isRemovingCover ? "Removing..." : "Remove Cover"}
                </button>
              </div>
            ) : null}

            {/* Pending Cover Preview Section */}
            {!selectedTask.coverImage && pendingCoverPreview ? (
              <div className="relative h-48 w-full bg-[color:var(--color-muted-bg)] overflow-hidden shrink-0">
                <img
                  src={pendingCoverPreview}
                  alt="Pending Cover Preview"
                  className="h-full w-full object-cover opacity-95 blur-[0.5px]"
                />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-4">
                  <button
                    onClick={() => handleSavePendingCover(selectedTask.id)}
                    disabled={isUploadingCover}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition-colors shadow-lg disabled:opacity-50"
                  >
                    {isUploadingCover ? `Saving (${uploadCoverProgress}%)` : "✅ Save Cover"}
                  </button>
                  <button
                    onClick={handleCancelPendingCover}
                    disabled={isUploadingCover}
                    className="rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur px-4 py-2 text-xs font-bold text-white transition-colors shadow-lg disabled:opacity-50"
                  >
                    ❌ Cancel
                  </button>
                </div>
              </div>
            ) : null}

            {/* Modal Header Controls */}
            <div className="flex items-center justify-between border-b border-[color:var(--color-border)] p-4 shrink-0 bg-[color:var(--color-surface)]">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 text-xs font-bold text-indigo-400">
                  🗂
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-[color:var(--color-text-subtle)]">
                  Task details
                </span>
              </div>
              <button
                onClick={() => setSelectedTaskId(null)}
                className="rounded-lg p-1.5 text-[color:var(--color-text-subtle)] hover:bg-[color:var(--color-muted-bg)] hover:text-white transition-colors"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Main Columns Split Layout */}
            <div className="flex flex-1 flex-col md:flex-row overflow-hidden bg-[color:var(--color-card)]">

              {/* Left Column (Scrollable details / subtasks / attachments) */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">

                {/* Title and Type badge */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <h2 className="text-xl font-bold text-[color:var(--color-text)]">
                      {selectedTask.title}
                    </h2>
                    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] ${getTypeBadge(selectedTask.type)}`}>
                      {selectedTask.type}
                    </span>
                  </div>
                  <p className="text-sm text-[color:var(--color-text-muted)] whitespace-pre-wrap leading-relaxed">
                    {selectedTask.description || "No description provided."}
                  </p>
                </div>

                {/* Metadata details block */}
                <div className="grid gap-4 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)]/20 p-4 sm:grid-cols-2 md:grid-cols-4">
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--color-text-subtle)]">
                      Assignee
                    </span>
                    <p className="mt-1 text-sm font-medium text-[color:var(--color-text)] truncate">
                      👤 {selectedTask.owner?.name ?? "Unassigned"}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--color-text-subtle)]">
                      Status
                    </span>
                    <p className="mt-1 text-sm font-medium text-[color:var(--color-text)]">
                      ⚡ {getStatusLabel(selectedTask.status)}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--color-text-subtle)]">
                      Estimate
                    </span>
                    <p className="mt-1 text-sm font-medium text-[color:var(--color-text)]">
                      ⏱ {formatEstimatedTime(selectedTask.estimatedHours)}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--color-text-subtle)]">
                      Time Spent
                    </span>
                    <p className="mt-1 text-sm font-medium text-[color:var(--color-text)]">
                      ⏳ {formatDurationShort(selectedSpentSeconds)}
                    </p>
                  </div>
                </div>

                {/* Cover Photo Option (if not uploaded and no pending preview) */}
                {!selectedTask.coverImage && !pendingCoverPreview && (
                  <div className="flex gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[color:var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--color-text-subtle)] hover:border-indigo-400 hover:text-white transition-all bg-[color:var(--color-muted-bg)]/40">
                      🖼 Add Cover Banner
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleCoverUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}

                {/* Predefined Dev Test Checklist */}
                <div className="space-y-3">
                  {(() => {
                    const items = (selectedTask.checklistItems ?? []).filter((item) => !item.isCustom);
                    const doneCount = items.filter((item) => item.isCompleted).length;
                    return (
                      <>
                        <div className="flex items-center justify-between border-b border-[color:var(--color-border)] pb-2">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-[color:var(--color-text-subtle)] flex items-center gap-2">
                            ⚠️ Predefined Dev Test Checklist
                          </h3>
                          <span className="text-xs text-[color:var(--color-text-muted)] font-medium">
                            {doneCount}/{items.length} Done
                          </span>
                        </div>
                        {items.length ? (
                          <ul className="space-y-2">
                            {items.map((item) => {
                              const isUpdating = pendingChecklistId === item.id;
                              const isEditable = canToggleChecklist(selectedTask);
                              return (
                                <li
                                  key={item.id}
                                  className={`flex items-start gap-2 text-xs text-[color:var(--color-text-muted)] ${isUpdating ? "opacity-60" : ""
                                    }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={item.isCompleted}
                                    disabled={!isEditable || isUpdating}
                                    onChange={(event) =>
                                      handleChecklistToggle(
                                        selectedTask.id,
                                        item,
                                        event.target.checked
                                      )
                                    }
                                    className="mt-0.5 h-4 w-4 rounded border-[color:var(--color-border)] bg-transparent text-emerald-500"
                                  />
                                  <span className={item.isCompleted ? "line-through text-[color:var(--color-text-subtle)]" : ""}>
                                    {item.label}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <p className="text-xs text-[color:var(--color-text-subtle)]">
                            No predefined test checklists for this task type.
                          </p>
                        )}
                      </>
                    );
                  })()}
                </div>

                {/* Custom Subtasks Section */}
                <div className="space-y-3">
                  {(() => {
                    const items = (selectedTask.checklistItems ?? []).filter((item) => item.isCustom);
                    const doneCount = items.filter((item) => item.isCompleted).length;
                    return (
                      <>
                        <div className="flex items-center justify-between border-b border-[color:var(--color-border)] pb-2">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-[color:var(--color-text-subtle)] flex items-center gap-2">
                            ☑ Custom Subtasks
                          </h3>
                          <span className="text-xs text-[color:var(--color-text-muted)] font-medium">
                            {doneCount}/{items.length} Done
                          </span>
                        </div>
                        {items.length ? (
                          <ul className="space-y-2">
                            {items.map((sub) => {
                              const isUpdating = pendingChecklistId === sub.id;
                              const isEditable = canToggleChecklist(selectedTask);
                              return (
                                <li key={sub.id} className={`flex items-center justify-between gap-3 text-xs text-[color:var(--color-text-muted)] ${isUpdating ? "opacity-60" : ""}`}>
                                  <label className="flex items-start gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={sub.isCompleted}
                                      disabled={!isEditable || isUpdating}
                                      onChange={(e) => handleChecklistToggle(selectedTask.id, sub, e.target.checked)}
                                      className="mt-0.5 h-4 w-4 rounded border-[color:var(--color-border)] bg-transparent text-indigo-500"
                                    />
                                    <span className={sub.isCompleted ? "line-through text-[color:var(--color-text-subtle)]" : ""}>
                                      {sub.label}
                                    </span>
                                  </label>
                                  <button
                                    onClick={() => handleDeleteSubtask(selectedTask.id, sub.id)}
                                    className="text-[10px] text-rose-400 hover:text-rose-300 transition-colors"
                                  >
                                    Remove
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <p className="text-xs text-[color:var(--color-text-subtle)]">
                            No subtasks added yet.
                          </p>
                        )}
                      </>
                    );
                  })()}

                  {/* Add Subtask Form */}
                  <form onSubmit={(e) => handleAddSubtask(e, selectedTask.id)} className="flex gap-2">
                    <input
                      type="text"
                      value={newSubtaskText}
                      onChange={(e) => setNewSubtaskText(e.target.value)}
                      placeholder="Add a subtask..."
                      className="flex-1 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-1.5 text-xs text-[color:var(--color-text)] placeholder-[color:var(--color-text-subtle)] focus:outline-none focus:border-[color:var(--color-accent)]"
                    />
                    <ActionButton label="Add" size="sm" type="submit" variant="secondary" />
                  </form>
                </div>

                {/* Attachments Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-[color:var(--color-border)] pb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[color:var(--color-text-subtle)]">
                      📎 Attachments
                    </h3>
                    {!isUploadingAttachment && (
                      <label className="cursor-pointer text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors">
                        + Add Files
                        <input
                          type="file"
                          accept="image/*,video/*,application/pdf,text/plain"
                          multiple
                          onChange={handleAddAttachment}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>

                  {/* Pending Attachments Queue */}
                  {pendingAttachments.length > 0 && (
                    <div className="rounded-xl border border-dashed border-indigo-500/50 bg-indigo-500/5 p-4 space-y-4 shadow-inner">
                      <div className="flex justify-between items-center gap-2">
                        <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                          ✨ Pending Upload Queue ({pendingAttachments.length})
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSavePendingAttachments(selectedTask.id)}
                            disabled={isUploadingAttachment}
                            className="rounded-lg bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 text-[10px] font-bold text-white transition-all shadow disabled:opacity-50 shrink-0"
                          >
                            {isUploadingAttachment ? "Uploading..." : "✅ Upload All"}
                          </button>
                          <button
                            onClick={handleCancelPendingAttachment}
                            disabled={isUploadingAttachment}
                            className="rounded-lg bg-[color:var(--color-muted-bg)] border border-[color:var(--color-border)] hover:bg-[color:var(--color-muted-bg)]/85 px-2.5 py-1.5 text-[10px] font-bold text-[color:var(--color-text-subtle)] hover:text-white transition-all disabled:opacity-50 shrink-0"
                          >
                            ❌ Clear Queue
                          </button>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2 max-h-60 overflow-y-auto pr-1">
                        {pendingAttachments.map((item) => {
                          const file = item.file;
                          const isImage = file.type.startsWith("image/");
                          const isVideo = file.type.startsWith("video/");
                          const isPdf = file.type === "application/pdf";
                          const isText = file.type === "text/plain";
                          
                          return (
                            <div 
                              key={item.id} 
                              onClick={() => setLightboxAttachment({
                                name: file.name,
                                size: (file.size / 1024).toFixed(1) + " KB",
                                type: file.type,
                                url: item.preview
                              })}
                              className="flex items-center gap-3 cursor-pointer rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-muted-bg)]/45 p-2 relative group min-w-0 hover:border-[color:var(--color-accent)]/40 hover:bg-[color:var(--color-muted-bg)]/60 transition-all"
                            >
                              {/* Lightweight Preview Box */}
                              <div className="h-12 w-12 shrink-0 rounded bg-black/30 border border-[color:var(--color-border)] overflow-hidden flex items-center justify-center relative">
                                {isImage ? (
                                  <img
                                    src={item.preview}
                                    alt="Preview"
                                    className="h-full w-full object-cover"
                                  />
                                ) : isVideo ? (
                                  <video
                                    src={item.preview}
                                    className="h-full w-full object-cover animate-pulse"
                                    muted
                                    loop
                                    playsInline
                                    preload="metadata"
                                  />
                                ) : isText ? (
                                  <div className="text-[7px] text-[color:var(--color-text-muted)] p-1 overflow-hidden select-none break-all font-mono leading-tight">
                                    {item.textSnippet || "TXT"}
                                  </div>
                                ) : (
                                  <span className="text-xl">📕</span>
                                )}
                                
                                {item.isUploading && (
                                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                    <span className="text-[9px] font-bold text-white">{item.progress}%</span>
                                  </div>
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[11px] font-semibold text-[color:var(--color-text)]">
                                  {file.name}
                                </p>
                                <p className="mt-0.5 text-[9px] text-[color:var(--color-text-subtle)] font-mono">
                                  {(file.size / 1024).toFixed(1)} KB · {file.type.split('/')[1] || file.type}
                                </p>
                              </div>

                              {!item.isUploading && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemovePendingItem(item.id);
                                  }}
                                  className="text-[10px] text-rose-400 hover:text-rose-300 transition-colors p-1 shrink-0"
                                  title="Remove from queue"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {isLoadingAttachments ? (
                    <div className="py-6 text-center text-xs text-[color:var(--color-text-subtle)]">
                      Loading attachments...
                    </div>
                  ) : attachments.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {attachments.map((att) => {
                        const isImage = att.type.startsWith("image/");
                        const isVideo = att.type.startsWith("video/");
                        const isPdf = att.type === "application/pdf";
                        return (
                          <div
                            key={att.id}
                            onClick={() => setLightboxAttachment(att)}
                            className="flex items-center gap-3 cursor-pointer rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-muted-bg)]/30 p-2.5 hover:border-[color:var(--color-accent)]/40 hover:bg-[color:var(--color-muted-bg)]/50 transition-all group"
                          >
                            <div className="h-10 w-10 shrink-0 rounded-lg overflow-hidden bg-black/40 flex items-center justify-center relative">
                              {isImage ? (
                                <img
                                  src={att.url}
                                  alt={att.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : isVideo ? (
                                <span className="text-lg">🎥</span>
                              ) : isPdf ? (
                                <span className="text-lg">📕</span>
                              ) : (
                                <span className="text-lg">📄</span>
                              )}
                              <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] text-white font-bold transition-opacity">
                                👁️
                              </div>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-semibold text-[color:var(--color-text)]">
                                {att.name}
                              </p>
                              <p className="mt-0.5 text-[9px] text-[color:var(--color-text-subtle)] font-mono">
                                {att.size} · {new Date(att.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </p>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteAttachment(selectedTask.id, att.id);
                              }}
                              disabled={isDeletingAttachmentId === att.id}
                              className="text-[10px] text-rose-400 hover:text-rose-300 disabled:opacity-50 transition-colors px-1 shrink-0"
                              title="Delete attachment"
                            >
                              {isDeletingAttachmentId === att.id ? "..." : "✕"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-[color:var(--color-text-subtle)]">
                      No files attached yet.
                    </p>
                  )}
                </div>

                {/* Personal To-Dos & Notes */}
                <div className="space-y-4 border-t border-[color:var(--color-border)]/50 pt-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[color:var(--color-text-subtle)] flex items-center gap-1.5">
                    <span className="text-emerald-400">☑</span> Personal Tasks & Notes
                  </h3>

                  {/* Personal To-Dos list */}
                  <div className="space-y-2">
                    {selectedTask.personalTodos && selectedTask.personalTodos.length > 0 ? (
                      <ul className="space-y-2">
                        {selectedTask.personalTodos.map((todo) => (
                          <li key={todo.id} className="flex items-start gap-2 text-xs text-[color:var(--color-text-muted)]">
                            <input
                              type="checkbox"
                              checked={todo.isCompleted}
                              onChange={() =>
                                handlePersonalTodoToggle(
                                  todo,
                                  !todo.isCompleted
                                )
                              }
                              className="mt-0.5 h-4 w-4 rounded border-[color:var(--color-border)] bg-transparent text-emerald-500"
                            />
                            <span className={todo.isCompleted ? "line-through text-[color:var(--color-text-subtle)]" : ""}>
                              {todo.content}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-[color:var(--color-text-subtle)] italic">
                        No personal To-Dos linked to this task.
                      </p>
                    )}
                  </div>

                  {/* Personal Notes list */}
                  <div className="space-y-2 pt-1">
                    {selectedTask.personalNotes && selectedTask.personalNotes.length > 0 ? (
                      <div className="space-y-2">
                        {selectedTask.personalNotes.map((note) => (
                          <div key={note.id} className="rounded-xl bg-[color:var(--color-muted-bg)]/20 border border-[color:var(--color-border)]/50 p-3">
                            <p className="font-semibold text-xs text-[color:var(--color-text)]">
                              {note.title}
                            </p>
                            <p className="mt-1 text-[11px] text-[color:var(--color-text-muted)] leading-relaxed whitespace-pre-wrap">
                              {note.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-[color:var(--color-text-subtle)] italic">
                        No personal notes linked.
                      </p>
                    )}
                  </div>
                </div>

                {/* Definition of Done (DoD) */}
                <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-muted-bg)]/20 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">📋</span>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
                      Definition of Done
                    </p>
                  </div>
                  <p className="text-xs text-[color:var(--color-text-muted)]">
                    Does this task touch new third-party APIs or core architecture?
                  </p>
                  <div className="space-y-2">
                    <label className="flex flex-col gap-1 text-[11px] text-[color:var(--color-text-muted)]">
                      Add 1-minute video/note link for future devs:
                      <input
                        type="url"
                        value={dodLink}
                        onChange={(e) => setDodLink(e.target.value)}
                        placeholder="e.g. Loom video or Google Drive link"
                        className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-xs text-[color:var(--color-text)] placeholder-[color:var(--color-text-subtle)] focus:outline-none focus:border-[color:var(--color-accent)]"
                      />
                    </label>
                    {dodLink.trim() && (
                      <label className="flex items-center gap-2 text-xs text-[color:var(--color-text-muted)] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={pushToProjectDocs}
                          onChange={(e) => setPushToProjectDocs(e.target.checked)}
                          className="rounded border-[color:var(--color-border)] bg-[color:var(--color-input)] focus:ring-0"
                        />
                        <span>Also publish to Project Video Directory</span>
                      </label>
                    )}
                    <div className="flex justify-end pt-1">
                      <ActionButton
                        label={savingDod ? "Saving..." : "Save DoD Link"}
                        size="sm"
                        variant="primary"
                        onClick={handleSaveDodLink}
                        disabled={savingDod}
                        className={savingDod ? "pointer-events-none opacity-60" : ""}
                      />
                    </div>
                  </div>
                </div>

                {/* Actions section */}
                <div className="flex items-center gap-2 flex-wrap border-t border-[color:var(--color-border)]/50 pt-4">
                  {canRequestMoreTime(selectedTask) ? (
                    <ActionButton
                      label="Request more time"
                      size="sm"
                      variant="secondary"
                      onClick={() => setTimeRequestOpen((prev) => !prev)}
                    />
                  ) : null}
                  {canEditTask(selectedTask) && onEditTask ? (
                    <ActionButton
                      label="Edit task"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setSelectedTaskId(null);
                        onEditTask(selectedTask);
                      }}
                    />
                  ) : null}
                  {(() => {
                    const isAllowedStatus = ["IN_PROGRESS"].includes(selectedTask.status);
                    const canControl = canControlBreaks(selectedTask);
                    const isDisabled = !(isAllowedStatus && canControl);
                    const tooltip = !canControl
                      ? "Only the assigned developer can pause or resume time."
                      : !isAllowedStatus
                        ? "Breaks are only available when a task is in progress."
                        : undefined;
                    return (
                      <ActionButton
                        label={selectedTask.activeBreak ? "Resume" : "Pause"}
                        size="sm"
                        variant={selectedTask.activeBreak ? "success" : "warning"}
                        onClick={() =>
                          selectedTask.activeBreak
                            ? handleResume(selectedTask)
                            : setBreakPanelOpen((prev) => !prev)
                        }
                        disabled={isDisabled || breakSubmitting}
                        title={tooltip}
                        className={breakSubmitting ? "pointer-events-none opacity-60" : ""}
                      />
                    );
                  })()}

                  {/* Status Actions (e.g., Approve / Reject testing sign-off) */}
                  <div className="ml-auto">
                    {renderActions(selectedTask)}
                  </div>
                </div>

              </div>

              {/* Right Column (Comments / Chat Column - Always visible) */}
              <div className="w-full md:w-[350px] border-t md:border-t-0 md:border-l border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)]/15 flex flex-col h-full overflow-hidden shrink-0 p-4">
                <CommentThread
                  entityType="TASK"
                  entityId={selectedTask.id}
                  currentUser={{ id: currentUserId }}
                  users={mentionUsers}
                  activities={selectedTask.activityLogs || []}
                />
              </div>

            </div>

          </div>
        </div>,
        document.body
      ) : null}

      {mounted && lightboxImage ? createPortal(
        <div 
          className="fixed inset-0 z-[10005] flex items-center justify-center bg-black/90 p-4 transition-all"
          onClick={() => setLightboxImage(null)}
        >
          <button 
            className="absolute right-6 top-6 rounded-full bg-white/10 p-2 text-white/80 hover:bg-white/20 hover:text-white transition-colors"
            onClick={() => setLightboxImage(null)}
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img 
            src={lightboxImage} 
            alt="Fullscreen preview" 
            className="max-h-[90vh] max-w-full rounded-lg object-contain shadow-2xl"
          />
        </div>,
        document.body
      ) : null}

      {mounted && lightboxAttachment ? createPortal(
        <div 
          className="fixed inset-0 z-[10006] flex flex-col items-center justify-center bg-black/95 p-4 transition-all"
          onClick={() => setLightboxAttachment(null)}
        >
          {/* Header Panel */}
          <div className="absolute top-0 inset-x-0 h-16 bg-black/40 flex items-center justify-between px-6 z-10">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                {lightboxAttachment.name}
              </p>
              <p className="mt-0.5 text-[10.5px] text-white/60 font-mono">
                {lightboxAttachment.size} · {lightboxAttachment.type}
              </p>
            </div>
            <button 
              className="rounded-full bg-white/10 p-2 text-white/80 hover:bg-white/20 hover:text-white transition-colors"
              onClick={() => setLightboxAttachment(null)}
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Interactive Player / Viewer */}
          <div 
            className="w-full max-w-5xl max-h-[80vh] flex items-center justify-center mt-16 overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {lightboxAttachment.type.startsWith("image/") ? (
              <img 
                src={lightboxAttachment.url} 
                alt={lightboxAttachment.name} 
                className="max-h-[80vh] max-w-full rounded-lg object-contain shadow-2xl"
              />
            ) : lightboxAttachment.type.startsWith("video/") ? (
              <video 
                src={lightboxAttachment.url} 
                controls 
                autoPlay 
                className="max-h-[80vh] w-full rounded-lg shadow-2xl bg-black"
              />
            ) : lightboxAttachment.type === "application/pdf" ? (
              <iframe 
                src={lightboxAttachment.url} 
                className="w-full h-[75vh] rounded-lg shadow-2xl bg-white border-0"
              />
            ) : lightboxAttachment.type === "text/plain" ? (
              <TextFileViewer url={lightboxAttachment.url} />
            ) : (
              <div className="text-center p-8 bg-[color:var(--color-card)] border border-[color:var(--color-border)] rounded-2xl max-w-md shadow-2xl">
                <span className="text-5xl block mb-3">📁</span>
                <p className="text-sm font-semibold text-[color:var(--color-text)] mb-4">
                  Preview is not supported for this file type.
                </p>
                <a 
                  href={lightboxAttachment.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-block rounded-lg bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-xs font-bold text-white transition-colors shadow"
                >
                  Download File
                </a>
              </div>
            )}
          </div>
        </div>,
        document.body
      ) : null}
    </div>
  );
}

const TextFileViewer = ({ url }) => {
  const [content, setContent] = useState("Loading file contents...");

  useEffect(() => {
    fetch(url)
      .then((res) => res.text())
      .then((text) => setContent(text))
      .catch((err) => setContent("Error loading file contents: " + err.message));
  }, [url]);

  return (
    <pre className="w-full max-h-[70vh] rounded-lg shadow-2xl bg-zinc-950/90 text-zinc-200 border border-zinc-800 p-6 overflow-auto text-left font-mono text-xs whitespace-pre-wrap leading-relaxed">
      {content}
    </pre>
  );
}
