"use client";

import Link from "next/link";
import { ChevronDown, LogOut, User } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import Avatar from "@/components/ui/Avatar";
import { Switch } from "@/components/ui/switch";
import {
  isNotificationSoundMuted,
  NOTIFICATION_SOUND_PREFERENCE_EVENT,
  setNotificationSoundMuted,
} from "@/lib/notificationPreferences";

export default function SidebarProfile({ session, collapsed, onLogout }) {
  const name = session?.name || session?.email || "User";
  const email = session?.email || "";
  const [isSoundMuted, setIsSoundMuted] = useState(false);

  useEffect(() => {
    const syncPreference = () => setIsSoundMuted(isNotificationSoundMuted());
    syncPreference();
    window.addEventListener("storage", syncPreference);
    window.addEventListener(NOTIFICATION_SOUND_PREFERENCE_EVENT, syncPreference);
    return () => {
      window.removeEventListener("storage", syncPreference);
      window.removeEventListener(NOTIFICATION_SOUND_PREFERENCE_EVENT, syncPreference);
    };
  }, []);

  return (
    <div className={`shrink-0 border-t border-border/70 py-3 ${collapsed ? "px-2" : "px-3"}`}>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={`group flex w-full items-center rounded-xl border border-border/80 bg-muted/35 text-left transition-[background-color,border-color,box-shadow] duration-150 hover:border-primary/25 hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${collapsed ? "h-12 justify-center p-1.5" : "gap-3 p-2"}`}
            aria-label={collapsed ? `Open profile menu for ${name}` : "Open profile menu"}
          >
            <Avatar src={session?.image} name={name} alt={`${name} avatar`} className="h-9 w-9 border border-border shadow-sm" />
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
            <Avatar src={session?.image} name={name} alt={`${name} avatar`} className="h-10 w-10 border border-border" />
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
          <div className="px-2.5 py-2">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Notifications
            </p>
            <label className="flex items-center justify-between gap-3 text-sm font-medium text-foreground">
              <span>Notifications Sound</span>
              <Switch
                checked={!isSoundMuted}
                onCheckedChange={(soundsEnabled) => setNotificationSoundMuted(!soundsEnabled)}
                aria-label="Enable notification sounds"
              />
            </label>
          </div>
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
