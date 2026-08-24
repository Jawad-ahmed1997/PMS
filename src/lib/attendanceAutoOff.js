import { endWorkSession } from "@/lib/taskWorkSessions";
import { getTimeZoneParts } from "@/lib/attendanceTimes";

export const ATTENDANCE_AUTO_OFF_HOURS = 10;
export const ATTENDANCE_AUTO_OFF_REASON = "AUTO_OFF_10H";
const ATTENDANCE_AUTO_OFF_MS = ATTENDANCE_AUTO_OFF_HOURS * 60 * 60 * 1000;

function toDate(value) {
  if (!value) {
    return null;
  }
  const parsed = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

export function getShift1AmCutoff(inTime, timeZone = "Asia/Karachi") {
  const date = toDate(inTime);
  if (!date) return null;

  const parts = getTimeZoneParts(date, timeZone);
  if (!parts) return null;

  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const hour = Number(parts.hour);

  // If check-in is before 11:00 AM, it belongs to the previous day's shift
  const shiftDay = hour < 11 ? day - 1 : day;
  // 1:00 AM PKT next day = 20:00 UTC of shiftDay
  const cutoffUtc = Date.UTC(year, month - 1, shiftDay, 20, 0, 0, 0);
  return new Date(cutoffUtc);
}

export function getAttendanceAutoOffTime(inTime, timeZone = "Asia/Karachi") {
  const start = toDate(inTime);
  if (!start) {
    return null;
  }
  const tenHours = new Date(start.getTime() + ATTENDANCE_AUTO_OFF_MS);
  const oneAmCutoff = getShift1AmCutoff(start, timeZone);

  if (oneAmCutoff && oneAmCutoff < tenHours && start < oneAmCutoff) {
    return oneAmCutoff;
  }
  return tenHours;
}

export function getAttendanceAutoOffTriggerTime(inTime, timeZone = "Asia/Karachi") {
  const start = toDate(inTime);
  if (!start) return null;

  const parts = getTimeZoneParts(start, timeZone);
  if (!parts) return null;

  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const hour = Number(parts.hour);

  const shiftDay = hour < 11 ? day - 1 : day;
  // 3:00 AM PKT of the morning after shiftDay = 22:00 UTC of shiftDay
  const shiftEnd3AmUtc = Date.UTC(year, month - 1, shiftDay, 22, 0, 0, 0);
  const shiftEnd3Am = new Date(shiftEnd3AmUtc);

  const tenHours = new Date(start.getTime() + ATTENDANCE_AUTO_OFF_MS);

  // Shift buffer allows working late up to 3:00 AM PKT or 10 hours, whichever is later
  return shiftEnd3Am > tenHours ? shiftEnd3Am : tenHours;
}

export function resolveAttendanceOutTime(attendance, now = new Date(), timeZone = "Asia/Karachi") {
  if (!attendance?.inTime) {
    return null;
  }
  const inAt = toDate(attendance.inTime);
  if (!inAt) {
    return null;
  }
  const explicitOut = toDate(attendance.outTime);
  if (explicitOut) {
    return explicitOut;
  }
  const nowDate = toDate(now) ?? new Date();
  if (nowDate <= inAt) {
    return null;
  }
  const triggerAt = getAttendanceAutoOffTriggerTime(inAt, timeZone);
  if (!triggerAt || nowDate < triggerAt) {
    // Currently within active shift window / working hours
    return nowDate;
  }
  const autoOffAt = getAttendanceAutoOffTime(inAt, timeZone);
  return autoOffAt || nowDate;
}

export function shouldAutoOffAttendance(attendance, now = new Date(), timeZone = null) {
  if (!attendance?.inTime || attendance?.outTime) {
    return false;
  }
  const resolvedTimeZone = timeZone ?? attendance.user?.timezone ?? "Asia/Karachi";
  const triggerAt = getAttendanceAutoOffTriggerTime(attendance.inTime, resolvedTimeZone);
  const nowDate = toDate(now) ?? new Date();

  // Do NOT auto-off while within the 3:00 AM shift buffer!
  if (!triggerAt || nowDate <= triggerAt) {
    return false;
  }

  return true;
}

export async function normalizeAttendanceAutoOff(prismaClient, attendance, now = new Date(), timeZone = null) {
  if (!prismaClient || !attendance?.id || !shouldAutoOffAttendance(attendance, now, timeZone)) {
    return null;
  }

  const resolvedTimeZone = timeZone ?? attendance.user?.timezone ?? "Asia/Karachi";
  const autoOffAt = getAttendanceAutoOffTime(attendance.inTime, resolvedTimeZone);
  if (!autoOffAt) {
    return null;
  }

  let retries = 3;
  let delayMs = 100;

  while (retries > 0) {
    try {
      return await prismaClient.$transaction(async (tx) => {
        const fresh = await tx.attendance.findUnique({
          where: { id: attendance.id },
          include: { breaks: true },
        });

        if (!fresh || !shouldAutoOffAttendance(fresh, now, resolvedTimeZone)) {
          return null;
        }

        // Check if user manually completed any task work session belonging to this shift past autoOffAt before leaving
        const lastCompletedSession = await tx.taskWorkSession.findFirst({
          where: {
            userId: fresh.userId,
            startedAt: { gte: fresh.inTime },
            endedAt: { gt: autoOffAt, lte: new Date(autoOffAt.getTime() + 10 * 3600 * 1000) },
          },
          orderBy: { endedAt: "desc" },
        });

        // Check if user manually completed any activity log belonging to this shift past autoOffAt before leaving
        const lastCompletedLog = await tx.activityLog.findFirst({
          where: {
            userId: fresh.userId,
            startAt: { gte: fresh.inTime },
            endAt: { gt: autoOffAt, lte: new Date(autoOffAt.getTime() + 10 * 3600 * 1000) },
          },
          orderBy: { endAt: "desc" },
        });

        let effectiveOutTime = autoOffAt;
        if (lastCompletedSession?.endedAt && lastCompletedSession.endedAt > effectiveOutTime) {
          effectiveOutTime = lastCompletedSession.endedAt;
        }
        if (lastCompletedLog?.endAt && lastCompletedLog.endAt > effectiveOutTime) {
          effectiveOutTime = lastCompletedLog.endAt;
        }

        await tx.attendance.update({
          where: { id: fresh.id },
          data: {
            outTime: effectiveOutTime,
            autoOff: true,
            autoOffReason: ATTENDANCE_AUTO_OFF_REASON,
          },
        });

        await tx.attendanceBreak.updateMany({
          where: {
            attendanceId: fresh.id,
            OR: [{ endAt: null }, { endAt: { gt: effectiveOutTime } }],
          },
          data: {
            endAt: effectiveOutTime,
            endedBy: "AUTO_OFF",
          },
        });

        // 1. Terminate running task sessions at the 1:00 AM cutoff (so ghost hours after 1:00 AM are excluded)
        const activeSessions = await tx.taskWorkSession.findMany({
          where: {
            userId: fresh.userId,
            endedAt: null,
            startedAt: { lt: autoOffAt },
          },
        });

        for (const session of activeSessions) {
          await endWorkSession({
            prismaClient: tx,
            session,
            endedAt: autoOffAt,
            includeBreaks: true,
            endedBy: "AUTO_OFF",
          });
        }

        // 2. Terminate running manual activity logs at the 1:00 AM cutoff
        const runningManualLogs = await tx.activityLog.findMany({
          where: {
            userId: fresh.userId,
            type: "MANUAL",
            endAt: null,
            startAt: { lt: autoOffAt },
          },
          select: { id: true, startAt: true },
        });

        for (const log of runningManualLogs) {
          const startAt = log.startAt instanceof Date ? log.startAt : new Date(log.startAt);
          if (Number.isNaN(startAt.getTime()) || startAt >= autoOffAt) {
            continue;
          }
          const durationSeconds = Math.max(
            0,
            Math.floor((autoOffAt.getTime() - startAt.getTime()) / 1000)
          );
          await tx.activityLog.update({
            where: { id: log.id },
            data: {
              endAt: autoOffAt,
              durationSeconds,
            },
          });
        }

        return { id: fresh.id, outTime: effectiveOutTime };
      });
    } catch (error) {
      const isWriteConflict =
        error?.code === "P2034" ||
        error?.message?.toLowerCase().includes("write conflict") ||
        error?.message?.toLowerCase().includes("deadlock");

      if (isWriteConflict && retries > 1) {
        retries--;
        const waitTime = Math.random() * delayMs + 50;
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        continue;
      }
      throw error;
    }
  }
}

export async function normalizeAutoOffForAttendances(prismaClient, attendances, now = new Date(), timeZone = null) {
  if (!prismaClient || !Array.isArray(attendances) || attendances.length === 0) {
    return 0;
  }
  const stale = attendances.filter((att) => shouldAutoOffAttendance(att, now, timeZone));
  if (stale.length === 0) {
    return 0;
  }
  let changes = 0;
  for (const attendance of stale) {
    const updated = await normalizeAttendanceAutoOff(prismaClient, attendance, now, timeZone);
    if (updated) {
      changes += 1;
    }
  }
  return changes;
}

export async function normalizeAutoOffForUser(prismaClient, userId, now = new Date()) {
  if (!prismaClient || !userId) {
    return 0;
  }
  const user = await prismaClient.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });
  const timeZone = user?.timezone ?? "Asia/Karachi";

  const stale = await prismaClient.attendance.findMany({
    where: {
      userId,
      outTime: null,
    },
    select: { id: true, inTime: true, outTime: true, userId: true },
  });
  return normalizeAutoOffForAttendances(prismaClient, stale, now, timeZone);
}
