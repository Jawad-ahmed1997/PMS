"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/ToastProvider";
import ProjectDialog from "@/components/projects/ProjectModal";
import PageHeader from "@/components/layout/PageHeader";
import ViewToggle from "@/components/ui/ViewToggle";
import { Table } from "@/components/ui/table";
import Avatar from "@/components/ui/Avatar";
import useOutsideClick from "@/hooks/useOutsideClick";

const VIEW_PREFERENCE_KEY = "pms.projects.view";

const buildErrorMessage = (data) =>
  data?.error ?? data?.message ?? "Unable to load project data.";

const normalizeProject = (project) => ({
  id: project.id,
  name: project.name,
  description: project.description ?? "",
  status: project.status ?? "Active",
  members: project.members ?? [],
});

const ProjectMembers = ({ members }) => {
  const visibleMembers = members.slice(0, 3);
  const extraCount = Math.max(0, members.length - visibleMembers.length);

  if (!members.length) {
    return (
      <span className="text-xs text-[color:var(--color-text-subtle)]">
        No members yet
      </span>
    );
  }

  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {visibleMembers.map((member) => (
          <div key={member.id} className="relative rounded-full ring-2 ring-[color:var(--color-card)]" title={member.name}>
            <Avatar 
              name={member.name} 
              size="sm"
            />
          </div>
        ))}
        {extraCount > 0 ? (
          <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--color-surface-muted)] ring-2 ring-[color:var(--color-card)] text-[10px] font-semibold text-[color:var(--color-text-subtle)]">
            +{extraCount}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default function ProjectListView({ canManageProjects }) {
  const { addToast } = useToast();
  const router = useRouter();
  const [projects, setProjects] = useState([]);
  const [status, setStatus] = useState({ loading: true, error: null });
  const [viewMode, setViewMode] = useState("grid");
  const [modalState, setDialogState] = useState({
    open: false,
    mode: "create",
    project: null,
  });

  const loadProjects = useCallback(async () => {
    setStatus({ loading: true, error: null });
    try {
      const response = await fetch("/api/projects");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(buildErrorMessage(data));
      }

      const normalized = (data?.projects ?? []).map((project) =>
        normalizeProject(project)
      );
      setProjects(normalized);
      setStatus({ loading: false, error: null });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load project data.";
      setStatus({ loading: false, error: message });
      addToast({
        title: "Projects unavailable",
        message,
        variant: "error",
      });
    }
  }, [addToast]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    const stored =
      typeof window !== "undefined"
        ? window.localStorage.getItem(VIEW_PREFERENCE_KEY)
        : null;
    if (stored === "grid" || stored === "list") {
      setViewMode(stored);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(VIEW_PREFERENCE_KEY, viewMode);
  }, [viewMode]);

  const openCreateDialog = () => {
    setDialogState({ open: true, mode: "create", project: null });
  };

  const openEditDialog = (project) => {
    setDialogState({ open: true, mode: "edit", project });
  };

  const closeDialog = () => {
    setDialogState({ open: false, mode: "create", project: null });
  };

  const ProjectActionMenu = ({ project }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef(null);

    useOutsideClick(menuRef, () => setIsOpen(false), isOpen);

    const handleView = () => {
      setIsOpen(false);
      router.push(`/projects/${project.id}`);
    };

    const handleEdit = () => {
      setIsOpen(false);
      openEditDialog(project);
    };

    return (
      <div className="relative" ref={menuRef}>
        <Button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setIsOpen((prev) => !prev);
          }}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--color-border)] text-[color:var(--color-text-muted)] transition hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-text)]"
          aria-label="Project actions"
          title="Project actions"
          aria-expanded={isOpen}
          aria-haspopup="menu"
        >
          <span className="text-lg leading-none">⋮</span>
        </Button>
        {isOpen ? (
          <div
            className="absolute right-0 z-10 mt-2 w-40 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-2 text-xs text-[color:var(--color-text)] shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <Button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleView();
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[color:var(--color-text)] hover:bg-[color:var(--color-muted-bg)]"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path
                  d="M1.5 12s4.5-7 10.5-7 10.5 7 10.5 7-4.5 7-10.5 7-10.5-7-10.5-7Z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <span>View</span>
            </Button>
            {canManageProjects ? (
              <Button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  handleEdit();
                }}
                className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[color:var(--color-text)] hover:bg-[color:var(--color-muted-bg)]"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path
                    d="M4 20h4l10-10-4-4L4 16v4Z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M13 7l4 4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>Edit</span>
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Projects"
        title="Portfolio overview"
        subtitle="Track active initiatives across the organization."
        actions={
          canManageProjects ? (
            <Button
              label="Create project"
              variant="success"
              onClick={openCreateDialog}
            />
          ) : null
        }
        viewToggle={
          <ViewToggle value={viewMode} onChange={setViewMode} />
        }
      />

      {status.loading && (
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-6 text-sm text-[color:var(--color-text-muted)]">
          Loading projects...
        </div>
      )}
      {!status.loading && status.error && (
        <div className="space-y-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-200">
          <p>{status.error}</p>
          <Button label="Retry" variant="secondary" onClick={loadProjects} />
        </div>
      )}
      {!status.loading && !status.error && !projects.length && (
        <div className="rounded-2xl border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-card)] p-6 text-sm text-[color:var(--color-text-muted)]">
          No projects yet. Create one to begin planning milestones.
        </div>
      )}

      {!status.loading && !status.error && projects.length ? (
        viewMode === "grid" ? (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((project, index) => {
              const isActive = project.status === "Active";
              const isArchived = project.status === "Archived";
              const borderClass = isActive
                ? "group-hover:border-emerald-500/50 group-hover:shadow-[0_8px_30px_-12px_rgba(16,185,129,0.5)]"
                : isArchived
                  ? "group-hover:border-gray-500/50 group-hover:shadow-[0_8px_30px_-12px_rgba(107,114,128,0.5)]"
                  : "group-hover:border-primary/50 group-hover:shadow-lg";

              const badgeClass = isActive
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-transparent"
                : isArchived
                  ? "bg-gray-500/15 text-gray-500 border-transparent"
                  : "bg-[color:var(--color-muted-bg)] text-[color:var(--color-text-muted)] border-[color:var(--color-border)]";

              return (
                <div
                  key={project.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push(`/projects/${project.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      router.push(`/projects/${project.id}`);
                    }
                  }}
                  style={{ animationDelay: `${index * 50}ms` }}
                  className={`group relative flex cursor-pointer flex-col justify-between overflow-hidden rounded-2xl border border-[color:var(--color-border)]/60 bg-[color:var(--color-card)] p-6 transition-all duration-300 hover:-translate-y-1 animate-in fade-in slide-in-from-bottom-4 fill-mode-both ${borderClass}`}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  
                  <div className="relative z-10 flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-lg font-bold tracking-tight text-[color:var(--color-text)] transition-colors group-hover:text-[color:var(--color-accent)]">
                        {project.name}
                      </h3>
                      <p className="mt-2 line-clamp-2 text-sm text-[color:var(--color-text-muted)] leading-relaxed">
                        {project.description || "No description provided."}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${badgeClass}`}>
                      {project.status}
                    </span>
                  </div>
                  
                  <div className="relative z-10 mt-6 flex items-center justify-between border-t border-[color:var(--color-border)]/50 pt-4">
                    <div className="flex items-center gap-3">
                      <ProjectMembers members={project.members} />
                    </div>
                    <ProjectActionMenu project={project} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)]">
            <Table className="w-full text-left text-sm">
              <thead className="bg-[color:var(--color-surface-muted)] text-xs uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
                <tr>
                  <th className="px-4 py-3">Project</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Members</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project, index) => {
                  const isActive = project.status === "Active";
                  const badgeClass = isActive
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-transparent"
                    : "bg-[color:var(--color-muted-bg)] text-[color:var(--color-text-muted)] border-[color:var(--color-border)]";

                  return (
                    <tr
                      key={project.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => router.push(`/projects/${project.id}`)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          router.push(`/projects/${project.id}`);
                        }
                      }}
                      style={{ animationDelay: `${index * 30}ms` }}
                      className="group animate-in fade-in slide-in-from-bottom-2 fill-mode-both border-t border-[color:var(--color-border)]/50 text-sm transition-all hover:bg-[color:var(--color-surface-muted)] cursor-pointer"
                    >
                      <td className="px-4 py-4 text-[color:var(--color-text)]">
                        <p className="font-bold tracking-tight group-hover:text-[color:var(--color-accent)] transition-colors">{project.name}</p>
                      </td>
                      <td className="px-4 py-4 text-[color:var(--color-text-muted)] max-w-xs truncate">
                        {project.description || "No description provided."}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${badgeClass}`}>
                          {project.status}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <ProjectMembers members={project.members} />
                      </td>
                      <td className="px-4 py-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                        <ProjectActionMenu project={project} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        )
      ) : null}

      <ProjectDialog
        isOpen={modalState.open}
        mode={modalState.mode}
        initialValues={modalState.project}
        onClose={closeDialog}
        onSuccess={loadProjects}
      />
    </div>
  );
}
