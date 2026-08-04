import { prisma } from "@/lib/prisma";
import {
  buildSuccess,
  ensureAuthenticated,
  getAuthContext,
} from "@/lib/api";
import { withManualLogStatus } from "@/lib/manualLogMutations";
import { makeZonedDateTime } from "@/lib/manualLogDateTime";

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

  return buildSuccess("Activity logs loaded.", {
    activityLogs: activityLogs.map((log) => (log.taskId ? log : withManualLogStatus(log))),
  });
}

