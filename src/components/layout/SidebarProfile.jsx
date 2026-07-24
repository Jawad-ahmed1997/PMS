"use client";

import Link from "next/link";
import { ChevronDown, LogOut, User } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";

function getInitials(name, email) {
  const value = name?.trim() || email?.trim() || "U";
  const parts = value.split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : value.slice(0, 2))
    .toUpperCase();
}

export default function SidebarProfile({ session, collapsed, onLogout }) {
  const name = session?.name || session?.email || "User";
  const email = session?.email || "";
  const initials = getInitials(session?.name, session?.email);

  return (
    <div className={`shrink-0 border-t border-border/70 py-3 ${collapsed ? "px-2" : "px-3"}`}>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={`group flex w-full items-center rounded-xl border border-border/80 bg-muted/35 text-left transition-[background-color,border-color,box-shadow] duration-150 hover:border-primary/25 hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${collapsed ? "h-12 justify-center p-1.5" : "gap-3 p-2"}`}
            aria-label={collapsed ? `Open profile menu for ${name}` : "Open profile menu"}
          >
            <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-background text-xs font-semibold text-foreground shadow-sm">
              {session?.image ? (
                <img src={session.image} alt="" className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </span>
            {!collapsed ? (
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-foreground">{name}</span>
                <span className="block truncate text-xs text-muted-foreground">{email}</span>
              </span>
            ) : null}
            {!collapsed ? (
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" aria-hidden="true" />
            ) : null}
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="right"
          align="end"
          sideOffset={10}
          className="w-64 rounded-xl border-border/80 bg-popover p-2.5 shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 data-[state=open]:slide-in-from-bottom-2 data-[state=closed]:slide-out-to-bottom-2 duration-200"
        >
          <div className="flex items-center gap-3 px-2 py-2">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-xs font-semibold text-foreground">
              {session?.image ? (
                <img src={session.image} alt="" className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{name}</p>
              <p className="truncate text-xs text-muted-foreground">{email}</p>
            </div>
          </div>
          <div className="my-1.5">
            <Separator />
          </div>
          <Link
            href="/profile"
            className="flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium text-foreground outline-none transition-colors hover:bg-muted focus-visible:bg-muted"
          >
            <User className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <span>Profile</span>
          </Link>
          <div className="my-1.5">
            <Separator />
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium text-destructive outline-none transition-[background-color,color] duration-200 hover:bg-destructive/10 hover:text-destructive focus-visible:bg-destructive/10"
          >
            <LogOut className="h-4 w-4 text-current" aria-hidden="true" />
            <span>Sign Out</span>
          </button>
        </PopoverContent>
      </Popover>
    </div>
  );
}
