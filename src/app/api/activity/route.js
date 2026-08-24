import { prisma } from "@/lib/prisma";
import {
  buildSuccess,
  ensureAuthenticated,
  getAuthContext,
} from "@/lib/api";
import { withManualLogStatus } from "@/lib/manualLogMutations";
import { makeZonedDateTime } from "@/lib/manualLogDateTime";
import { aggregateActivityLogs } from "@/lib/activityAggregation";

export async function GET(request) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope");
  const userId = searchParams.get("userId");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const category = searchParams.get("category");
  const taskId = searchParams.get("taskId");

  const where = {};
  const canViewAll = ["CEO", "PM", "CTO", "TEAM_LEAD"].includes(context.role);

  if (canViewAll && scope === "all") {
    if (userId) {
      where.userId = userId;
    }
  } else {
    where.userId = context.user.id;
  }

  if (category) {
    const normalized = category.toString().trim().toUpperCase();
    if (normalized === "TASK") {
      where.taskId = { not: null };
    } else {
      where.categories = { has: normalized };
    }
  }

  if (taskId) {
    where.taskId = taskId;
  }

  if (startDate || endDate) {
    where.date = {};
    const tz = context.timezone || "Asia/Karachi";
    if (startDate) {
      const parsedStart = makeZonedDateTime({ dateKey: startDate, timeStr: "00:00", tz });
      if (parsedStart) {
        where.date.gte = parsedStart;
      }
    }
    if (endDate) {
      const parsedEnd = makeZonedDateTime({ dateKey: endDate, timeStr: "23:59", tz });
      if (parsedEnd) {
        where.date.lte = parsedEnd;
      }
    }
  }

  const activityLogs = await prisma.activityLog.findMany({
    where,
    orderBy: { date: "desc" },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
      task: { select: { id: true, title: true, ownerId: true } },
    },
  });

  let virtualTaskLogs = [];
  const isFilteringOtherCategory = category && category.toString().trim().toUpperCase() !== "TASK";

  if (!isFilteringOtherCategory) {
    const taskSessionWhere = {
      endedAt: null,
      ...(where.userId ? { userId: where.userId } : {}),
      ...(where.taskId ? { taskId: where.taskId } : {}),
    };
    if (where.date) {
      taskSessionWhere.startedAt = {};
      if (where.date.gte) {
        taskSessionWhere.startedAt.gte = where.date.gte;
      }
      if (where.date.lte) {
        taskSessionWhere.startedAt.lte = where.date.lte;
      }
    }

    const activeTaskSessions = await prisma.taskWorkSession.findMany({
      where: taskSessionWhere,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        task: { select: { id: true, title: true, ownerId: true } },
      },
    });

    const activeTaskBreaks = await prisma.taskBreak.findMany({
      where: {
        endedAt: null,
        ...(where.userId ? { userId: where.userId } : {}),
        ...(where.taskId ? { taskId: where.taskId } : {}),
      },
      select: { taskId: true, userId: true },
    });

    const pausedTaskSet = new Set(
      activeTaskBreaks.map((b) => `${b.userId}-${b.taskId}`)
    );

    virtualTaskLogs = activeTaskSessions.map((session) => {
      const isPaused = pausedTaskSet.has(`${session.userId}-${session.taskId}`);
      return {
        id: `running-task-${session.id}`,
        type: "TASK",
        userId: session.userId,
        taskId: session.taskId,
        description: `Working on task: ${session.task.title}`,
        date: session.startedAt,
        startAt: session.startedAt,
        endAt: null,
        isPaused,
        user: session.user,
        task: session.task,
        isVirtual: true,
      };
    });
  }

  const mappedLogs = activityLogs.map((log) => (log.taskId ? log : withManualLogStatus(log)));
  const combinedLogs = [...virtualTaskLogs, ...mappedLogs];
  const tz = context.timezone || "Asia/Karachi";
  const finalLogs = aggregateActivityLogs(combinedLogs, tz);

  return buildSuccess("Activity logs loaded.", {
    activityLogs: finalLogs,
  });
}

