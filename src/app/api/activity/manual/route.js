import { prisma } from "@/lib/prisma";
import {
  ALL_ROLES,
  buildError,
  buildSuccess,
  ensureAuthenticated,
  ensureRole,
  getAuthContext,
} from "@/lib/api";
import {
  buildManualLogTimes,
  buildManualLogDate,
  isManualLogInFuture,
  isManualLogDateAllowed,
  MANUAL_LOG_CATEGORIES,
  normalizeManualCategories,
} from "@/lib/manualLogs";
import {
  findConflictingManualLog,
  findRunningManualLog,
  withManualLogStatus,
} from "@/lib/manualLogMutations";

export async function POST(request) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const roleError = ensureRole(context.role, ALL_ROLES);
  if (roleError) {
    return roleError;
  }

  const body = await request.json();
  const description = body?.description?.trim();
  const rawCategories = body?.categories;
  const dateInput = body?.date ?? new Date();
  const startTime = body?.startTime;
  const endTime = body?.endTime;

  const userTimeZone = context.timezone;

  if (!description) {
    return buildError("Description is required.", 400);
  }

  const date = buildManualLogDate(dateInput, userTimeZone);
  if (!date) {
    return buildError("Date must be valid.", 400);
  }

  if (isManualLogInFuture({ date: dateInput, startTime, endTime }, new Date(), userTimeZone)) {
    return buildError("Manual logs cannot be in the future.", 400);
  }

  if (!isManualLogDateAllowed(dateInput, new Date(), userTimeZone)) {
    return buildError(
      "Manual logs can only be added/edited for today or last 2 days.",
      403
    );
  }

  const categories = normalizeManualCategories(rawCategories);
  if (!categories) {
    return buildError(
      `Categories must include at least one of: ${MANUAL_LOG_CATEGORIES.join(
        ", "
      ).toLowerCase()}.`,
      400
    );
  }

  const { startAt, endAt, durationSeconds, error: timeError } =
    buildManualLogTimes({ date: dateInput, startTime, endTime, timeZone: userTimeZone });
  if (timeError) {
    return buildError(timeError, 400);
  }

  const conflict = await findConflictingManualLog(prisma, {
    userId: context.user.id,
    startAt,
    endAt,
  });
  if (conflict) {
    return buildError("Manual activity overlaps with another log.", 409);
  }

  if (!endAt) {
    const runningLog = await findRunningManualLog(prisma, {
      userId: context.user.id,
    });
    if (runningLog) {
      return buildError("Finish your running manual activity before starting a new one.", 409);
    }
  }

  const activityLog = await prisma.activityLog.create({
    data: {
      description,
      date,
      categories,
      userId: context.user.id,
      type: "MANUAL",
      startAt,
      endAt,
      durationSeconds,
    },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
      task: { select: { id: true, title: true, ownerId: true } },
    },
  });

  return buildSuccess("Activity log created.", { activityLog: withManualLogStatus(activityLog) }, 201);
}
