"use client";
import { Button } from "@/components/ui/button";

import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import { Textarea } from "@/components/ui/textarea";
import useOutsideClick from "@/hooks/useOutsideClick";

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
  const [showDetails, setShowDetails] = useState(false);
  const [mentionState, setMentionState] = useState({
    open: false,
    query: "",
    anchorIndex: null,
  });

  // Edit Comment States
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingMessage, setEditingMessage] = useState("");

  const mentionRef = useRef(null);
  const inputRef = useRef(null);

  useOutsideClick(
    mentionRef,
    () => setMentionState((prev) => ({ ...prev, open: false })),
    mentionState.open
  );

  const getInitials = (name) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

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

  const handleSubmit = async (event) => {
    event?.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) {
      return;
    }

    setStatus((prev) => ({ ...prev, submitting: true }));
    try {
      const response = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType,
          entityId,
          message: trimmed,
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
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to send comment.";
      addToast({
        title: "Comment failed",
        message,
        variant: "error",
      });
    } finally {
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
    if (!confirm("Are you sure you want to delete this comment?")) return;

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
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={status.submitting || !message.trim()}
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
              const initials = getInitials(comment.createdBy?.name);
              const isEditing = editingCommentId === comment.id;

              return (
                <div key={comment.id} className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 font-bold text-xs text-white shadow-sm">
                    {initials}
                  </div>
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
                        <div className="mt-1 w-fit max-w-full rounded-xl border border-[color:var(--color-border)]/40 bg-[color:var(--color-surface-muted)]/60 px-4 py-2 text-xs text-[color:var(--color-text)] whitespace-pre-wrap leading-relaxed shadow-sm">
                          {comment.message}
                        </div>
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
                                onClick={() => handleDeleteComment(comment.id)}
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
              const initials = getInitials(userName);

              return (
                <div key={activity.id} className="flex gap-3 items-start opacity-85">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600/70 font-semibold text-xs text-white/90 shadow-sm">
                    {initials}
                  </div>
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
    </div>
  );
}
