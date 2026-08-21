import { prisma } from "@/lib/prisma";
import {
  buildError,
  buildSuccess,
  ensureAuthenticated,
  getAuthContext,
} from "@/lib/api";
import {
  buildManualLogTimes,
  formatManualLogTime,
  isManualLogInFuture,
  isManualLogDateAllowed,
  MANUAL_LOG_CATEGORIES,
  normalizeManualCategories,
} from "@/lib/manualLogs";
import {
  findConflictingManualLog,
  validateAndSplitManualLog,
  withManualLogStatus,
} from "@/lib/manualLogMutations";

import {
  toDateKeyInTZ,
  normalizeTimeString,
  MANUAL_LOG_TIME_ZONE,
} from "@/lib/manualLogDateTime";

async function getManualLog(logId) {
  return prisma.activityLog.findUnique({
    where: { id: logId },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
      task: { select: { id: true, title: true, ownerId: true } },
    },
  });
}

export async function PATCH(request, { params }) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const { id: logId } = await params;
  if (!logId) {
    return buildError("Activity log id is required.", 400);
  }

  const log = await getManualLog(logId);
  if (!log) {
    return buildError("Activity log not found.", 404);
  }

  if (log.taskId) {
    return buildError("Only manual logs can be edited here.", 400);
  }

  if (log.userId !== context.user.id) {
    return buildError("You do not have permission to update this log.", 403);
  }

  const body = await request.json();
  const userTimeZone = context.timezone;
  const updates = {};
  const targetDateInput = log.date;
  const existingStartTime = log.startAt
    ? formatManualLogTime(log.startAt, userTimeZone)
    : null;

  if (body?.description) {
    updates.description = body.description.trim();
  }

  if (body?.date) {
    const existingDateKey = toDateKeyInTZ(log.date, userTimeZone);
    const newDateKey = toDateKeyInTZ(body.date, userTimeZone);
    if (existingDateKey !== newDateKey) {
      return buildError("Date cannot be changed for manual activity logs.", 400);
    }
  }

  if (body?.startTime) {
    const existingStart = existingStartTime ? normalizeTimeString(existingStartTime) : null;
    const newStart = normalizeTimeString(body.startTime);
    if (existingStart !== newStart) {
      return buildError("Start time cannot be changed for manual activity logs.", 400);
    }
  }

  const hasEndTimeProvided = body?.endTime !== undefined && body?.endTime !== null && String(body.endTime).trim() !== "";
  
  if (hasEndTimeProvided) {
    if (
      isManualLogInFuture({
        date: targetDateInput,
        startTime: existingStartTime,
        endTime: body.endTime,
      }, new Date(), userTimeZone)
    ) {
      return buildError("Manual logs cannot be in the future.", 400);
    }
  }

  if (!isManualLogDateAllowed(log.date, new Date(), userTimeZone)) {
    return buildError(
      "Manual logs can only be added/edited for today or last 2 days.",
      403
    );
  }

  if (body?.categories) {
    const categories = normalizeManualCategories(body.categories);
    if (!categories) {
      return buildError(
        `Categories must include at least one of: ${MANUAL_LOG_CATEGORIES.join(
          ", "
        ).toLowerCase()}.`,
        400
      );
    }
    updates.categories = categories;
  }

  let extraSegments = [];

  if (hasEndTimeProvided) {
    const { startAt, endAt, durationSeconds, error: timeError } =
      buildManualLogTimes({
        date: targetDateInput,
        startTime: existingStartTime,
        endTime: body.endTime,
        timeZone: userTimeZone,
      });
    if (timeError) {
      return buildError(timeError, 400);
    }

    const result = await validateAndSplitManualLog(prisma, {
      userId: context.user.id,
      startAt,
      endAt,
      excludeId: logId,
      timeZone: userTimeZone,
    });

    if (result.hasConflict) {
      return buildError(result.conflict.reasonMessage || "Manual activity overlaps with another log.", 409);
    }

    if (result.segments.length === 0) {
      return buildError("Activity time falls entirely within a break.", 400);
    }

    updates.startAt = result.segments[0].startAt;
    updates.endAt = result.segments[0].endAt;
    updates.durationSeconds = result.segments[0].durationSeconds;
    extraSegments = result.segments.slice(1);
  }

  if (Object.keys(updates).length === 0) {
    return buildError("No valid updates provided.", 400);
  }

  const updatedLog = await prisma.activityLog.update({
    where: { id: logId },
    data: updates,
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
      task: { select: { id: true, title: true, ownerId: true } },
    },
  });

  if (extraSegments.length > 0) {
    await prisma.$transaction(
      extraSegments.map((seg) =>
        prisma.activityLog.create({
          data: {
            description: updatedLog.description,
            date: updatedLog.date,
            categories: updatedLog.categories,
            userId: context.user.id,
            type: "MANUAL",
            startAt: seg.startAt,
            endAt: seg.endAt,
            durationSeconds: seg.durationSeconds,
          },
        })
      )
    );
  }

  const message = extraSegments.length > 0
    ? `Activity log updated and split into ${extraSegments.length + 1} parts around break.`
    : "Activity log updated.";

  return buildSuccess(message, { activityLog: withManualLogStatus(updatedLog) });
}
