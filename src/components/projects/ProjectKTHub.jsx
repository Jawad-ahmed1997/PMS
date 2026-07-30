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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/ToastProvider";

// Simple client-side Markdown parser
function parseMarkdown(text) {
  if (!text) return "";
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Headers (e.g. ### Header)
  html = html.replace(/^### (.*?)$/gm, '<h3 class="mt-4 mb-2 text-sm font-bold text-foreground">$1</h3>');
  html = html.replace(/^## (.*?)$/gm, '<h2 class="mt-5 mb-2 text-base font-bold text-foreground">$1</h2>');
  html = html.replace(/^# (.*?)$/gm, '<h1 class="mt-6 mb-3 text-lg font-bold text-foreground">$1</h1>');

  // Bold (**text** or __text__)
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__(.*?)__/g, "<strong>$1</strong>");

  // Italics (*text* or _text_)
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
  html = html.replace(/_(.*?)_/g, "<em>$1</em>");

  // Monospace / Code Block
  html = html.replace(/```([\s\S]*?)```/gm, '<pre class="my-3 overflow-x-auto rounded-xl border border-border bg-muted p-3 font-mono text-xs text-muted-foreground">$1</pre>');
  html = html.replace(/`(.*?)`/g, '<code class="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs text-primary">$1</code>');

  // Bullet Lists
  html = html.replace(/^\s*-\s+(.*?)$/gm, '<li class="ml-4 list-disc text-sm text-muted-foreground">$1</li>');

  // Paragraphs
  html = html.replace(/^(?!<(h|li|pre|code))+(.*?)$/gm, '<p class="mb-3 text-sm leading-relaxed text-muted-foreground">$2</p>');

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
      <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Loading project Knowledge Transfer documentation...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Onboarding Quick commands bar */}
      <div className="rounded-2xl border border-border bg-card p-5 transition-colors duration-200 hover:border-primary/30">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Quickstart local commands
            </h4>
            <p className="mt-1 text-xs text-muted-foreground">
              Copy-paste commands to set up this project locally in seconds.
            </p>
          </div>
          {!isEditing && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
            >
              ✍ Edit Guides
            </Button>
          )}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            { label: "1. Clone project", cmd: "git clone <repo-url>", name: "clone" },
            { label: "2. Install packages", cmd: "npm install", name: "install" },
            { label: "3. Launch Dev", cmd: "npm run dev", name: "dev" },
          ].map((item) => (
            <Button
              type="button"
              variant="outline"
              key={item.name}
              onClick={() => handleCopyCommand(item.cmd, item.name)}
              className="h-auto min-w-0 justify-between rounded-xl bg-muted px-3 py-2 text-left transition-colors duration-200 hover:border-primary/40"
            >
              <span className="min-w-0">
                <span className="block text-[10px] font-semibold uppercase text-muted-foreground">
                  {item.label}
                </span>
                <span className="mt-0.5 block truncate font-mono text-xs text-muted-foreground">
                  {item.cmd}
                </span>
              </span>
              <span className="ml-2 shrink-0 text-xs font-medium text-primary">
                {copyingCmd === item.name ? "✓ Copied" : "Copy"}
              </span>
            </Button>
          ))}
        </div>
      </div>

      {isEditing ? (
        // EDIT MODE
        <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
          <h3 className="text-sm font-semibold text-foreground">
            Editing Onboarding Documentation
          </h3>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium">
              Quick Start Guide (Markdown supported)
              </Label>
              <Textarea
                value={editState.quickStartGuide}
                onChange={(e) => setEditState({ ...editState, quickStartGuide: e.target.value })}
                rows={8}
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">
              Architecture & Third-Party APIs (Markdown supported)
              </Label>
              <Textarea
                value={editState.architectureNotes}
                onChange={(e) => setEditState({ ...editState, architectureNotes: e.target.value })}
                rows={6}
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">
              Environment Variables (Code block / text)
              </Label>
              <Textarea
                value={editState.envVariables}
                onChange={(e) => setEditState({ ...editState, envVariables: e.target.value })}
                rows={6}
                className="font-mono text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditing(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveGuide}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Documentation"}
            </Button>
          </div>
        </div>
      ) : (
        // VIEW MODE
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Guides column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quickstart guide card */}
            <div className="rounded-2xl border border-border bg-card p-6 space-y-3 transition-colors duration-200 hover:border-primary/30">
              <h3 className="border-b border-border pb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                🚀 Quickstart Local Run Guide
              </h3>
              <div
                className="prose max-w-none text-sm leading-relaxed dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: parseMarkdown(kt?.quickStartGuide) }}
              />
            </div>

            {/* Architecture Notes card */}
            <div className="rounded-2xl border border-border bg-card p-6 space-y-3 transition-colors duration-200 hover:border-primary/30">
              <h3 className="border-b border-border pb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                ⚙️ Core Architecture & Third-Party Integrations
              </h3>
              <div
                className="prose max-w-none text-sm leading-relaxed dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: parseMarkdown(kt?.architectureNotes) }}
              />
            </div>
          </div>

          {/* Right column: Env vars and Video walk-throughs */}
          <div className="space-y-6">
            {/* Env variables checklist */}
            <div className="rounded-2xl border border-border bg-card p-6 space-y-3 transition-colors duration-200 hover:border-primary/30">
              <h3 className="border-b border-border pb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                🔑 Environment Keys
              </h3>
              <div
                className="prose max-w-none font-mono text-xs leading-relaxed dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: parseMarkdown(kt?.envVariables) }}
              />
            </div>

            {/* Video Walkthroughs */}
            <div className="rounded-2xl border border-border bg-card p-6 space-y-4 transition-colors duration-200 hover:border-primary/30">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  🎥 Video Walkthroughs
                </h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsAddVideoOpen(true)}
                >
                  Add Link
                </Button>
              </div>

              {videos.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border py-4 text-center text-xs text-muted-foreground">
                  No video walkthrough links added yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {videos.map((vid) => (
                    <div
                      key={vid.id}
                      className="group flex flex-col justify-between rounded-xl border border-border bg-muted p-3 transition-colors duration-200 hover:border-primary/40"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <a
                          href={vid.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="line-clamp-2 text-xs font-medium text-primary hover:underline"
                        >
                          {vid.title}
                        </a>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteVideo(vid.id)}
                          className="ml-1 h-7 shrink-0 px-2 text-[10px] text-destructive opacity-0 transition-opacity group-hover:opacity-100"
                          title="Remove video link"
                        >
                          Delete
                        </Button>
                      </div>
                      <div className="mt-2 flex items-center justify-between font-mono text-[9px] text-muted-foreground">
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

      {/* Add Video Dialog */}
      <DialogRoot
        open={isAddVideoOpen}
        onOpenChange={(open) => !open && setIsAddVideoOpen(false)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Video Walkthrough</DialogTitle>
            <DialogDescription>
              Share a Loom or Drive video link explaining codebase components.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddVideo} className="mt-6 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="kt-video-title">Video Title</Label>
              <Input
                id="kt-video-title"
                type="text"
                required
                value={videoForm.title}
                onChange={(e) => setVideoForm({ ...videoForm, title: e.target.value })}
                placeholder="e.g., Stripe Payment Gateway Integration Flow"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="kt-video-url">Video / Loom URL</Label>
              <Input
                id="kt-video-url"
                type="url"
                required
                value={videoForm.url}
                onChange={(e) => setVideoForm({ ...videoForm, url: e.target.value })}
                placeholder="e.g., https://www.loom.com/share/..."
              />
            </div>

            <DialogFooter className="border-t border-border pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddVideoOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Add Video Link</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </DialogRoot>
    </div>
  );
}
