"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { UserPlus, Users, Trash2, Shield, ShieldCheck, Crown } from "lucide-react";

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
  const [users, setUsers] = useState([]);
  const [activeTab, setActiveTab] = useState("board");

  // Loading statuses
  const [status, setStatus] = useState({ loading: true, error: null });
  const [savingMilestone, setSavingMilestone] = useState(false);
  const [savingTask, setSavingTask] = useState(false);

  // Query for tasks loading
  const { data: tasks = [], isLoading: tasksLoading, error: tasksError, refetch: refetchTasks, dataUpdatedAt } = useQuery({
    queryKey: ["tasks", "project", projectId],
    queryFn: async () => {
      const response = await fetch(`/api/tasks?projectId=${projectId}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message ?? "Failed to load tasks");
      }
      return data?.tasks ?? [];
    },
    enabled: activeTab === "board" && !status.loading && !status.error,
    staleTime: 1000 * 10,
    refetchInterval: 300000,
  });

  const lastUpdatedAt = dataUpdatedAt ? new Date(dataUpdatedAt) : null;

  // Modals state
  const [modalOpen, setModalOpen] = useState(false); // Milestone modal
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false); // Task modal
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [initialTaskForm, setInitialTaskForm] = useState(null);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [selectedAddUserId, setSelectedAddUserId] = useState("");
  const [selectedAddUserRole, setSelectedAddUserRole] = useState("MEMBER");
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
  const normalizedRole = useMemo(() => normalizeRoleId(role), [role]);

  const isProjectAdmin = useMemo(() => {
    if (!project || !currentUserId) return false;
    const member = (project.members ?? []).find((m) => m.id === currentUserId);
    return member?.projectRole === "ADMIN" || project.createdById === currentUserId;
  }, [project, currentUserId]);

  const canCreateTask = useMemo(
    () => canCreateTasks(normalizedRole) || isProjectAdmin,
    [normalizedRole, isProjectAdmin]
  );

  const canManageAssignments = useMemo(
    () =>
      [roles.CEO, roles.PM, roles.CTO, roles.SENIOR_DEV].includes(normalizedRole) || isProjectAdmin,
    [normalizedRole, isProjectAdmin]
  );

  const effectiveCanManageMilestones = useMemo(
    () => canManageMilestones || isProjectAdmin,
    [canManageMilestones, isProjectAdmin]
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

  useEffect(() => {
    if (tasksError) {
      addToast({
        title: "Tasks unavailable",
        message: tasksError.message || "Failed to load tasks.",
        variant: "error",
      });
    }
  }, [tasksError, addToast]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

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
      const currentMembers = (project.members ?? []).map((m) => ({
        userId: m.id,
        role: m.projectRole ?? "MEMBER",
      }));
      const newMembers = [
        ...currentMembers,
        { userId: selectedAddUserId, role: selectedAddUserRole }
      ];

      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ members: newMembers }),
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
      setSelectedAddUserRole("MEMBER");
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

  const handleToggleMemberRole = async (userId, currentRole) => {
    if (!project) return;
    const newRole = currentRole === "ADMIN" ? "MEMBER" : "ADMIN";
    try {
      const updatedMembers = (project.members ?? []).map((m) => ({
        userId: m.id,
        role: m.id === userId ? newRole : (m.projectRole ?? "MEMBER"),
      }));

      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ members: updatedMembers }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message ?? "Failed to update member role.");
      }

      addToast({
        title: "Role updated",
        message: `Updated member to ${newRole === "ADMIN" ? "Project Admin" : "Standard Member"}.`,
        variant: "success",
      });

      await loadProject();
    } catch (error) {
      addToast({
        title: "Action failed",
        message: error instanceof Error ? error.message : "Failed to update role.",
        variant: "error",
      });
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!project) return;
    if (userId === project.createdById) {
      addToast({
        title: "Cannot remove creator",
        message: "The project creator cannot be removed.",
        variant: "warning",
      });
      return;
    }
    if (!confirm("Are you sure you want to remove this member from the project?")) {
      return;
    }
    try {
      const updatedMembers = (project.members ?? [])
        .filter((m) => m.id !== userId)
        .map((m) => ({
          userId: m.id,
          role: m.projectRole ?? "MEMBER",
        }));

      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ members: updatedMembers }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message ?? "Failed to remove member.");
      }

      addToast({
        title: "Member removed",
        message: "Member removed from the project.",
        variant: "success",
      });

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
        message: error instanceof Error ? error.message : "Failed to remove member.",
        variant: "error",
      });
    }
  };

  // Milestone Form Management
  const resetMilestoneForm = () => {
    const today = getTodayInPSTDateString();
    setMilestoneForm({ title: "", startDate: today, endDate: today });
  };

  const handleMilestoneSubmit = async (event) => {
    event.preventDefault();
    if (!effectiveCanManageMilestones) {
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

  // Task Form Management
  const resetTaskForm = () => {
    revokeAllLocalObjectUrls(taskForm.attachments);
    setTaskForm({
      title: "",
      description: "",
      status: TASK_STATUSES[0]?.id ?? "BACKLOG",
      type: Object.keys(TASK_TYPE_CHECKLISTS)[0] ?? "UI",
      estimatedTime: "",
      ownerId: "",
      milestoneId: milestones[0]?.id ?? "",
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
      milestoneId: task.milestoneId ?? "",
      checklistItems: (task.checklistItems ?? []).map((item) => ({
        id: item.id,
        label: item.label,
        isCompleted: item.isCompleted,
      })),
    };
    setTaskForm(initial);
    setInitialTaskForm(initial);
    setIsTaskModalOpen(true);
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
      milestoneId: taskForm.milestoneId,
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
                  milestoneId: taskForm.milestoneId || null,
                }
              : {
                  ...payload,
                  status: taskForm.status,
                  milestoneId: taskForm.milestoneId || null,
                  projectId: projectId,
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
          : "Task added to project execution queue.",
        variant: "success",
      });

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("pms:refresh-notifications"));
      }

      resetTaskForm();
      setIsTaskModalOpen(false);
      refetchTasks();
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
                await Promise.all([loadProject(), refetchTasks()]);
              }}
              ariaLabel="Refresh project data"
            />
            {effectiveCanManageMilestones && (
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
            <div
              className={`flex items-center gap-2 ${canManageAssignments ? "cursor-pointer group" : ""}`}
              onClick={canManageAssignments ? () => setIsAddMemberModalOpen(true) : undefined}
              title={canManageAssignments ? "Click to manage team members and project roles" : undefined}
            >
              <span className="text-xs font-semibold text-[color:var(--color-text-subtle)] group-hover:text-primary transition-colors">
                Members:
              </span>
              <div className="flex items-center -space-x-1.5 overflow-hidden">
                {(project.members ?? []).map((member) => (
                  <Avatar
                    key={member.id}
                    src={member.image}
                    name={member.name}
                    alt={`${member.name} avatar`}
                    className={`h-7 w-7 border-2 text-[10px] transition-transform group-hover:scale-105 ${
                      member.projectRole === "ADMIN" ? "border-amber-400 ring-1 ring-amber-400/40" : "border-card"
                    }`}
                    fallbackClassName="text-[10px]"
                    title={member.projectRole === "ADMIN" ? `⭐ ${member.name} (Project Admin)` : `${member.name} (${member.role})`}
                  />
                ))}
                {/* Add / Manage Member Button */}
                {canManageAssignments && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsAddMemberModalOpen(true);
                    }}
                    className="ml-2 h-7 w-7 rounded-full border-dashed text-muted-foreground hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
                    title="Manage Project Members & Roles"
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
                  role={isProjectAdmin ? "PM" : role}
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
              <Button type="submit" disabled={savingTask || (Boolean(editingTaskId) && isTaskFormUnchanged)}>
                {savingTask ? "Saving..." : editingTaskId ? "Save changes" : "Create task"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </DialogRoot>

      {/* Project Team Members & Roles Management Dialog */}
      <DialogRoot
        open={isAddMemberModalOpen}
        onOpenChange={(open) => {
          if (!open && !addingMember) {
            setIsAddMemberModalOpen(false);
            setSelectedAddUserId("");
            setSelectedAddUserRole("MEMBER");
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <span>Project Team Members &amp; Roles</span>
            </DialogTitle>
            <DialogDescription>
              Manage member assignments and grant project-level admin rights.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-6">
            {/* 1. Existing Project Members List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <span>Current Members ({(project?.members ?? []).length})</span>
                <span>Role &amp; Permissions</span>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {(project?.members ?? []).map((member) => {
                  const isCreator = member.id === project?.createdById;
                  const isAdmin = member.projectRole === "ADMIN" || isCreator;
                  return (
                    <div
                      key={member.id}
                      className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                        isAdmin
                          ? "bg-amber-500/5 border-amber-500/20"
                          : "bg-muted/20 border-border/70"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar
                          src={member.image}
                          name={member.name}
                          alt=""
                          className="h-8 w-8 text-xs shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold truncate text-foreground">
                              {member.name}
                            </span>
                            {isCreator && (
                              <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                                Creator
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-muted-foreground block truncate">
                            {member.role?.replace(/_/g, " ")} &bull; {member.email}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isCreator ? (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/15 border border-amber-500/30 text-amber-400 cursor-default">
                            👑 Creator (Admin)
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleMemberRole(member.id, member.projectRole)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                              member.projectRole === "ADMIN"
                                ? "bg-amber-500/20 border-amber-500/40 text-amber-400 hover:bg-amber-500/30"
                                : "bg-muted/40 border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                            }`}
                            title="Click to toggle between Project Admin and Standard Member"
                          >
                            {member.projectRole === "ADMIN" ? "⭐ Project Admin" : "Standard Member"}
                          </button>
                        )}

                        {!isCreator && (
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(member.id)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="Remove from project"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. Add New Member Form */}
            <form onSubmit={handleAddMember} className="space-y-4 border-t border-border pt-4">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Add New Member
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="project-member" className="text-xs font-medium">
                    Team Member
                  </Label>
                  <Select
                    value={selectedAddUserId}
                    onValueChange={setSelectedAddUserId}
                  >
                    <SelectTrigger id="project-member" className="w-full text-xs">
                      <SelectValue placeholder="Choose user..." />
                    </SelectTrigger>
                    <SelectContent>
                      {nonMemberUsers.length ? (
                        nonMemberUsers.map((user) => (
                          <SelectItem
                            key={user.id}
                            value={user.id}
                          >
                            <span className="flex items-center gap-2">
                              <Avatar
                                src={user.image}
                                name={user.name}
                                className="h-5 w-5 text-[10px]"
                              />
                              <span>{user.name} ({user.role?.replace(/_/g, " ")})</span>
                            </span>
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="__none__" disabled>
                          All active users are in project
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="project-role" className="text-xs font-medium">
                    Project Role
                  </Label>
                  <Select
                    value={selectedAddUserRole}
                    onValueChange={setSelectedAddUserRole}
                  >
                    <SelectTrigger id="project-role" className="w-full text-xs">
                      <SelectValue placeholder="Role..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MEMBER">Standard Member</SelectItem>
                      <SelectItem value="ADMIN">⭐ Project Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <p className="text-[11px] text-muted-foreground">
                  ⭐ Project Admins have full access to manage milestones and tasks in this project.
                </p>
                <Button
                  type="submit"
                  disabled={addingMember || !selectedAddUserId}
                  className="shrink-0"
                >
                  {addingMember ? "Adding..." : "Add Member"}
                </Button>
              </div>
            </form>
          </div>

          <DialogFooter className="mt-4 border-t border-border pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsAddMemberModalOpen(false);
                setSelectedAddUserId("");
                setSelectedAddUserRole("MEMBER");
              }}
            >
              Done
            </Button>
          </DialogFooter>
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
