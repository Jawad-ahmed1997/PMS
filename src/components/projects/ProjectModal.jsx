"use client";

import { useEffect, useState } from "react";

import Modal from "@/components/ui/Modal";
import ActionButton from "@/components/ui/ActionButton";
import { useToast } from "@/components/ui/ToastProvider";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  });
  const [isSaving, setIsSaving] = useState(false);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (!isOpen) return;
    setFormValues({
      name: initialValues?.name ?? "",
      description: initialValues?.description ?? "",
      memberIds: (initialValues?.members ?? []).map((member) => member.id),
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
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return { ...prev, memberIds: Array.from(next) };
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      title={mode === "edit" ? "Edit project" : "Create project"}
      description="Capture initiative goals and project summaries."
      onClose={isSaving ? undefined : onClose}
    >
      <form onSubmit={handleSubmit} className="flex h-full flex-col">
        <div className="flex-1 space-y-5 overflow-y-auto pr-2 pb-4 hide-scrollbar">
          <label className="grid gap-2 text-xs text-[color:var(--color-text-muted)]">
            Project name
            <Input
              className="w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-4 py-2.5 text-sm font-medium text-[color:var(--color-text)] transition-colors focus:border-[color:var(--color-accent)]"
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
              className="w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-4 py-3 text-sm text-[color:var(--color-text)] transition-colors focus:border-[color:var(--color-accent)] resize-none"
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
            <div className="grid max-h-56 gap-2 overflow-y-auto rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] p-3 shadow-inner hide-scrollbar">
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
                      className={`flex cursor-pointer items-center justify-between rounded-xl p-3 transition-all ${
                        isSelected
                          ? "bg-[color:var(--color-accent)]/10 ring-1 ring-[color:var(--color-accent)]"
                          : "hover:bg-[color:var(--color-surface-muted)]"
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
                      
                      <div className={`flex h-5 w-5 items-center justify-center rounded-full border transition-colors ${
                        isSelected 
                          ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent)] text-white" 
                          : "border-[color:var(--color-border)]"
                      }`}>
                        {isSelected && (
                          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
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
        <div className="sticky bottom-0 flex flex-wrap justify-end gap-3 border-t border-[color:var(--color-border)] bg-[color:var(--color-card)] pt-4 pb-2">
          <ActionButton
            label="Cancel"
            variant="secondary"
            onClick={onClose}
            className={isSaving ? "pointer-events-none opacity-60" : ""}
          />
          <ActionButton
            label={isSaving ? "Saving..." : "Save project"}
            variant="primary"
            type="submit"
            className={isSaving ? "pointer-events-none opacity-60" : ""}
          />
        </div>
      </form>
    </Modal>
  );
}
