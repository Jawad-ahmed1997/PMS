"use client";
import { Button } from "@/components/ui/button";

import { useEffect, useRef, useState } from "react";
import Logo from "@/components/ui/Logo";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { getRoleById } from "@/lib/roles";
import AccessDeniedToast from "@/components/layout/AccessDeniedToast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import NotificationSheet from "@/components/notifications/NotificationDrawer";
import RouteProgress from "@/components/layout/RouteProgress";
import { logoutAction } from "@/app/logout/actions";
import {
  NotificationCountsProvider,
  useNotificationCounts,
} from "@/components/notifications/NotificationCountsContext";
import { Bell } from "lucide-react";

const SIDEBAR_STATE_KEY = "pms.sidebar.collapsed";

function normalizeTitle(value) {
  if (!value) return "";
  return value.replace(/^\(\d+\)\s*/, "").replace(/^●\s*/, "");
}

function AppShellContent({ children, session }) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(
    () =>
      typeof window !== "undefined" &&
      window.localStorage.getItem(SIDEBAR_STATE_KEY) === "true",
  );
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isNavbarScrolled, setIsNavbarScrolled] = useState(false);
  const baseTitleRef = useRef(null);
  const mainRef = useRef(null);
  const { counts } = useNotificationCounts();
  const role = getRoleById(session?.role);
  const roleLabel = role?.label ?? "Guest";
  const userName = session?.name ?? "Guest";

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SIDEBAR_STATE_KEY, String(isCollapsed));
  }, [isCollapsed]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const cleaned = normalizeTitle(document.title);
    baseTitleRef.current = cleaned || baseTitleRef.current;
  }, [pathname]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const baseTitle = baseTitleRef.current ?? normalizeTitle(document.title);
    if (counts.total > 0) {
      document.title = `(${counts.total}) ${baseTitle}`;
    } else {
      baseTitleRef.current = normalizeTitle(document.title);
      document.title = baseTitle;
    }
  }, [counts.total]);

  useEffect(() => {
    const scrollContainer = mainRef.current;
    if (!scrollContainer) return undefined;

    const handleScroll = () => {
      setIsNavbarScrolled(scrollContainer.scrollTop > 8);
    };

    handleScroll();
    scrollContainer.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollContainer.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLogout = async () => {
    await logoutAction();
    // A full navigation discards the RSC cache, providers, and browser history entry.
    window.location.replace("/login");
  };

  return (
    <div
      className="h-screen bg-[color:var(--color-bg)] text-[color:var(--color-text)]"
      style={{
        "--sidebar-width": isCollapsed ? "5.25rem" : "15rem",
        "--header-height": "4.5rem",
      }}
    >
      <AccessDeniedToast />
      <Sidebar
        activeRole={role}
        collapsed={isCollapsed}
        onToggle={() => setIsCollapsed((prev) => !prev)}
        onLogout={session ? handleLogout : undefined}
      />

      <header
        className={`fixed z-30 flex h-[var(--header-height)] items-center justify-between overflow-visible px-5 transition-[left,right,top,background-color,backdrop-filter,backdrop-saturate,border-color,box-shadow,opacity,border-radius] duration-[220ms] ease-out motion-reduce:transition-none sm:px-6 ${isNavbarScrolled ? "left-[calc(var(--sidebar-width)+1rem)] right-4 top-3 rounded-2xl border border-border/70 bg-background/75 shadow-lg backdrop-blur-2xl backdrop-saturate-150 supports-[backdrop-filter]:bg-background/65" : "left-[var(--sidebar-width)] right-0 top-0 rounded-none border border-transparent bg-transparent shadow-none backdrop-blur-0 backdrop-saturate-100"}`}
      >
        <Logo alt="PMS Cloud" priority className="h-auto w-[118px]" />
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <ThemeToggle className="h-9 min-w-0 rounded-lg px-2.5 sm:min-w-[7.5rem] sm:px-4" />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="relative h-9 w-9 rounded-full border-0 text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Notifications"
            onClick={() => setIsNotificationsOpen(true)}
          >
            <Bell className="h-4 w-4 " aria-hidden="true" />
            {counts.total > 0 ? (
                <span className="absolute -right-1 -top-1 inline-flex min-w-[1.2rem] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                {counts.total}
              </span>
            ) : null}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="flex items-center gap-2 rounded-full border-border/70 bg-background/70 px-1.5 py-1 text-left transition-colors duration-150 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring sm:gap-3 sm:px-2"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-sm font-semibold text-foreground shadow-sm">
                  {userName.charAt(0).toUpperCase()}
                </span>
                <span className="hidden flex-col sm:flex">
                  <span className="text-sm font-semibold text-foreground">{userName}</span>
                  <span className="text-xs text-muted-foreground">{roleLabel}</span>
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onSelect={handleLogout}>
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <RouteProgress />

      <main ref={mainRef} className="fixed bottom-0 left-[var(--sidebar-width)] right-0 top-[var(--header-height)] overflow-y-auto px-6 py-6 transition-[left] duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none">
        <div className="mx-auto w-full max-w-6xl space-y-8">{children}</div>
      </main>

      <NotificationSheet
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
      />
    </div>
  );
}

export default function AppShell({ children, session }) {
  if (!session) {
    return children;
  }

  return (
    <NotificationCountsProvider>
      <AppShellContent session={session}>{children}</AppShellContent>
    </NotificationCountsProvider>
  );
}
