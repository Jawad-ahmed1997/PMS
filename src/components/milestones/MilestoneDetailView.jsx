"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/ToastProvider";
import TaskBoard from "@/components/tasks/TaskBoard";
import PageHeader from "@/components/layout/PageHeader";
import { TASK_STATUSES } from "@/lib/kanban";
import { TASK_TYPE_CHECKLISTS } from "@/lib/taskChecklists";
import { canCreateTasks, normalizeRoleId, roles } from "@/lib/roles";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import ScrollArea from "@/components/ui/ScrollArea";
import {
  getMilestoneCapacity,
  getMilestoneStatus,
  getTaskEstimatedMinutes,
} from "@/lib/milestoneProgress";

const buildErrorMessage = (data) =>
  data?.error ?? data?.message ?? "Unable to load milestone.";

export default function MilestoneDetailView({
  milestoneId,
  role,
  currentUserId,
}) {
  const { addToast } = useToast();
  const [milestone, setMilestone] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [status, setStatus] = useState({ loading: true, error: null });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [users, setUsers] = useState([]);
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    status: TASK_STATUSES[0]?.id ?? "BACKLOG",
    type: Object.keys(TASK_TYPE_CHECKLISTS)[0] ?? "UI",
    estimatedTime: "",
    ownerId: "",
    checklistItems: [],
  });

  const taskTypes = useMemo(() => Object.keys(TASK_TYPE_CHECKLISTS), []);
  const milestoneStatus = useMemo(
    () => getMilestoneStatus(milestone?.startDate, milestone?.endDate),
    [milestone?.endDate, milestone?.startDate]
  );
  const normalizedRole = useMemo(() => normalizeRoleId(role), [role]);
  const canCreateTask = useMemo(() => canCreateTasks(normalizedRole), [normalizedRole]);
  const milestoneCapacity = useMemo(() => {
    const plannedMinutes = tasks.reduce(
      (sum, task) => sum + getTaskEstimatedMinutes(task),
      0
    );
    return getMilestoneCapacity({
      startDate: milestone?.startDate,
      endDate: milestone?.endDate,
      plannedMinutes,
    });
  }, [milestone?.endDate, milestone?.startDate, tasks]);
  const canManageAssignments = useMemo(
    () =>
      [roles.CEO, roles.PM, roles.CTO, roles.SENIOR_DEV].includes(normalizedRole),
    [normalizedRole]
  );

  const loadMilestone = useCallback(async () => {
    setStatus({ loading: true, error: null });
    try {
      const [milestoneResponse, tasksResponse] = await Promise.all([
        fetch(`/api/milestones/${milestoneId}`),
        fetch(`/api/tasks?milestoneId=${milestoneId}`),
      ]);
      const milestoneData = await milestoneResponse.json();
      const tasksData = await tasksResponse.json();

      if (!milestoneResponse.ok) {
        throw new Error(buildErrorMessage(milestoneData));
      }
      if (!tasksResponse.ok) {
        throw new Error(buildErrorMessage(tasksData));
      }

      setMilestone(milestoneData?.milestone ?? null);
      setTasks(tasksData?.tasks ?? []);
      setStatus({ loading: false, error: null });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load milestone.";
      setStatus({ loading: false, error: message });
      addToast({
        title: "Milestone unavailable",
        message,
        variant: "error",
      });
    }
  }, [addToast, milestoneId]);

  useEffect(() => {
    loadMilestone();
  }, [loadMilestone]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    const handleAttendanceUpdate = () => {
      loadMilestone();
    };
    window.addEventListener("attendance-updated", handleAttendanceUpdate);
    return () => {
      window.removeEventListener("attendance-updated", handleAttendanceUpdate);
    };
  }, [loadMilestone]);

  useEffect(() => {
    if (!canManageAssignments || !milestone?.projectId) {
      return;
    }

    const loadUsers = async () => {
      try {
        const response = await fetch(
          `/api/users?isActive=true&projectId=${milestone.projectId}`
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
  }, [canManageAssignments, milestone?.projectId]);

  const resetTaskForm = () => {
    setTaskForm({
      title: "",
      description: "",
      status: TASK_STATUSES[0]?.id ?? "BACKLOG",
      type: Object.keys(TASK_TYPE_CHECKLISTS)[0] ?? "UI",
      estimatedTime: "",
      ownerId: "",
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
      checklistItems: (task.checklistItems ?? []).map((item) => ({
        id: item.id,
        label: item.label,
        isCompleted: item.isCompleted,
      })),
    });
    setIsDialogOpen(true);
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
                }
              : {
                  ...payload,
                  status: taskForm.status,
                  milestoneId,
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
          : "Task added to milestone execution queue.",
        variant: "success",
      });
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("pms:refresh-notifications"));
      }
      resetTaskForm();
      setIsDialogOpen(false);
      if (editingTaskId) {
        setTasks((prev) =>
          prev.map((task) => (task.id === data.task.id ? data.task : task))
        );
      } else {
        loadMilestone();
      }
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

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={milestone?.project?.name ?? "Project milestones"}
        title={milestone?.title ?? "Milestone overview"}
        backHref={
          milestone?.project?.id
            ? `/projects/${milestone.project.id}`
            : "/milestones"
        }
        backLabel="Back to milestones"
        actions={
          canCreateTask ? (
            <Button
              label="Create task"
              variant="primary"
              onClick={() => {
                resetTaskForm();
                setIsDialogOpen(true);
              }}
            />
          ) : null
        }
      />

      {!status.loading && !status.error && milestone && (
        <div
          className={`rounded-2xl border p-4 ${milestoneCapacity.overbooked ? "border-rose-500/60 bg-rose-500/5" : "border-[color:var(--color-border)] bg-[color:var(--color-card)]"}`}
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
              {milestoneStatus.statusText}
            </p>
            <div className="text-right text-xs text-[color:var(--color-text-muted)]">
              <p>Capacity: {milestoneCapacity.capacityHours.toFixed(1)}h</p>
              <p>Planned: {milestoneCapacity.plannedHours.toFixed(1)}h</p>
              <p className={milestoneCapacity.overbooked ? "text-rose-400" : ""}>
                {milestoneCapacity.overbooked
                  ? `Over by: +${Math.abs(milestoneCapacity.remainingHours).toFixed(1)}h`
                  : `Left: ${milestoneCapacity.remainingHours.toFixed(1)}h`}
              </p>
            </div>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[color:var(--color-muted-bg)]">
            <div
              className={`h-full ${milestoneCapacity.overbooked ? "bg-rose-500" : "bg-[color:var(--color-accent)]"}`}
              style={{ width: `${milestoneCapacity.fillPercent}%` }}
            />
          </div>
        </div>
      )}

      {status.loading && (
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-6 text-sm text-[color:var(--color-text-muted)]">
          Loading milestone...
        </div>
      )}

      {!status.loading && status.error && (
        <div className="space-y-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-200">
          <p>{status.error}</p>
          <Button label="Retry" variant="secondary" onClick={loadMilestone} />
        </div>
      )}

      {!status.loading && !status.error && milestone && (
        <>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[color:var(--color-text)]">
                Task board
              </p>
              <span className="text-xs text-[color:var(--color-text-muted)]">
                {tasks.length} total
              </span>
            </div>
            {tasks.length ? (
              <TaskBoard
                tasks={tasks}
                role={role}
                currentUserId={currentUserId}
                onEditTask={openEditTask}
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-card)] p-6 text-center text-sm text-[color:var(--color-text-muted)]">
                No tasks yet.
              </div>
            )}
          </div>
        </>
      )}

      <DialogRoot
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (!open && !savingTask) {
            setIsDialogOpen(false);
            resetTaskForm();
          }
        }}
      >
        <DialogContent className="max-h-[85vh] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingTaskId ? "Edit task" : "Create task"}</DialogTitle>
            <DialogDescription>
              {editingTaskId
                ? "Update the task details and checklist."
                : "Tasks created here are tied to this milestone."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleTaskSubmit} className="mt-6 flex min-h-0 flex-1 flex-col">
            <ScrollArea className="min-h-0 flex-1" viewportClassName="pr-3">
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="milestone-task-title">Task title</Label>
                  <Input
                    id="milestone-task-title"
                    value={taskForm.title}
                    onChange={(event) =>
                      setTaskForm((prev) => ({ ...prev, title: event.target.value }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="milestone-task-description">Description</Label>
                  <Textarea
                    id="milestone-task-description"
                    rows={4}
                    value={taskForm.description}
                    onChange={(event) =>
                      setTaskForm((prev) => ({
                        ...prev,
                        description: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {!editingTaskId ? (
                    <div className="space-y-2">
                      <Label htmlFor="milestone-task-status">Status</Label>
                      <Select
                        value={taskForm.status}
                        onValueChange={(value) =>
                          setTaskForm((prev) => ({ ...prev, status: value }))
                        }
                      >
                        <SelectTrigger id="milestone-task-status">
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
                  ) : null}

                  <div className="space-y-2">
                    <Label htmlFor="milestone-task-type">Type</Label>
                    <Select
                      value={taskForm.type}
                      onValueChange={(value) =>
                        setTaskForm((prev) => ({ ...prev, type: value }))
                      }
                    >
                      <SelectTrigger id="milestone-task-type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {taskTypes.map((taskType) => (
                          <SelectItem key={taskType} value={taskType}>
                            {taskType}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="milestone-task-owner">Assignee</Label>
                  <Select
                    value={taskForm.ownerId || "UNASSIGNED"}
                    onValueChange={(value) =>
                      setTaskForm((prev) => ({
                        ...prev,
                        ownerId: value === "UNASSIGNED" ? "" : value,
                      }))
                    }
                    disabled={!canManageAssignments}
                  >
                    <SelectTrigger id="milestone-task-owner">
                      <SelectValue
                        placeholder={canManageAssignments ? "Select developer" : "Unassigned"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UNASSIGNED">
                        {canManageAssignments ? "Select developer" : "Unassigned"}
                      </SelectItem>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="milestone-task-estimate">Estimated time</Label>
                  <Input
                    id="milestone-task-estimate"
                    placeholder="2 hours 30 minutes"
                    value={taskForm.estimatedTime}
                    onChange={(event) =>
                      setTaskForm((prev) => ({
                        ...prev,
                        estimatedTime: event.target.value,
                      }))
                    }
                  />
                </div>

                {editingTaskId ? (
                  <div className="space-y-4 rounded-xl border border-border bg-muted/30 p-4">
                    <div>
                      <p className="text-sm font-semibold">Checklist</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Track the completion of this task&apos;s checklist items.
                      </p>
                    </div>
                    <div className="space-y-2">
                      {taskForm.checklistItems.length ? (
                        taskForm.checklistItems.map((item, index) => (
                          <div
                            key={item.id ?? `new-${index}`}
                            className="flex items-center gap-2"
                          >
                            <Checkbox
                              checked={item.isCompleted}
                              onCheckedChange={(checked) =>
                                setTaskForm((prev) => ({
                                  ...prev,
                                  checklistItems: prev.checklistItems.map(
                                    (existing, itemIndex) =>
                                      itemIndex === index
                                        ? {
                                            ...existing,
                                            isCompleted: checked === true,
                                          }
                                        : existing
                                  ),
                                }))
                              }
                              aria-label={`Mark ${item.label || "checklist item"} complete`}
                            />
                            <Input
                              value={item.label}
                              onChange={(event) =>
                                setTaskForm((prev) => ({
                                  ...prev,
                                  checklistItems: prev.checklistItems.map(
                                    (existing, itemIndex) =>
                                      itemIndex === index
                                        ? {
                                            ...existing,
                                            label: event.target.value,
                                          }
                                        : existing
                                  ),
                                }))
                              }
                              className="flex-1"
                              aria-label="Checklist item"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setTaskForm((prev) => ({
                                  ...prev,
                                  checklistItems: prev.checklistItems.filter(
                                    (_, itemIndex) => itemIndex !== index
                                  ),
                                }))
                              }
                            >
                              Remove
                            </Button>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          No checklist items yet.
                        </p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-fit"
                      onClick={() =>
                        setTaskForm((prev) => ({
                          ...prev,
                          checklistItems: [
                            ...prev.checklistItems,
                            { label: "", isCompleted: false },
                          ],
                        }))
                      }
                    >
                      Add checklist item
                    </Button>
                  </div>
                ) : null}
              </div>
            </ScrollArea>

            <DialogFooter className="mt-4 border-t border-border pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsDialogOpen(false)}
                disabled={savingTask}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={savingTask}>
                {savingTask
                  ? "Saving..."
                  : editingTaskId
                    ? "Save changes"
                    : "Create Task"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </DialogRoot>
    </div>
  );
}
