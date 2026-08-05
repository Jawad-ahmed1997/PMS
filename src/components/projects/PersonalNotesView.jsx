"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/ToastProvider";
import { Plus, Search, Trash2, Link2, Eye, Edit3, BookOpen, Bold, Italic, Heading, List, Code } from "lucide-react";
import SearchableTaskSelector from "@/components/ui/SearchableTaskSelector";
import DeleteConfirmationDialog from "@/components/ui/DeleteConfirmationDialog";

// A simple, safe client-side Markdown parser for the preview mode
function parseMarkdown(text) {
  if (!text) return "";
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Headers (e.g. ### Header)
  html = html.replace(/^### (.*?)$/gm, '<h3 class="text-sm font-bold text-[color:var(--color-text)] mt-4 mb-2">$1</h3>');
  html = html.replace(/^## (.*?)$/gm, '<h2 class="text-base font-bold text-[color:var(--color-text)] mt-5 mb-2">$1</h2>');
  html = html.replace(/^# (.*?)$/gm, '<h1 class="text-lg font-bold text-[color:var(--color-text)] mt-6 mb-3">$1</h1>');

  // Bold (**text** or __text__)
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__(.*?)__/g, "<strong>$1</strong>");

  // Italics (*text* or _text_)
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
  html = html.replace(/_(.*?)_/g, "<em>$1</em>");

  // Monospace / Code Block
  html = html.replace(/```([\s\S]*?)```/gm, '<pre class="bg-[color:var(--color-muted-bg)] border border-[color:var(--color-border)] rounded-xl p-3 text-xs font-mono my-3 overflow-x-auto text-[color:var(--color-text-subtle)]">$1</pre>');
  html = html.replace(/`(.*?)`/g, '<code class="bg-[color:var(--color-muted-bg)] border border-[color:var(--color-border)] px-1.5 py-0.5 rounded text-xs font-mono text-emerald-400">$1</code>');

  // Bullet Lists
  html = html.replace(/^\s*-\s+(.*?)$/gm, '<li class="ml-4 list-disc text-sm text-[color:var(--color-text-subtle)]">$1</li>');

  // Paragraphs
  html = html.replace(/^(?!<(h|li|pre|code))+(.*?)$/gm, '<p class="text-sm text-[color:var(--color-text-subtle)] leading-relaxed mb-3">$2</p>');

  return html;
}

export default function PersonalNotesView({ projectId, tasks = [] }) {
  const { addToast } = useToast();
  const [notes, setNotes] = useState([]);
  const [activeNoteId, setActiveNoteId] = useState(null);
  const queryClient = useQueryClient();
  
  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  
  // Editor State
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editTaskId, setEditTaskId] = useState("");
  const [viewMode, setViewMode] = useState("preview"); // edit, preview
  const [saving, setSaving] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState(null);

  const textareaRef = useRef(null);

  const { data: queryNotes = [], isLoading: loading, error: notesError } = useQuery({
    queryKey: ["notes"],
    queryFn: async () => {
      const response = await fetch("/api/notes");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message ?? "Failed to load notes.");
      }
      return data.notes ?? [];
    },
    staleTime: 1000 * 15,
  });

  useEffect(() => {
    if (notesError) {
      addToast({
        title: "Notes unavailable",
        message: notesError.message || "Failed to load notes.",
        variant: "error",
      });
    }
  }, [notesError, addToast]);

  useEffect(() => {
    const projectTasksMap = new Map(tasks.map((t) => [t.id, t]));
    const filtered = queryNotes.filter((note) => {
      if (!note.taskId) {
        return true; // General note
      }
      return projectTasksMap.has(note.taskId); // Linked to task in this project
    });

    setNotes(filtered);

    // Select first note by default if none active
    if (filtered.length > 0 && !activeNoteId) {
      const first = filtered[0];
      setActiveNoteId(first.id);
      setEditTitle(first.title);
      setEditContent(first.content);
      setEditTaskId(first.taskId || "");
    }
  }, [queryNotes, tasks, activeNoteId]);

  const activeNote = useMemo(() => {
    return notes.find((n) => n.id === activeNoteId) ?? null;
  }, [notes, activeNoteId]);

  // Select another note
  const handleSelectNote = (note) => {
    setActiveNoteId(note.id);
    setEditTitle(note.title);
    setEditContent(note.content);
    setEditTaskId(note.taskId || "");
    // Respects current view mode
  };

  // Create note
  const handleCreateNote = async () => {
    try {
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "New Note",
          content: "",
          taskId: null,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message ?? "Failed to create note.");
      }
      
      setNotes((prev) => [data.note, ...prev]);
      setActiveNoteId(data.note.id);
      setEditTitle(data.note.title);
      setEditContent(data.note.content);
      setEditTaskId("");
      setViewMode("edit");

      addToast({
        title: "Note created",
        message: "A new private note has been started.",
        variant: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["notes"] });
    } catch (error) {
      addToast({
        title: "Action failed",
        message: error instanceof Error ? error.message : "Failed to create note.",
        variant: "error",
      });
    }
  };

  // Save active note
  const handleSaveNote = async () => {
    if (!activeNoteId) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/notes/${activeNoteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim() || "Untitled Note",
          content: editContent,
          taskId: editTaskId || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message ?? "Failed to save note.");
      }

      // Update local state
      setNotes((prev) =>
        prev.map((n) => (n.id === activeNoteId ? data.note : n))
      );

      addToast({
        title: "Note saved",
        message: "Your private note has been updated.",
        variant: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["notes"] });
    } catch (error) {
      addToast({
        title: "Action failed",
        message: error instanceof Error ? error.message : "Failed to save note.",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  // Delete active note
  const handleDeleteNote = async (noteId) => {
    try {
      const response = await fetch(`/api/notes/${noteId}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message ?? "Failed to delete note.");
      }

      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      if (activeNoteId === noteId) {
        setActiveNoteId(null);
        setEditTitle("");
        setEditContent("");
        setEditTaskId("");
      }

      addToast({
        title: "Note deleted",
        message: "Your private note has been deleted.",
        variant: "info",
      });
      queryClient.invalidateQueries({ queryKey: ["notes"] });
    } catch (error) {
      addToast({
        title: "Action failed",
        message: error instanceof Error ? error.message : "Failed to delete note.",
        variant: "error",
      });
    }
  };

  // Format Selection Helper
  const insertFormatting = (before, after) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selection = editContent.substring(start, end);
    const replacement = before + (selection || "text") + after;

    const nextContent =
      editContent.substring(0, start) +
      replacement +
      editContent.substring(end);

    setEditContent(nextContent);
    textarea.focus();
    
    // Reset selection bounds
    setTimeout(() => {
      textarea.setSelectionRange(
        start + before.length,
        start + before.length + (selection || "text").length
      );
    }, 0);
  };

  // Filter notes by search query
  const filteredNotes = notes.filter((n) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q);
  });

  return (
    <div className="grid gap-6 lg:grid-cols-4 h-[calc(100vh-18rem)] min-h-[500px]">
      {/* Sidebar List */}
      <div className="lg:col-span-1 border border-[color:var(--color-border)] rounded-2xl bg-[color:var(--color-card)] flex flex-col overflow-hidden">
        {/* Sidebar Header */}
        <div className="p-3 border-b border-[color:var(--color-border)] space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[color:var(--color-text-subtle)]">
              My Notes
            </h3>
            <Button
              variant="outline"
              size="icon"
              onClick={handleCreateNote}
              className="flex items-center justify-center p-1 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-bg)] hover:bg-[color:var(--color-muted-bg)] hover:text-[color:var(--color-accent)] transition text-[color:var(--color-text-subtle)]"
              title="New Note"
            >
              <Plus className="h-4.5 w-4.5" />
            </Button>
          </div>
          
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[color:var(--color-text-muted)]" />
            <Input
              type="text"
              placeholder="Search notes..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] text-xs text-[color:var(--color-text)] focus:outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Notes Items List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-xs text-[color:var(--color-text-muted)] animate-pulse">
              <Skeleton className="mx-auto h-4 w-32" />
            </div>
          ) : filteredNotes.length > 0 ? (
            filteredNotes.map((note) => (
              <button
                key={note.id}
                onClick={() => handleSelectNote(note)}
                className={`w-full text-left p-2.5 rounded-xl border transition flex flex-col gap-1 ${
                  activeNoteId === note.id
                    ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent-muted)]"
                    : "border-transparent hover:bg-[color:var(--color-muted-bg)]"
                }`}
              >
                <span className="text-sm font-semibold text-[color:var(--color-text)] truncate w-full">
                  {note.title || "Untitled Note"}
                </span>
                <span className="text-[10px] text-[color:var(--color-text-muted)]">
                  {new Date(note.updatedAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                {note.task && (
                  <span className="inline-flex items-center gap-0.5 mt-1 rounded bg-[color:var(--color-muted-bg)] px-1 py-0.5 text-[9px] text-[color:var(--color-text-muted)] max-w-full truncate border border-[color:var(--color-border)]">
                    <Link2 className="h-2 w-2 shrink-0" /> {note.task.title}
                  </span>
                )}
              </button>
            ))
          ) : (
            <p className="text-center text-xs text-[color:var(--color-text-muted)] py-8">
              No notes found.
            </p>
          )}
        </div>
      </div>

      {/* Note Workspace */}
      <div className="lg:col-span-3 border border-[color:var(--color-border)] rounded-2xl bg-[color:var(--color-card)] flex flex-col overflow-hidden">
        {activeNote ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Editor Top Bar */}
            <div className="p-3 border-b border-[color:var(--color-border)] flex flex-wrap items-center justify-between gap-3 bg-[color:var(--color-muted-bg)]">
              {/* Tab Selector */}
              <div className="flex border border-[color:var(--color-border)] rounded-xl overflow-hidden bg-[color:var(--color-input)] p-0.5">
                <Button
                  variant={viewMode === "edit" ? "secondary" : "ghost"}
                  onClick={() => setViewMode("edit")}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    viewMode === "edit"
                      ? "bg-[color:var(--color-card)] text-[color:var(--color-text)] shadow-sm"
                      : "text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]"
                  }`}
                >
                  <Edit3 className="h-3 w-3" /> Edit
                </Button>
                <Button
                  variant={viewMode === "preview" ? "secondary" : "ghost"}
                  onClick={() => setViewMode("preview")}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    viewMode === "preview"
                      ? "bg-[color:var(--color-card)] text-[color:var(--color-text)] shadow-sm"
                      : "text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]"
                  }`}
                >
                  <Eye className="h-3 w-3" /> Preview
                </Button>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button
                  variant="default"
                  onClick={handleSaveNote}
                  disabled={saving}
                  size="sm"
                >{saving ? "Saving..." : "Save Note"}</Button>
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => setNoteToDelete(activeNote.id)}
                  className="flex items-center justify-center p-2 rounded-xl border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500 hover:text-white transition text-rose-300"
                  title="Delete Note"
                >
                  <Trash2 className="h-4.5 w-4.5" />
                </Button>
              </div>
            </div>

            {/* Note Metadata Details */}
            <div className="p-4 border-b border-[color:var(--color-border)] grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">
                  Note Title
                </Label>
                <Input
                  type="text"
                  placeholder="Enter title..."
                  className="w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-1.5 text-sm text-[color:var(--color-text)] placeholder-[color:var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-accent)]"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">
                  <Link2 className="h-3.5 w-3.5" /> Link to Task (Optional)
                </Label>
                <SearchableTaskSelector
                  tasks={tasks}
                  value={editTaskId}
                  onChange={setEditTaskId}
                  emptyLabel="General Project Note"
                />
              </div>
            </div>

            {/* Editor Workspace */}
            {viewMode === "edit" ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Format Toolbar */}
                <div className="px-4 py-1.5 border-b border-[color:var(--color-border)] flex gap-2 items-center overflow-x-auto bg-[color:var(--color-muted-bg)]">
                  <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    onClick={() => insertFormatting("**", "**")}
                    className="p-1.5 rounded hover:bg-[color:var(--color-border)] text-[color:var(--color-text-subtle)] transition"
                    title="Bold"
                  >
                    <Bold className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    onClick={() => insertFormatting("*", "*")}
                    className="p-1.5 rounded hover:bg-[color:var(--color-border)] text-[color:var(--color-text-subtle)] transition"
                    title="Italic"
                  >
                    <Italic className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    onClick={() => insertFormatting("### ", "")}
                    className="p-1.5 rounded hover:bg-[color:var(--color-border)] text-[color:var(--color-text-subtle)] transition"
                    title="Header"
                  >
                    <Heading className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    onClick={() => insertFormatting("- ", "")}
                    className="p-1.5 rounded hover:bg-[color:var(--color-border)] text-[color:var(--color-text-subtle)] transition"
                    title="Bullet List"
                  >
                    <List className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    onClick={() => insertFormatting("```\n", "\n```")}
                    className="p-1.5 rounded hover:bg-[color:var(--color-border)] text-[color:var(--color-text-subtle)] transition"
                    title="Code Block"
                  >
                    <Code className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <Textarea
                  ref={textareaRef}
                  placeholder="Start writing in Markdown..."
                  className="flex-1 w-full p-4 bg-transparent text-sm text-[color:var(--color-text)] placeholder-[color:var(--color-text-muted)] focus:outline-none resize-none overflow-y-auto font-sans leading-relaxed"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                />
              </div>
            ) : (
              /* Preview Mode */
              <div className="flex-1 overflow-y-auto p-5 bg-[color:var(--color-bg)]">
                {editContent.trim() ? (
                  <article
                    className="max-w-none prose dark:prose-invert"
                    dangerouslySetInnerHTML={{
                      __html: parseMarkdown(editContent),
                    }}
                  />
                ) : (
                  <p className="text-sm text-[color:var(--color-text-muted)] italic">
                    Note is empty. Switch to Edit mode to write content.
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Empty State */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[color:var(--color-bg)]">
            <BookOpen className="h-12 w-12 text-[color:var(--color-text-muted)] mb-3 animate-pulse" />
            <h3 className="text-sm font-semibold text-[color:var(--color-text)]">
              No Note Selected
            </h3>
            <p className="text-xs text-[color:var(--color-text-muted)] mt-1 mb-4 max-w-xs">
              Select an existing private note from the sidebar, or create a new one to document links or notes.
            </p>
            <Button variant="default" onClick={handleCreateNote}>Create Note</Button>
          </div>
        )}
      </div>
      <DeleteConfirmationDialog
        open={Boolean(noteToDelete)}
        onOpenChange={(open) => { if (!open) setNoteToDelete(null); }}
        onConfirm={() => handleDeleteNote(noteToDelete)}
      />
    </div>
  );
}
