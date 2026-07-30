"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Link2, X } from "lucide-react";
import { Button } from "./button";
import { Input } from "./input";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { cn } from "@/lib/utils";

export default function SearchableTaskSelector({ tasks = [], value = "", onChange, placeholder = "Select a task...", emptyLabel = "General / Unlinked" }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedTask = tasks.find((task) => task.id === value);
  const filteredTasks = useMemo(() => {
    const normalized = query.toLowerCase();
    return tasks.filter((task) => `${task.title} ${task.milestone?.project?.name ?? ""}`.toLowerCase().includes(normalized));
  }, [query, tasks]);

  const choose = (nextValue) => {
    onChange(nextValue);
    setOpen(false);
    setQuery("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="h-10 w-full justify-between px-3 text-left text-sm font-normal">
          <span className="flex min-w-0 items-center gap-2 truncate">
            <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className={cn("truncate", !selectedTask && "text-muted-foreground")}>{selectedTask?.title ?? emptyLabel ?? placeholder}</span>
          </span>
          <span className="flex items-center gap-1">
            {value ? <span role="button" tabIndex={0} aria-label="Clear linked task" className="rounded p-0.5 hover:bg-muted" onClick={(event) => { event.stopPropagation(); choose(""); }}><X className="h-3.5 w-3.5" /></span> : null}
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(22rem,calc(100vw-2rem))] p-2" align="start">
        <Input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tasks..." className="mb-2 h-9" />
        <div className="max-h-56 overflow-y-auto" role="listbox" aria-label="Tasks">
          <Button type="button" variant="ghost" role="option" aria-selected={!value} onClick={() => choose("")} className={cn("h-auto w-full justify-between px-2 py-2 text-left text-sm font-normal", !value && "bg-muted font-medium")}>
            {emptyLabel}<Check className={cn("h-4 w-4", value ? "opacity-0" : "opacity-100")} />
          </Button>
          {filteredTasks.map((task) => {
            const selected = task.id === value;
            return <Button key={task.id} type="button" variant="ghost" role="option" aria-selected={selected} onClick={() => choose(task.id)} className={cn("h-auto w-full justify-between px-2 py-2 text-left text-sm font-normal", selected && "bg-muted font-medium")}>
              <span className="min-w-0"><span className="block truncate">{task.title}</span>{task.milestone?.project?.name ? <span className="block truncate text-xs text-muted-foreground">{task.milestone.project.name}</span> : null}</span>
              <Check className={cn("h-4 w-4 shrink-0", selected ? "opacity-100" : "opacity-0")} />
            </Button>;
          })}
          {!filteredTasks.length ? <p className="px-2 py-4 text-center text-sm text-muted-foreground">No tasks found.</p> : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
