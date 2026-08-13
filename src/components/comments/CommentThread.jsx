"use client";
import { Button } from "@/components/ui/button";
import { createPortal } from "react-dom";

import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import { Textarea } from "@/components/ui/textarea";
import useOutsideClick from "@/hooks/useOutsideClick";
import DeleteConfirmationDialog from "@/components/ui/DeleteConfirmationDialog";
import Avatar from "@/components/ui/Avatar";

const buildErrorMessage = (data, fallback) =>
  data?.error ?? data?.message ?? fallback;

export default function CommentThread({
  entityType,
  entityId,
  currentUser,
  users = [],
  variant = "task",
  autoFocus = false,
  onCommentAdded,
  activities = [],
}) {
  const { addToast } = useToast();
  const [comments, setComments] = useState([]);
  const [lastReadAt, setLastReadAt] = useState(null);
  const [status, setStatus] = useState({
    loading: false,
    submitting: false,
  });
  const [message, setMessage] = useState("");
  const [commentToDelete, setCommentToDelete] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [mentionState, setMentionState] = useState({
    open: false,
    query: "",
    anchorIndex: null,
  });

  // Edit Comment States
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingMessage, setEditingMessage] = useState("");

  // Pending File Upload States
  const [pendingFile, setPendingFile] = useState(null);
  const [pendingPreview, setPendingPreview] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [lightboxAttachment, setLightboxAttachment] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const mentionRef = useRef(null);
  const inputRef = useRef(null);

  useOutsideClick(
    mentionRef,
    () => setMentionState((prev) => ({ ...prev, open: false })),
    mentionState.open
  );

  const filteredUsers = useMemo(() => {
    if (!mentionState.query) {
      return users;
    }
    const query = mentionState.query.toLowerCase();
    return users.filter(
      (user) =>
        user.name?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query)
    );
  }, [mentionState.query, users]);

  // Combine comments and activities chronologically (newest first)
  const timelineItems = useMemo(() => {
    const commentItems = comments.map((c) => ({
      id: c.id,
      type: "comment",
      date: new Date(c.createdAt),
      data: c,
    }));

    const activityItems = showDetails
      ? activities.map((a) => ({
        id: a.id,
        type: "activity",
        date: new Date(a.date || a.createdAt || Date.now()),
        data: a,
      }))
      : [];

    return [...commentItems, ...activityItems].sort(
      (a, b) => b.date.getTime() - a.date.getTime()
    );
  }, [comments, activities, showDetails]);

  useEffect(() => {
    if (!entityType || !entityId) {
      setComments([]);
      setLastReadAt(null);
      return;
    }

    const loadComments = async () => {
      setStatus((prev) => ({ ...prev, loading: true }));
      try {
        const response = await fetch(
          `/api/comments?entityType=${entityType}&entityId=${entityId}`
        );
        const data = await response.json();
        if (!response.ok) {
          throw new Error(buildErrorMessage(data, "Unable to load comments."));
        }
        setComments(data?.comments ?? []);
        setLastReadAt(data?.readState?.lastReadAt ?? null);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to load comments.";
        addToast({
          title: "Comments unavailable",
          message,
          variant: "error",
        });
        setComments([]);
      } finally {
        setStatus((prev) => ({ ...prev, loading: false }));
      }
    };

    loadComments();
  }, [addToast, entityId, entityType]);

  useEffect(() => {
    if (!entityType || !entityId || status.loading) {
      return;
    }

    const markRead = async () => {
      try {
        await fetch("/api/comments/mark-read", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entityType, entityId }),
        });
        setLastReadAt(new Date().toISOString());
      } catch (error) {
        // Silent fail to avoid blocking UI.
      }
    };

    markRead();
  }, [entityId, entityType, status.loading]);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleMessageChange = (event) => {
    const value = event.target.value;
    setMessage(value);

    const cursorIndex = event.target.selectionStart ?? value.length;
    const slice = value.slice(0, cursorIndex);
    const atIndex = slice.lastIndexOf("@");
    if (atIndex >= 0) {
      const query = slice.slice(atIndex + 1);
      if (query.length >= 1 && !query.includes(" ")) {
        setMentionState({ open: true, query, anchorIndex: atIndex });
        return;
      }
    }
    setMentionState({ open: false, query: "", anchorIndex: null });
  };

  const handleMentionSelect = (user) => {
    if (mentionState.anchorIndex === null) {
      return;
    }

    const before = message.slice(0, mentionState.anchorIndex);
    const after = message.slice(
      mentionState.anchorIndex + mentionState.query.length + 1
    );
    const mentionText = `@${user.name}`;
    const nextValue = `${before}${mentionText} ${after}`.replace(/\s+/g, " ");
    setMessage(nextValue);
    setMentionState({ open: false, query: "", anchorIndex: null });
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedPrefixes = ["image/", "video/", "application/pdf", "text/plain"];
    const isAllowedType = allowedPrefixes.some(pref => file.type.startsWith(pref));
    if (!isAllowedType) {
      addToast({
        title: "Invalid file type",
        message: "Only images, videos, PDFs, and plain text files are allowed.",
        variant: "error",
      });
      return;
    }

    if (pendingPreview) {
      URL.revokeObjectURL(pendingPreview);
    }

    setPendingFile(file);
    setPendingPreview(URL.createObjectURL(file));
    e.target.value = "";
  };

  const handleCancelPending = () => {
    if (pendingPreview) {
      URL.revokeObjectURL(pendingPreview);
    }
    setPendingFile(null);
    setPendingPreview(null);
    setUploadProgress(0);
  };

  const handleSubmit = async (event) => {
    event?.preventDefault();
    const trimmed = message.trim();
    if (!trimmed && !pendingFile) {
      return;
    }

    setStatus((prev) => ({ ...prev, submitting: true }));
    let uploadedAttachment = null;

    try {
      if (pendingFile) {
        setIsUploading(true);
        setUploadProgress(0);

        // 1. Get presigned URL
        const res = await fetch("/api/upload/presigned", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: pendingFile.name,
            fileType: pendingFile.type,
            uploadType: "comment"
          }),
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData?.message || "Failed to get upload signature.");
        }

        const { uploadUrl, fileUrl, fileKey } = await res.json();

        // 2. Direct upload to S3
        await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", uploadUrl, true);
          xhr.setRequestHeader("Content-Type", pendingFile.type);

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const percent = Math.round((event.loaded / event.total) * 100);
              setUploadProgress(percent);
            }
          };

          xhr.onload = () => {
            if (xhr.status === 200) resolve();
            else reject(new Error("S3 upload failed."));
          };

          xhr.onerror = () => reject(new Error("Network error during S3 upload."));
          xhr.send(pendingFile);
        });

        uploadedAttachment = {
          name: pendingFile.name,
          size: (pendingFile.size / 1024).toFixed(1) + " KB",
          type: pendingFile.type,
          url: fileUrl,
          key: fileKey
        };
      }

      // 3. Create comment
      const response = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType,
          entityId,
          message: trimmed,
          attachment: uploadedAttachment
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(buildErrorMessage(data, "Unable to send comment."));
      }

      setComments((prev) => [...prev, data.comment]);
      onCommentAdded?.(data.comment);

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("pms:refresh-notifications"));
      }

      setMessage("");
      handleCancelPending();
    } catch (error) {
      console.error("Comment submission error:", error);
      const msg = error instanceof Error ? error.message : "Unable to send comment.";
      addToast({
        title: "Comment failed",
        message: msg,
        variant: "error",
      });
    } finally {
      setIsUploading(false);
      setStatus((prev) => ({ ...prev, submitting: false }));
    }
  };

  const handleUpdateComment = async (commentId) => {
    const trimmed = editingMessage.trim();
    if (!trimmed) return;

    try {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(buildErrorMessage(data, "Unable to update comment."));
      }

      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? data.comment : c))
      );
      setEditingCommentId(null);
      setEditingMessage("");
      addToast({
        title: "Comment updated",
        message: "Your comment was updated successfully.",
        variant: "success",
      });
    } catch (error) {
      addToast({
        title: "Update failed",
        message: error instanceof Error ? error.message : "Unable to update comment.",
        variant: "error",
      });
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(buildErrorMessage(data, "Unable to delete comment."));
      }

      setComments((prev) => prev.filter((c) => c.id !== commentId));
      addToast({
        title: "Comment deleted",
        message: "Your comment has been deleted.",
        variant: "info",
      });
    } catch (error) {
      addToast({
        title: "Delete failed",
        message: error instanceof Error ? error.message : "Unable to delete comment.",
        variant: "error",
      });
    }
  };

  const requestCommentDelete = (commentId) => setCommentToDelete(commentId);

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header section matching Trello */}
      <div className="flex items-center justify-between border-b border-[color:var(--color-border)]/50 pb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[color:var(--color-text-subtle)] flex items-center gap-1.5">
          💬 Comments and activity
        </h3>
        <button
          type="button"
          onClick={() => setShowDetails((prev) => !prev)}
          className="rounded-lg border border-[color:var(--color-border)] px-3 py-1 text-[11px] font-semibold text-[color:var(--color-text-muted)] hover:border-[color:var(--color-accent)] hover:text-white transition-all bg-[color:var(--color-muted-bg)]/20"
        >
          {showDetails ? "Hide details" : "Show details"}
        </button>
      </div>

      {/* Input box section */}
      <div className="space-y-2">
        <div className="relative" ref={mentionRef}>
          <Textarea
            ref={inputRef}
            rows={3}
            value={message}
            onChange={handleMessageChange}
            placeholder="Write a comment..."
            className="w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-4 py-2.5 text-xs text-[color:var(--color-text)] outline-none focus:border-[color:var(--color-accent)] placeholder-[color:var(--color-text-subtle)] resize-none"
          />
          {mentionState.open && filteredUsers.length > 0 ? (
            <div className="absolute bottom-full left-0 z-10 mb-2 max-h-48 overflow-y-auto w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-2 text-xs shadow-lg">
              {filteredUsers.map((user) => (
                <Button
                  key={user.id}
                  type="button"
                  onClick={() => handleMentionSelect(user)}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-[color:var(--color-text)] hover:bg-[color:var(--color-muted-bg)]"
                >
                  <span>{user.name}</span>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
                    {user.role}
                  </span>
                </Button>
              ))}
            </div>
          ) : null}
        </div>
        {pendingPreview && (
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-indigo-500/50 bg-indigo-500/5 p-2.5">
            <div className="h-10 w-10 shrink-0 rounded bg-black/30 overflow-hidden flex items-center justify-center relative">
              {pendingFile.type.startsWith("image/") ? (
                <img src={pendingPreview} alt="Preview" className="h-full w-full object-cover" />
              ) : pendingFile.type.startsWith("video/") ? (
                <video src={pendingPreview} className="h-full w-full object-cover" muted />
              ) : (
                <span className="text-xl">{pendingFile.type === "application/pdf" ? "📕" : "📄"}</span>
              )}
              {isUploading && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-[9px] font-bold text-white">
                  {uploadProgress}%
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-[color:var(--color-text)]">
                {pendingFile.name}
              </p>
              <p className="mt-0.5 text-[10px] text-[color:var(--color-text-subtle)] font-mono">
                {(pendingFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
            {!isUploading && (
              <button
                type="button"
                onClick={handleCancelPending}
                className="text-xs text-rose-400 hover:text-rose-300 px-1"
              >
                ✕
              </button>
            )}
          </div>
        )}
        <div className="flex justify-between items-center">
          <label className="cursor-pointer flex items-center justify-center p-2 rounded-lg bg-[color:var(--color-muted-bg)]/30 border border-[color:var(--color-border)] hover:bg-[color:var(--color-muted-bg)]/60 text-[color:var(--color-text-subtle)] hover:text-white transition-all shadow-sm group">
            <svg
              className="h-4.5 w-4.5 text-[color:var(--color-text-subtle)] group-hover:text-white transition-colors"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.122 2.122l7.81-7.81a1.5 1.5 0 00-2.122-2.122z"
              />
            </svg>
            <input
              type="file"
              accept="image/*,video/*,application/pdf,text/plain"
              onChange={handleFileChange}
              disabled={isUploading}
              className="hidden"
            />
          </label>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={status.submitting || isUploading || (!message.trim() && !pendingFile)}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status.submitting ? "Sending..." : "Send"}
          </Button>
        </div>
      </div>

      {/* Timeline List (Comments + Activities) */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {status.loading ? (
          <p className="text-xs text-[color:var(--color-text-subtle)] italic">
            Loading timeline...
          </p>
        ) : timelineItems.length === 0 ? (
          <p className="text-xs text-[color:var(--color-text-subtle)] italic">
            No comments or activity yet.
          </p>
        ) : (
          timelineItems.map((item) => {
            if (item.type === "comment") {
              const comment = item.data;
              const isCurrentUser = comment.createdBy?.id === currentUser?.id;
              const commentAuthor = comment.createdBy ?? {};
              const commentProfile = users.find((user) => user.id === commentAuthor.id)
                ?? (isCurrentUser ? currentUser : null);
              const isEditing = editingCommentId === comment.id;

              return (
                <div key={comment.id} className="flex gap-3">
                  <Avatar
                    src={commentAuthor.image ?? commentProfile?.image}
                    name={commentAuthor.name ?? commentAuthor.email ?? "Teammate"}
                    alt={`${commentAuthor.name ?? "Teammate"} avatar`}
                    className="h-8 w-8 text-xs"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="font-semibold text-xs text-[color:var(--color-text)]">
                        {comment.createdBy?.name || "Teammate"}
                      </span>
                      <span className="text-[10px] text-[color:var(--color-text-subtle)] hover:underline cursor-pointer">
                        {new Date(comment.createdAt).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {comment.updatedAt && (
                        <span
                          className="text-[9.5px] text-[color:var(--color-text-subtle)] font-medium italic"
                          title={`Edited on ${new Date(comment.updatedAt).toLocaleString()}`}
                        >
                          (edited)
                        </span>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="mt-2 space-y-2">
                        <textarea
                          value={editingMessage}
                          onChange={(e) => setEditingMessage(e.target.value)}
                          className="w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-xs text-[color:var(--color-text)] outline-none focus:border-[color:var(--color-accent)]"
                          rows={2}
                        />
                        <div className="flex gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => setEditingCommentId(null)}
                            className="px-2.5 py-1 text-[10px] rounded border border-[color:var(--color-border)] text-[color:var(--color-text-subtle)] hover:text-white"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateComment(comment.id)}
                            className="px-2.5 py-1 text-[10px] rounded bg-indigo-600 text-white font-semibold hover:bg-indigo-500"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {comment.message && (
                          <div className="mt-1 w-fit max-w-full rounded-xl border border-[color:var(--color-border)]/40 bg-[color:var(--color-surface-muted)]/60 px-4 py-2 text-xs text-[color:var(--color-text)] whitespace-pre-wrap leading-relaxed shadow-sm">
                            {comment.message}
                          </div>
                        )}
                        {comment.attachment && (
                          <div 
                            onClick={() => setLightboxAttachment(comment.attachment)}
                            className="mt-2 flex items-center gap-3 cursor-pointer rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-muted-bg)]/20 p-2.5 hover:border-[color:var(--color-accent)]/30 hover:bg-[color:var(--color-muted-bg)]/40 transition-all group max-w-xs"
                          >
                            <div className="h-9 w-9 shrink-0 rounded-lg overflow-hidden bg-black/40 flex items-center justify-center relative">
                              {comment.attachment.type.startsWith("image/") ? (
                                <img src={comment.attachment.url} alt={comment.attachment.name} className="h-full w-full object-cover" />
                              ) : comment.attachment.type.startsWith("video/") ? (
                                <span className="text-sm">🎥</span>
                              ) : comment.attachment.type === "application/pdf" ? (
                                <span className="text-sm">📕</span>
                              ) : (
                                <span className="text-sm">📄</span>
                              )}
                              <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[9px] text-white font-bold transition-opacity">
                                👁️
                              </div>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[11px] font-semibold text-[color:var(--color-text)]">
                                {comment.attachment.name}
                              </p>
                              <p className="mt-0.5 text-[9px] text-[color:var(--color-text-subtle)] font-mono">
                                {comment.attachment.size}
                              </p>
                            </div>
                          </div>
                        )}
                        <div className="mt-1 flex items-center gap-2 text-[10px] text-[color:var(--color-text-subtle)]">
                          <span className="cursor-pointer hover:text-white" title="React">
                            😊
                          </span>
                          {isCurrentUser && (
                            <>
                              <span>•</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCommentId(comment.id);
                                  setEditingMessage(comment.message);
                                }}
                                className="hover:text-white hover:underline"
                              >
                                Edit
                              </button>
                              <span>•</span>
                              <button
                                type="button"
                                onClick={() => requestCommentDelete(comment.id)}
                                className="hover:text-rose-400 hover:underline"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            } else {
              // Activity item style
              const activity = item.data;
              const userObj = users.find((u) => u.id === activity.userId);
              const userName = userObj?.name || "Teammate";

              return (
                <div key={activity.id} className="flex gap-3 items-start opacity-85">
                  <Avatar
                    src={userObj?.image}
                    name={userObj?.name ?? userObj?.email ?? "Teammate"}
                    alt={`${userName} avatar`}
                    className="h-8 w-8 text-xs"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[color:var(--color-text-muted)]">
                      <span className="font-semibold text-[color:var(--color-text)]">
                        {userName}
                      </span>{" "}
                      {activity.description}
                    </p>
                    <span className="text-[10px] text-[color:var(--color-text-subtle)] hover:underline cursor-pointer">
                      {new Date(activity.date || activity.createdAt).toLocaleString(
                        "en-US",
                        {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      )}
                    </span>
                  </div>
                </div>
              );
            }
          })
        )}
      </div>
      <DeleteConfirmationDialog
        open={Boolean(commentToDelete)}
        onOpenChange={(open) => { if (!open) setCommentToDelete(null); }}
        onConfirm={() => handleDeleteComment(commentToDelete)}
      />

      {mounted && lightboxAttachment ? createPortal(
        <div 
          className="fixed inset-0 z-[10006] flex flex-col items-center justify-center bg-black/95 p-4 transition-all"
          onClick={() => setLightboxAttachment(null)}
        >
          {/* Header Panel */}
          <div className="absolute top-0 inset-x-0 h-16 bg-black/40 flex items-center justify-between px-6 z-10">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                {lightboxAttachment.name}
              </p>
              <p className="mt-0.5 text-[10.5px] text-white/60 font-mono">
                {lightboxAttachment.size} · {lightboxAttachment.type}
              </p>
            </div>
            <button 
              className="rounded-full bg-white/10 p-2 text-white/80 hover:bg-white/20 hover:text-white transition-colors"
              onClick={() => setLightboxAttachment(null)}
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Interactive Player / Viewer */}
          <div 
            className="w-full max-w-5xl max-h-[80vh] flex items-center justify-center mt-16 overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {lightboxAttachment.type.startsWith("image/") ? (
              <img 
                src={lightboxAttachment.url} 
                alt={lightboxAttachment.name} 
                className="max-h-[80vh] max-w-full rounded-lg object-contain shadow-2xl"
              />
            ) : lightboxAttachment.type.startsWith("video/") ? (
              <video 
                src={lightboxAttachment.url} 
                controls 
                autoPlay 
                className="max-h-[80vh] w-full rounded-lg shadow-2xl bg-black"
              />
            ) : lightboxAttachment.type === "application/pdf" ? (
              <iframe 
                src={lightboxAttachment.url} 
                className="w-full h-[75vh] rounded-lg shadow-2xl bg-white border-0"
              />
            ) : lightboxAttachment.type === "text/plain" ? (
              <TextFileViewer url={lightboxAttachment.url} />
            ) : (
              <div className="text-center p-8 bg-[color:var(--color-card)] border border-[color:var(--color-border)] rounded-2xl max-w-md shadow-2xl">
                <span className="text-5xl block mb-3">📁</span>
                <p className="text-sm font-semibold text-[color:var(--color-text)] mb-4">
                  Preview is not supported for this file type.
                </p>
                <a 
                  href={lightboxAttachment.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-block rounded-lg bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-xs font-bold text-white transition-colors shadow"
                >
                  Download File
                </a>
              </div>
            )}
          </div>
        </div>,
        document.body
      ) : null}
    </div>
  );
}

const TextFileViewer = ({ url }) => {
  const [content, setContent] = useState("Loading file contents...");

  useEffect(() => {
    fetch(url)
      .then((res) => res.text())
      .then((text) => setContent(text))
      .catch((err) => setContent("Error loading file contents: " + err.message));
  }, [url]);

  return (
    <pre className="w-full max-h-[70vh] rounded-lg shadow-2xl bg-zinc-950/90 text-zinc-200 border border-zinc-800 p-6 overflow-auto text-left font-mono text-xs whitespace-pre-wrap leading-relaxed">
      {content}
    </pre>
  );
}
