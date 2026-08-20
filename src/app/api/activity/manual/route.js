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
  validateAndSplitManualLog,
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

  const result = await validateAndSplitManualLog(prisma, {
    userId: context.user.id,
    startAt,
    endAt,
    timeZone: userTimeZone,
  });

  if (result.hasConflict) {
    return buildError(result.conflict.reasonMessage || "Manual activity overlaps with another log.", 409);
  }

  if (result.segments.length === 0) {
    return buildError("Activity time falls entirely within a break.", 400);
  }

  if (!endAt) {
    const runningLog = await findRunningManualLog(prisma, {
      userId: context.user.id,
    });
    if (runningLog) {
      return buildError("Finish your running manual activity before starting a new one.", 409);
    }
  }

  const createdLogs = await prisma.$transaction(
    result.segments.map((seg) =>
      prisma.activityLog.create({
        data: {
          description,
          date,
          categories,
          userId: context.user.id,
          type: "MANUAL",
          startAt: seg.startAt,
          endAt: seg.endAt,
          durationSeconds: seg.durationSeconds,
        },
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
          task: { select: { id: true, title: true, ownerId: true } },
        },
      })
    )
  );

  const message = result.isSplit
    ? `Activity logged in ${createdLogs.length} parts (automatically split around break).`
    : "Activity log created.";

  return buildSuccess(
    message,
    {
      activityLog: withManualLogStatus(createdLogs[0]),
      activityLogs: createdLogs.map((log) => withManualLogStatus(log)),
    },
    201
  );
}
