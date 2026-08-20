import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ADMIN_ROLES,
  buildError,
  buildSuccess,
  ensureAuthenticated,
  ensureRole,
  getAuthContext,
  isAdminRole,
} from "@/lib/api";
import {
  buildManualLogTimes,
  buildManualLogDate,
  isManualLogInFuture,
  isManualLogDateAllowed,
  MANUAL_LOG_CATEGORIES,
  normalizeManualCategories,
} from "@/lib/manualLogs";
import { findConflictingManualLog, validateAndSplitManualLog } from "@/lib/manualLogMutations";

async function getActivityLog(logId) {
  return prisma.activityLog.findUnique({
    where: { id: logId },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
      task: { select: { id: true, title: true, ownerId: true } },
    },
  });
}

function canAccessLog(context, log) {
  if (!log) {
    return false;
  }

  if (isAdminRole(context.role)) {
    return true;
  }

  return log.userId === context.user.id;
}

function canEditManualLog(context, log) {
  if (!log) {
    return false;
  }
  return log.userId === context.user.id;
}

export async function GET(request, { params }) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const { id: logId } = await params;
  if (!logId) {
    return buildError("Activity log id is required.", 400);
  }

  const log = await getActivityLog(logId);
  if (!log) {
    return buildError("Activity log not found.", 404);
  }

  if (!canAccessLog(context, log)) {
    return buildError("You do not have permission to view this log.", 403);
  }

  return buildSuccess("Activity log loaded.", { activityLog: log });
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

  const log = await getActivityLog(logId);
  if (!log) {
    return buildError("Activity log not found.", 404);
  }

  if (!canAccessLog(context, log)) {
    return buildError("You do not have permission to update this log.", 403);
  }

  const body = await request.json();
  const updates = {};
  const isManualLog = !log.taskId;
  const targetDateInput = body?.date ?? log.date;
  const targetDate = buildManualLogDate(targetDateInput);

  if (body?.description) {
    updates.description = body.description.trim();
  }

  if (body?.date) {
    if (!targetDate) {
      return buildError("Date must be valid.", 400);
    }
    updates.date = targetDate;
  }

  if (isManualLog) {
    if (!canEditManualLog(context, log)) {
      return buildError("You do not have permission to update this log.", 403);
    }

    const hasTimeUpdate = body?.startTime || body?.endTime || body?.date;
    if (
      hasTimeUpdate &&
      isManualLogInFuture({
        date: targetDateInput,
        startTime: body.startTime,
        endTime: body.endTime,
      })
    ) {
      return buildError("Manual logs cannot be in the future.", 400);
    }

    if (!isManualLogDateAllowed(targetDateInput)) {
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

    if (hasTimeUpdate) {
      if (!body?.startTime || !body?.endTime) {
        return buildError("Start and end time are required.", 400);
      }
      const { startAt, endAt, durationSeconds, error: timeError } =
        buildManualLogTimes({
          date: targetDateInput,
          startTime: body.startTime,
          endTime: body.endTime,
        });
      if (timeError) {
        return buildError(timeError, 400);
      }

      const result = await validateAndSplitManualLog(prisma, {
        userId: context.user.id,
        startAt,
        endAt,
        excludeId: logId,
        timeZone: context.timezone,
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
  }

  if (Object.keys(updates).length === 0) {
    return buildError("No valid updates provided.", 400);
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.activityLog.update({
      where: { id: logId },
      data: updates,
    });

    if (extraSegments.length > 0) {
      for (const seg of extraSegments) {
        await tx.activityLog.create({
          data: {
            description: updates.description ?? log.description,
            date: updates.date ?? log.date,
            categories: updates.categories ?? log.categories,
            userId: context.user.id,
            taskId: log.taskId ?? null,
            type: "MANUAL",
            startAt: seg.startAt,
            endAt: seg.endAt,
            durationSeconds: seg.durationSeconds,
          },
        });
      }
    }

    return tx.activityLog.findUnique({
      where: { id: logId },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        task: { select: { id: true, title: true, ownerId: true } },
      },
    });
  });

  const message = extraSegments.length > 0
    ? `Activity log updated and split into ${extraSegments.length + 1} parts around break.`
    : "Activity log updated.";

  return buildSuccess(message, { activityLog: updated });
}

export async function DELETE(request, { params }) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const allowedRoles = [...ADMIN_ROLES, "DEVELOPER", "INTERN", "JUNIOR_INTERN"];
  const roleError = ensureRole(context.role, allowedRoles);
  if (roleError) {
    return roleError;
  }

  const { id: logId } = await params;
  if (!logId) {
    return buildError("Activity log id is required.", 400);
  }

  const log = await getActivityLog(logId);
  if (!log) {
    return buildError("Activity log not found.", 404);
  }

  if (!canAccessLog(context, log)) {
    return buildError("You do not have permission to delete this log.", 403);
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.activityLog.delete({ where: { id: logId } });
    });
    return buildSuccess("Activity log deleted.");
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return buildError("Activity log not found.", 404);
      }
    }

    return buildError("Unable to delete activity log.", 500);
  }
}
