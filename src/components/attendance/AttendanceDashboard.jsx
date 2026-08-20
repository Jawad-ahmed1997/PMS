"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, MoreHorizontal } from "lucide-react";
import ActionButton from "@/components/ui/ActionButton";
import Avatar from "@/components/ui/Avatar";
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import ScrollArea from "@/components/ui/ScrollArea";
import { Button } from "@/components/ui/button";
import RefreshButton from "@/components/ui/RefreshButton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { Calendar } from "@/components/ui/calendar";
import { TimePicker } from "@/components/ui/time-picker";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/DropdownMenu";
import DeleteConfirmationDialog from "@/components/ui/DeleteConfirmationDialog";
import PageHeader from "@/components/layout/PageHeader";
import { useToast } from "@/components/ui/ToastProvider";
import useOutsideClick from "@/hooks/useOutsideClick";
import { getAttendanceAutoOffTime } from "@/lib/attendanceAutoOff";
import { formatBreakTypes, normalizeBreakTypes } from "@/lib/breakTypes";
import {
  formatDateInPSTDateString,
  getTodayInPSTDateString,
  shiftDateStringByDays,
} from "@/lib/pstDate";

const badgeOptions = [
  { id: "all", label: "All" },
  { id: "recorded", label: "Recorded" },
];

const presetOptions = [
  { id: "today", label: "Today" },
  { id: "week", label: "This Week" },
  { id: "month", label: "This Month" },
];

const breakTypeOptions = [
  { id: "LUNCH", label: "Lunch" },
  { id: "DINNER", label: "Dinner" },
  { id: "NAMAZ", label: "Namaz" },
  { id: "REFRESHMENT", label: "Refreshment" },
  { id: "OTHER", label: "Other" },
];

function formatDateForInput(value) {
  return formatDateInPSTDateString(value);
}

function DateRangeFilter({ from, to, onChange }) {
  const selected = {
    from: from ? new Date(`${from}T00:00:00`) : undefined,
    to: to ? new Date(`${to}T00:00:00`) : undefined,
  };
  const label = from && to ? `${from} – ${to}` : from || to || "Select date range";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="min-w-[220px] justify-start gap-2 font-normal"
          aria-label="Select attendance date range"
        >
          <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto max-w-[calc(100vw-2rem)] overflow-x-auto p-2" align="start">
        <Calendar
          mode="range"
          numberOfMonths={2}
          selected={selected}
          onSelect={(nextRange) => {
            onChange("from", nextRange?.from ? formatDateForInput(nextRange.from) : "");
            onChange("to", nextRange?.to ? formatDateForInput(nextRange.to) : "");
          }}
          classNames={{
            months: "flex flex-row gap-6",
            month: "space-y-3",
            caption: "relative flex min-h-12 items-center justify-center px-10",
            caption_label: "text-sm font-semibold text-foreground",
            nav: "absolute inset-x-1 top-2 flex items-center justify-end gap-2",
            button_previous: "inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            button_next: "inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            weekdays: "flex",
            weekday: "w-9 rounded-md text-center text-[0.8rem] font-medium text-muted-foreground",
            week: "mt-2 flex w-full",
            day: "relative h-9 w-9 p-0 text-center text-sm text-foreground",
            day_button: "inline-flex h-9 w-9 items-center justify-center rounded-md font-normal text-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground",
            selected: "bg-primary text-primary-foreground",
            range_start: "rounded-l-md bg-primary text-primary-foreground [&>button]:rounded-l-md [&>button]:bg-primary [&>button]:text-primary-foreground",
            range_end: "rounded-r-md bg-primary text-primary-foreground [&>button]:rounded-r-md [&>button]:bg-primary [&>button]:text-primary-foreground",
            range_middle: "bg-primary/15 text-foreground [&>button]:rounded-none [&>button]:bg-primary/15 [&>button]:text-foreground",
            today: "border border-primary/60 bg-primary/5 text-primary font-semibold",
            outside: "text-muted-foreground/50",
            disabled: "text-muted-foreground/35 opacity-60",
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

function formatDisplayDate(value, timeZone = "Asia/Karachi") {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  try {
    const formatter = new Intl.DateTimeFormat("fr-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const formatted = formatter.format(date); // YYYY-MM-DD
    const parts = formatted.split("-");
    return `${parts[2]}/${parts[1]}/${parts[0]}`; // DD/MM/YYYY
  } catch (e) {
    console.error(e);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }
}

function formatDisplayTime(value, timeZone = "Asia/Karachi") {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    return formatter.format(date); // e.g. "03:15 PM"
  } catch (e) {
    console.error(e);
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;
    const hoursStr = String(hours).padStart(2, "0");
    return `${hoursStr}:${minutes} ${ampm}`;
  }
}

function formatTimeInput(value, timeZone = "Asia/Karachi") {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const formatted = formatter.format(date);
    const match = formatted.match(/(\d{2}):(\d{2})/);
    if (match) {
      let hour = match[1];
      if (hour === "24") hour = "00";
      return `${hour}:${match[2]}`;
    }
  } catch (e) {
    console.error(e);
  }
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function formatDurationFromSeconds(seconds) {
  if (!seconds || seconds <= 0) {
    return "-";
  }
  const totalMinutes = Math.round(seconds / 60);
  if (totalMinutes <= 0) {
    return "-";
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours && minutes) {
    return `${hours}h ${minutes}m`;
  }
  if (hours) {
    return `${hours}h`;
  }
  return `${minutes}m`;
}

function formatDurationFromMinutes(minutes) {
  const totalMinutes = Number(minutes);
  if (!totalMinutes || totalMinutes <= 0) {
    return "-";
  }
  const hours = Math.floor(totalMinutes / 60);
  const remaining = totalMinutes % 60;
  if (hours && remaining) {
    return `${hours}h ${remaining}m`;
  }
  if (hours) {
    return `${hours}h`;
  }
  return `${remaining}m`;
}

function getRecordDurations(record) {
  if (!record) {
    return { office: "-", wfh: "-", total: "-" };
  }
  if (record.inTime && !record.outTime) {
    return { office: "Shift running", wfh: "-", total: "-" };
  }
  if (record.officeHHMM || record.wfhHHMM || record.dutyHHMM) {
    return {
      office: record.officeHHMM ?? "-",
      wfh: record.wfhHHMM ?? "-",
      total: record.dutyHHMM ?? "-",
    };
  }
  let officeSeconds = 0;
  if (record.inTime && record.outTime) {
    const start = new Date(record.inTime);
    const end = new Date(record.outTime);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end > start) {
      officeSeconds = Math.round((end - start) / 1000);
    }
  }
  let wfhSeconds = 0;
  if (Array.isArray(record.wfhIntervals)) {
    record.wfhIntervals.forEach((interval) => {
      if (!interval?.startAt || !interval?.endAt) {
        return;
      }
      const start = new Date(interval.startAt);
      const end = new Date(interval.endAt);
      if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end > start) {
        wfhSeconds += Math.round((end - start) / 1000);
      }
    });
  }
  const totalSeconds = officeSeconds + wfhSeconds;
  return {
    office: formatDurationFromSeconds(officeSeconds),
    wfh: formatDurationFromSeconds(wfhSeconds),
    total: formatDurationFromSeconds(totalSeconds),
  };
}

function getRecordBreaks(record, timeZone = "Asia/Karachi") {
  if (!Array.isArray(record?.breaks) || record.breaks.length === 0) {
    return { count: 0, totalFormatted: "-", details: [] };
  }

  let totalMinutes = 0;
  const details = [];

  record.breaks.forEach((brk) => {
    let mins = brk.durationMinutes ?? 0;
    if (!mins && brk.startAt && brk.endAt) {
      const s = new Date(brk.startAt);
      const e = new Date(brk.endAt);
      if (!Number.isNaN(s.getTime()) && !Number.isNaN(e.getTime()) && e > s) {
        mins = Math.round((e.getTime() - s.getTime()) / (60 * 1000));
      }
    }
    totalMinutes += mins;

    const label = formatBreakTypes(brk.types, brk.type);
    const startStr = brk.startAt ? formatDisplayTime(brk.startAt, timeZone) : "";
    const endStr = brk.endAt ? formatDisplayTime(brk.endAt, timeZone) : "";
    const timeRange = startStr && endStr ? `${startStr} → ${endStr}` : startStr ? startStr : "";
    const duration = formatDurationFromMinutes(mins);

    details.push({
      id: brk.id,
      label,
      duration,
      timeRange,
      notes: brk.notes?.trim() || null,
    });
  });

  return {
    count: record.breaks.length,
    totalFormatted: formatDurationFromMinutes(totalMinutes),
    details,
  };
}

function isTodayDate(value) {
  const target = formatDateForInput(value);
  if (!target) {
    return false;
  }
  return target === getTodayInPSTDateString();
}

function isEditableAttendanceDate(value) {
  let target;
  if (value instanceof Date) {
    target = value.toISOString().slice(0, 10);
  } else if (typeof value === "string") {
    target = value.slice(0, 10);
  } else {
    target = formatDateForInput(value);
  }
  const today = getTodayInPSTDateString();
  if (!target || !today) {
    return false;
  }
  const earliest = shiftDateStringByDays(today, -2);
  return Boolean(earliest) && target >= earliest && target <= today;
}

function isAttendanceRunning(attendance, now = new Date()) {
  if (!attendance?.inTime || attendance.outTime) {
    return false;
  }
  const start = new Date(attendance.inTime);
  if (Number.isNaN(start.getTime())) {
    return false;
  }
  const cutoff = getAttendanceAutoOffTime(start);
  if (!cutoff) {
    return false;
  }
  return now >= start && now <= cutoff;
}

function getPresetRange(preset) {
  const today = getTodayInPSTDateString();
  const [year, month, day] = today.split("-").map((part) => Number(part));
  const start = new Date(Date.UTC(year, month - 1, day));
  const end = new Date(start);

  if (preset === "week") {
    const weekday = (start.getUTCDay() + 6) % 7;
    start.setUTCDate(start.getUTCDate() - weekday);
    end.setUTCDate(start.getUTCDate() + 6);
  } else if (preset === "month") {
    start.setUTCDate(1);
    end.setUTCMonth(start.getUTCMonth() + 1, 0);
  }

  return {
    from: formatDateForInput(start),
    to: formatDateForInput(end),
  };
}

function formatPresenceLabel(presence) {
  const status = presence?.status;
  if (status === "IN_OFFICE") {
    return "In office";
  }
  if (status === "WFH") {
    return "WFH";
  }
  return "Off duty";
}

function formatBreakType(types, fallbackType = null) {
  return formatBreakTypes(types, fallbackType);
}

function combineDateTime(dateValue, timeValue) {
  if (!dateValue || !timeValue) {
    return null;
  }
  const combined = new Date(`${dateValue}T${timeValue}`);
  if (Number.isNaN(combined.getTime())) {
    return null;
  }
  return combined.toISOString();
}

const AttendanceMenu = ({ onEdit, disabled, tooltip }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useOutsideClick(menuRef, () => setIsOpen(false), isOpen);

  return (
    <div className="relative" ref={menuRef}>
      <Button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          if (disabled) {
            return;
          }
          setIsOpen((prev) => !prev);
        }}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--color-border)] text-[color:var(--color-text-muted)] transition ${disabled
          ? "cursor-not-allowed opacity-60"
          : "hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-text)]"
          }`}
        aria-label="Attendance actions"
        title={disabled ? tooltip : "Attendance actions"}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        disabled={disabled}
      >
        <span className="text-lg leading-none">⋮</span>
        </Button>
      {isOpen ? (
        <div
          className="absolute right-0 z-10 mt-2 w-40 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-2 text-xs text-[color:var(--color-text)] shadow-xl"
          onClick={(event) => event.stopPropagation()}
        >
          <Button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setIsOpen(false);
              onEdit();
            }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[color:var(--color-text)] hover:bg-[color:var(--color-muted-bg)]"
          >
            Edit
          </Button>
        </div>
      ) : null}
    </div>
  );
};

const BreakMenu = ({ onEdit, onDelete, disabled, tooltip }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useOutsideClick(menuRef, () => setIsOpen(false), isOpen);

  return (
    <div className="relative" ref={menuRef}>
      <Button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          if (disabled) {
            return;
          }
          setIsOpen((prev) => !prev);
        }}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--color-border)] text-[color:var(--color-text-muted)] transition ${disabled
          ? "cursor-not-allowed opacity-60"
          : "hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-text)]"
          }`}
        aria-label="Break actions"
        title={disabled ? tooltip : "Break actions"}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        disabled={disabled}
      >
        <span className="text-lg leading-none">⋮</span>
        </Button>
      {isOpen ? (
        <div
          className="absolute right-0 z-10 mt-2 w-40 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-2 text-xs text-[color:var(--color-text)] shadow-xl"
          onClick={(event) => event.stopPropagation()}
        >
          <Button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setIsOpen(false);
              onEdit();
            }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[color:var(--color-text)] hover:bg-[color:var(--color-muted-bg)]"
          >
            Edit
          </Button>
          <Button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setIsOpen(false);
              onDelete();
            }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-rose-300 hover:bg-rose-500/10"
          >
            Delete
          </Button>
        </div>
      ) : null}
    </div>
  );
};

function AttendanceMenuShadcn({ onEdit, disabled, tooltip }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="icon" disabled={disabled} title={disabled ? tooltip : "Attendance actions"} aria-label="Attendance actions" className="h-8 w-8 rounded-full"><MoreHorizontal className="h-4 w-4" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onEdit}>Edit</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function BreakMenuShadcn({ onEdit, onDelete, disabled, tooltip }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="icon" disabled={disabled} title={disabled ? tooltip : "Break actions"} aria-label="Break actions" className="h-8 w-8 rounded-full"><MoreHorizontal className="h-4 w-4" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onEdit}>Edit</DropdownMenuItem>
        <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive">Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function AttendanceDashboard({
  initialAttendance,
  initialPresenceNow,
  users,
  currentUser,
  isLeader,
  initialRange,
}) {
  const { addToast } = useToast();
  const userTimeZone = currentUser?.timezone || "Asia/Karachi";

  const formatDisplayDate = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    try {
      const formatter = new Intl.DateTimeFormat("fr-CA", {
        timeZone: userTimeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      const formatted = formatter.format(date);
      const parts = formatted.split("-");
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    } catch (e) {
      console.error(e);
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    }
  };

  const formatDisplayTime = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    try {
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: userTimeZone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      return formatter.format(date);
    } catch (e) {
      console.error(e);
      let hours = date.getHours();
      const minutes = String(date.getMinutes()).padStart(2, "0");
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12;
      hours = hours ? hours : 12;
      const hoursStr = String(hours).padStart(2, "0");
      return `${hoursStr}:${minutes} ${ampm}`;
    }
  };

  const formatTimeInput = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    try {
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: userTimeZone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      const formatted = formatter.format(date);
      const match = formatted.match(/(\d{2}):(\d{2})/);
      if (match) {
        let hour = match[1];
        if (hour === "24") hour = "00";
        return `${hour}:${match[2]}`;
      }
    } catch (e) {
      console.error(e);
    }
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  const queryClient = useQueryClient();
  const [activeBadge, setActiveBadge] = useState("all");
  const [activePreset, setActivePreset] = useState(initialRange?.preset ?? "today");
  const [range, setRange] = useState(() => {
    if (initialRange?.from && initialRange?.to) {
      return { from: initialRange.from, to: initialRange.to };
    }
    return getPresetRange("today");
  });
  const [selectedUser, setSelectedUser] = useState(null);
  const [userQuery, setUserQuery] = useState("");
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  const [isFiltering, setIsFiltering] = useState(false);

  const [currentStatus, setCurrentStatus] = useState(null);

  const fetchCurrentStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/attendance/current-status", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setCurrentStatus(data);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchCurrentStatus();
  }, [fetchCurrentStatus]);

  const { data: attendanceData, isFetching: attendanceLoading, error: attendanceError, refetch: refetchAttendance } = useQuery({
    queryKey: ["attendanceList", range.from, range.to, selectedUser?.id],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (range.from) params.set("from", range.from);
      if (range.to) params.set("to", range.to);
      if (selectedUser?.id) params.set("userId", selectedUser.id);
      const response = await fetch(`/api/attendance?${params.toString()}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message ?? "Unable to load attendance.");
      }
      return {
        attendance: data?.attendance ?? [],
        presenceNow: data?.presenceNow ?? null,
      };
    },
    initialData: (initialAttendance !== null && initialAttendance !== undefined)
      ? { attendance: initialAttendance, presenceNow: initialPresenceNow ?? null }
      : undefined,
    staleTime: 1000 * 10,
  });

  const [attendance, setAttendance] = useState(initialAttendance ?? []);
  const [presenceNow, setPresenceNow] = useState(initialPresenceNow ?? null);

  useEffect(() => {
    if (attendanceData) {
      setAttendance(attendanceData.attendance ?? []);
      setPresenceNow(attendanceData.presenceNow ?? null);
    }
    if (!attendanceLoading) {
      setIsFiltering(false);
    }
  }, [attendanceData, attendanceLoading]);

  // Clear local attendance list immediately when changing filters to prevent showing stale records
  useEffect(() => {
    setIsFiltering(true);
    setAttendance([]);
  }, [range.from, range.to]);

  const handleRefreshAttendance = useCallback(async () => {
    await refetchAttendance();
    fetchCurrentStatus();
    queryClient.invalidateQueries({ queryKey: ["attendanceList"] });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("attendance-updated"));
    }
  }, [refetchAttendance, queryClient, fetchCurrentStatus]);

  const [modalState, setModalState] = useState({ open: false, mode: "create" });
  const [activeRecord, setActiveRecord] = useState(null);
  const [form, setForm] = useState({
    date: "",
    inTime: "",
    outTime: "",
    note: "",
    userId: currentUser?.id ?? "",
  });
  const [wfhIntervals, setWfhIntervals] = useState([]);
  const [wfhForm, setWfhForm] = useState({ startTime: "", endTime: "" });
  const [wfhSubmitting, setWfhSubmitting] = useState(false);
  const [breakModal, setBreakModal] = useState({
    open: false,
    mode: "create",
    breakItem: null,
    attendanceId: null,
  });
  const [breakForm, setBreakForm] = useState({
    types: ["LUNCH"],
    startTime: "",
    durationMinutes: "",
    notes: "",
  });
  const [breakSubmitting, setBreakSubmitting] = useState(false);
  const [breakToDelete, setBreakToDelete] = useState(null);
  const [attendanceSubmitting, setAttendanceSubmitting] = useState(false);
  const [formUserQuery, setFormUserQuery] = useState("");
  const [isFormUserMenuOpen, setIsFormUserMenuOpen] = useState(false);
  const formUserMenuRef = useRef(null);

  useOutsideClick(userMenuRef, () => setIsUserMenuOpen(false), isUserMenuOpen);
  useOutsideClick(
    formUserMenuRef,
    () => setIsFormUserMenuOpen(false),
    isFormUserMenuOpen
  );

  useEffect(() => {
    const today = getTodayInPSTDateString();
    setForm((prev) => (prev.date ? prev : { ...prev, date: today }));
    setRange((prev) => {
      if (prev.from && prev.to) {
        return prev;
      }
      return { from: today, to: today };
    });
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

  const filteredFormUsers = useMemo(() => {
    const query = formUserQuery.toLowerCase();
    if (!query) {
      return users;
    }
    return users.filter(
      (user) =>
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query)
    );
  }, [formUserQuery, users]);

  const badgeCounts = useMemo(() => {
    const counts = { all: attendance.length, recorded: 0 };
    attendance.forEach((record) => {
      if (record.inTime || record.outTime) {
        counts.recorded += 1;
      }
    });
    return counts;
  }, [attendance]);

  const filteredAttendance = useMemo(() => {
    let result = attendance;
    if (selectedUser?.id) {
      result = result.filter(
        (record) => (record.userId ?? record.user?.id) === selectedUser.id
      );
    }
    if (activeBadge === "recorded") {
      result = result.filter((record) => record.inTime || record.outTime);
    }
    return result;
  }, [activeBadge, attendance, selectedUser?.id]);

  const activeBreakRecord = useMemo(() => {
    const targetUserId = selectedUser?.id ?? currentUser?.id;
    if (!targetUserId) {
      return null;
    }
    return (
      attendance.find(
        (record) =>
          (record.userId ?? record.user?.id) === targetUserId &&
          record.inTime &&
          !record.outTime
      ) ?? null
    );
  }, [attendance, currentUser?.id, selectedUser?.id]);

  const canManageBreaks = useMemo(() => {
    if (!activeBreakRecord) {
      return false;
    }
    if (isLeader) {
      return true;
    }
    return isAttendanceRunning(activeBreakRecord, new Date());
  }, [activeBreakRecord, isLeader]);

  const notifyAttendanceUpdated = (userId) => {
    if (typeof window === "undefined") {
      return;
    }
    window.dispatchEvent(
      new CustomEvent("attendance-updated", { detail: { userId } })
    );
  };

  useEffect(() => {
    if (attendanceError) {
      addToast({
        title: "Attendance unavailable",
        message: attendanceError.message || "Unable to load attendance.",
        variant: "error",
      });
    }
  }, [attendanceError, addToast]);

  const handlePresetClick = (preset) => {
    setIsFiltering(true);
    const nextRange = getPresetRange(preset);
    setRange(nextRange);
    setActivePreset(preset);
  };

  const handleRangeChange = (field, value) => {
    setIsFiltering(true);
    setRange((prev) => ({ ...prev, [field]: value }));
    setActivePreset(null);
  };

  const openCreateModal = () => {
    const now = new Date();
    setForm({
      date: getTodayInPSTDateString(),
      inTime: formatTimeInput(now),
      outTime: "",
      note: "",
      userId: "",
    });
    setWfhIntervals([]);
    setWfhForm({ startTime: "", endTime: "" });
    setFormUserQuery("");
    setActiveRecord(null);
    setModalState({ open: true, mode: "create" });
  };

  const openEditModal = (record) => {
    setActiveRecord(record);
    const now = new Date();
    setForm({
      date: formatDateForInput(record.date) || getTodayInPSTDateString(),
      inTime: formatTimeInput(record.inTime) || formatTimeInput(now),
      outTime: record.outTime ? formatTimeInput(record.outTime) : "",
      note: record.note ?? "",
      userId: record.userId ?? record.user?.id ?? "",
    });
    setWfhIntervals(record.wfhIntervals ?? []);
    setWfhForm({ startTime: "", endTime: "" });
    setFormUserQuery(record.user?.name ?? "");
    setModalState({ open: true, mode: "edit" });
  };

  const closeModal = () => {
    setModalState({ open: false, mode: "create" });
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const canAddWfh =
    modalState.mode === "edit" &&
    activeRecord &&
    isTodayDate(activeRecord.date) &&
    activeRecord.inTime &&
    activeRecord.outTime;

  const wfhHelperText = useMemo(() => {
    if (!activeRecord || modalState.mode !== "edit") {
      return "Save attendance to add WFH intervals.";
    }
    if (!isTodayDate(activeRecord.date)) {
      return "WFH intervals can only be added for today.";
    }
    if (!activeRecord.outTime) {
      return "Add out time to enable WFH.";
    }
    return "Add intervals for today.";
  }, [activeRecord, modalState.mode]);

  const handleWfhChange = (event) => {
    const { name, value } = event.target;
    setWfhForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddWfhInterval = async () => {
    if (!activeRecord?.id) {
      return;
    }
    const startAt = combineDateTime(form.date, wfhForm.startTime);
    const endAt = combineDateTime(form.date, wfhForm.endTime);
    if (!startAt || !endAt) {
      addToast({
        title: "WFH time required",
        message: "Select both a start and end time for WFH.",
        variant: "warning",
      });
      return;
    }
    setWfhSubmitting(true);
    try {
      const response = await fetch(
        `/api/attendance/${activeRecord.id}/wfh-interval`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startAt, endAt }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "Unable to add WFH interval.");
      }
      addToast({
        title: "WFH interval added",
        message: data?.message ?? "WFH interval saved.",
        variant: "success",
      });
      setWfhForm({ startTime: "", endTime: "" });
      if (data?.attendance) {
        setActiveRecord(data.attendance);
        setWfhIntervals(data.attendance.wfhIntervals ?? []);
        if (data?.presenceNow) {
          setPresenceNow(data.presenceNow);
        }
        setAttendance((prev) =>
          prev.map((record) =>
            record.id === data.attendance.id ? data.attendance : record
          )
        );
        notifyAttendanceUpdated(data.attendance.userId ?? currentUser?.id);
      } else {
        handleRefreshAttendance();
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to add WFH interval.";
      addToast({
        title: "WFH failed",
        message,
        variant: "error",
      });
    } finally {
      setWfhSubmitting(false);
    }
  };

  const openBreakModalForm = ({ mode, breakItem = null, attendanceId = null } = {}) => {
    const startTimeValue = breakItem?.startAt
      ? formatTimeInput(breakItem.startAt)
      : formatTimeInput(new Date());
    const nextTypes = normalizeBreakTypes(breakItem?.types, breakItem?.type);
    setBreakForm({
      types: nextTypes.length ? nextTypes : ["LUNCH"],
      startTime: startTimeValue,
      durationMinutes: breakItem?.durationMinutes?.toString() ?? "",
      notes: breakItem?.notes ?? "",
    });
    setBreakModal({ open: true, mode, breakItem, attendanceId });
  };

  const closeBreakModal = () => {
    setBreakModal({ open: false, mode: "create", breakItem: null, attendanceId: null });
  };

  const handleBreakFormChange = (event) => {
    const { name, value } = event.target;
    setBreakForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleBreakTypeToggle = (type) => {
    setBreakForm((prev) => {
      const hasType = prev.types.includes(type);
      const nextTypes = hasType
        ? prev.types.filter((item) => item !== type)
        : [...prev.types, type];
      return { ...prev, types: nextTypes };
    });
  };

  const handleBreakSubmit = async (event) => {
    event.preventDefault();
    const targetAttendanceId =
      breakModal.mode === "create"
        ? breakModal.attendanceId ?? activeBreakRecord?.id
        : breakModal.breakItem?.attendanceId;
    if (!targetAttendanceId) {
      return;
    }
    if (!breakForm.types.length) {
      addToast({
        title: "Break type required",
        message: "Select at least one break type.",
        variant: "warning",
      });
      return;
    }
    if (!breakForm.startTime || !breakForm.durationMinutes) {
      addToast({
        title: "Break info required",
        message: "Select a start time and duration.",
        variant: "warning",
      });
      return;
    }
    setBreakSubmitting(true);
    try {
      const payload = {
        types: breakForm.types,
        startTime: breakForm.startTime,
        durationMinutes: Number(breakForm.durationMinutes),
        notes: breakForm.notes,
      };
      const endpoint =
        breakModal.mode === "edit" && breakModal.breakItem
          ? `/api/attendance/breaks/${breakModal.breakItem.id}`
          : `/api/attendance/${targetAttendanceId}/breaks`;
      const response = await fetch(endpoint, {
        method: breakModal.mode === "edit" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message ?? "Unable to save break.");
      }
      addToast({
        title: breakModal.mode === "edit" ? "Break updated" : "Break added",
        message: data?.message ?? "Break saved.",
        variant: "success",
      });
      closeBreakModal();
      if (data?.attendance) {
        if (activeRecord?.id === data.attendance.id) {
          setActiveRecord(data.attendance);
        }
        setAttendance((prev) =>
          prev.map((record) =>
            record.id === data.attendance.id ? data.attendance : record
          )
        );
      } else {
        handleRefreshAttendance();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save break.";
      addToast({
        title: "Break failed",
        message,
        variant: "error",
      });
    } finally {
      setBreakSubmitting(false);
    }
  };

  const handleBreakDelete = async (breakItem) => {
    if (!breakItem?.id) {
      return;
    }
    setBreakSubmitting(true);
    try {
      const response = await fetch(`/api/attendance/breaks/${breakItem.id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message ?? "Unable to delete break.");
      }
      addToast({
        title: "Break deleted",
        message: data?.message ?? "Break deleted.",
        variant: "success",
      });
      if (data?.attendance) {
        if (activeRecord?.id === data.attendance.id) {
          setActiveRecord(data.attendance);
        }
        setAttendance((prev) =>
          prev.map((record) =>
            record.id === data.attendance.id ? data.attendance : record
          )
        );
      } else {
        handleRefreshAttendance();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to delete break.";
      addToast({
        title: "Break failed",
        message,
        variant: "error",
      });
    } finally {
      setBreakSubmitting(false);
    }
  };

  const requestBreakDelete = (breakItem) => setBreakToDelete(breakItem);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setAttendanceSubmitting(true);

    const payload = {
      date: form.date,
      inTime: combineDateTime(form.date, form.inTime),
      outTime: combineDateTime(form.date, form.outTime),
      note: form.note,
    };

    if (isLeader && form.userId) {
      payload.userId = form.userId;
    }

    try {
      const response = await fetch(
        modalState.mode === "edit" && activeRecord
          ? `/api/attendance/${activeRecord.id}`
          : "/api/attendance",
        {
          method: modalState.mode === "edit" ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message ?? "Unable to save attendance.");
      }
      addToast({
        title: "Attendance saved",
        message: data?.message ?? "Attendance saved.",
        variant: "success",
      });
      closeModal();
      if (data?.presenceNow) {
        setPresenceNow(data.presenceNow);
      }
      handleRefreshAttendance();
      notifyAttendanceUpdated(data?.attendance?.userId ?? currentUser?.id);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save attendance.";
      addToast({
        title: "Attendance failed",
        message,
        variant: "error",
      });
    } finally {
      setAttendanceSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="People Ops"
        title="Attendance"
        subtitle="Track check-ins and check-outs across the team."
        actions={
          <div className="flex items-center gap-2">
            <RefreshButton onClick={handleRefreshAttendance} ariaLabel="Refresh attendance records" />
            {(!isLeader && currentStatus?.dutyStartAt) ? null : (
              <Button type="button" onClick={openCreateModal}>Add Attendance</Button>
            )}
          </div>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-4">
        <div className="flex flex-wrap items-center gap-2">
          {badgeOptions.map((badge) => (
            <Button
              key={badge.id}
              type="button"
              onClick={() => setActiveBadge(badge.id)}
              variant="outline"
              size="sm"
              className={`flex items-center gap-2 rounded-lg border px-3 py-1 text-xs font-semibold transition ${activeBadge === badge.id
                ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent-muted)] text-[color:var(--color-accent)]"
                : "border-[color:var(--color-border)] text-[color:var(--color-text-muted)] hover:border-[color:var(--color-accent)]"
                }`}
            >
              <span>{badge.label}</span>
              <span className="rounded-full bg-[color:var(--color-muted-bg)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--color-text-muted)]">
                {badgeCounts[badge.id] ?? 0}
              </span>
            </Button>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            {presetOptions.map((preset) => (
              <Button
                key={preset.id}
                type="button"
                onClick={() => handlePresetClick(preset.id)}
                variant="outline"
                size="sm"
                className={`rounded-lg border px-3 py-1 text-xs font-semibold transition ${activePreset === preset.id
                  ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent-muted)] text-[color:var(--color-accent)]"
                  : "border-[color:var(--color-border)] text-[color:var(--color-text-muted)] hover:border-[color:var(--color-accent)]"
                  }`}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <DateRangeFilter
            from={range.from}
            to={range.to}
            onChange={handleRangeChange}
          />
          <div className="flex items-center gap-2 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-muted-bg)] px-3 py-3 text-xs font-semibold text-[color:var(--color-text-muted)]">
            <span>Presence</span>
            <span className="text-[color:var(--color-text)]">
              {formatPresenceLabel(presenceNow)}
            </span>
          </div>
        </div>

        {isLeader ? (
          <Popover open={isUserMenuOpen} onOpenChange={setIsUserMenuOpen}>
            <PopoverAnchor asChild>
            <div className="relative w-full max-w-xs">
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
              onClick={() => setIsUserMenuOpen(true)}
              placeholder="Search user"
              className="w-full rounded-lg pl-4 pr-10"
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
                className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground"
                aria-label="Clear user filter"
              >
                ×
              </Button>
            ) : null}
            </div>
            </PopoverAnchor>
            <PopoverContent align="end" className="w-[min(20rem,calc(100vw-2rem))] p-0">
              <Command value={userQuery} onValueChange={setUserQuery}>
                <CommandInput placeholder="Search users" autoFocus />
                <CommandGroup className="max-h-56 overflow-y-auto">
                  {filteredUsers.map((user) => (
                    <CommandItem
                      key={user.id}
                      value={`${user.name} ${user.email}`}
                      onSelect={() => {
                        setSelectedUser(user);
                        setUserQuery(user.name);
                        setIsUserMenuOpen(false);
                      }}
                      className="flex flex-col items-start gap-1"
                    >
                      <span className="text-sm font-semibold">{user.name}</span>
                      <span className="text-[11px] text-muted-foreground">{user.role}</span>
                    </CommandItem>
                  ))}
                  <CommandEmpty>No users found.</CommandEmpty>
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>
        ) : null}
      </div>

      {activeBreakRecord &&
        (isLeader || isAttendanceRunning(activeBreakRecord, new Date())) ? (
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[color:var(--color-text)]">Breaks</p>
              <p className="text-xs text-[color:var(--color-text-muted)]">
                {activeBreakRecord.user?.name ?? "Current user"} ·{" "}
                {formatDisplayDate(activeBreakRecord.date)}
              </p>
            </div>
            <ActionButton
              label="Add Break"
              variant="secondary"
              onClick={() =>
                openBreakModalForm({
                  mode: "create",
                  attendanceId: activeBreakRecord.id,
                })
              }
              disabled={!canManageBreaks}
            />
          </div>
          {activeBreakRecord.breaks?.length ? (
            <ul className="mt-4 space-y-3 text-sm text-[color:var(--color-text)]">
              {activeBreakRecord.breaks.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-muted-bg)] p-3"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-card)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--color-text-muted)]">
                        {formatBreakType(item.types, item.type)}
                      </span>
                      <span className="text-xs text-[color:var(--color-text-muted)]">
                        {formatDurationFromMinutes(item.durationMinutes)}
                      </span>
                      <span className="text-xs text-[color:var(--color-text-subtle)]">
                        {formatDisplayTime(item.startAt)} →{" "}
                        {formatDisplayTime(item.endAt)}
                      </span>
                    </div>
                    {item.notes ? (
                      <p className="text-xs text-[color:var(--color-text-muted)]">
                        {item.notes}
                      </p>
                    ) : null}
                  </div>
                  <BreakMenuShadcn
                    onEdit={() => openBreakModalForm({ mode: "edit", breakItem: item })}
                    onDelete={() => requestBreakDelete(item)}
                    disabled={!canManageBreaks}
                    tooltip="Breaks can only be edited while duty is running."
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-[color:var(--color-text-subtle)]">
              No breaks recorded yet.
            </p>
          )}
        </div>
      ) : null}

      {(attendanceLoading || isFiltering) ? (
        <div className="space-y-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-6">
          {[...Array(5)].map((_, index) => (
            <div
              key={`skeleton-${index}`}
              className="h-10 w-full animate-pulse rounded-xl bg-[color:var(--color-muted-bg)]"
            />
          ))}
        </div>
      ) : attendanceError ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-200">
          {attendanceError.message || "Unable to load attendance."}
        </div>
      ) : filteredAttendance.length ? (
        <div className="overflow-x-auto rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[color:var(--color-border)] text-xs uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
              <tr>
                {isLeader ? <th className="px-4 py-3">User</th> : null}
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">In time</th>
                <th className="px-4 py-3">Out time</th>
                <th className="px-4 py-3">Office duration</th>
                <th className="px-4 py-3">WFH duration</th>
                <th className="px-4 py-3">Total duty</th>
                <th className="px-4 py-3">Breaks</th>
                <th className="px-4 py-3">Note</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAttendance.map((record) => (
                <tr
                  key={record.id}
                  className="border-b border-[color:var(--color-border)] last:border-b-0"
                >
                  {(() => {
                    const durations = getRecordDurations(record);
                    return (
                      <>
                        {isLeader ? (
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <Avatar
                                src={record.user?.image}
                                name={record.user?.name ?? record.user?.email ?? "User"}
                                alt={`${record.user?.name ?? "User"} avatar`}
                                className="h-8 w-8 text-xs shrink-0"
                              />
                              <div>
                                <div className="text-sm font-semibold text-[color:var(--color-text)]">
                                  {record.user?.name ?? "Unknown"}
                                </div>
                                <div className="text-xs text-[color:var(--color-text-subtle)]">
                                  {record.user?.role ?? ""}
                                </div>
                              </div>
                            </div>
                          </td>
                        ) : null}
                        <td className="px-4 py-4 text-[color:var(--color-text)]">
                          {formatDisplayDate(record.date)}
                        </td>
                        <td className="px-4 py-4 text-[color:var(--color-text)]">
                          {record.inTime ? formatDisplayTime(record.inTime) : "-"}
                        </td>
                        <td className="px-4 py-4 text-[color:var(--color-text)]">
                          {record.outTime ? (
                            <div className="space-y-1">
                              <p>{formatDisplayTime(record.outTime)}</p>
                              {record.autoOff ? (
                                <span
                                  className="inline-flex rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200"
                                  title="Auto closed after 10 hours (missing out time)"
                                >
                                  Auto Off
                                </span>
                              ) : null}
                            </div>
                          ) : record.inTime ? (
                            <div className="space-y-1 text-[color:var(--color-text-subtle)]">
                              <p>Out time not added yet</p>
                              <p className="text-[11px]">In recorded, waiting for out time</p>
                            </div>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-4 py-4 text-[color:var(--color-text)]">
                          {durations.office}
                        </td>
                        <td className="px-4 py-4 text-[color:var(--color-text)]">
                          {durations.wfh}
                        </td>
                        <td className="px-4 py-4 text-[color:var(--color-text)]">
                          {durations.total}
                        </td>
                        <td className="px-4 py-4 text-[color:var(--color-text)]">
                          {(() => {
                            const breakInfo = getRecordBreaks(record, userTimeZone);
                            if (!breakInfo.count) {
                              return <span className="text-[color:var(--color-text-subtle)]">-</span>;
                            }
                            return (
                              <div className="group relative inline-block cursor-help">
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-300 transition-colors hover:border-amber-400/60 hover:bg-amber-500/20">
                                  <span>{breakInfo.totalFormatted}</span>
                                  <span className="text-[10px] text-amber-400/70">({breakInfo.count})</span>
                                </span>
                                <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden -translate-x-1/2 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-3 text-xs shadow-2xl transition-all group-hover:block w-max max-w-xs space-y-2 text-[color:var(--color-text)]">
                                  <div className="flex items-center justify-between border-b border-[color:var(--color-border)] pb-1.5 gap-4">
                                    <span className="font-semibold text-amber-400">Breaks ({breakInfo.count})</span>
                                    <span className="font-mono text-xs text-amber-300 font-bold">{breakInfo.totalFormatted} total</span>
                                  </div>
                                  <div className="space-y-2">
                                    {breakInfo.details.map((item, idx) => (
                                      <div key={item.id || idx} className="flex flex-col gap-0.5 text-[11px] text-[color:var(--color-text-muted)]">
                                        <div className="flex items-center justify-between gap-3">
                                          <span className="font-semibold text-[color:var(--color-text)]">{item.label}</span>
                                          <span className="font-mono font-medium text-amber-300">{item.duration}</span>
                                        </div>
                                        {item.timeRange ? (
                                          <span className="text-[10px] text-[color:var(--color-text-subtle)]">{item.timeRange}</span>
                                        ) : null}
                                        {item.notes ? (
                                          <span className="text-[10px] italic text-[color:var(--color-text-muted)]">"{item.notes}"</span>
                                        ) : null}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-4 text-[color:var(--color-text-muted)]">
                          {record.note || "-"}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <AttendanceMenuShadcn
                            onEdit={() => openEditModal(record)}
                            disabled={!isLeader && !isEditableAttendanceDate(record.date)}
                            tooltip="You can only edit attendance for today and the last 2 days."
                          />
                        </td>
                      </>
                    );
                  })()}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-6 text-sm text-[color:var(--color-text-muted)]">
          No attendance found.
        </div>
      )}

      <DialogRoot open={modalState.open} onOpenChange={(open) => !open && closeModal()}>
        <DialogPortal>
          <DialogOverlay />
          <DialogContent className="h-[85vh] max-h-[85vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle>{modalState.mode === "edit" ? "Edit attendance" : "Add attendance"}</DialogTitle>
              <DialogDescription>Record check-in and check-out times for any date.</DialogDescription>
            </DialogHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <ScrollArea viewportClassName="pr-4" className="mt-5 min-h-0 flex-1 overflow-hidden pr-1 [&>div]:space-y-6">
            {isLeader ? (
              <Popover open={isFormUserMenuOpen} onOpenChange={setIsFormUserMenuOpen}>
                <PopoverAnchor asChild>
              <div className="relative">
                <label className="grid gap-2 text-xs text-[color:var(--color-text-muted)]">
                  User
                  <Input
                    value={formUserQuery}
                    onChange={(event) => {
                      setFormUserQuery(event.target.value);
                      setIsFormUserMenuOpen(true);
                      if (!event.target.value) {
                        setForm((prev) => ({ ...prev, userId: "" }));
                      }
                    }}
                    onFocus={() => setIsFormUserMenuOpen(true)}
                    onClick={() => setIsFormUserMenuOpen(true)}
                    placeholder="Search and select a user..."
                    className="mb-3"
                  />
                </label>
                {form.userId ? (
                    <Button
                    type="button"
                    onClick={() => {
                      setForm((prev) => ({ ...prev, userId: "" }));
                      setFormUserQuery("");
                      setIsFormUserMenuOpen(false);
                    }}
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-8 h-8 w-8 text-muted-foreground"
                    aria-label="Clear user selection"
                  >
                    ×
                    </Button>
                ) : null}
                </div>
                </PopoverAnchor>
                <PopoverContent align="end" className="w-[min(20rem,calc(100vw-2rem))] p-0">
                  <Command value={formUserQuery} onValueChange={setFormUserQuery}>
                    <CommandInput placeholder="Search users" autoFocus />
                    <CommandGroup className="max-h-56 overflow-y-auto">
                      {filteredFormUsers.map((user) => (
                        <CommandItem
                          key={user.id}
                          value={`${user.name} ${user.email}`}
                          onSelect={() => {
                            setForm((prev) => ({ ...prev, userId: user.id }));
                            setFormUserQuery(user.name);
                            setIsFormUserMenuOpen(false);
                          }}
                          className="flex flex-col items-start gap-1"
                        >
                          <span className="text-sm font-semibold">{user.name}</span>
                          <span className="text-[11px] text-muted-foreground">{user.role}</span>
                        </CommandItem>
                      ))}
                      <CommandEmpty>No users found.</CommandEmpty>
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            ) : null}
            <div className="grid gap-3 lg:grid-cols-3 mb-3">
              <label className="grid gap-2 text-xs text-[color:var(--color-text-muted)]">
                Date
                <DatePicker
                  name="date"
                  value={form.date}
                  onChange={handleFormChange}
                  required
                />
              </label>
              <label className="grid gap-2 text-xs text-[color:var(--color-text-muted)]">
                In time
                <TimePicker
                  name="inTime"
                  value={form.inTime}
                  onChange={handleFormChange}
                  required
                />
              </label>
              <label className="grid gap-2 text-xs text-[color:var(--color-text-muted)]">
                Out time
                <TimePicker
                  name="outTime"
                  value={form.outTime}
                  onChange={handleFormChange}
                />
              </label>
            </div>
            <label className="grid mb-3 gap-2 text-xs text-[color:var(--color-text-muted)]">
              Note
              <Textarea
                name="note"
                value={form.note}
                onChange={handleFormChange}
                rows={3}
                placeholder="Optional notes"
              />
            </label>
            <div className="rounded-lg mb-3 border border-[color:var(--color-border)] bg-[color:var(--color-muted-bg)] p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
                  Work From Home
                </p>
                <span className="text-[11px] text-[color:var(--color-text-subtle)]">
                  {wfhHelperText}
                </span>
              </div>
              {wfhIntervals.length ? (
                <ul className="mt-3 space-y-2 text-xs text-[color:var(--color-text-muted)]">
                  {wfhIntervals.map((interval) => (
                    <li
                      key={interval.id}
                      className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-card)] px-3 py-2"
                    >
                      {formatDisplayTime(interval.startAt)} →{" "}
                      {formatDisplayTime(interval.endAt)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-xs text-[color:var(--color-text-subtle)]">
                  No WFH intervals recorded.
                </p>
              )}
              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                <label className="grid gap-2 text-xs text-[color:var(--color-text-muted)]">
                  Start time
                  <TimePicker
                    name="startTime"
                    value={wfhForm.startTime}
                    onChange={handleWfhChange}
                    disabled={!canAddWfh}
                  />
                </label>
                <label className="grid gap-2 text-xs text-[color:var(--color-text-muted)]">
                  End time
                  <TimePicker
                    name="endTime"
                    value={wfhForm.endTime}
                    onChange={handleWfhChange}
                    disabled={!canAddWfh}
                  />
                </label>
                <div className="flex items-end">
                  <ActionButton
                    label={wfhSubmitting ? "Adding..." : "Add interval"}
                    variant="secondary"
                    type="button"
                    onClick={handleAddWfhInterval}
                    disabled={!canAddWfh || wfhSubmitting}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
            {modalState.mode === "edit" && activeRecord ? (
              <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-muted-bg)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
                    Breaks
                  </p>
                  {isLeader || isAttendanceRunning(activeRecord, new Date()) ? (
                    <ActionButton
                      label="Add break"
                      variant="secondary"
                      type="button"
                      onClick={() =>
                        openBreakModalForm({
                          mode: "create",
                          attendanceId: activeRecord.id,
                        })
                      }
                    />
                  ) : null}
                </div>
                {activeRecord.breaks?.length ? (
                  <ul className="mt-3 space-y-2 text-xs text-[color:var(--color-text-muted)]">
                    {activeRecord.breaks.map((item) => (
                      <li
                        key={item.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-card)] px-3 py-2"
                      >
                        <div className="space-y-1 mb3">
                          <div className="flex flex-wrap items-center gap-2 " >
                            <span className="rounded-lg border border-[color:var(--color-border)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--color-text-muted)]">
                              {formatBreakType(item.types, item.type)}
                            </span>
                            <span>{formatDurationFromMinutes(item.durationMinutes)}</span>
                            <span>
                              {formatDisplayTime(item.startAt)} →{" "}
                              {formatDisplayTime(item.endAt)}
                            </span>
                          </div>
                          {item.notes ? <p>{item.notes}</p> : null}
                        </div>
                        {isLeader || isAttendanceRunning(activeRecord, new Date()) ? (
                          <BreakMenuShadcn
                            onEdit={() =>
                              openBreakModalForm({ mode: "edit", breakItem: item })
                            }
                            onDelete={() => requestBreakDelete(item)}
                            disabled={false}
                          />
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-xs text-[color:var(--color-text-subtle)]">
                    No breaks recorded.
                  </p>
                )}
                {!isLeader && !isAttendanceRunning(activeRecord, new Date()) ? (
                  <p className="mt-2 text-xs text-[color:var(--color-text-subtle)]">
                    Breaks can be edited while duty is running.
                  </p>
                ) : null}
              </div>
            ) : null}
          </ScrollArea>
          <div className="sticky bottom-0 mt-4 flex flex-wrap items-center justify-end gap-3 border-t border-[color:var(--color-border)] bg-[color:var(--color-card)] py-4">
            <ActionButton
              label={attendanceSubmitting ? "Saving..." : (modalState.mode === "edit" ? "Save changes" : "Save attendance")}
              variant="primary"
              type="submit"
              disabled={attendanceSubmitting}
              className="min-w-[160px]"
            />
          </div>
        </form>
      </DialogContent>
          </DialogPortal>
        </DialogRoot>

      <DialogRoot open={breakModal.open} onOpenChange={(open) => !open && closeBreakModal()}>
        <DialogPortal>
          <DialogOverlay />
          <DialogContent className="max-h-[85vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle>{breakModal.mode === "edit" ? "Edit break" : "Add break"}</DialogTitle>
              <DialogDescription>Log a break taken during duty.</DialogDescription>
            </DialogHeader>
        <form onSubmit={handleBreakSubmit} className="flex h-full flex-col">
          <ScrollArea viewportClassName="pr-4" className="mt-5 min-h-0 flex-1 pr-1 [&>div]:space-y-6">
            <div className="grid gap-2 text-xs text-[color:var(--color-text-muted)]">
              <p>Break type</p>
              <div className="grid gap-2 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] p-3">
                {breakTypeOptions.map((option) => (
                  <label key={option.id} className="flex items-center gap-2 text-sm text-[color:var(--color-text)]">
                    <Checkbox
                      checked={breakForm.types.includes(option.id)}
                      onCheckedChange={() => handleBreakTypeToggle(option.id)}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <label className="grid gap-2 text-xs text-[color:var(--color-text-muted)]">
                Start time
                <TimePicker
                  name="startTime"
                  value={breakForm.startTime}
                  onChange={handleBreakFormChange}
                />
              </label>
              <label className="grid gap-2 text-xs text-[color:var(--color-text-muted)]">
                Duration (minutes)
                <Input
                  name="durationMinutes"
                  value={breakForm.durationMinutes}
                  onChange={handleBreakFormChange}
                  min={1}
                  required
                />
              </label>
            </div>
            <label className="grid gap-2 text-xs text-[color:var(--color-text-muted)]">
              Notes
              <Textarea
                name="notes"
                value={breakForm.notes}
                onChange={handleBreakFormChange}
                rows={3}

              />
            </label>
          </ScrollArea>
          <div className="sticky bottom-0 mt-4 flex flex-wrap items-center justify-end gap-3 border-t border-[color:var(--color-border)] bg-[color:var(--color-card)] pt-4">
            <ActionButton
              label={breakSubmitting ? "Saving..." : "Save break"}
              variant="primary"
              type="submit"
              className="min-w-[160px]"
              disabled={breakSubmitting}
            />
          </div>
        </form>
      </DialogContent>
          </DialogPortal>
        </DialogRoot>
      <DeleteConfirmationDialog
        open={Boolean(breakToDelete)}
        onOpenChange={(open) => { if (!open) setBreakToDelete(null); }}
        onConfirm={() => handleBreakDelete(breakToDelete)}
      />
    </div>
  );
}
