"use client";

import { useEffect, useState } from "react";

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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import Avatar from "@/components/ui/Avatar";

const buildErrorMessage = (data) =>
  data?.error ?? data?.message ?? "Unable to save project.";

export default function ProjectDialog({
  isOpen,
  mode,
  initialValues,
  onClose,
  onSuccess,
}) {
  const { addToast } = useToast();
  const [formValues, setFormValues] = useState({
    name: "",
    description: "",
    memberIds: [],
    adminIds: [],
  });
  const [isSaving, setIsSaving] = useState(false);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (!isOpen) return;
    setFormValues({
      name: initialValues?.name ?? "",
      description: initialValues?.description ?? "",
      memberIds: (initialValues?.members ?? []).map((member) => member.id),
      adminIds: (initialValues?.members ?? [])
        .filter((member) => member.projectRole === "ADMIN")
        .map((member) => member.id),
    });
  }, [isOpen, initialValues]);

  useEffect(() => {
    if (!isOpen) return;
    const loadUsers = async () => {
      try {
        const response = await fetch("/api/users?isActive=true");
        const data = await response.json();
        if (response.ok) {
          setUsers(data?.users ?? []);
        }
      } catch (error) {
        setUsers([]);
      }
    };
    loadUsers();
  }, [isOpen]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!formValues.name.trim()) {
      addToast({
        title: "Project name needed",
        message: "Add a project name to continue.",
        variant: "warning",
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(
        mode === "edit" ? `/api/projects/${initialValues?.id}` : "/api/projects",
        {
          method: mode === "edit" ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formValues.name,
            description: formValues.description,
            memberIds: formValues.memberIds,
            adminIds: formValues.adminIds,
          }),
        }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(buildErrorMessage(data));
      }

      addToast({
        title: mode === "edit" ? "Project updated" : "Project created",
        message:
          mode === "edit"
            ? "Project details are synced."
            : "New project added to the portfolio.",
        variant: "success",
      });
      onSuccess?.(data.project);
      onClose?.();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save project.";
      addToast({
        title: "Project update failed",
        message,
        variant: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleMember = (userId) => {
    setFormValues((prev) => {
      const next = new Set(prev.memberIds);
      const nextAdmins = new Set(prev.adminIds);
      if (next.has(userId)) {
        next.delete(userId);
        nextAdmins.delete(userId);
      } else {
        next.add(userId);
      }
      return { 
        ...prev, 
        memberIds: Array.from(next),
        adminIds: Array.from(nextAdmins)
      };
    });
  };

  const toggleAdmin = (userId, event) => {
    event.stopPropagation();
    setFormValues((prev) => {
      const nextAdmins = new Set(prev.adminIds);
      if (nextAdmins.has(userId)) {
        nextAdmins.delete(userId);
      } else {
        nextAdmins.add(userId);
      }
      return { ...prev, adminIds: Array.from(nextAdmins) };
    });
  };

  return (
    <DialogRoot open={isOpen} onOpenChange={(open) => !open && !isSaving && onClose?.()}>
      <DialogContent className="max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Edit project" : "Create project"}</DialogTitle>
          <DialogDescription>Capture initiative goals and project summaries.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="mt-6 flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-5 overflow-y-auto pr-2 pb-4 hide-scrollbar">
          <label className="grid gap-2 text-xs text-[color:var(--color-text-muted)]">
            Project name
            <Input
              className="w-full text-sm"
              value={formValues.name}
              placeholder="e.g. Phoenix Redesign"
              onChange={(event) =>
                setFormValues((prev) => ({
                  ...prev,
                  name: event.target.value,
                }))
              }
            />
          </label>
          <label className="grid gap-2 text-xs text-[color:var(--color-text-muted)]">
            Description
            <Textarea
              rows={4}
              className="min-h-24 resize-none text-sm"
              value={formValues.description}
              placeholder="Brief summary of the project goals..."
              onChange={(event) =>
                setFormValues((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))
              }
            />
          </label>
          <div className="space-y-3 text-xs text-[color:var(--color-text-muted)]">
            <p>Team Members</p>
            <div className="grid max-h-56 gap-1.5 overflow-y-auto rounded-xl border border-border/70 bg-muted/20 p-2 hide-scrollbar">
              {users.length ? (
                users.map((user) => {
                  const isSelected = formValues.memberIds.includes(user.id);
                  return (
                    <div
                      key={user.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleMember(user.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleMember(user.id);
                        }
                      }}
                      className={`flex cursor-pointer items-center justify-between rounded-lg p-3 transition-colors duration-200 ${
                        isSelected
                          ? "bg-primary/10 ring-1 ring-primary/30"
                          : "hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar name={user.name} size="md" />
                        <div className="flex flex-col">
                          <span className={`font-semibold ${isSelected ? "text-[color:var(--color-text)]" : "text-[color:var(--color-text)]"}`}>
                            {user.name}
                          </span>
                          <span className="text-[10px] text-[color:var(--color-text-subtle)]">
                            {user.role}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isSelected && (
                          <button
                            type="button"
                            onClick={(event) => {
                              if (user.id === initialValues?.createdById) return;
                              toggleAdmin(user.id, event);
                            }}
                            disabled={user.id === initialValues?.createdById}
                            className={`px-2 py-0.5 rounded text-[9.5px] font-bold uppercase tracking-wider border transition-colors ${
                              (user.id === initialValues?.createdById || formValues.adminIds.includes(user.id))
                                ? "bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20"
                                : "bg-muted/40 border-border text-[color:var(--color-text-subtle)] hover:bg-muted"
                            }`}
                            title={
                              user.id === initialValues?.createdById
                                ? "Project Creator (Always Admin)"
                                : "Click to toggle admin rights"
                            }
                          >
                            {(user.id === initialValues?.createdById || formValues.adminIds.includes(user.id)) ? "⭐ Admin" : "Member"}
                          </button>
                        )}
                        <Checkbox checked={isSelected} onCheckedChange={() => toggleMember(user.id)} onClick={(event) => event.stopPropagation()} aria-label={`Select ${user.name}`} />
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="p-4 text-center text-sm text-[color:var(--color-text-subtle)]">
                  No active users available.
                </p>
              )}
            </div>
          </div>
        </div>
          <DialogFooter className="mt-4 flex-row flex-wrap justify-end gap-3 border-t border-border bg-card pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSaving}
          >Cancel</Button>
          <Button type="submit" variant="default" disabled={isSaving}>
            {isSaving ? "Saving..." : "Save project"}
          </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </DialogRoot>
  );
}
