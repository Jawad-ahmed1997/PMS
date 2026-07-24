"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/ToastProvider";
import { Input } from "@/components/ui/input";
import MilestoneCard from "@/components/milestones/MilestoneCard";
import PageHeader from "@/components/layout/PageHeader";
import TaskBoard from "@/components/tasks/TaskBoard";
import ProjectKTHub from "@/components/projects/ProjectKTHub";
import { TASK_STATUSES } from "@/lib/kanban";
import { TASK_TYPE_CHECKLISTS } from "@/lib/taskChecklists";
import { canCreateTasks, normalizeRoleId, roles } from "@/lib/roles";
import { getTodayInPSTDateString } from "@/lib/pstDate";
import Modal from "../ui/Modal";

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

  // Load project tasks
  const loadTasks = useCallback(async () => {
    setTasksLoading(true);
    try {
      const response = await fetch(`/api/tasks?projectId=${projectId}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message ?? "Failed to load tasks");
      }
      setTasks(data?.tasks ?? []);
    } catch (error) {
      addToast({
        title: "Tasks unavailable",
        message: error instanceof Error ? error.message : "Failed to load tasks.",
        variant: "error",
      });
    } finally {
      setTasksLoading(false);
    }
  }, [addToast, projectId]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  useEffect(() => {
    if (activeTab === "board" && !status.loading && !status.error) {
      loadTasks();
    }
  }, [activeTab, loadTasks, status.loading, status.error]);

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
      setDialogOpen(false);
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

    if (!editingTaskId && !taskForm.milestoneId) {
      addToast({
        title: "Milestone required",
        message: "Associate the task with a milestone to continue.",
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
              }
              : {
                ...payload,
                status: taskForm.status,
                milestoneId: taskForm.milestoneId,
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
          canManageMilestones ? (
            <div className="flex items-center gap-2">
              {activeTab === "milestones" ? (
                <ActionButton
                  label="Create milestone"
                  variant="success"
                  onClick={() => {
                    resetMilestoneForm();
                    setModalOpen(true);
                  }}
                />
              ) : milestones.length > 0 ? (
                <ActionButton
                  label="Create task"
                  variant="success"
                  onClick={() => {
                    resetTaskForm();
                    setIsTaskModalOpen(true);
                  }}
                />
              ) : null}
            </div>
          ) : null
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
                  <span
                    key={member.id}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-[color:var(--color-card)] bg-[color:var(--color-muted-bg)] text-[10px] font-bold text-[color:var(--color-text)] cursor-pointer"
                    title={`${member.name} (${member.role})`}
                  >
                    {(member.name ?? "U").charAt(0).toUpperCase()}
                  </span>
                ))}
                {/* Add Member Button */}
                {canManageAssignments && (
                  <button
                    type="button"
                    onClick={() => setIsAddMemberModalOpen(true)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-[color:var(--color-border)] bg-transparent text-[color:var(--color-text-muted)] hover:border-[color:var(--color-accent)] hover:text-white transition-colors ml-2"
                    title="Add Member to Project"
                  >
                    +
                  </button>
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
                  {milestones.length === 0
                    ? "Create a milestone first to add tasks to this project."
                    : "No tasks yet. Create a task to get started."}
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
        onClose={savingMilestone ? undefined : () => setDialogOpen(false)}
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
              onClick={() => setDialogOpen(false)}
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

      {/* Task Creation/Editing Modal */}
      <Modal
        isOpen={isTaskModalOpen}
        title={editingTaskId ? "Edit task" : "Create task"}
        description={
          editingTaskId
            ? "Update the task details and checklist."
            : "Tasks created here will be added to the project."
        }
        onClose={
          savingTask
            ? undefined
            : () => {
              setIsTaskModalOpen(false);
              resetTaskForm();
            }
        }
      >
        <form onSubmit={handleTaskSubmit} className="flex max-h-[60vh] flex-col">
          <div className="space-y-4 overflow-y-auto pr-1">
            <label className="text-xs text-[color:var(--color-text-muted)]">
              Task title
              <input
                className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-sm text-[color:var(--color-text)]"
                value={taskForm.title}
                onChange={(event) =>
                  setTaskForm((prev) => ({ ...prev, title: event.target.value }))
                }
              />
            </label>
            <label className="text-xs text-[color:var(--color-text-muted)]">
              Description
              <textarea
                className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-sm text-[color:var(--color-text)]"
                rows={4}
                value={taskForm.description}
                onChange={(event) =>
                  setTaskForm((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
              />
            </label>

            {!editingTaskId && (
              <label className="text-xs text-[color:var(--color-text-muted)]">
                Milestone
                <select
                  className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-sm text-[color:var(--color-text)]"
                  value={taskForm.milestoneId}
                  onChange={(event) =>
                    setTaskForm((prev) => ({
                      ...prev,
                      milestoneId: event.target.value,
                    }))
                  }
                >
                  {milestones.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              {!editingTaskId ? (
                <label className="text-xs text-[color:var(--color-text-muted)]">
                  Status
                  <select
                    className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-sm text-[color:var(--color-text)]"
                    value={taskForm.status}
                    onChange={(event) =>
                      setTaskForm((prev) => ({
                        ...prev,
                        status: event.target.value,
                      }))
                    }
                  >
                    {TASK_STATUSES.map((statusOption) => (
                      <option key={statusOption.id} value={statusOption.id}>
                        {statusOption.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="text-xs text-[color:var(--color-text-muted)]">
                Type
                <select
                  className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-sm text-[color:var(--color-text)]"
                  value={taskForm.type}
                  onChange={(event) =>
                    setTaskForm((prev) => ({
                      ...prev,
                      type: event.target.value,
                    }))
                  }
                >
                  {taskTypes.map((taskType) => (
                    <option key={taskType} value={taskType}>
                      {taskType}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="text-xs text-[color:var(--color-text-muted)]">
              Assignee
              <select
                className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-sm text-[color:var(--color-text)]"
                value={taskForm.ownerId}
                onChange={(event) =>
                  setTaskForm((prev) => ({
                    ...prev,
                    ownerId: event.target.value,
                  }))
                }
              >
                <option value="">Unassigned</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.role})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-[color:var(--color-text-muted)]">
              Estimated time (e.g. 8h, 2 hours 30 minutes, 45m)
              <input
                className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-sm text-[color:var(--color-text)]"
                placeholder="2h 30m"
                value={taskForm.estimatedTime}
                onChange={(event) =>
                  setTaskForm((prev) => ({
                    ...prev,
                    estimatedTime: event.target.value,
                  }))
                }
              />
            </label>
          </div>
          <div className="flex flex-wrap justify-end gap-2 pt-4 border-t border-[color:var(--color-border)] mt-4">
            <ActionButton
              label="Cancel"
              variant="secondary"
              onClick={() => {
                setIsTaskModalOpen(false);
                resetTaskForm();
              }}
              className={savingTask ? "pointer-events-none opacity-60" : ""}
            />
            <ActionButton
              label={savingTask ? "Saving..." : editingTaskId ? "Save changes" : "Create task"}
              variant="primary"
              type="submit"
              className={savingTask ? "pointer-events-none opacity-60" : ""}
            />
          </div>
        </form>
      </Modal>

      {/* Add Project Member Modal */}
      <Modal
        isOpen={isAddMemberModalOpen}
        title="Add Member to Project"
        description="Search and assign a team member to this project."
        onClose={addingMember ? undefined : () => {
          setIsAddMemberModalOpen(false);
          setSelectedAddUserId("");
        }}
      >
        <form onSubmit={handleAddMember} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-[color:var(--color-text-muted)]">
              Select Team Member
              <select
                value={selectedAddUserId}
                onChange={(e) => setSelectedAddUserId(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-sm text-[color:var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-accent)]"
                required
              >
                <option value="">Choose a member...</option>
                {nonMemberUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.role})
                  </option>
                ))}
              </select>
            </label>
            {nonMemberUsers.length === 0 && (
              <p className="mt-2 text-xs text-[color:var(--color-text-subtle)] italic">
                All active system members are already in this project.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setIsAddMemberModalOpen(false);
                setSelectedAddUserId("");
              }}
              disabled={addingMember}
              className="rounded-xl border border-[color:var(--color-border)] bg-transparent px-4 py-2 text-xs font-semibold text-[color:var(--color-text-subtle)] hover:bg-[color:var(--color-muted-bg)] transition"
            >
              Cancel
            </button>
            <ActionButton
              label={addingMember ? "Adding..." : "Add to Project"}
              variant="success"
              type="submit"
              disabled={addingMember || !selectedAddUserId}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
