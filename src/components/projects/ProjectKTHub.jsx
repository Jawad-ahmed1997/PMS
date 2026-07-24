"use client";

import { useEffect, useState } from "react";
import ActionButton from "@/components/ui/ActionButton";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/ToastProvider";

// Simple client-side Markdown parser
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

export default function ProjectKTHub({ projectId }) {
  const { addToast } = useToast();
  const [kt, setKt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editing forms state
  const [editState, setEditState] = useState({
    quickStartGuide: "",
    envVariables: "",
    architectureNotes: "",
  });

  // Video walkthroughs state
  const [videos, setVideos] = useState([]);
  const [isAddVideoOpen, setIsAddVideoOpen] = useState(false);
  const [videoForm, setVideoForm] = useState({ title: "", url: "" });
  const [copyingCmd, setCopyingCmd] = useState(null);

  const fetchKT = async () => {
    if (!projectId) return;
    try {
      const response = await fetch(`/api/projects/${projectId}/kt`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to load KT");
      
      setKt(data.kt);
      setEditState({
        quickStartGuide: data.kt.quickStartGuide,
        envVariables: data.kt.envVariables,
        architectureNotes: data.kt.architectureNotes,
      });
      // Parse video walkthroughs safely from JSON
      const loadedVideos = typeof data.kt.videoWalkthroughs === "string"
        ? JSON.parse(data.kt.videoWalkthroughs)
        : data.kt.videoWalkthroughs ?? [];
      setVideos(loadedVideos);
    } catch (error) {
      console.error(error);
      addToast({
        title: "Error",
        message: error instanceof Error ? error.message : "Unable to fetch project KT docs.",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKT();
  }, [projectId]);

  const handleCopyCommand = (cmdText, name) => {
    navigator.clipboard.writeText(cmdText);
    setCopyingCmd(name);
    setTimeout(() => setCopyingCmd(null), 1500);
    addToast({
      title: "Copied",
      message: `"${cmdText}" copied to clipboard.`,
      variant: "success",
    });
  };

  const handleSaveGuide = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/kt`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editState),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to save docs");

      setKt(data.kt);
      setIsEditing(false);
      addToast({
        title: "Success",
        message: "Project setup documentation updated.",
        variant: "success",
      });
    } catch (error) {
      addToast({
        title: "Save failed",
        message: error instanceof Error ? error.message : "Could not save guide updates.",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAddVideo = async (e) => {
    e.preventDefault();
    if (!videoForm.title.trim() || !videoForm.url.trim()) return;

    const newVideo = {
      id: Math.random().toString(36).substring(2, 9),
      title: videoForm.title.trim(),
      url: videoForm.url.trim(),
      createdAt: new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    };

    const updatedVideos = [...videos, newVideo];
    setSaving(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/kt`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoWalkthroughs: updatedVideos }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to add video");

      setVideos(updatedVideos);
      setIsAddVideoOpen(false);
      setVideoForm({ title: "", url: "" });
      addToast({
        title: "Video added",
        message: "New video walkthrough added to project hub.",
        variant: "success",
      });
    } catch (error) {
      addToast({
        title: "Failed to add video",
        message: error instanceof Error ? error.message : "Could not update project video grid.",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVideo = async (videoId) => {
    const updatedVideos = videos.filter((v) => v.id !== videoId);
    setSaving(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/kt`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoWalkthroughs: updatedVideos }),
      });
      if (!response.ok) throw new Error("Failed to delete video");
      setVideos(updatedVideos);
      addToast({
        title: "Video deleted",
        message: "Video walkthrough removed.",
        variant: "success",
      });
    } catch (error) {
      addToast({
        title: "Error",
        message: "Could not remove video walkthrough.",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-8 text-center text-sm text-[color:var(--color-text-muted)]">
        Loading project Knowledge Transfer documentation...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Onboarding Quick commands bar */}
      <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[color:var(--color-text-subtle)]">
              Quickstart local commands
            </h4>
            <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">
              Copy-paste commands to set up this project locally in seconds.
            </p>
          </div>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="rounded-lg border border-[color:var(--color-border)] px-3 py-1.5 text-xs font-medium text-[color:var(--color-text-subtle)] hover:border-[color:var(--color-accent)] hover:text-white transition-colors"
            >
              ✍ Edit Guides
            </button>
          )}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            { label: "1. Clone project", cmd: "git clone <repo-url>", name: "clone" },
            { label: "2. Install packages", cmd: "npm install", name: "install" },
            { label: "3. Launch Dev", cmd: "npm run dev", name: "dev" },
          ].map((item) => (
            <div
              key={item.name}
              onClick={() => handleCopyCommand(item.cmd, item.name)}
              className="flex items-center justify-between rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-muted-bg)] px-3 py-2 cursor-pointer hover:border-[color:var(--color-accent)] transition-all"
            >
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-[color:var(--color-text-muted)] uppercase">
                  {item.label}
                </p>
                <p className="font-mono text-xs text-[color:var(--color-text-subtle)] truncate mt-0.5">
                  {item.cmd}
                </p>
              </div>
              <span className="text-xs text-indigo-400 font-medium shrink-0 ml-2">
                {copyingCmd === item.name ? "✓ Copied" : "Copy"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {isEditing ? (
        // EDIT MODE
        <div className="space-y-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-6">
          <h3 className="text-sm font-semibold text-[color:var(--color-text)]">
            Editing Onboarding Documentation
          </h3>

          <div className="space-y-4">
            <label className="block text-xs font-medium text-[color:var(--color-text-muted)]">
              Quick Start Guide (Markdown supported)
              <textarea
                value={editState.quickStartGuide}
                onChange={(e) => setEditState({ ...editState, quickStartGuide: e.target.value })}
                rows={8}
                className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] p-3 font-mono text-xs text-[color:var(--color-text)] focus:outline-none focus:border-[color:var(--color-accent)]"
              />
            </label>

            <label className="block text-xs font-medium text-[color:var(--color-text-muted)]">
              Architecture & Third-Party APIs (Markdown supported)
              <textarea
                value={editState.architectureNotes}
                onChange={(e) => setEditState({ ...editState, architectureNotes: e.target.value })}
                rows={6}
                className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] p-3 font-mono text-xs text-[color:var(--color-text)] focus:outline-none focus:border-[color:var(--color-accent)]"
              />
            </label>

            <label className="block text-xs font-medium text-[color:var(--color-text-muted)]">
              Environment Variables (Code block / text)
              <textarea
                value={editState.envVariables}
                onChange={(e) => setEditState({ ...editState, envVariables: e.target.value })}
                rows={6}
                className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] p-3 font-mono text-xs text-[color:var(--color-text)] focus:outline-none focus:border-[color:var(--color-accent)]"
              />
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setIsEditing(false)}
              disabled={saving}
              className="rounded-xl border border-[color:var(--color-border)] px-4 py-2 text-xs font-medium text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-muted-bg)] transition-colors"
            >
              Cancel
            </button>
            <ActionButton
              label={saving ? "Saving..." : "Save Documentation"}
              variant="primary"
              onClick={handleSaveGuide}
              disabled={saving}
            />
          </div>
        </div>
      ) : (
        // VIEW MODE
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Guides column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quickstart guide card */}
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-6 space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-[color:var(--color-text-subtle)] border-b border-[color:var(--color-border)] pb-2">
                🚀 Quickstart Local Run Guide
              </h3>
              <div
                className="prose prose-invert max-w-none text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: parseMarkdown(kt?.quickStartGuide) }}
              />
            </div>

            {/* Architecture Notes card */}
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-6 space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-[color:var(--color-text-subtle)] border-b border-[color:var(--color-border)] pb-2">
                ⚙️ Core Architecture & Third-Party Integrations
              </h3>
              <div
                className="prose prose-invert max-w-none text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: parseMarkdown(kt?.architectureNotes) }}
              />
            </div>
          </div>

          {/* Right column: Env vars and Video walk-throughs */}
          <div className="space-y-6">
            {/* Env variables checklist */}
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-6 space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-[color:var(--color-text-subtle)] border-b border-[color:var(--color-border)] pb-2">
                🔑 Environment Keys
              </h3>
              <div
                className="prose prose-invert max-w-none text-xs leading-relaxed font-mono"
                dangerouslySetInnerHTML={{ __html: parseMarkdown(kt?.envVariables) }}
              />
            </div>

            {/* Video Walkthroughs */}
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-[color:var(--color-border)] pb-2">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-[color:var(--color-text-subtle)]">
                  🎥 Video Walkthroughs
                </h3>
                <button
                  onClick={() => setIsAddVideoOpen(true)}
                  className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  + Add Link
                </button>
              </div>

              {videos.length === 0 ? (
                <div className="py-4 text-center text-xs text-[color:var(--color-text-muted)] border border-dashed border-[color:var(--color-border)] rounded-xl">
                  No video walkthrough links added yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {videos.map((vid) => (
                    <div
                      key={vid.id}
                      className="group flex flex-col justify-between rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-muted-bg)] p-3 hover:border-indigo-500/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <a
                          href={vid.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-xs text-indigo-300 hover:underline hover:text-indigo-200 line-clamp-2"
                        >
                          {vid.title}
                        </a>
                        <button
                          onClick={() => handleDeleteVideo(vid.id)}
                          className="text-[10px] text-rose-400 opacity-0 group-hover:opacity-100 hover:text-rose-300 transition-all ml-1 shrink-0"
                          title="Remove video link"
                        >
                          Delete
                        </button>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[9px] text-[color:var(--color-text-subtle)] font-mono">
                        <span className="truncate max-w-[150px]">{vid.url}</span>
                        <span>{vid.createdAt}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Video Modal */}
      <Modal
        isOpen={isAddVideoOpen}
        title="Add Video Walkthrough"
        description="Share a Loom or Drive video link explaining codebase components."
        onClose={() => setIsAddVideoOpen(false)}
      >
        <form onSubmit={handleAddVideo} className="space-y-4 pb-4">
          <label className="block text-xs text-[color:var(--color-text-muted)]">
            Video Title
            <input
              type="text"
              required
              value={videoForm.title}
              onChange={(e) => setVideoForm({ ...videoForm, title: e.target.value })}
              placeholder="e.g., Stripe Payment Gateway Integration Flow"
              className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-sm text-[color:var(--color-text)]"
            />
          </label>

          <label className="block text-xs text-[color:var(--color-text-muted)]">
            Video / Loom URL
            <input
              type="url"
              required
              value={videoForm.url}
              onChange={(e) => setVideoForm({ ...videoForm, url: e.target.value })}
              placeholder="e.g., https://www.loom.com/share/..."
              className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-sm text-[color:var(--color-text)]"
            />
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAddVideoOpen(false)}
              className="rounded-xl border border-[color:var(--color-border)] px-4 py-2 text-xs font-medium text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-muted-bg)]"
            >
              Cancel
            </button>
            <ActionButton
              label="Add Video Link"
              variant="primary"
              type="submit"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
