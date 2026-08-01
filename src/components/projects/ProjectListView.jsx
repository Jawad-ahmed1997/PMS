"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, MoreHorizontal, Pencil, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { useToast } from "@/components/ui/ToastProvider";
import ProjectDialog from "@/components/projects/ProjectModal";
import PageHeader from "@/components/layout/PageHeader";
import ViewToggle from "@/components/ui/ViewToggle";
import { Table } from "@/components/ui/table";
import Avatar from "@/components/ui/Avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const VIEW_PREFERENCE_KEY = "pms.projects.view";
const buildErrorMessage = (data) => data?.error ?? data?.message ?? "Unable to load project data.";
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
  const remainingMembers = members.slice(visibleMembers.length);
  if (!members.length) return <span className="text-xs text-muted-foreground">No members yet</span>;
  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex items-center">
        <div className="flex items-center -space-x-2">
        {visibleMembers.map((member) => (
          <div key={member.id} className="relative rounded-full ring-2 ring-card transition-transform duration-200 hover:z-10 hover:-translate-y-0.5" title={member.name}>
            <Avatar src={member.image} name={member.name} alt={`${member.name} avatar`} className="h-8 w-8 text-xs" />
          </div>
        ))}
        {extraCount > 0 ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="relative z-[1] ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-border bg-secondary text-[11px] font-semibold text-secondary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Show ${extraCount} more project member${extraCount === 1 ? "" : "s"}`}>
                +{extraCount}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" align="start" className="max-w-64 whitespace-normal p-3">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Additional members</p>
              <div className="grid gap-1">
                {remainingMembers.map((member) => <span key={member.id}>{member.name}</span>)}
              </div>
            </TooltipContent>
          </Tooltip>
        ) : null}
        </div>
      </div>
    </TooltipProvider>
  );
};

export default function ProjectListView({ canManageProjects }) {
  const { addToast } = useToast();
  const router = useRouter();
  const [projects, setProjects] = useState([]);
  const [status, setStatus] = useState({ loading: true, error: null });
  const [viewMode, setViewMode] = useState("grid");
  const [modalState, setDialogState] = useState({ open: false, mode: "create", project: null });

  const loadProjects = useCallback(async () => {
    setStatus({ loading: true, error: null });
    try {
      const response = await fetch("/api/projects");
      const data = await response.json();
      if (!response.ok) throw new Error(buildErrorMessage(data));
      setProjects((data?.projects ?? []).map(normalizeProject));
      setStatus({ loading: false, error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load project data.";
      setStatus({ loading: false, error: message });
      addToast({ title: "Projects unavailable", message, variant: "error" });
    }
  }, [addToast]);

  useEffect(() => { loadProjects(); }, [loadProjects]);
  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(VIEW_PREFERENCE_KEY) : null;
    if (stored === "grid" || stored === "list") setViewMode(stored);
  }, []);
  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(VIEW_PREFERENCE_KEY, viewMode);
  }, [viewMode]);

  const openCreateDialog = () => setDialogState({ open: true, mode: "create", project: null });
  const openEditDialog = (project) => setDialogState({ open: true, mode: "edit", project });
  const closeDialog = () => setDialogState({ open: false, mode: "create", project: null });

  const ProjectActionMenu = ({ project }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon" onClick={(event) => event.stopPropagation()} className="h-8 w-8 text-muted-foreground" aria-label="Project actions" title="Project actions">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40" onClick={(event) => event.stopPropagation()}>
        <DropdownMenuItem onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()} onSelect={(event) => { event.stopPropagation(); router.push(`/projects/${project.id}`); }}><Eye className="mr-2 h-4 w-4" />View</DropdownMenuItem>
        {canManageProjects ? <DropdownMenuItem onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()} onSelect={(event) => { event.stopPropagation(); openEditDialog(project); }}><Pencil className="mr-2 h-4 w-4" />Edit</DropdownMenuItem> : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const statusBadge = (project) => <Badge variant={project.status === "Active" ? "secondary" : "outline"} className="text-[10px] uppercase tracking-wider">{project.status}</Badge>;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Projects"
        title="Portfolio overview"
        subtitle="Track active initiatives across the organization."
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={loadProjects}
              className="inline-flex items-center gap-1.5 rounded-xl border-[color:var(--color-border)] bg-[color:var(--color-input)] text-[color:var(--color-text-subtle)] hover:text-white transition-colors"
              title="Refresh project list"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Refresh</span>
            </Button>
            {canManageProjects && (
              <Button onClick={openCreateDialog}>Create project</Button>
            )}
          </div>
        }
        viewToggle={<ViewToggle value={viewMode} onChange={setViewMode} />}
      />

      {status.loading && <div className="rounded-xl border border-border/70 bg-card p-6 text-sm text-muted-foreground">Loading projects...</div>}
      {!status.loading && status.error && <div className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-sm text-destructive"><p>{status.error}</p><Button variant="secondary" onClick={loadProjects}>Retry</Button></div>}
      {!status.loading && !status.error && !projects.length && <div className="rounded-xl border border-dashed border-border bg-card p-8 text-sm text-muted-foreground">No projects yet. Create one to begin planning milestones.</div>}

      {!status.loading && !status.error && projects.length ? viewMode === "grid" ? (
        <div className="grid auto-rows-fr gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {projects.map((project, index) => (
            <div key={project.id} role="button" tabIndex={0} onClick={() => router.push(`/projects/${project.id}`)} onKeyDown={(event) => { if (event.key === "Enter") router.push(`/projects/${project.id}`); }} style={{ animationDelay: `${index * 50}ms` }} className="group flex h-full cursor-pointer flex-col justify-between overflow-hidden rounded-xl border border-border/70 bg-card p-5 transition-colors duration-200 ease-out hover:border-foreground/25 hover:bg-muted/20 animate-in fade-in slide-in-from-bottom-4 fill-mode-both">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1"><h3 className="truncate text-base font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary">{project.name}</h3><p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{project.description || "No description provided."}</p></div>
                <div className="shrink-0">{statusBadge(project)}</div>
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-4"><ProjectMembers members={project.members} /><ProjectActionMenu project={project} /></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
          <Table className="w-full text-left text-sm"><thead className="bg-muted/50 text-xs uppercase tracking-[0.16em] text-muted-foreground"><tr><th className="px-4 py-3">Project</th><th className="px-4 py-3">Description</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Members</th><th className="px-4 py-3 text-right">Actions</th></tr></thead><tbody>
            {projects.map((project, index) => <tr key={project.id} role="button" tabIndex={0} onClick={() => router.push(`/projects/${project.id}`)} onKeyDown={(event) => { if (event.key === "Enter") router.push(`/projects/${project.id}`); }} style={{ animationDelay: `${index * 30}ms` }} className="group cursor-pointer animate-in fade-in slide-in-from-bottom-2 fill-mode-both border-t border-border/60 text-sm transition-colors duration-200 hover:bg-muted/40"><td className="px-4 py-4"><p className="font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary">{project.name}</p></td><td className="max-w-xs truncate px-4 py-4 text-muted-foreground">{project.description || "No description provided."}</td><td className="px-4 py-4">{statusBadge(project)}</td><td className="px-4 py-4"><ProjectMembers members={project.members} /></td><td className="px-4 py-4 text-right"><ProjectActionMenu project={project} /></td></tr>)}
          </tbody></Table>
        </div>
      ) : null}

      <ProjectDialog isOpen={modalState.open} mode={modalState.mode} initialValues={modalState.project} onClose={closeDialog} onSuccess={loadProjects} />
    </div>
  );
}
