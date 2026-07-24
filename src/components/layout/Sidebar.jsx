"use client";
import { Button } from "@/components/ui/button";
import ScrollArea from "@/components/ui/ScrollArea";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigationItems } from "@/lib/navigation";
import { Activity, BarChart3, CalendarDays, ChevronLeft, ChevronRight, FolderKanban, LayoutDashboard, LogOut, Milestone, UserRoundPlus } from "lucide-react";

const iconMap = {
  Dashboard: <LayoutDashboard className="h-[18px] w-[18px]" />,
  Projects: <FolderKanban className="h-[18px] w-[18px]" />,
  Milestones: <Milestone className="h-[18px] w-[18px]" />,
  Activity: <Activity className="h-[18px] w-[18px]" />,
  Attendance: <CalendarDays className="h-[18px] w-[18px]" />,
  Reports: <BarChart3 className="h-[18px] w-[18px]" />,
  "Create user": <UserRoundPlus className="h-[18px] w-[18px]" />,
};

const navigationGroups = [
  { label: "Overview", items: ["Dashboard", "Projects", "Milestones", "Activity"] },
  { label: "Operations", items: ["Attendance", "Reports"] },
  { label: "Administration", items: ["Create user"] },
];

function LogoutIcon() {
  return <LogOut className="h-[18px] w-[18px]" aria-hidden="true" />;
}

export default function Sidebar({ activeRole, collapsed, onToggle, onLogout }) {
  const pathname = usePathname();
  const visibleItems = navigationItems.filter((item) =>
    activeRole ? item.roles.includes(activeRole.id) : false,
  );

  const groupedItems = navigationGroups
    .map((group) => ({
      ...group,
      items: visibleItems.filter((item) => group.items.includes(item.label)),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <aside
      className="fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-border/70 bg-background transition-[width] duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none"
      style={{ width: "var(--sidebar-width)" }}
      aria-label="Primary navigation"
    >
      <div className={`relative flex h-[4.75rem] shrink-0 items-center ${collapsed ? "justify-center" : "justify-between px-5"}`}>
        <Button
          type="button"
          variant="ghost"
          onClick={collapsed ? onToggle : undefined}
          tabIndex={collapsed ? 0 : -1}
          className={`flex min-w-0 items-center text-primary focus-visible:ring-ring ${collapsed ? "h-10 w-10 justify-center" : "cursor-default gap-3 hover:bg-transparent"}`}
          aria-label={collapsed ? "Expand sidebar" : undefined}
        >
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center text-base font-bold tracking-[-0.08em]"
            aria-hidden="true"
          >
            PM
          </span>
          <span
            className={`overflow-hidden whitespace-nowrap text-left transition-[max-width,opacity,transform] duration-[180ms] ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none ${collapsed ? "pointer-events-none max-w-0 -translate-x-2 opacity-0" : "max-w-[140px] translate-x-0 opacity-100 delay-75"}`}
            aria-hidden={collapsed}
          >
            <span className="block text-sm font-semibold text-foreground">
              PMS Cloud
            </span>
            <span className="block text-xs text-muted-foreground">
              Workspace
            </span>
          </span>
        </Button>
        {!collapsed ? (
          <Button
            type="button"
            variant="ghost"
            onClick={onToggle}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-muted/60 text-muted-foreground shadow-none transition-colors duration-150 hover:border-primary/30 hover:bg-accent hover:text-primary active:translate-y-px focus-visible:ring-ring"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft className="h-6 w-6" aria-hidden="true" />
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            onClick={onToggle}
            className="absolute -right-4 top-1/2 z-10 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background  duration-150 hover:border-primary/30 hover:bg-accent hover:text-primary focus-visible:ring-ring"
            aria-label="Expand sidebar"
          >
            <ChevronRight className="h-4 w-4 " aria-hidden="true" />
          </Button>
        )}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <nav className={`px-2 pb-5 pt-2 ${collapsed ? "sm:px-2" : "sm:px-3"}`}>
          <TooltipProvider delayDuration={120} skipDelayDuration={100}>
            <div className="space-y-5">
              {groupedItems.map((group, groupIndex) => (
                <div key={group.label} className={collapsed ? "contents" : "space-y-1.5"}>
                  <div className={`px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/75 transition-opacity duration-150 ${collapsed ? "pointer-events-none h-0 overflow-hidden p-0 opacity-0" : "pb-1 opacity-100"}`}>
                    {group.label}
                  </div>
                  {group.items.map((item) => {
                    const isActive =
                      pathname === item.href || pathname.startsWith(`${item.href}/`);
                    const link = (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-label={item.label}
                        aria-current={isActive ? "page" : undefined}
                        className={`group relative flex rounded-xl text-sm font-medium transition-colors duration-150 ease-out motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background ${collapsed ? "h-[4.25rem] flex-col justify-center gap-0.5 px-1 py-1" : "h-11 items-center gap-3 px-3"} ${isActive ? "bg-muted text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                      >
                        {isActive ? <span className="absolute left-0 top-2.5 h-6 w-0.5 rounded-full bg-primary" aria-hidden="true" /> : null}
                        <span className={`flex shrink-0 items-center justify-center text-current ${collapsed ? "h-8 w-10" : "h-8 w-8"}`}>{iconMap[item.label]}</span>
                        {!collapsed ? <span className="max-w-[140px]  overflow-hidden whitespace-nowrap">{item.label}</span> : null}
                      </Link>
                    );
                    return collapsed ? (
                      <Tooltip key={item.href}>
                        <TooltipTrigger asChild>{link}</TooltipTrigger>
                        <TooltipContent side="right">{item.label}</TooltipContent>
                      </Tooltip>
                    ) : link;
                  })}
                  {!collapsed && groupIndex < groupedItems.length - 1 ? <Separator className="mx-3 mt-5 w-auto" /> : null}
                </div>
              ))}
              {!groupedItems.length ? (
                <p className="px-3 text-xs text-muted-foreground">No routes available for this role.</p>
              ) : null}
            </div>
          </TooltipProvider>
        </nav>
      </ScrollArea>

      {onLogout ? (
        <div className={`shrink-0 border-t border-border/70 py-3 ${collapsed ? "px-2" : "px-3"}`}>
          <Button
            type="button"
            onClick={onLogout}
            className={`flex h-10 items-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary/90 focus-visible:ring-ring ${collapsed ? "mx-auto w-10 justify-center px-0" : "w-full gap-3 px-3"}`}
            aria-label="Log out"
          >
            <span className="flex h-8 w-8 items-center justify-center">
              <LogoutIcon />
            </span>
            {!collapsed ? <span>Log out</span> : null}
          </Button>
        </div>
      ) : null}
    </aside>
  );
}
