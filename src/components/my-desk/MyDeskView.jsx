"use client";

import { useEffect, useState, useCallback } from "react";
import PageHeader from "@/components/layout/PageHeader";
import PersonalTodoView from "@/components/projects/PersonalTodoView";
import PersonalNotesView from "@/components/projects/PersonalNotesView";
import { normalizeRoleId } from "@/lib/roles";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";

export default function MyDeskView({ role, currentUserId }) {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState("todos"); // todos, notes
  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(true);

  const loadTasks = useCallback(async () => {
    setTasksLoading(true);
    try {
      const isManager = role && ["pm", "cto", "ceo"].includes(normalizeRoleId(role));
      const url = isManager ? "/api/tasks?allTasks=true" : "/api/tasks";
      const response = await fetch(url);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message ?? "Failed to load tasks.");
      }
      setTasks(data.tasks || []);
    } catch (error) {
      addToast({
        title: "Tasks loading failed",
        message: error instanceof Error ? error.message : "Could not fetch tasks for linking.",
        variant: "warning",
      });
    } finally {
      setTasksLoading(false);
    }
  }, [role, addToast]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Desk"
        description="Your personal workspace to track private to-dos and document markdown notes."
      />

      {/* Tabs Menu */}
      <div className="flex border-b border-[color:var(--color-border)]">
        <button
          onClick={() => setActiveTab("todos")}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition duration-150 ${
            activeTab === "todos"
              ? "border-[color:var(--color-accent)] text-[color:var(--color-accent)]"
              : "border-transparent text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]"
          }`}
        >
          Personal To-Do
        </button>
        <button
          onClick={() => setActiveTab("notes")}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition duration-150 ${
            activeTab === "notes"
              ? "border-[color:var(--color-accent)] text-[color:var(--color-accent)]"
              : "border-transparent text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]"
          }`}
        >
          Notes
        </button>
      </div>

      <div className="py-2">
        {tasksLoading ? (
          <div className="flex items-center justify-center py-12 text-sm text-[color:var(--color-text-muted)]">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Initializing desk workspace...
          </div>
        ) : (
          <>
            {activeTab === "todos" && (
              <PersonalTodoView tasks={tasks} />
            )}
            {activeTab === "notes" && (
              <PersonalNotesView tasks={tasks} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
