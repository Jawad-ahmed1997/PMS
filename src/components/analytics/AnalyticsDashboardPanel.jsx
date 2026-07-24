"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import useOutsideClick from "@/hooks/useOutsideClick";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarDays, ChevronDown } from "lucide-react";

const periodOptions = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
];

const AnalyticsResults = dynamic(
  () => import("@/components/analytics/AnalyticsResults"),
  {
    ssr: false,
    loading: () => (
      <Card><CardContent className="p-5 text-sm text-muted-foreground">
        Loading analytics...
      </CardContent></Card>
    ),
  }
);

function formatDateOnly(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString().slice(0, 10);
}

function parseDateOnly(value) {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

function formatDateLabel(value) {
  const date = parseDateOnly(value);
  return date
    ? date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : "Select date";
}

export default function AnalyticsDashboardPanel({ users, currentUser, isManager }) {
  const [period, setPeriod] = useState("daily");
  const [selectedDate, setSelectedDate] = useState("");
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userQuery, setUserQuery] = useState("");
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  useOutsideClick(userMenuRef, () => setIsUserMenuOpen(false), isUserMenuOpen);

  useEffect(() => {
    setSelectedDate(formatDateOnly(new Date()));
  }, []);

  const filteredUsers = useMemo(() => {
    const query = userQuery.toLowerCase();
    if (!query) {
      return users;
    }
    return users.filter(
      (user) =>
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query)
    );
  }, [userQuery, users]);

  const activeUserId = selectedUser?.id ?? (isManager ? null : currentUser?.id);

  return (
    <div className="space-y-6">
      <Card className="relative z-10 shadow-none">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="h-10 w-[132px] rounded-xl border-border bg-background text-xs font-semibold uppercase tracking-[0.16em]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
            {periodOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
            ))}
            </SelectContent>
          </Select>
          <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="h-10 min-w-[164px] justify-between rounded-lg border-border bg-background px-3 text-sm font-medium text-foreground"
              >
                <span className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  {formatDateLabel(selectedDate)}
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-2">
              <Calendar
                mode="single"
                selected={parseDateOnly(selectedDate)}
                onSelect={(date) => {
                  if (!date) return;
                  setSelectedDate(formatDateOnly(date));
                  setIsDatePickerOpen(false);
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {isManager ? (
          <div className="relative w-full max-w-xs" ref={userMenuRef}>
            <Input
              value={userQuery}
              onChange={(event) => {
                setUserQuery(event.target.value);
                setIsUserMenuOpen(true);
                if (!event.target.value) {
                  setSelectedUser(null);
                }
              }}
              onFocus={() => setIsUserMenuOpen(true)}
              placeholder="Search user"
                className="w-full rounded-lg border-border bg-background px-4 py-2 text-sm text-foreground"
            />
            {selectedUser ? (
              <Button
                type="button"
                onClick={() => {
                  setSelectedUser(null);
                  setUserQuery("");
                  setIsUserMenuOpen(false);
                }}
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Clear user filter"
              >
                ×
              </Button>
            ) : null}
            {isUserMenuOpen ? (
              <div className="absolute right-0 z-10 mt-2 max-h-56 w-full overflow-y-auto rounded-xl border border-border bg-popover p-2 text-xs text-popover-foreground shadow-lg">
                {filteredUsers.length ? (
                  filteredUsers.map((user) => (
                    <Button
                      key={user.id}
                      type="button"
                      onClick={() => {
                        setSelectedUser(user);
                        setUserQuery(user.name);
                        setIsUserMenuOpen(false);
                      }}
                      variant="ghost"
                      className="h-auto flex w-full flex-col items-start gap-1 rounded-lg px-3 py-2 text-left text-foreground hover:bg-muted hover:text-foreground"
                    >
                      <span className="text-sm font-semibold">{user.name}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {user.role}
                      </span>
                    </Button>
                  ))
                ) : (
                    <p className="px-3 py-2 text-muted-foreground">
                    No users found.
                  </p>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
        </CardContent>
      </Card>

      <AnalyticsResults period={period} date={selectedDate} userId={activeUserId} />
    </div>
  );
}
