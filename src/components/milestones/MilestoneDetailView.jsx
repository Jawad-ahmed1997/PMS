"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import RefreshButton from "@/components/ui/RefreshButton";
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
import { UserPlus } from "lucide-react";
import Avatar from "@/components/ui/Avatar";

const buildErrorMessage = (data) =>
  data?.error ?? data?.message ?? "Unable to load milestone.";

export default function MilestoneDetailView({
  milestoneId,
  role,
  currentUserId,
}) {
  const { addToast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [initialTaskForm, setInitialTaskForm] = useState(null);
  const [users, setUsers] = useState([]);

  // Query for milestone details and tasks
  const { data: milestone = null, isLoading: milestoneLoading, error: milestoneError, refetch: refetchMilestone } = useQuery({
    queryKey: ["milestone", milestoneId],
    queryFn: async () => {
      const response = await fetch(`/api/milestones/${milestoneId}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(buildErrorMessage(data));
      }
      return data?.milestone ?? null;
    },
    staleTime: 1000 * 30,
  });

  const { data: tasks = [], isLoading: tasksLoading, error: tasksError, refetch: refetchTasks } = useQuery({
    queryKey: ["tasks", "milestone", milestoneId],
    queryFn: async () => {
      const response = await fetch(`/api/tasks?milestoneId=${milestoneId}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(buildErrorMessage(data));
      }
      return data?.tasks ?? [];
    },
    staleTime: 1000 * 10,
  });

  const handleRefresh = useCallback(async () => {
    await Promise.all([refetchMilestone(), refetchTasks()]);
  }, [refetchMilestone, refetchTasks]);

  // Project Members states
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [selectedAddUserId, setSelectedAddUserId] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [systemUsers, setSystemUsers] = useState([]);
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    status: TASK_STATUSES[0]?.id ?? "BACKLOG",
    type: Object.keys(TASK_TYPE_CHECKLISTS)[0] ?? "UI",
    estimatedTime: "",
    ownerId: "",
    checklistItems: [],
    attachments: [],
  });

  const fileInputRef = useRef(null);
  const [pendingUploads, setPendingUploads] = useState([]);
  const [lightboxAttachment, setLightboxAttachment] = useState(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const taskTypes = useMemo(() => Object.keys(TASK_TYPE_CHECKLISTS), []);
  const milestoneStatus = useMemo(
    () => getMilestoneStatus(milestone?.startDate, milestone?.endDate),
    [milestone?.endDate, milestone?.startDate]
  );
  const normalizedRole = useMemo(() => normalizeRoleId(role), [role]);
  const isProjectAdmin = useMemo(() => {
    return (
      milestone?.project?.createdById === currentUserId ||
      (milestone?.project?.members ?? []).some(
        (m) =>
          (m.userId === currentUserId || m.id === currentUserId) &&
          (m.role === "ADMIN" || m.projectRole === "ADMIN")
      )
    );
  }, [milestone?.project, currentUserId]);

  const canCreateTask = useMemo(
    () => canCreateTasks(normalizedRole) || isProjectAdmin,
    [normalizedRole, isProjectAdmin]
  );
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
      [roles.CEO, roles.PM, roles.CTO, roles.SENIOR_DEV].includes(normalizedRole) ||
      isProjectAdmin,
    [normalizedRole, isProjectAdmin]
  );

  const nonMemberUsers = useMemo(() => {
    const memberIds = new Set((milestone?.project?.members ?? []).map((m) => m.id));
    return systemUsers.filter((u) => !memberIds.has(u.id));
  }, [systemUsers, milestone?.project?.members]);

  const shouldScrollMemberOptions = useMemo(() => nonMemberUsers.length > 8, [nonMemberUsers.length]);

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

  useEffect(() => {
    if (milestoneError) {
      addToast({
        title: "Milestone unavailable",
        message: milestoneError.message || "Unable to load milestone.",
        variant: "error",
      });
    }
  }, [milestoneError, addToast]);

  useEffect(() => {
    if (tasksError) {
      addToast({
        title: "Tasks unavailable",
        message: tasksError.message || "Unable to load tasks.",
        variant: "error",
      });
    }
  }, [tasksError, addToast]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    const handleAttendanceUpdate = () => {
      handleRefresh();
    };
    window.addEventListener("attendance-updated", handleAttendanceUpdate);
    return () => {
      window.removeEventListener("attendance-updated", handleAttendanceUpdate);
    };
  }, [handleRefresh]);

  const loadUsers = useCallback(async () => {
    if (!canManageAssignments || !milestone?.projectId) {
      return;
    }
    try {
      const response = await fetch(
        `/api/users?isActive=true&projectId=${milestone.projectId}`
      );
      const data = await response.json();
      if (response.ok) {
        setUsers(data?.users ?? []);
      }
    } catch (error) {
      console.error("Failed to load project users", error);
      setUsers([]);
    }
  }, [canManageAssignments, milestone?.projectId]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleAddMember = async (event) => {
    event.preventDefault();
    if (!selectedAddUserId || !milestone?.projectId) return;

    setAddingMember(true);
    try {
      const currentMemberIds = (milestone.project.members ?? []).map((m) => m.id);
      const newMemberIds = [...currentMemberIds, selectedAddUserId];

      const response = await fetch(`/api/projects/${milestone.projectId}`, {
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

      await handleRefresh();
      // Reload task assignee choices
      try {
        const usersResponse = await fetch(
          `/api/users?isActive=true&projectId=${milestone.projectId}`
        );
        const usersData = await usersResponse.json();
        if (usersResponse.ok) {
          setUsers(usersData?.users ?? []);
        }
      } catch (e) {
        console.error(e);
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

  const handleLocalFilesSelect = (files) => {
    const allowedPrefixes = ["image/", "video/", "application/pdf", "text/plain"];
    const validFiles = Array.from(files).filter((file) =>
      allowedPrefixes.some((pref) => file.type.startsWith(pref))
    );

    if (validFiles.length === 0) return;

    const newAttachments = validFiles.map((file) => {
      const localUrl = URL.createObjectURL(file);
      return {
        key: `local-${Date.now()}-${Math.random()}`,
        name: file.name,
        size: `${(file.size / 1024).toFixed(1)} KB`,
        type: file.type,
        url: localUrl,
        file: file,
      };
    });

    setTaskForm((prev) => ({
      ...prev,
      attachments: [...(prev.attachments || []), ...newAttachments],
    }));
  };

  const revokeAllLocalObjectUrls = (attachments) => {
    (attachments || []).forEach((att) => {
      if (att.url && att.url.startsWith("blob:")) {
        URL.revokeObjectURL(att.url);
      }
    });
  };

  const handleRemoveAttachment = (key) => {
    setTaskForm((prev) => {
      const target = (prev.attachments || []).find((att) => att.key === key);
      if (target?.url && target.url.startsWith("blob:")) {
        URL.revokeObjectURL(target.url);
      }
      return {
        ...prev,
        attachments: (prev.attachments || []).filter((att) => att.key !== key),
      };
    });
  };

  const handleTaskFormPaste = (event) => {
    const clipboardItems = event.clipboardData?.items;
    if (!clipboardItems) return;

    const items = Array.from(clipboardItems);
    const imageItem = items.find((item) => item.type.indexOf("image") !== -1);
    if (!imageItem) return;

    const file = imageItem.getAsFile();
    if (!file) return;

    event.preventDefault();
    handleLocalFilesSelect([file]);
  };

  const resetTaskForm = () => {
    revokeAllLocalObjectUrls(taskForm.attachments);
    setTaskForm({
      title: "",
      description: "",
      status: TASK_STATUSES[0]?.id ?? "BACKLOG",
      type: Object.keys(TASK_TYPE_CHECKLISTS)[0] ?? "UI",
      estimatedTime: "",
      ownerId: "",
      checklistItems: [],
      attachments: [],
    });
    setEditingTaskId(null);
    setInitialTaskForm(null);
    setPendingUploads([]);
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
    const initial = {
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
    };
    setTaskForm(initial);
    setInitialTaskForm(initial);
    setIsDialogOpen(true);
  };

  const isTaskFormUnchanged = useMemo(() => {
    if (!editingTaskId || !initialTaskForm) return false;
    const currentComparable = {
      title: taskForm.title,
      description: taskForm.description,
      status: taskForm.status,
      type: taskForm.type,
      estimatedTime: taskForm.estimatedTime,
      ownerId: taskForm.ownerId,
      checklistItems: taskForm.checklistItems,
    };
    return JSON.stringify(currentComparable) === JSON.stringify(initialTaskForm) && pendingUploads.length === 0;
  }, [editingTaskId, taskForm, initialTaskForm, pendingUploads]);

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
      const uploadedAttachments = [];
      const localAttachments = (taskForm.attachments || []).filter((att) => att.file);

      if (localAttachments.length > 0) {
        // Initialize pending uploads in the UI queue
        const newPendingItems = localAttachments.map((item, idx) => ({
          id: item.key,
          name: item.name,
          progress: 0,
          type: item.type,
        }));
        setPendingUploads(newPendingItems);

        for (const item of localAttachments) {
          // 1. Fetch Presigned URL
          const res = await fetch("/api/upload/presigned", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              filename: item.name,
              fileType: item.type,
              uploadType: "task",
            }),
          });

          if (!res.ok) {
            throw new Error(`Failed to get presigned S3 url for ${item.name}`);
          }

          const { uploadUrl, fileUrl, fileKey } = await res.json();

          // 2. PUT upload to S3
          await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("PUT", uploadUrl, true);
            xhr.setRequestHeader("Content-Type", item.type);

            xhr.upload.onprogress = (event) => {
              if (event.lengthComputable) {
                const percent = Math.round((event.loaded / event.total) * 100);
                setPendingUploads((prev) =>
                  prev.map((p) => (p.id === item.key ? { ...p, progress: percent } : p))
                );
              }
            };

            xhr.onload = () => {
              if (xhr.status === 200) resolve();
              else reject(new Error(`S3 upload failed for ${item.name}`));
            };

            xhr.onerror = () => reject(new Error(`Upload network error for ${item.name}`));
            xhr.send(item.file);
          });

          uploadedAttachments.push({
            name: item.name,
            size: item.size,
            type: item.type,
            url: fileUrl,
            key: fileKey,
          });

          setPendingUploads((prev) => prev.filter((p) => p.id !== item.key));
        }
      }

      const existingAttachments = (taskForm.attachments || [])
        .filter((att) => !att.file)
        .map((att) => ({
          name: att.name,
          size: att.size,
          type: att.type,
          url: att.url,
          key: att.key,
        }));

      const finalAttachments = [...existingAttachments, ...uploadedAttachments];

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
                  projectId: milestone?.projectId,
                  attachments: finalAttachments,
                }
          ),
        }
      );
      const data = await response.json().catch(() => null);

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
      handleRefresh();
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
          <div className="flex items-center gap-4">
            <RefreshButton onClick={handleRefresh} ariaLabel="Refresh milestone data" />
            {/* Members Avatars */}
            {!milestoneLoading && !milestoneError && milestone?.project?.members && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[color:var(--color-text-subtle)]">
                  Members:
                </span>
                <div className="flex items-center -space-x-1.5 overflow-hidden">
                  {(milestone.project.members ?? []).map((member) => (
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
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            )}
            {canCreateTask && (
              <Button
                label="Create task"
                variant="primary"
                onClick={() => {
                  resetTaskForm();
                  setIsDialogOpen(true);
                }}
              />
            )}
          </div>
        }
      />

      {!milestoneLoading && !milestoneError && milestone && (
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

      {milestoneLoading && (
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-6 text-sm text-[color:var(--color-text-muted)] animate-pulse">
          Loading milestone...
        </div>
      )}

      {!milestoneLoading && milestoneError && (
        <div className="space-y-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-200">
          <p>{milestoneError.message || "Unable to load milestone."}</p>
          <Button label="Retry" variant="secondary" onClick={handleRefresh} />
        </div>
      )}

      {!milestoneLoading && !milestoneError && milestone && (
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
                role={isProjectAdmin ? "PM" : role}
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
        <DialogContent className="max-h-[85vh] overflow-y-auto overflow-x-hidden sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingTaskId ? "Edit task" : "Create task"}</DialogTitle>
            <DialogDescription>
              {editingTaskId
                ? "Update the task details and checklist."
                : "Tasks created here are tied to this milestone."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleTaskSubmit} className="mt-6 space-y-6">
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
                <div className="space-y-2">
                  <Label>Attachments</Label>
                  
                  {/* Hidden File Input */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    multiple
                    accept="image/*,video/*,application/pdf,text/plain"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.length) {
                        handleLocalFilesSelect(e.target.files);
                      }
                      e.target.value = "";
                    }}
                  />

                  {/* Drop zone / Upload trigger */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onPaste={handleTaskFormPaste}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={async (e) => {
                      e.preventDefault();
                      if (e.dataTransfer.files?.length) {
                        handleLocalFilesSelect(e.dataTransfer.files);
                      }
                    }}
                    className="cursor-pointer flex flex-col items-center justify-center border-2 border-dashed border-[color:var(--color-border)] hover:border-[color:var(--color-accent)] rounded-xl py-6 px-4 bg-[color:var(--color-muted-bg)]/20 hover:bg-[color:var(--color-muted-bg)]/40 transition-all text-center space-y-1.5 group"
                  >
                    <svg
                      className="h-7 w-7 text-[color:var(--color-text-subtle)] group-hover:text-white transition-colors"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.122 2.122l7.81-7.81a1.5 1.5 0 00-2.122-2.122z"
                      />
                    </svg>
                    <div>
                      <p className="text-xs font-semibold text-[color:var(--color-text)]">
                        Click/Drag here to upload or paste a screenshot
                      </p>
                      <p className="text-[10px] text-[color:var(--color-text-subtle)] mt-0.5">
                        Supports images, videos, PDFs, and text files
                      </p>
                    </div>
                  </div>

                {/* Attached Files List */}
                {taskForm.attachments && taskForm.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-3 mt-2">
                    {taskForm.attachments.map((att) => {
                      const pending = (pendingUploads || []).find((p) => p.id === att.key);
                      const isUploading = Boolean(pending);
                      const progress = pending?.progress ?? 0;
                      return (
                        <div
                          key={att.key}
                          onClick={() => setLightboxAttachment(att)}
                          className="cursor-pointer relative h-24 w-24 rounded-xl border border-[color:var(--color-border)] hover:border-[color:var(--color-accent)] bg-[color:var(--color-muted-bg)]/20 shadow-sm transition-all overflow-hidden group flex items-center justify-center text-3xl shrink-0"
                          title={att.name}
                        >
                          {att.type.startsWith("image/") ? (
                            <img src={att.url} alt={att.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200" />
                          ) : att.type.startsWith("video/") ? (
                            <span>🎥</span>
                          ) : att.type === "application/pdf" ? (
                            <span>📕</span>
                          ) : (
                            <span>📄</span>
                          )}
                          
                          {isUploading ? (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
                              <span className="text-[10px] font-bold text-white">{progress}%</span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveAttachment(att.key);
                              }}
                              className="absolute top-1 right-1 h-5 w-5 flex items-center justify-center rounded-full bg-black/60 hover:bg-rose-600 text-white text-[10px] transition-colors shadow z-10"
                              title="Remove attachment"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
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

            <DialogFooter className="mt-4 border-t border-border pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsDialogOpen(false)}
                disabled={savingTask}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={savingTask || (Boolean(editingTaskId) && isTaskFormUnchanged)}>
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

      {isClient && lightboxAttachment ? createPortal(
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
      .catch((err) => setContent("Error loading file content: " + err.message));
  }, [url]);

  return (
    <pre className="w-full max-h-[75vh] p-6 rounded-lg bg-[#18181b] border border-neutral-800 text-neutral-200 overflow-auto font-mono text-xs leading-relaxed whitespace-pre-wrap select-text">
      {content}
    </pre>
  );
};
