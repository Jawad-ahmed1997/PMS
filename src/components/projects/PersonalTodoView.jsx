"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/ToastProvider";
import { Trash2, Bell, Link2, CheckCircle2, Circle, Edit2, ClipboardList, Zap, Check } from "lucide-react";
import SearchableTaskSelector from "@/components/ui/SearchableTaskSelector";

export default function PersonalTodoView({ tasks = [] }) {
  const { addToast } = useToast();
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Add Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [content, setContent] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [statusOption, setStatusOption] = useState("TODO"); // TODO, IN_PROGRESS, COMPLETED
  const [reminderOption, setReminderOption] = useState("none"); // none, 1h, 4h, custom
  const [customReminder, setCustomReminder] = useState("");

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState(null);
  const [editContent, setEditContent] = useState("");
  const [editTaskId, setEditTaskId] = useState("");
  const [editStatusOption, setEditStatusOption] = useState("TODO");
  const [editReminderOption, setEditReminderOption] = useState("none");
  const [editCustomReminder, setEditCustomReminder] = useState("");
  const [updating, setUpdating] = useState(false);

  const parseTodo = (todo) => {
    let status = "TODO";
    let cleanContent = todo.content;
    
    if (todo.isCompleted) {
      status = "COMPLETED";
    } else if (todo.content.startsWith("[IN_PROGRESS] ")) {
      status = "IN_PROGRESS";
      cleanContent = todo.content.substring("[IN_PROGRESS] ".length);
    } else if (todo.content.startsWith("[TODO] ")) {
      status = "TODO";
      cleanContent = todo.content.substring("[TODO] ".length);
    }
    
    return { ...todo, status, cleanContent };
  };

  const loadTodos = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/todos");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message ?? "Failed to load to-dos.");
      }
      setTodos((data.todos ?? []).map(parseTodo));
    } catch (error) {
      addToast({
        title: "To-Dos unavailable",
        message: error instanceof Error ? error.message : "Failed to load to-dos.",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadTodos();
  }, [loadTodos]);

  const handleCreateTodo = async (event) => {
    event.preventDefault();
    if (!content.trim()) {
      return;
    }

    setSubmitting(true);

    let prefixedContent = content.trim();
    if (statusOption === "IN_PROGRESS") {
      prefixedContent = "[IN_PROGRESS] " + prefixedContent;
    } else if (statusOption === "TODO") {
      prefixedContent = "[TODO] " + prefixedContent;
    }
    const isCompleted = statusOption === "COMPLETED";

    let reminderAt = null;
    if (reminderOption === "1h") {
      reminderAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    } else if (reminderOption === "4h") {
      reminderAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
    } else if (reminderOption === "custom" && customReminder) {
      reminderAt = new Date(customReminder).toISOString();
    }

    try {
      const response = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: prefixedContent,
          taskId: selectedTaskId || null,
          reminderAt,
          isCompleted,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message ?? "Failed to create to-do.");
      }

      // If completing, sync update
      if (isCompleted) {
        await fetch(`/api/todos/${data.todo.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isCompleted: true }),
        });
      }

      setContent("");
      setSelectedTaskId("");
      setStatusOption("TODO");
      setReminderOption("none");
      setCustomReminder("");
      setIsAddModalOpen(false);
      
      await loadTodos();

      addToast({
        title: "To-Do created",
        message: "Your private to-do has been added.",
        variant: "success",
      });
    } catch (error) {
      addToast({
        title: "Action failed",
        message: error instanceof Error ? error.message : "Failed to create to-do.",
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (todo, newStatus) => {
    let prefixedContent = todo.cleanContent;
    if (newStatus === "IN_PROGRESS") {
      prefixedContent = "[IN_PROGRESS] " + prefixedContent;
    } else if (newStatus === "TODO") {
      prefixedContent = "[TODO] " + prefixedContent;
    }
    const isCompleted = newStatus === "COMPLETED";

    // Optimistic UI Update
    setTodos((prev) =>
      prev.map((item) => (item.id === todo.id ? { ...item, status: newStatus, isCompleted, content: prefixedContent } : item))
    );

    try {
      const response = await fetch(`/api/todos/${todo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: prefixedContent,
          isCompleted,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message ?? "Failed to update status.");
      }
    } catch (error) {
      // Revert on error
      await loadTodos();
      addToast({
        title: "Update failed",
        message: error instanceof Error ? error.message : "Failed to update to-do status.",
        variant: "error",
      });
    }
  };

  const handleToggleComplete = async (todo) => {
    const nextStatus = todo.status === "COMPLETED" ? "TODO" : "COMPLETED";
    await handleStatusChange(todo, nextStatus);
  };

  const handleDeleteTodo = async (todoId) => {
    const previousTodos = [...todos];
    setTodos((prev) => prev.filter((item) => item.id !== todoId));

    try {
      const response = await fetch(`/api/todos/${todoId}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message ?? "Failed to delete to-do.");
      }
      addToast({
        title: "To-Do deleted",
        message: "Your to-do has been removed.",
        variant: "info",
      });
    } catch (error) {
      setTodos(previousTodos);
      addToast({
        title: "Action failed",
        message: error instanceof Error ? error.message : "Failed to delete to-do.",
        variant: "error",
      });
    }
  };

  // Format Helper for Datetime-Local input
  const formatDateTimeLocal = (isoString) => {
    if (!isoString) return "";
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return "";
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const openEditModal = (todo) => {
    setEditingTodo(todo);
    setEditContent(todo.cleanContent);
    setEditTaskId(todo.taskId || "");
    setEditStatusOption(todo.status);
    if (todo.reminderAt) {
      setEditReminderOption("custom");
      setEditCustomReminder(formatDateTimeLocal(todo.reminderAt));
    } else {
      setEditReminderOption("none");
      setEditCustomReminder("");
    }
    setIsEditModalOpen(true);
  };

  const handleUpdateTodo = async (event) => {
    event.preventDefault();
    if (!editingTodo || !editContent.trim()) return;

    setUpdating(true);
    let prefixedContent = editContent.trim();
    if (editStatusOption === "IN_PROGRESS") {
      prefixedContent = "[IN_PROGRESS] " + prefixedContent;
    } else if (editStatusOption === "TODO") {
      prefixedContent = "[TODO] " + prefixedContent;
    }
    const isCompleted = editStatusOption === "COMPLETED";

    let reminderAt = null;
    if (editReminderOption === "1h") {
      reminderAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    } else if (editReminderOption === "4h") {
      reminderAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
    } else if (editReminderOption === "custom" && editCustomReminder) {
      reminderAt = new Date(editCustomReminder).toISOString();
    }

    try {
      const response = await fetch(`/api/todos/${editingTodo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: prefixedContent,
          taskId: editTaskId || null,
          reminderAt,
          isCompleted,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message ?? "Failed to save to-do.");
      }

      setIsEditModalOpen(false);
      setEditingTodo(null);
      await loadTodos();

      addToast({
        title: "To-Do updated",
        message: "Your changes have been saved.",
        variant: "success",
      });
    } catch (error) {
      addToast({
        title: "Action failed",
        message: error instanceof Error ? error.message : "Failed to update to-do.",
        variant: "error",
      });
    } finally {
      setUpdating(false);
    }
  };

  const formatReminderLabel = (isoString) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const todoList = todos.filter((t) => t.status === "TODO");
  const inProgressList = todos.filter((t) => t.status === "IN_PROGRESS");
  const completedList = todos.filter((t) => t.status === "COMPLETED");

  const renderTodoCard = (todo) => (
    <div
      key={todo.id}
      className="group flex flex-col justify-between gap-3 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-3.5 transition hover:border-[color:var(--color-accent)] shadow-sm"
    >
      <div className="flex items-start gap-2.5 min-w-0">
        <Button
          variant="ghost"
          size="icon"
          type="button"
          onClick={() => handleToggleComplete(todo)}
          className={`mt-0.5 transition shrink-0 ${
            todo.status === "COMPLETED" 
              ? "text-[color:var(--color-accent)]" 
              : "text-[color:var(--color-text-muted)] hover:text-[color:var(--color-accent)]"
          }`}
        >
          {todo.status === "COMPLETED" ? (
            <CheckCircle2 className="h-4.5 w-4.5" />
          ) : (
            <Circle className="h-4.5 w-4.5" />
          )}
        </Button>
        <div className="min-w-0 space-y-1.5 flex-1">
          <p className={`text-sm break-words leading-relaxed ${todo.status === "COMPLETED" ? "line-through text-[color:var(--color-text-subtle)] opacity-70" : "text-[color:var(--color-text)]"}`}>
            {todo.cleanContent}
          </p>
          
          <div className="flex flex-wrap items-center gap-1.5">
            {todo.task && (
              <span className="inline-flex items-center gap-0.5 rounded-md bg-[color:var(--color-muted-bg)] px-1.5 py-0.5 text-[10px] font-medium text-[color:var(--color-text-subtle)] border border-[color:var(--color-border)]">
                <Link2 className="h-2.5 w-2.5" /> {todo.task.title}
              </span>
            )}
            {todo.reminderAt && (
              <span className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold border ${
                todo.reminderSent 
                  ? "bg-rose-500/10 border-rose-500/20 text-rose-300"
                  : "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
              }`}>
                <Bell className="h-2.5 w-2.5" /> {formatReminderLabel(todo.reminderAt)}
              </span>
            )}
          </div>
        </div>
      </div>
      
      {/* Controls Footer */}
      <div className="flex items-center justify-between gap-2 border-t border-[color:var(--color-border)]/40 pt-2.5">
        {/* Status Dropdown */}
        <Select value={todo.status} onValueChange={(value) => handleStatusChange(todo, value)}>
          <SelectTrigger className="h-9 w-auto min-w-[8rem] px-2 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODO">To Do</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
          </SelectContent>
        </Select>

        {/* Edit / Delete Buttons */}
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition shrink-0">
          <Button
            variant="ghost"
            size="icon"
            type="button"
            onClick={() => openEditModal(todo)}
            className="text-[color:var(--color-text-muted)] hover:text-[color:var(--color-accent)] transition"
            aria-label="Edit"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            type="button"
            onClick={() => handleDeleteTodo(todo.id)}
            className="text-[color:var(--color-text-muted)] hover:text-rose-500 transition"
            aria-label="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="flex justify-between items-center">
        <h3 className="text-base font-bold text-[color:var(--color-text)]">
          My Personal To-Dos
        </h3>
        <Button
          type="button"
          size="md"
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white transition  shadow-sm"
        >
          <span>+ Add To-Do</span>
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12 text-sm text-[color:var(--color-text-muted)]">
          <div className="space-y-3 py-8"><Skeleton className="h-5 w-48" /><Skeleton className="h-24 w-full" /></div>
        </div>
      ) : (
        <div className="flex md:grid gap-6 overflow-x-auto md:overflow-x-visible pb-4 md:pb-0 md:grid-cols-3 items-start hide-scrollbar">
          {/* Column 1: To Do */}
          <div className="min-w-[280px] md:min-w-0 flex-1 md:flex-none space-y-4">
            <div className="flex items-center justify-between border-b border-[color:var(--color-border)] pb-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[color:var(--color-text-muted)] flex items-center gap-2">
                📋 To Do
              </h4>
              <span className="text-xs text-[color:var(--color-text-muted)] bg-[color:var(--color-muted-bg)] px-2 py-0.5 rounded-full font-medium">
                {todoList.length}
              </span>
            </div>
            <div className="space-y-3">
              {todoList.map(renderTodoCard)}
              {todoList.length === 0 && (
                <p className="text-xs text-[color:var(--color-text-muted)] italic py-2">
                  No items in to-do list.
                </p>
              )}
            </div>
          </div>

          {/* Column 2: In Progress */}
          <div className="min-w-[280px] md:min-w-0 flex-1 md:flex-none space-y-4">
            <div className="flex items-center justify-between border-b border-[color:var(--color-border)] pb-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[color:var(--color-text-muted)] flex items-center gap-2">
                ⚡ In Progress
              </h4>
              <span className="text-xs text-[color:var(--color-text-muted)] bg-[color:var(--color-muted-bg)] px-2 py-0.5 rounded-full font-medium">
                {inProgressList.length}
              </span>
            </div>
            <div className="space-y-3">
              {inProgressList.map(renderTodoCard)}
              {inProgressList.length === 0 && (
                <p className="text-xs text-[color:var(--color-text-muted)] italic py-2">
                  No items in progress.
                </p>
              )}
            </div>
          </div>

          {/* Column 3: Completed */}
          <div className="min-w-[280px] md:min-w-0 flex-1 md:flex-none space-y-4">
            <div className="flex items-center justify-between border-b border-[color:var(--color-border)] pb-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[color:var(--color-text-muted)] flex items-center gap-2">
                ✅ Completed
              </h4>
              <span className="text-xs text-[color:var(--color-text-muted)] bg-[color:var(--color-muted-bg)] px-2 py-0.5 rounded-full font-medium">
                {completedList.length}
              </span>
            </div>
            <div className="space-y-3">
              {completedList.map(renderTodoCard)}
              {completedList.length === 0 && (
                <p className="text-xs text-[color:var(--color-text-muted)] italic py-2">
                  No completed items yet.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add To-Do Modal */}
      <DialogRoot open={isAddModalOpen} onOpenChange={(open) => {
        if (!open && !submitting) {
          setIsAddModalOpen(false);
          setContent("");
          setSelectedTaskId("");
          setStatusOption("TODO");
          setReminderOption("none");
          setCustomReminder("");
        }
      }}>
        <DialogPortal><DialogOverlay /><DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add To-Do</DialogTitle><DialogDescription>Create a new private to-do task.</DialogDescription></DialogHeader>
        <form onSubmit={handleCreateTodo} className="space-y-4">
          <div>
            <Label className="text-xs font-semibold text-[color:var(--color-text-muted)]">
              To-Do content
              <Input
                type="text"
                placeholder="What needs to be done?"
                className="mt-1.5 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-sm text-[color:var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-accent)]"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
              />
            </Label>
          </div>

          <div>
            <Label className="flex items-center gap-1 mb-1.5 text-xs font-semibold text-[color:var(--color-text-muted)]">
              <Link2 className="h-3.5 w-3.5" /> Link to Task (Optional)
            </Label>
            <SearchableTaskSelector
              tasks={tasks}
              value={selectedTaskId}
              onChange={setSelectedTaskId}
              emptyLabel="General Personal To-Do"
            />
          </div>

          <div>
            <Label className="mb-1.5 block text-xs font-semibold text-[color:var(--color-text-muted)]">
              Initial Status
            </Label>
            <Select value={statusOption} onValueChange={setStatusOption}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODO">To Do</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="flex items-center gap-1 mb-1.5 text-xs font-semibold text-[color:var(--color-text-muted)]">
              <Bell className="h-3.5 w-3.5" /> Set Reminder (Optional)
            </Label>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { id: "none", label: "None" },
                { id: "1h", label: "+1h" },
                { id: "4h", label: "+4h" },
                { id: "custom", label: "Custom" },
              ].map((opt) => (
                <Button
                  variant={reminderOption === opt.id ? "secondary" : "outline"}
                  size="sm"
                  key={opt.id}
                  type="button"
                  onClick={() => setReminderOption(opt.id)}
                  className={`text-[11px] ${
                    reminderOption === opt.id
                      ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent-muted)] text-[color:var(--color-accent)]"
                      : "border-[color:var(--color-border)] bg-transparent text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]"
                  }`}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
            
            {reminderOption === "custom" && (
              <Input
                type="datetime-local"
                className="mt-2.5 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-1.5 text-xs text-[color:var(--color-text)] focus:outline-none"
                value={customReminder}
                onChange={(e) => setCustomReminder(e.target.value)}
                required
              />
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => {
                setIsAddModalOpen(false);
                setContent("");
                setSelectedTaskId("");
                setStatusOption("TODO");
                setReminderOption("none");
                setCustomReminder("");
              }}
              disabled={submitting}
              className="rounded-xl border border-[color:var(--color-border)] bg-transparent px-4 py-2 text-xs font-semibold text-[color:var(--color-text-subtle)] hover:bg-[color:var(--color-muted-bg)] transition"
            >
              Cancel
            </Button>
            <Button
              variant="default"
              type="submit"
              disabled={submitting || !content.trim()}
            >{submitting ? "Adding..." : "Add To-Do"}</Button>
          </DialogFooter>
        </form>
        </DialogContent></DialogPortal>
      </DialogRoot>

      {/* Edit To-Do Modal */}
      <DialogRoot open={isEditModalOpen} onOpenChange={(open) => {
        if (!open && !updating) {
          setIsEditModalOpen(false);
          setEditingTodo(null);
        }
      }}>
        <DialogPortal><DialogOverlay /><DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit To-Do</DialogTitle><DialogDescription>Update your private to-do task details.</DialogDescription></DialogHeader>
        <form onSubmit={handleUpdateTodo} className="space-y-4">
          <div>
            <Label className="text-xs font-semibold text-[color:var(--color-text-muted)]">
              To-Do content
              <Input
                type="text"
                className="mt-1.5 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-sm text-[color:var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-accent)]"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                required
              />
            </Label>
          </div>

          <div>
            <Label className="flex items-center gap-1 mb-1.5 text-xs font-semibold text-[color:var(--color-text-muted)]">
              <Link2 className="h-3.5 w-3.5" /> Link to Task (Optional)
            </Label>
            <SearchableTaskSelector
              tasks={tasks}
              value={editTaskId}
              onChange={setEditTaskId}
              emptyLabel="General Personal To-Do"
            />
          </div>

          <div>
            <Label className="mb-1.5 block text-xs font-semibold text-[color:var(--color-text-muted)]">
              Status
            </Label>
            <Select value={editStatusOption} onValueChange={setEditStatusOption}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODO">To Do</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="flex items-center gap-1 mb-1.5 text-xs font-semibold text-[color:var(--color-text-muted)]">
              <Bell className="h-3.5 w-3.5" /> Set Reminder (Optional)
            </Label>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { id: "none", label: "None" },
                { id: "1h", label: "+1h" },
                { id: "4h", label: "+4h" },
                { id: "custom", label: "Custom" },
              ].map((opt) => (
                <Button
                  variant={editReminderOption === opt.id ? "secondary" : "outline"}
                  size="sm"
                  key={opt.id}
                  type="button"
                  onClick={() => setEditReminderOption(opt.id)}
                  className={`text-[11px] ${
                    editReminderOption === opt.id
                      ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent-muted)] text-[color:var(--color-accent)]"
                      : "border-[color:var(--color-border)] bg-transparent text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]"
                  }`}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
            
            {editReminderOption === "custom" && (
              <Input
                type="datetime-local"
                className="mt-2.5 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-1.5 text-xs text-[color:var(--color-text)] focus:outline-none"
                value={editCustomReminder}
                onChange={(e) => setEditCustomReminder(e.target.value)}
                required
              />
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => {
                setIsEditModalOpen(false);
                setEditingTodo(null);
              }}
              disabled={updating}
              className="rounded-xl border border-[color:var(--color-border)] bg-transparent px-4 py-2 text-xs font-semibold text-[color:var(--color-text-subtle)] hover:bg-[color:var(--color-muted-bg)] transition"
            >
              Cancel
            </Button>
            <Button
              variant="default"
              type="submit"
              disabled={updating || !editContent.trim()}
            >{updating ? "Saving..." : "Save Changes"}</Button>
          </DialogFooter>
        </form>
        </DialogContent></DialogPortal>
      </DialogRoot>
    </div>
  );
}
