import { prisma } from "@/lib/prisma";
import {
  buildError,
  buildSuccess,
  ensureAuthenticated,
  getAuthContext,
} from "@/lib/api";
import { getTimeZoneNow } from "@/lib/attendanceTimes";
import { getDutyDate } from "@/lib/dutyHours";
import { normalizeBreakTypes } from "@/lib/breakTypes";

export async function POST(request) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const now = new Date();
  const dutyDate = getDutyDate(now, context.timezone);
  const dutyDateValue = dutyDate ? new Date(dutyDate) : null;

  if (!dutyDateValue) {
    return buildError("Not on duty today.", 400);
  }

  // Find current attendance
  const attendance = await prisma.attendance.findFirst({
    where: {
      userId: context.user.id,
      date: dutyDateValue,
      outTime: null,
    },
  });

  if (!attendance) {
    return buildError("You must check in first.", 400);
  }

  // Check if there is already an active break
  const existingBreak = await prisma.attendanceBreak.findFirst({
    where: {
      attendanceId: attendance.id,
      endAt: null,
    },
  });

  if (existingBreak) {
    return buildError("A break is already in progress.", 409);
  }

  const body = await request.json();
  const types = normalizeBreakTypes(body?.types, body?.type);
  const notes = body?.notes?.trim() || null;

  const newBreak = await prisma.attendanceBreak.create({
    data: {
      attendanceId: attendance.id,
      type: types[0] || "OTHER",
      types: types.length ? types : ["OTHER"],
      startAt: now,
      endAt: null,
      durationMinutes: 0,
      notes,
      createdByUserId: context.user.id,
    },
  });

  return buildSuccess("Break started successfully.", { break: newBreak });
}
