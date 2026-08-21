function normalizeDate(value) {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

export function getManualLogStatus(log) {
  return log?.endAt ? "COMPLETED" : "RUNNING";
}

export function withManualLogStatus(log) {
  if (!log) {
    return log;
  }
  return {
    ...log,
    status: getManualLogStatus(log),
  };
}

import { formatBreakTypes } from "@/lib/breakTypes";
import { toDateKeyInTZ, MANUAL_LOG_TIME_ZONE } from "@/lib/manualLogDateTime";

function format12HourTime(date, timeZone, includeDate = false) {
  if (!date) return "";
  const options = {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    ...(includeDate ? { month: "short", day: "numeric" } : {}),
  };
  const formatter = new Intl.DateTimeFormat("en-US", options);
  return formatter.format(date);
}

function formatTimeRange(start, end, timeZone) {
  if (!start) return "";
  const startStr = format12HourTime(start, timeZone);
  if (!end) {
    return `started at ${startStr}`;
  }
  const d1 = toDateKeyInTZ(start, timeZone);
  const d2 = toDateKeyInTZ(end, timeZone);
  const sameDay = d1 && d2 && d1 === d2;

  const formattedStart = sameDay ? startStr : format12HourTime(start, timeZone, true);
  const formattedEnd = format12HourTime(end, timeZone, !sameDay);
  return `${formattedStart} - ${formattedEnd}`;
}

export function subtractIntervalsFromRange(start, end, breakIntervals) {
  if (!start || !end || end <= start) {
    return [];
  }
  let segments = [{ start, end }];

  const sortedBreaks = (breakIntervals ?? [])
    .map((b) => ({
      start: b.startAt < start ? start : b.startAt,
      end: b.endAt ? (b.endAt > end ? end : b.endAt) : end,
    }))
    .filter((b) => b.end > b.start)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  for (const brk of sortedBreaks) {
    const nextSegments = [];
    for (const seg of segments) {
      if (brk.end <= seg.start || brk.start >= seg.end) {
        nextSegments.push(seg);
      } else {
        if (brk.start > seg.start) {
          nextSegments.push({ start: seg.start, end: brk.start });
        }
        if (brk.end < seg.end) {
          nextSegments.push({ start: brk.end, end: seg.end });
        }
      }
    }
    segments = nextSegments;
  }

  return segments
    .map((seg) => {
      const durationSeconds = Math.max(0, Math.floor((seg.end.getTime() - seg.start.getTime()) / 1000));
      return { startAt: seg.start, endAt: seg.end, durationSeconds };
    })
    .filter((seg) => seg.durationSeconds >= 60);
}

export async function validateAndSplitManualLog(prismaClient, {
  userId,
  startAt,
  endAt,
  excludeId,
  timeZone = MANUAL_LOG_TIME_ZONE,
}) {
  const start = normalizeDate(startAt);
  const end = normalizeDate(endAt);
  if (!prismaClient || !userId || !start) {
    return { hasConflict: false, isSplit: false, segments: [] };
  }

  const [activityLogs, taskBreaks, attendanceBreaks, workSessions] = await Promise.all([
    prismaClient.activityLog.findMany({
      where: {
        userId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        OR: [
          {
            endAt: null,
            ...(end ? { startAt: { lt: end } } : {}),
          },
          {
            endAt: { gt: start },
            ...(end ? { startAt: { lt: end } } : {}),
          },
        ],
      },
      select: {
        id: true,
        description: true,
        type: true,
        startAt: true,
        endAt: true,
        task: { select: { title: true } },
      },
    }),
    prismaClient.taskBreak.findMany({
      where: {
        userId,
        OR: [
          {
            endedAt: null,
            ...(end ? { startedAt: { lt: end } } : {}),
          },
          {
            endedAt: { gt: start },
            ...(end ? { startedAt: { lt: end } } : {}),
          },
        ],
      },
      select: {
        id: true,
        startedAt: true,
        endedAt: true,
        reason: true,
        reasons: true,
        note: true,
        task: { select: { title: true } },
      },
    }),
    prismaClient.attendanceBreak.findMany({
      where: {
        attendance: { userId },
        OR: [
          {
            endAt: null,
            ...(end ? { startAt: { lt: end } } : {}),
          },
          {
            endAt: { gt: start },
            ...(end ? { startAt: { lt: end } } : {}),
          },
        ],
      },
      select: {
        id: true,
        startAt: true,
        endAt: true,
        type: true,
        types: true,
        notes: true,
      },
    }),
    prismaClient.taskWorkSession.findMany({
      where: {
        userId,
        OR: [
          {
            endedAt: null,
            ...(end ? { startedAt: { lt: end } } : {}),
          },
          {
            endedAt: { gt: start },
            ...(end ? { startedAt: { lt: end } } : {}),
          },
        ],
      },
      select: {
        id: true,
        startedAt: true,
        endedAt: true,
        task: { select: { title: true } },
      },
    }),
  ]);

  // Check 1: Overlap with another Activity Log
  for (const log of activityLogs) {
    const lStart = normalizeDate(log.startAt);
    const lEnd = normalizeDate(log.endAt);
    if (!lStart) continue;
    if (end && lStart >= end) continue;
    if (lEnd && lEnd <= start) continue;

    const title = log.description?.trim() || log.task?.title || "activity log";
    const taskTitleContext =
      log.task?.title && log.description && log.description.trim() !== log.task.title
        ? ` on task '${log.task.title}'`
        : "";
    const timeStr = formatTimeRange(lStart, lEnd, timeZone);
    const isRunning = !lEnd;

    return {
      hasConflict: true,
      conflict: {
        id: log.id,
        startAt: lStart,
        endAt: lEnd,
        conflictType: "ACTIVITY_LOG",
        reasonMessage: `Manual activity overlaps with ${isRunning ? "running activity" : "activity"} '${title}'${taskTitleContext} (${timeStr}).`,
      },
    };
  }

  // Check 2: Overlap with a Task Work Session
  for (const session of workSessions) {
    const sStart = normalizeDate(session.startedAt);
    const sEnd = normalizeDate(session.endedAt);
    if (!sStart) continue;
    if (end && sStart >= end) continue;
    if (sEnd && sEnd <= start) continue;

    const taskTitle = session.task?.title ? `'${session.task.title}'` : "a task";
    const timeStr = formatTimeRange(sStart, sEnd, timeZone);
    const isRunning = !sEnd;

    return {
      hasConflict: true,
      conflict: {
        id: session.id,
        startAt: sStart,
        endAt: sEnd,
        conflictType: "TASK_WORK_SESSION",
        reasonMessage: `Manual activity overlaps with ${isRunning ? "running task session" : "task session"} on ${taskTitle} (${timeStr}).`,
      },
    };
  }

  // Collect all overlapping breaks
  const overlappingBreaks = [];

  for (const brk of attendanceBreaks) {
    const bStart = normalizeDate(brk.startAt);
    const bEnd = normalizeDate(brk.endAt);
    if (!bStart) continue;
    if (end && bStart >= end) continue;
    if (bEnd && bEnd <= start) continue;

    overlappingBreaks.push({
      startAt: bStart,
      endAt: bEnd,
      label: formatBreakTypes(brk.types, brk.type),
    });
  }

  for (const brk of taskBreaks) {
    const bStart = normalizeDate(brk.startedAt);
    const bEnd = normalizeDate(brk.endedAt);
    if (!bStart) continue;
    if (end && bStart >= end) continue;
    if (bEnd && bEnd <= start) continue;

    overlappingBreaks.push({
      startAt: bStart,
      endAt: bEnd,
      label: formatBreakTypes(brk.reasons, brk.reason),
    });
  }

  // If no breaks or open-ended log
  if (overlappingBreaks.length === 0 || !end) {
    const durationSeconds = end ? Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000)) : 0;
    return {
      hasConflict: false,
      isSplit: false,
      segments: [{ startAt: start, endAt: end, durationSeconds }],
    };
  }

  // Split around breaks
  const segments = subtractIntervalsFromRange(start, end, overlappingBreaks);
  return {
    hasConflict: false,
    isSplit: segments.length > 1 || (segments.length === 1 && (segments[0].startAt > start || segments[0].endAt < end)),
    segments,
  };
}

export async function findConflictingManualLog(prismaClient, options) {
  const result = await validateAndSplitManualLog(prismaClient, options);
  if (result.hasConflict) {
    return result.conflict;
  }
  return null;
}

export async function findRunningManualLog(prismaClient, { userId, excludeId }) {
  if (!prismaClient || !userId) {
    return null;
  }

  return prismaClient.activityLog.findFirst({
    where: {
      userId,
      type: "MANUAL",
      endAt: null,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: {
      id: true,
      description: true,
      categories: true,
      startAt: true,
      date: true,
    },
    orderBy: { startAt: "desc" },
  });
}
