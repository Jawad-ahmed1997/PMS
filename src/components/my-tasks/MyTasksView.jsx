"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import TaskBoard from "@/components/tasks/TaskBoard";
import PageHeader from "@/components/layout/PageHeader";
import ActionButton from "@/components/ui/ActionButton";
import { useToast } from "@/components/ui/ToastProvider";
import { normalizeRoleId } from "@/lib/roles";
import { Filter, Briefcase, Calendar, ChevronDown, User, Clock } from "lucide-react";

const buildErrorMessage = (data) =>
  data?.error ?? data?.message ?? "Unable to load tasks.";

const STATUS_OPTIONS = [
  { id: "BACKLOG", label: "Backlog" },
  { id: "READY", label: "Ready" },
  { id: "IN_PROGRESS", label: "In Progress" },
  { id: "ON_HOLD", label: "On Hold" },
  { id: "DONE", label: "Done" },
];

export default function MyTasksView({ role, currentUserId }) {
  const { addToast } = useToast();
  const [tasks, setTasks] = useState([]);
  const [status, setStatus] = useState({ loading: true, error: null });

  const isManager = ["ceo", "pm", "cto"].includes(normalizeRoleId(role));

  // Filter State
  const [scope, setScope] = useState(isManager ? "all" : "mine"); // all, mine
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedMilestoneId, setSelectedMilestoneId] = useState("");
  const [selectedOwnerId, setSelectedOwnerId] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");

  const loadTasks = useCallback(async () => {
    setStatus({ loading: true, error: null });
    try {
      // Always fetch all tasks if manager so they can filter locally, otherwise fetch assigned to them
      const url = isManager ? `/api/tasks?allTasks=true` : `/api/tasks?assignedToMe=true`;
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(buildErrorMessage(data));
      }

      setTasks(data?.tasks ?? []);
      setStatus({ loading: false, error: null });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load tasks.";
      setStatus({ loading: false, error: message });
      addToast({
        title: "Tasks unavailable",
        message,
        variant: "error",
      });
    }
  }, [addToast, isManager]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Derived Projects List
  const projectsList = useMemo(() => {
    const projectsMap = new Map();
    tasks.forEach((task) => {
      const proj = task.milestone?.project;
      if (proj?.id && proj?.name) {
        projectsMap.set(proj.id, proj);
      }
    });
    return Array.from(projectsMap.values());
  }, [tasks]);

  // Derived Milestones List (filtered by selected project if applicable)
  const milestonesList = useMemo(() => {
    const milestonesMap = new Map();
    tasks.forEach((task) => {
      const milestone = task.milestone;
      if (milestone?.id && milestone?.title) {
        if (!selectedProjectId || milestone.projectId === selectedProjectId) {
          milestonesMap.set(milestone.id, milestone);
        }
      }
    });
    return Array.from(milestonesMap.values());
  }, [tasks, selectedProjectId]);

  // Derived Assignees List
  const assigneesList = useMemo(() => {
    const assigneesMap = new Map();
    tasks.forEach((task) => {
      const owner = task.owner;
      if (owner?.id && owner?.name) {
        assigneesMap.set(owner.id, owner);
      }
    });
    return Array.from(assigneesMap.values());
  }, [tasks]);

  // Handle Project Filter Change
  const handleProjectChange = (projectId) => {
    setSelectedProjectId(projectId);
    setSelectedMilestoneId(""); // Reset milestone filter on project switch
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSelectedProjectId("");
    setSelectedMilestoneId("");
    setSelectedOwnerId("");
    setSelectedStatus("");
    setScope(isManager ? "all" : "mine");
  };

  // Filtered Tasks List
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesScope = scope === "all" ? true : task.ownerId === currentUserId;
      const matchesProject =
        !selectedProjectId || task.milestone?.project?.id === selectedProjectId;
      const matchesMilestone =
        !selectedMilestoneId || task.milestone?.id === selectedMilestoneId;
      const matchesOwner =
        !selectedOwnerId || task.ownerId === selectedOwnerId;
      const matchesStatus =
        !selectedStatus || task.status === selectedStatus;

      return matchesScope && matchesProject && matchesMilestone && matchesOwner && matchesStatus;
    });
  }, [tasks, scope, currentUserId, selectedProjectId, selectedMilestoneId, selectedOwnerId, selectedStatus]);

  const hasActiveFilters =
    selectedProjectId ||
    selectedMilestoneId ||
    selectedOwnerId ||
    selectedStatus ||
    (isManager && scope === "mine");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={isManager ? "Management workspace" : "Personal workspace"}
        title={isManager ? "All Active Tasks" : "My Tasks"}
        subtitle={isManager ? "Oversee all active tasks and execution across all milestones." : "Focus execution on your assigned items across all milestones."}
      />

      {/* Premium Integrated Filters Bar */}
      {!status.loading && !status.error && tasks.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 bg-[color:var(--color-card)] border border-[color:var(--color-border)] px-4 py-3 rounded-2xl shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            {/* Filter Indicator Icon */}
            <div className="flex items-center gap-2 text-xs font-bold text-[color:var(--color-text-subtle)] mr-1 shrink-0">
              <Filter className="h-4 w-4 text-[color:var(--color-accent)]" />
              <span>Filters</span>
            </div>

            {/* Scope Toggle Button Group (Only for managers) */}
            {isManager && (
              <div className="flex border border-[color:var(--color-border)] rounded-xl overflow-hidden bg-[color:var(--color-input)] p-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setScope("all")}
                  className={`px-3 py-1 rounded-lg text-[11px] font-bold transition ${
                    scope === "all"
                      ? "bg-[color:var(--color-card)] text-[color:var(--color-text)] shadow-sm"
                      : "text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]"
                  }`}
                >
                  All Tasks
                </button>
                <button
                  type="button"
                  onClick={() => setScope("mine")}
                  className={`px-3 py-1 rounded-lg text-[11px] font-bold transition ${
                    scope === "mine"
                      ? "bg-[color:var(--color-card)] text-[color:var(--color-text)] shadow-sm"
                      : "text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]"
                  }`}
                >
                  My Tasks
                </button>
              </div>
            )}

            {/* Project Select */}
            <div className="relative shrink-0">
              <select
                value={selectedProjectId}
                onChange={(e) => handleProjectChange(e.target.value)}
                className="appearance-none pl-8 pr-8 py-1.5 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] text-xs text-[color:var(--color-text)] font-semibold focus:outline-none focus:ring-1 focus:ring-[color:var(--color-accent)] cursor-pointer hover:border-[color:var(--color-accent)] transition"
              >
                <option value="">All Projects</option>
                {projectsList.map((proj) => (
                  <option key={proj.id} value={proj.id}>
                    {proj.name}
                  </option>
                ))}
              </select>
              <Briefcase className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[color:var(--color-text-muted)] pointer-events-none" />
              <ChevronDown className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-[color:var(--color-text-muted)] pointer-events-none" />
            </div>

            {/* Milestone Select */}
            <div className="relative shrink-0">
              <select
                value={selectedMilestoneId}
                onChange={(e) => setSelectedMilestoneId(e.target.value)}
                className="appearance-none pl-8 pr-8 py-1.5 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] text-xs text-[color:var(--color-text)] font-semibold focus:outline-none focus:ring-1 focus:ring-[color:var(--color-accent)] cursor-pointer hover:border-[color:var(--color-accent)] transition"
              >
                <option value="">All Milestones</option>
                {milestonesList.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
              <Calendar className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[color:var(--color-text-muted)] pointer-events-none" />
              <ChevronDown className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-[color:var(--color-text-muted)] pointer-events-none" />
            </div>

            {/* Assignee / Owner Select */}
            {isManager && scope === "all" && (
              <div className="relative shrink-0">
                <select
                  value={selectedOwnerId}
                  onChange={(e) => setSelectedOwnerId(e.target.value)}
                  className="appearance-none pl-8 pr-8 py-1.5 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] text-xs text-[color:var(--color-text)] font-semibold focus:outline-none focus:ring-1 focus:ring-[color:var(--color-accent)] cursor-pointer hover:border-[color:var(--color-accent)] transition"
                >
                  <option value="">All Assignees</option>
                  {assigneesList.map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {owner.name}
                    </option>
                  ))}
                </select>
                <User className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[color:var(--color-text-muted)] pointer-events-none" />
                <ChevronDown className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-[color:var(--color-text-muted)] pointer-events-none" />
              </div>
            )}

            {/* Status Select */}
            <div className="relative shrink-0">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="appearance-none pl-8 pr-8 py-1.5 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] text-xs text-[color:var(--color-text)] font-semibold focus:outline-none focus:ring-1 focus:ring-[color:var(--color-accent)] cursor-pointer hover:border-[color:var(--color-accent)] transition"
              >
                <option value="">All Statuses</option>
                {STATUS_OPTIONS.map((statusOpt) => (
                  <option key={statusOpt.id} value={statusOpt.id}>
                    {statusOpt.label}
                  </option>
                ))}
              </select>
              <Clock className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[color:var(--color-text-muted)] pointer-events-none" />
              <ChevronDown className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-[color:var(--color-text-muted)] pointer-events-none" />
            </div>

            {/* Reset Filters */}
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="text-xs font-bold text-rose-400 hover:text-rose-300 transition px-2.5 py-1 rounded-xl hover:bg-rose-500/10 shrink-0"
              >
                Reset
              </button>
            )}
          </div>

          {/* Task Count Badge */}
          <div className="text-xs text-[color:var(--color-text-muted)] font-semibold bg-[color:var(--color-input)] px-3 py-1 rounded-xl border border-[color:var(--color-border)] shrink-0">
            Showing <span className="text-[color:var(--color-text)] font-bold">{filteredTasks.length}</span> of {tasks.length} tasks
          </div>
        </div>
      )}

      {status.loading && (
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-6 text-sm text-[color:var(--color-text-muted)] animate-pulse">
          Loading tasks...
        </div>
      )}

      {!status.loading && status.error && (
        <div className="space-y-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-200">
          <p>{status.error}</p>
          <ActionButton label="Retry" variant="secondary" onClick={loadTasks} />
        </div>
      )}

      {!status.loading && !status.error && (
        <div>
          {filteredTasks.length ? (
            <TaskBoard
              tasks={filteredTasks}
              role={role}
              currentUserId={currentUserId}
              hideFilterButton={true}
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-card)] p-8 text-center text-sm text-[color:var(--color-text-muted)] animate-fade-in">
              {tasks.length > 0 
                ? "No tasks match the selected filters." 
                : isManager 
                  ? "No tasks currently exist in the system." 
                  : "No tasks currently assigned to you. Enjoy your clean board!"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
