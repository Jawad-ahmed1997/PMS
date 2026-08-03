"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";

import {
  Dialog,
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/ToastProvider";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import MilestoneCard from "@/components/milestones/MilestoneCard";
import PageHeader from "@/components/layout/PageHeader";
import TaskBoard from "@/components/tasks/TaskBoard";
import ProjectKTHub from "@/components/projects/ProjectKTHub";
import { TASK_STATUSES } from "@/lib/kanban";
import { TASK_TYPE_CHECKLISTS } from "@/lib/taskChecklists";
import { canCreateTasks, normalizeRoleId, roles } from "@/lib/roles";
import { getTodayInPSTDateString } from "@/lib/pstDate";
import ActionButton from "../ui/ActionButton";
import { Button } from "@/components/ui/button";
import RefreshButton from "@/components/ui/RefreshButton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import Avatar from "@/components/ui/Avatar";
import ScrollArea from "@/components/ui/ScrollArea";

const formatDateInput = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
};

const buildErrorMessage = (data) =>
  data?.error ?? data?.message ?? "Unable to load data.";

export default function ProjectDetailView({
  projectId,
  canManageMilestones,
  role,
  currentUserId,
}) {
  const router = useRouter();
  const { addToast } = useToast();
  const [project, setProject] = useState(null);
  const [milestones, setMilestones] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [activeTab, setActiveTab] = useState("board");

  // Loading statuses
  const [status, setStatus] = useState({ loading: true, error: null });
  const [tasksLoading, setTasksLoading] = useState(false);
  const [savingMilestone, setSavingMilestone] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const refreshIntervalRef = useRef(null);
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  // Modals state
  const [modalOpen, setModalOpen] = useState(false); // Milestone modal
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false); // Task modal
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [selectedAddUserId, setSelectedAddUserId] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [systemUsers, setSystemUsers] = useState([]);

  // Milestone Form
  const [milestoneForm, setMilestoneForm] = useState({
    title: "",
    startDate: "",
    endDate: "",
  });

  // Task Form
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    status: TASK_STATUSES[0]?.id ?? "BACKLOG",
    type: Object.keys(TASK_TYPE_CHECKLISTS)[0] ?? "UI",
    estimatedTime: "",
    ownerId: "",
    milestoneId: "",
    checklistItems: [],
  });

  const taskTypes = useMemo(() => Object.keys(TASK_TYPE_CHECKLISTS), []);
  const normalizedRole = useMemo(() => normalizeRoleId(role), [role]);
  const canCreateTask = useMemo(() => canCreateTasks(normalizedRole), [normalizedRole]);
  const canManageAssignments = useMemo(
    () =>
      [roles.CEO, roles.PM, roles.CTO, roles.SENIOR_DEV].includes(normalizedRole),
    [normalizedRole]
  );

  // Load project details & milestones
  const loadProject = useCallback(async () => {
    setStatus({ loading: true, error: null });
    try {
      const [projectResponse, milestoneResponse] = await Promise.all([
        fetch(`/api/projects/${projectId}`),
        fetch(`/api/milestones?projectId=${projectId}`),
      ]);
      const projectData = await projectResponse.json();
      const milestoneData = await milestoneResponse.json();

      if (!projectResponse.ok) {
        throw new Error(buildErrorMessage(projectData));
      }
      if (!milestoneResponse.ok) {
        throw new Error(buildErrorMessage(milestoneData));
      }

      setProject(projectData.project);

      const loadedMilestones = (milestoneData?.milestones ?? []).map((m) => ({
        id: m.id,
        title: m.title,
        startDate: formatDateInput(m.startDate),
        endDate: formatDateInput(m.endDate),
      }));

      setMilestones(loadedMilestones);

      // Default new task milestoneId to first milestone
      if (loadedMilestones.length > 0) {
        setTaskForm((prev) => ({
          ...prev,
          milestoneId: prev.milestoneId || loadedMilestones[0].id,
        }));
      }

      setStatus({ loading: false, error: null });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load project data.";
      setStatus({ loading: false, error: message });
      addToast({
        title: "Project unavailable",
        message,
        variant: "error",
      });
    }
  }, [addToast, projectId]);

  // Load project tasks with sessionStorage cache (stale-while-revalidate)
  const loadTasks = useCallback(async (silent = false) => {
    const cacheKey = `pms-tasks-${projectId}`;

    // On non-silent load, try to serve from cache immediately for instant render
    if (!silent && typeof window !== "undefined") {
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_TTL && Array.isArray(data) && data.length > 0) {
            setTasks(data);
            setLastUpdatedAt(new Date(timestamp));
            // Continue to fetch fresh data in the background (don't show spinner)
          }
        }
      } catch { /* ignore parse errors */ }
    }

    if (!silent) setTasksLoading(true);
    try {
      const response = await fetch(`/api/tasks?projectId=${projectId}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message ?? "Failed to load tasks");
      }
      const freshTasks = data?.tasks ?? [];
      setTasks(freshTasks);
      const now = Date.now();
      setLastUpdatedAt(new Date(now));
      // Save to cache
      if (typeof window !== "undefined") {
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify({ data: freshTasks, timestamp: now }));
        } catch { /* quota errors */ }
      }
    } catch (error) {
      if (!silent) {
        addToast({
          title: "Tasks unavailable",
          message: error instanceof Error ? error.message : "Failed to load tasks.",
          variant: "error",
        });
      }
    } finally {
      if (!silent) setTasksLoading(false);
    }
  }, [addToast, projectId, CACHE_TTL]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  useEffect(() => {
    if (activeTab === "board" && !status.loading && !status.error) {
      loadTasks();
    }
  }, [activeTab, loadTasks, status.loading, status.error]);

  // 5-minute background auto-refresh when the board tab is active
  useEffect(() => {
    if (activeTab !== "board") {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
      return;
    }
    refreshIntervalRef.current = setInterval(() => {
      loadTasks(true); // silent refresh
    }, CACHE_TTL);
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [activeTab, loadTasks, CACHE_TTL]);

  // Load project members for task assignee dropdown
  useEffect(() => {
    if (!canManageAssignments || !projectId) {
      return;
    }

    const loadUsers = async () => {
      try {
        const response = await fetch(
          `/api/users?isActive=true&projectId=${projectId}`
        );
        const data = await response.json();
        if (response.ok) {
          setUsers(data?.users ?? []);
        }
      } catch (error) {
        setUsers([]);
      }
    };

    loadUsers();
  }, [canManageAssignments, projectId]);

  const loadSystemUsers = useCallback(async () => {
    try {
      const response = await fetch("/api/users?isActive=true");
      const data = await response.json();
      if (response.ok) {
        setSystemUsers(data?.users ?? []);
      }
    } catch (error) {
      console.error("Failed to load system users", error);
    }
  }, []);

  useEffect(() => {
    if (isAddMemberModalOpen) {
      loadSystemUsers();
    }
  }, [isAddMemberModalOpen, loadSystemUsers]);

  const nonMemberUsers = useMemo(() => {
    const memberIds = new Set((project?.members ?? []).map((m) => m.id));
    return systemUsers.filter((u) => !memberIds.has(u.id));
  }, [systemUsers, project?.members]);

  const handleAddMember = async (event) => {
    event.preventDefault();
    if (!selectedAddUserId || !project) return;

    setAddingMember(true);
    try {
      const currentMemberIds = (project.members ?? []).map((m) => m.id);
      const newMemberIds = [...currentMemberIds, selectedAddUserId];

      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberIds: newMemberIds }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message ?? "Failed to add member.");
      }

      addToast({
        title: "Member added",
        message: "Successfully added the member to the project.",
        variant: "success",
      });

      setSelectedAddUserId("");
      setIsAddMemberModalOpen(false);

      await loadProject();
      if (canManageAssignments) {
        const usersResponse = await fetch(
          `/api/users?isActive=true&projectId=${projectId}`
        );
        const usersData = await usersResponse.json();
        if (usersResponse.ok) {
          setUsers(usersData?.users ?? []);
        }
      }
    } catch (error) {
      addToast({
        title: "Action failed",
        message: error instanceof Error ? error.message : "Failed to add member.",
        variant: "error",
      });
    } finally {
      setAddingMember(false);
    }
  };

  // Milestone Form Management
  const resetMilestoneForm = () => {
    const today = getTodayInPSTDateString();
    setMilestoneForm({ title: "", startDate: today, endDate: today });
  };

  const handleMilestoneSubmit = async (event) => {
    event.preventDefault();
    if (!canManageMilestones) {
      addToast({
        title: "Not allowed",
        message: "Not allowed",
        variant: "error",
      });
      return;
    }

    if (!milestoneForm.title.trim()) {
      addToast({
        title: "Milestone title needed",
        message: "Name the milestone to continue.",
        variant: "warning",
      });
      return;
    }

    setSavingMilestone(true);
    try {
      const response = await fetch("/api/milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: milestoneForm.title,
          startDate: milestoneForm.startDate,
          endDate: milestoneForm.endDate,
          projectId,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(buildErrorMessage(data));
      }

      addToast({
        title: "Milestone created",
        message: "Timeline checkpoint added.",
        variant: "success",
      });
      resetMilestoneForm();
      setModalOpen(false);
      loadProject();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save milestone.";
      addToast({
        title: "Milestone update failed",
        message,
        variant: "error",
      });
    } finally {
      setSavingMilestone(false);
    }
  };

  // Task Form Management
  const resetTaskForm = () => {
    setTaskForm({
      title: "",
      description: "",
      status: TASK_STATUSES[0]?.id ?? "BACKLOG",
      type: Object.keys(TASK_TYPE_CHECKLISTS)[0] ?? "UI",
      estimatedTime: "",
      ownerId: "",
      milestoneId: milestones[0]?.id ?? "",
      checklistItems: [],
    });
    setEditingTaskId(null);
  };

  const parseEstimatedTime = (value) => {
    if (!value) return 0;
    const input = value.toLowerCase().trim();
    if (!input) return 0;
    const hourMatch = input.match(/(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours)/);
    const minuteMatch = input.match(
      /(\d+(?:\.\d+)?)\s*(m|min|mins|minute|minutes)/
    );
    let hours = 0;
    let minutes = 0;
    let hasMatch = false;
    if (hourMatch) {
      hours = Number.parseFloat(hourMatch[1]);
      hasMatch = true;
    }
    if (minuteMatch) {
      minutes = Number.parseFloat(minuteMatch[1]);
      hasMatch = true;
    }
    if (!hasMatch) {
      const numeric = Number.parseFloat(input);
      if (Number.isFinite(numeric)) {
        hours = numeric;
        hasMatch = true;
      } else {
        return NaN;
      }
    }
    return Number.isFinite(hours + minutes / 60)
      ? Math.max(0, hours + minutes / 60)
      : NaN;
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
    return minutes > 0 ? `${minutes}m` : "";
  };

  const openEditTask = (task) => {
    setEditingTaskId(task.id);
    setTaskForm({
      title: task.title ?? "",
      description: task.description ?? "",
      status: task.status ?? (TASK_STATUSES[0]?.id ?? "BACKLOG"),
      type: task.type ?? (Object.keys(TASK_TYPE_CHECKLISTS)[0] ?? "UI"),
      estimatedTime: formatEstimatedTime(task.estimatedHours ?? 0),
      ownerId: task.ownerId ?? "",
      milestoneId: task.milestoneId ?? "",
      checklistItems: (task.checklistItems ?? []).map((item) => ({
        id: item.id,
        label: item.label,
        isCompleted: item.isCompleted,
      })),
    });
    setIsTaskModalOpen(true);
  };

  const handleTaskSubmit = async (event) => {
    event.preventDefault();

    if (!editingTaskId && !canCreateTask) {
      addToast({
        title: "Not allowed",
        message: "Not allowed",
        variant: "error",
      });
      return;
    }

    if (!taskForm.title.trim() || !taskForm.description.trim()) {
      addToast({
        title: "Task details needed",
        message: "Add a title and description to continue.",
        variant: "warning",
      });
      return;
    }

    const estimatedHours = parseEstimatedTime(taskForm.estimatedTime);
    if (!Number.isFinite(estimatedHours)) {
      addToast({
        title: "Estimated time invalid",
        message: "Enter a time like 2 hours 30 minutes or 20 minutes.",
        variant: "warning",
      });
      return;
    }

    setSavingTask(true);
    try {
      const payload = {
        title: taskForm.title,
        description: taskForm.description,
        type: taskForm.type,
        estimatedHours,
        ownerId: taskForm.ownerId || undefined,
      };

      const response = await fetch(
        editingTaskId ? `/api/tasks/${editingTaskId}` : "/api/tasks",
        {
          method: editingTaskId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            editingTaskId
              ? {
                ...payload,
                checklistItems: taskForm.checklistItems,
                milestoneId: taskForm.milestoneId || null,
              }
              : {
                ...payload,
                status: taskForm.status,
                milestoneId: taskForm.milestoneId || null,
                projectId: projectId,
              }
          ),
        }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(buildErrorMessage(data));
      }

      addToast({
        title: editingTaskId ? "Task updated" : "Task created",
        message: editingTaskId
          ? "Task changes have been saved."
          : "Task added to project execution queue.",
        variant: "success",
      });

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("pms:refresh-notifications"));
      }

      resetTaskForm();
      setIsTaskModalOpen(false);
      loadTasks();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : editingTaskId
            ? "Unable to update task."
            : "Unable to create task.";
      addToast({
        title: editingTaskId ? "Task update failed" : "Task creation failed",
        message,
        variant: "error",
      });
    } finally {
      setSavingTask(false);
    }
  };

  const handleMilestoneNavigate = (milestoneId) => {
    if (!projectId || !milestoneId) {
      addToast({
        title: "Milestone link unavailable",
        message: "This milestone is missing project details.",
        variant: "warning",
      });
      return;
    }
    router.push(`/projects/${projectId}/milestones/${milestoneId}`);
  };

  const memberOptionItems = nonMemberUsers.length ? (
    nonMemberUsers.map((user) => (
      <SelectItem
        key={user.id}
        value={user.id}
        textValue={`${user.name} ${user.email ?? ""} ${user.role ?? ""}`}
      >
        <span className="flex items-center gap-2">
          <Avatar
            src={user.image}
            name={user.name}
            alt=""
            className="h-6 w-6 text-[10px]"
            fallbackClassName="text-[10px]"
          />
          <span className="min-w-0 truncate">
            {user.name}{user.email ? ` · ${user.email}` : ""}{user.role ? ` · ${user.role}` : ""}
          </span>
        </span>
      </SelectItem>
    ))
  ) : (
    <SelectItem value="__none__" disabled>
      No active members available
    </SelectItem>
  );
  const shouldScrollMemberOptions = nonMemberUsers.length > 8;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Project workspace"
        title={project?.name ?? "Project overview"}
        subtitle={
          project?.description || "Add a short summary for this project."
        }
        backHref="/projects"
        backLabel="Back to projects"
        actions={
          <div className="flex items-center gap-2">
            <RefreshButton
              onClick={async () => {
                if (typeof window !== "undefined") {
                  sessionStorage.removeItem(`pms-tasks-${projectId}`);
                }
                await Promise.all([loadProject(), loadTasks(false)]);
              }}
              ariaLabel="Refresh project data"
            />
            {canManageMilestones && (
              activeTab === "milestones" ? (
                <ActionButton
                  label="Create milestone"
                  variant="success"
                  onClick={() => {
                    resetMilestoneForm();
                    setModalOpen(true);
                  }}
                />
              ) : (
                <Button
                  variant="primary"
                  onClick={() => {
                    resetTaskForm();
                    setIsTaskModalOpen(true);
                  }}
                >
                  Create task
                </Button>
              )
            )}
          </div>
        }
      />

      {/* Tabs Menu Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-[color:var(--color-border)] pb-0 gap-3">
        {/* Left Side: Tabs */}
        <div className="flex">
          <button
            onClick={() => setActiveTab("board")}
            className={`px-5 py-3 text-sm font-semibold border-b-2 transition duration-150 ${activeTab === "board"
              ? "border-[color:var(--color-accent)] text-[color:var(--color-accent)]"
              : "border-transparent text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]"
              }`}
          >
            Task Board
          </button>
          <button
            onClick={() => setActiveTab("milestones")}
            className={`px-5 py-3 text-sm font-semibold border-b-2 transition duration-150 ${activeTab === "milestones"
              ? "border-[color:var(--color-accent)] text-[color:var(--color-accent)]"
              : "border-transparent text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]"
              }`}
          >
            Milestones ({milestones.length})
          </button>
          <button
            onClick={() => setActiveTab("kt")}
            className={`px-5 py-3 text-sm font-semibold border-b-2 transition duration-150 ${activeTab === "kt"
              ? "border-[color:var(--color-accent)] text-[color:var(--color-accent)]"
              : "border-transparent text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]"
              }`}
          >
            KT / Dev Hub
          </button>
        </div>

        {/* Right Side: Members and Filter Button */}
        {!status.loading && !status.error && project && (
          <div className="flex items-center gap-4 px-4 pb-2 sm:pb-0">
            {/* Members Avatars */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[color:var(--color-text-subtle)]">
                Members:
              </span>
              <div className="flex items-center -space-x-1.5 overflow-hidden">
                {(project.members ?? []).map((member) => (
                  <Avatar
                    key={member.id}
                    src={member.image}
                    name={member.name}
                    alt={`${member.name} avatar`}
                    className="h-7 w-7 border-2 border-card text-[10px]"
                    fallbackClassName="text-[10px]"
                    title={`${member.name} (${member.role})`}
                  />
                ))}
                {/* Add Member Button */}
                {canManageAssignments && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setIsAddMemberModalOpen(true)}
                    className="ml-2 h-7 w-7 rounded-full border-dashed text-muted-foreground hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
                    title="Add Member to Project"
                  ><UserPlus className="h-3.5 w-3.5" /></Button>
                )}
              </div>
            </div>

            {/* Filter Toggle Button Portal Target */}
            {activeTab === "board" && (
              <div id="project-board-filter-button-portal" className="shrink-0" />
            )}
          </div>
        )}
      </div>

      {status.loading && (
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-6 text-sm text-[color:var(--color-text-muted)]">
          Loading project...
        </div>
      )}

      {!status.loading && status.error && (
        <div className="space-y-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-200">
          <p>{status.error}</p>
          <Button label="Retry" variant="secondary" onClick={loadProject} />
        </div>
      )}

      {!status.loading && !status.error && project && (
        <>
          {activeTab === "milestones" && (
            <div className="space-y-4">
              {milestones.length ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  {milestones.map((milestone) => (
                    <MilestoneCard
                      key={milestone.id}
                      milestone={milestone}
                      href={
                        projectId && milestone.id
                          ? `/projects/${projectId}/milestones/${milestone.id}`
                          : undefined
                      }
                      onClick={
                        projectId && milestone.id
                          ? undefined
                          : () => handleMilestoneNavigate(milestone.id)
                      }
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-card)] p-8 text-center text-sm text-[color:var(--color-text-muted)]">
                  Add milestones to visualize timelines for this project.
                </div>
              )}
            </div>
          )}

          {activeTab === "kt" && (
            <ProjectKTHub projectId={projectId} />
          )}

          {activeTab === "board" && (
            <div className="space-y-4">
              {/* Last-updated badge + silent refresh indicator */}
              {lastUpdatedAt && (
                <div className="flex items-center justify-end gap-2">
                  {tasksLoading && tasks.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-[color:var(--color-text-muted)]">
                      <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/>
                      </svg>
                      Refreshing…
                    </span>
                  )}
                  <span className="text-[11px] text-[color:var(--color-text-muted)] bg-[color:var(--color-muted-bg)] px-2.5 py-1 rounded-full">
                    🔄 Last updated: {Math.round((Date.now() - lastUpdatedAt.getTime()) / 60000) < 1
                      ? "just now"
                      : `${Math.round((Date.now() - lastUpdatedAt.getTime()) / 60000)}m ago`}
                  </span>
                </div>
              )}
              {tasksLoading && tasks.length === 0 ? (
                <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-6 text-sm text-[color:var(--color-text-muted)]">
                  Loading tasks...
                </div>
              ) : tasks.length ? (
                <TaskBoard
                  tasks={tasks}
                  role={role}
                  currentUserId={currentUserId}
                  onEditTask={openEditTask}
                />
              ) : (
                <div className="rounded-2xl border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-card)] p-8 text-center text-sm text-[color:var(--color-text-muted)]">
                  No tasks yet. Create a task to get started.
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Milestone Creation Modal */}
      <Dialog
        isOpen={modalOpen}
        title="Create milestone"
        description="Set dates to anchor the milestone timeline."
        onClose={savingMilestone ? undefined : () => setModalOpen(false)}
      >
        <form onSubmit={handleMilestoneSubmit} className="space-y-4">
          <label className="text-xs text-[color:var(--color-text-muted)]">
            Milestone title
            <Input
              className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-sm text-[color:var(--color-text)]"
              value={milestoneForm.title}
              onChange={(event) =>
                setMilestoneForm((prev) => ({
                  ...prev,
                  title: event.target.value,
                }))
              }
            />
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs text-[color:var(--color-text-muted)]">
              Start date
              <Input
                type="date"
                className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-sm text-[color:var(--color-text)]"
                value={milestoneForm.startDate}
                onChange={(event) =>
                  setMilestoneForm((prev) => ({
                    ...prev,
                    startDate: event.target.value,
                  }))
                }
              />
            </label>
            <label className="text-xs text-[color:var(--color-text-muted)]">
              End date
              <Input
                type="date"
                className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-sm text-[color:var(--color-text)]"
                value={milestoneForm.endDate}
                onChange={(event) =>
                  setMilestoneForm((prev) => ({
                    ...prev,
                    endDate: event.target.value,
                  }))
                }
              />
            </label>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              label="Cancel"
              variant="secondary"
              onClick={() => setModalOpen(false)}
              className={savingMilestone ? "pointer-events-none opacity-60" : ""}
            />
            <Button
              label={savingMilestone ? "Saving..." : "Create milestone"}
              variant="primary"
              type="submit"
              className={savingMilestone ? "pointer-events-none opacity-60" : ""}
            />
          </div>
        </form>
      </Dialog>

      {/* Task Creation/Editing Dialog */}
      <DialogRoot
        open={isTaskModalOpen}
        onOpenChange={(open) => {
          if (!open && !savingTask) {
            setIsTaskModalOpen(false);
            resetTaskForm();
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto overflow-x-hidden sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingTaskId ? "Edit task" : "Create task"}</DialogTitle>
            <DialogDescription>
              {editingTaskId
                ? "Update the task details and checklist."
                : "Tasks created here will be added to the project."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleTaskSubmit} className="mt-6 space-y-6">
            <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="project-task-title">Task title</Label>
                  <Input
                    id="project-task-title"
                    value={taskForm.title}
                    onChange={(event) => setTaskForm((prev) => ({ ...prev, title: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="project-task-description">Description</Label>
                  <Textarea
                    id="project-task-description"
                    rows={4}
                    value={taskForm.description}
                    onChange={(event) => setTaskForm((prev) => ({ ...prev, description: event.target.value }))}
                  />
                </div>
                {!editingTaskId && (
                  <div className="space-y-2">
                    <Label htmlFor="project-task-milestone">Milestone</Label>
                    <Select
                      value={taskForm.milestoneId || "none"}
                      onValueChange={(value) => setTaskForm((prev) => ({ ...prev, milestoneId: value === "none" ? "" : value }))}
                    >
                      <SelectTrigger id="project-task-milestone">
                        <SelectValue placeholder="Select milestone" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">General Task (No Milestone)</SelectItem>
                        {milestones.map((milestoneOption) => (
                          <SelectItem key={milestoneOption.id} value={milestoneOption.id}>
                            {milestoneOption.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="grid gap-4 md:grid-cols-2">
                  {!editingTaskId && (
                    <div className="space-y-2">
                      <Label htmlFor="project-task-status">Status</Label>
                      <Select
                        value={taskForm.status}
                        onValueChange={(value) => setTaskForm((prev) => ({ ...prev, status: value }))}
                      >
                        <SelectTrigger id="project-task-status">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          {TASK_STATUSES.map((statusOption) => (
                            <SelectItem key={statusOption.id} value={statusOption.id}>
                              {statusOption.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="project-task-type">Type</Label>
                    <Select
                      value={taskForm.type}
                      onValueChange={(value) => setTaskForm((prev) => ({ ...prev, type: value }))}
                    >
                      <SelectTrigger id="project-task-type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {taskTypes.map((taskType) => (
                          <SelectItem key={taskType} value={taskType}>{taskType}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="project-task-owner">Assignee</Label>
                  <Select
                    value={taskForm.ownerId || "UNASSIGNED"}
                    onValueChange={(value) => setTaskForm((prev) => ({ ...prev, ownerId: value === "UNASSIGNED" ? "" : value }))}
                    disabled={!canManageAssignments}
                  >
                    <SelectTrigger id="project-task-owner">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UNASSIGNED">Unassigned</SelectItem>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>{user.name} ({user.role})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="project-task-estimated-time">Estimated time</Label>
                  <Input
                    id="project-task-estimated-time"
                    placeholder="2h 30m"
                    value={taskForm.estimatedTime}
                    onChange={(event) => setTaskForm((prev) => ({ ...prev, estimatedTime: event.target.value }))}
                  />
              </div>
            </div>

            <DialogFooter className="mt-4 border-t border-border pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setIsTaskModalOpen(false);
                  resetTaskForm();
                }}
                disabled={savingTask}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={savingTask}>
                {savingTask ? "Saving..." : editingTaskId ? "Save changes" : "Create task"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </DialogRoot>

      {/* Add Project Member Dialog */}
      <DialogRoot
        open={isAddMemberModalOpen}
        onOpenChange={(open) => {
          if (!open && !addingMember) {
            setIsAddMemberModalOpen(false);
            setSelectedAddUserId("");
          }
        }}
      >
        <DialogContent className="max-h-[80vh] overflow-hidden sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Member to Project</DialogTitle>
            <DialogDescription>
              Search and assign a team member to this project.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddMember} className="mt-6 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="project-member" className="text-sm font-medium">
                Select Team Member
              </Label>
              <Select
                value={selectedAddUserId}
                onValueChange={setSelectedAddUserId}
                required
              >
                <SelectTrigger id="project-member" className="w-full">
                  <SelectValue placeholder="Choose a member..." />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  side="bottom"
                  align="start"
                  sideOffset={6}
                  avoidCollisions
                  collisionPadding={8}
                  className="w-[var(--radix-select-trigger-width)]"
                >
                  <ScrollArea
                    type={shouldScrollMemberOptions ? "always" : "auto"}
                    className={shouldScrollMemberOptions ? "h-[320px] max-h-[calc(100vh-12rem)] w-full" : "w-full"}
                    viewportClassName="pr-2"
                  >
                    {nonMemberUsers.length ? (
                      nonMemberUsers.map((user) => (
                        <SelectItem
                          key={user.id}
                          value={user.id}
                          textValue={`${user.name} ${user.email ?? ""} ${user.role ?? ""}`}
                        >
                          <span className="flex items-center gap-2">
                            <Avatar
                              src={user.image}
                              name={user.name}
                              alt=""
                              className="h-6 w-6 text-[10px]"
                              fallbackClassName="text-[10px]"
                            />
                            <span className="min-w-0 truncate">
                              {user.name}{user.role ? ` · ${user.role}` : ""}
                            </span>
                          </span>
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="__none__" disabled>
                        No active members available
                      </SelectItem>
                    )}
                  </ScrollArea>
                </SelectContent>
              </Select>
              {nonMemberUsers.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  All active system members are already in this project.
                </p>
              )}
            </div>

            <DialogFooter className="flex-row flex-wrap justify-end gap-2 border-t border-border pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsAddMemberModalOpen(false);
                  setSelectedAddUserId("");
                }}
                disabled={addingMember}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={addingMember || !selectedAddUserId}
              >
                {addingMember ? "Adding..." : "Add to Project"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </DialogRoot>
    </div>
  );
}
