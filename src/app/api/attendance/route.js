import { prisma } from "@/lib/prisma";
import {
  computeAttendanceDurationsForRecord,
  getUserPresenceNow,
} from "@/lib/dutyHours";
export const dynamic = "force-dynamic";
import { getTimeZoneNow, normalizeAttendanceTimes } from "@/lib/attendanceTimes";
import { APP_DATE_TIME_ZONE, dateKeyToUtcDate, isDateKeyInRange, shiftDateKey, toDateKey } from "@/lib/dateKeys";
import { normalizeAutoOffForAttendances } from "@/lib/attendanceAutoOff";
import { endActiveSessionsAtTime } from "@/lib/taskWorkSessions";
import {
  PROJECT_MANAGEMENT_ROLES,
  buildError,
  buildSuccess,
  ensureAuthenticated,
  getAuthContext,
} from "@/lib/api";

function isLeader(role) {
  return PROJECT_MANAGEMENT_ROLES.includes(role);
}

function normalizeDateOnly(value, timeZone = APP_DATE_TIME_ZONE) {
  const dateKey = toDateKey(value, timeZone);
  if (!dateKey) {
    return null;
  }
  return dateKeyToUtcDate(dateKey);
}

function normalizeDateRange(from, to, timeZone = APP_DATE_TIME_ZONE) {
  const start = normalizeDateOnly(from, timeZone);
  const end = normalizeDateOnly(to, timeZone);
  if (!start && !end) {
    return null;
  }
  const range = {};
  if (start) {
    range.gte = start;
  }
  if (end) {
    const endOfDay = new Date(end);
    endOfDay.setUTCHours(23, 59, 59, 999);
    range.lte = endOfDay;
  }
  return range;
}

function getEditWindow(timeZone = APP_DATE_TIME_ZONE) {
  const today = toDateKey(new Date(), timeZone);
  if (!today) {
    return null;
  }
  const earliest = shiftDateKey(today, -2);
  if (!earliest) {
    return null;
  }
  return { earliest, today };
}

function isDateEditable(date, timeZone = APP_DATE_TIME_ZONE) {
  const window = getEditWindow(timeZone);
  let targetKey;
  if (date instanceof Date) {
    targetKey = date.toISOString().slice(0, 10);
  } else if (typeof date === "string") {
    targetKey = date.slice(0, 10);
  } else {
    targetKey = toDateKey(date, timeZone);
  }
  if (!window || !targetKey) {
    return false;
  }
  return isDateKeyInRange(targetKey, window.earliest, window.today);
}

function parseDateTime(value) {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function normalizeNote(note) {
  if (!note) {
    return null;
  }
  const trimmed = note.trim();
  return trimmed ? trimmed : null;
}

function attachComputedDurations(attendance) {
  if (!attendance) {
    return attendance;
  }
  const computed = computeAttendanceDurationsForRecord(attendance);
  return {
    ...attendance,
    computedOfficeSeconds: computed.officeSeconds,
    computedWfhSeconds: computed.wfhSeconds,
    computedDutySeconds: computed.dutySeconds,
    officeHHMM: computed.officeHHMM,
    wfhHHMM: computed.wfhHHMM,
    dutyHHMM: computed.dutyHHMM,
  };
}

export async function GET(request) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const requestedUserId = searchParams.get("userId");

  const where = {};

  if (isLeader(context.role)) {
    if (requestedUserId) {
      where.userId = requestedUserId;
    }
  } else {
    where.userId = context.user.id;
  }

  const userTimeZone = context.timezone;
  const range = normalizeDateRange(from, to, userTimeZone);
  if (range) {
    where.date = range;
  }

  const presenceUserId = requestedUserId ?? context.user.id;

  const [rawAttendance, presenceNow] = await Promise.all([
    prisma.attendance.findMany({
      where,
      orderBy: { date: "desc" },
      include: {
        user: { select: { id: true, name: true, role: true, email: true, image: true, timezone: true } },
        wfhIntervals: { orderBy: { startAt: "asc" } },
        breaks: { orderBy: { startAt: "asc" } },
      },
    }),
    presenceUserId ? getUserPresenceNow(prisma, presenceUserId) : null,
  ]);

  let attendance = rawAttendance;
  const changes = await normalizeAutoOffForAttendances(prisma, attendance, new Date());

  if (changes > 0) {
    attendance = await prisma.attendance.findMany({
      where,
      orderBy: { date: "desc" },
      include: {
        user: { select: { id: true, name: true, role: true, email: true, image: true, timezone: true } },
        wfhIntervals: { orderBy: { startAt: "asc" } },
        breaks: { orderBy: { startAt: "asc" } },
      },
    });
  }

  // Load Task Breaks for all returned attendances to ensure breaks from task timers/pauses are included
  if (attendance.length > 0) {
    const userIds = [...new Set(attendance.map((a) => a.userId))];
    const dates = attendance.map((a) => new Date(a.date).getTime()).filter(Boolean);
    const minTimestamp = Math.min(...dates) - 24 * 3600 * 1000;
    const maxTimestamp = Math.max(...dates) + 48 * 3600 * 1000;

    const taskBreaks = await prisma.taskBreak.findMany({
      where: {
        userId: { in: userIds },
        startedAt: {
          gte: new Date(minTimestamp),
          lte: new Date(maxTimestamp),
        },
      },
      include: {
        task: { select: { id: true, title: true } },
      },
      orderBy: { startedAt: "asc" },
    });

    const now = new Date();

    attendance = attendance.map((record) => {
      const shiftIn = record.inTime ? new Date(record.inTime) : null;
      const shiftOut = record.outTime ? new Date(record.outTime) : (shiftIn ? now : null);

      let mergedBreaks = [...(record.breaks ?? [])];

      if (shiftIn && shiftOut) {
        const matchingTaskBreaks = taskBreaks.filter((tb) => {
          if (tb.userId !== record.userId) return false;
          const tbStart = new Date(tb.startedAt);
          const tbEnd = tb.endedAt ? new Date(tb.endedAt) : now;
          return tbStart < shiftOut && tbEnd > shiftIn;
        }).map((tb) => {
          const tbStart = new Date(tb.startedAt);
          const tbEnd = tb.endedAt ? new Date(tb.endedAt) : now;
          const startAt = tbStart > shiftIn ? tbStart : shiftIn;
          const endAt = tbEnd < shiftOut ? tbEnd : shiftOut;
          const durationMinutes = Math.max(0, Math.round((endAt.getTime() - startAt.getTime()) / (60 * 1000)));

          return {
            id: `task-break-${tb.id}`,
            attendanceId: record.id,
            type: tb.reason || "OTHER",
            types: tb.reasons?.length ? tb.reasons : (tb.reason ? [tb.reason] : ["OTHER"]),
            durationMinutes,
            startAt,
            endAt,
            notes: tb.task?.title ? `Task: ${tb.task.title}` : null,
            source: "TASK_PAUSE",
          };
        });

        mergedBreaks = [...mergedBreaks, ...matchingTaskBreaks];
      }

      return {
        ...record,
        breaks: mergedBreaks,
      };
    });
  }

  return buildSuccess("Attendance loaded.", {
    attendance: attendance.map((record) => attachComputedDurations(record)),
    presenceNow,
  });
}

export async function POST(request) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const body = await request.json();
  const userTimeZone = context.timezone;
  const date = normalizeDateOnly(body?.date, userTimeZone);
  if (!date) {
    return buildError("Date is required.", 400);
  }

  const leader = isLeader(context.role);
  const targetUserId = leader && body?.userId ? body.userId : context.user.id;

  const { inAt, outAt } = normalizeAttendanceTimes({
    shiftDate: date,
    inTime: body?.inTime,
    outTime: body?.outTime,
    timeZone: userTimeZone,
  });
  const inTime = inAt ?? (body?.inTime ? parseDateTime(body?.inTime) : null);
  const outTime = outAt ?? (body?.outTime ? parseDateTime(body?.outTime) : null);

  if (!body?.inTime) {
    return buildError("In time is required.", 400);
  }

  if (body?.inTime && !inTime) {
    return buildError("In time must be valid.", 400);
  }

  if (body?.outTime && !outTime) {
    return buildError("Out time must be valid.", 400);
  }

  const now = getTimeZoneNow(userTimeZone);
  if (inTime && inTime > now) {
    return buildError("In time cannot be in the future.", 422);
  }
  if (outTime && outTime > now) {
    return buildError("Out time cannot be in the future.", 422);
  }

  if (leader && body?.userId) {
    const userExists = await prisma.user.findUnique({
      where: { id: body.userId },
      select: { id: true },
    });
    if (!userExists) {
      return buildError("User not found.", 404);
    }
  }

  if (!leader && !isDateEditable(date)) {
    return buildError(
      "You can only edit attendance for today and the last 2 days.",
      403
    );
  }

  const attendance = await prisma.attendance.upsert({
    where: { userId_date: { userId: targetUserId, date } },
    update: {
      inTime,
      outTime,
      note: normalizeNote(body?.note),
      autoOff: false,
      autoOffReason: null,
      userId: targetUserId,
      date,
    },
    create: {
      userId: targetUserId,
      date,
      inTime,
      outTime,
      note: normalizeNote(body?.note),
      autoOff: false,
      autoOffReason: null,
    },
    include: {
      user: { select: { id: true, name: true, role: true, email: true, image: true } },
      wfhIntervals: { orderBy: { startAt: "asc" } },
      breaks: { orderBy: { startAt: "asc" } },
    },
  });

  if (outTime) {
    try {
      await endActiveSessionsAtTime(prisma, targetUserId, outTime);
    } catch (err) {
      console.error("Failed to end active task work sessions on manual checkout:", err);
    }
  }

  return buildSuccess("Attendance saved.", {
    attendance: attachComputedDurations(attendance),
    presenceNow: await getUserPresenceNow(prisma, targetUserId),
  });
}
