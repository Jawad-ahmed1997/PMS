"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import TaskBoard from "@/components/tasks/TaskBoard";
import PageHeader from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import ScrollArea from "@/components/ui/ScrollArea";
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

function FilterPopover({ icon: Icon, label, value, options, onSelect }) {
  const [open, setOpen] = useState(false);
  const selectedOption = options.find((option) => option.value === value);
  const displayLabel = selectedOption?.label ?? label;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 min-w-[9.25rem] justify-between rounded-xl bg-background px-3 text-xs font-semibold"
        >
          <span className="flex min-w-0 items-center gap-2">
            <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="truncate">{displayLabel}</span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(20rem,calc(100vw-2rem))] p-0">
        <Command>
          <CommandInput placeholder={`Search ${label.toLowerCase()}...`} />
          <CommandEmpty>No matches found.</CommandEmpty>
          <ScrollArea className="h-52">
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value || "all"}
                  value={option.label}
                  onSelect={() => {
                    onSelect(option.value);
                    setOpen(false);
                  }}
                  className={option.value === value ? "bg-muted font-semibold" : ""}
                >
                  <span className="flex-1">{option.label}</span>
                  {option.value === value ? <span className="text-primary">✓</span> : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </ScrollArea>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

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
              <ToggleGroup
                type="single"
                value={scope}
                onValueChange={(value) => value && setScope(value)}
                className="shrink-0 rounded-xl border border-border bg-background p-0.5"
                aria-label="Task scope"
              >
                <ToggleGroupItem value="all" className="h-8 rounded-lg border-0 px-3 text-[11px] font-bold">All Tasks</ToggleGroupItem>
                <ToggleGroupItem value="mine" className="h-8 rounded-lg border-0 px-3 text-[11px] font-bold">My Tasks</ToggleGroupItem>
              </ToggleGroup>
            )}

            {/* Project Select */}
            <FilterPopover
              icon={Briefcase}
              label="All Projects"
              value={selectedProjectId}
              onSelect={handleProjectChange}
              options={[{ value: "", label: "All Projects" }, ...projectsList.map((proj) => ({ value: proj.id, label: proj.name }))]}
            />

            {/* Milestone Select */}
            <FilterPopover
              icon={Calendar}
              label="All Milestones"
              value={selectedMilestoneId}
              onSelect={setSelectedMilestoneId}
              options={[{ value: "", label: "All Milestones" }, ...milestonesList.map((milestone) => ({ value: milestone.id, label: milestone.title }))]}
            />

            {/* Assignee / Owner Select */}
            {isManager && scope === "all" && (
              <FilterPopover
                icon={User}
                label="All Assignees"
                value={selectedOwnerId}
                onSelect={setSelectedOwnerId}
                options={[{ value: "", label: "All Assignees" }, ...assigneesList.map((owner) => ({ value: owner.id, label: owner.name }))]}
              />
            )}

            {/* Status Select */}
            <FilterPopover
              icon={Clock}
              label="All Statuses"
              value={selectedStatus}
              onSelect={setSelectedStatus}
              options={[{ value: "", label: "All Statuses" }, ...STATUS_OPTIONS.map((statusOpt) => ({ value: statusOpt.id, label: statusOpt.label }))]}
            />

            {/* Reset Filters */}
            {hasActiveFilters && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="h-9 shrink-0 px-2.5 text-xs font-bold text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                Reset
              </Button>
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
          <Button type="button" variant="secondary" onClick={loadTasks}>Retry</Button>
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
