"use client";

import { useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import PersonalTodoView from "@/components/projects/PersonalTodoView";
import PersonalNotesView from "@/components/projects/PersonalNotesView";
import { normalizeRoleId } from "@/lib/roles";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/ToastProvider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="gap-6">
          <TabsTrigger value="todos">Personal To-Do</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>
        {tasksLoading ? (
          <div className="space-y-4 py-8" aria-label="Loading desk workspace">
            <Skeleton className="h-5 w-48" />
            <div className="grid gap-4 md:grid-cols-3">
              <Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" />
            </div>
          </div>
        ) : (
          <>
            <TabsContent value="todos"><PersonalTodoView tasks={tasks} /></TabsContent>
            <TabsContent value="notes"><PersonalNotesView tasks={tasks} /></TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
