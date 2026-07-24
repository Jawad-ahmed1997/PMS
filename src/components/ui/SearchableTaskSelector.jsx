"use client";

import { useEffect, useRef, useState } from "react";
import { Link2, X } from "lucide-react";

export default function SearchableTaskSelector({
  tasks = [],
  value = "",
  onChange,
  placeholder = "Select a task...",
  emptyLabel = "General / Unlinked",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedTask = tasks.find((t) => t.id === value);

  const filteredTasks = tasks.filter((task) => {
    const query = searchQuery.toLowerCase();
    const taskTitle = (task.title ?? "").toLowerCase();
    const projectName = (task.milestone?.project?.name ?? "").toLowerCase();
    return taskTitle.includes(query) || projectName.includes(query);
  });

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger Button */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setIsOpen(!isOpen);
            setSearchQuery("");
          }}
          className="w-full flex items-center justify-between rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] pl-3 pr-2.5 py-1.5 text-xs text-[color:var(--color-text)] text-left focus:outline-none focus:ring-1 focus:ring-[color:var(--color-accent)] transition-all"
        >
          <span className="truncate flex items-center gap-1.5">
            <Link2 className="h-3.5 w-3.5 text-[color:var(--color-text-muted)] shrink-0" />
            {selectedTask ? (
              <span className="font-medium text-[color:var(--color-text)]">
                {selectedTask.title}
                {selectedTask.milestone?.project?.name && (
                  <span className="ml-1.5 text-[10px] text-[color:var(--color-text-muted)] font-normal">
                    ({selectedTask.milestone.project.name})
                  </span>
                )}
              </span>
            ) : (
              <span className="text-[color:var(--color-text-subtle)]">{emptyLabel}</span>
            )}
          </span>
          <span className="flex items-center gap-1">
            {value && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onChange("");
                }}
                className="p-0.5 rounded-full hover:bg-[color:var(--color-border)] text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]"
              >
                <X className="h-3 w-3" />
              </span>
            )}
            <svg
              className={`h-3.5 w-3.5 text-[color:var(--color-text-muted)] transition-transform duration-200 ${
                isOpen ? "rotate-180" : ""
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="1.8"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          </span>
        </button>
      </div>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute z-50 mt-1.5 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] shadow-xl overflow-hidden flex flex-col max-h-60">
          {/* Search Input inside Dropdown */}
          <div className="p-2 border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)]/20 shrink-0">
            <input
              type="text"
              autoFocus
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-input)] text-[color:var(--color-text)] placeholder-[color:var(--color-text-subtle)] focus:outline-none focus:border-[color:var(--color-accent)] transition-colors"
            />
          </div>

          {/* Tasks List */}
          <div className="overflow-y-auto flex-1 py-1 divide-y divide-[color:var(--color-border)]/20">
            {/* General/Unlinked Option */}
            <button
              type="button"
              onClick={() => {
                onChange("");
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-[color:var(--color-surface-muted)] ${
                !value ? "bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)] font-semibold" : "text-[color:var(--color-text-subtle)]"
              }`}
            >
              {emptyLabel}
            </button>

            {/* Filtered Tasks */}
            {filteredTasks.length === 0 ? (
              <div className="px-3 py-3 text-center text-xs text-[color:var(--color-text-subtle)]">
                No tasks found.
              </div>
            ) : (
              filteredTasks.map((task) => {
                const isSelected = task.id === value;
                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => {
                      onChange(task.id);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-[color:var(--color-surface-muted)] flex flex-col gap-0.5 ${
                      isSelected
                        ? "bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)] font-semibold"
                        : "text-[color:var(--color-text)]"
                    }`}
                  >
                    <span className="truncate">{task.title}</span>
                    {task.milestone?.project?.name && (
                      <span className={`text-[9px] font-normal truncate ${isSelected ? "text-[color:var(--color-accent)]/80" : "text-[color:var(--color-text-muted)]"}`}>
                        Project: {task.milestone.project.name}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
