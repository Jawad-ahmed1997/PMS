import { prisma } from "@/lib/prisma";
import { buildSuccess, buildError } from "@/lib/api";
import { createNotification } from "@/lib/notifications";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function getWeeklyBoundsForCron(now = new Date()) {
  const dayOfWeek = now.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const distanceToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const startDate = new Date(now);
  startDate.setDate(now.getDate() + distanceToMonday);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 5); // Monday + 5 days = Saturday
  endDate.setHours(23, 59, 59, 999);

  return { startDate, endDate };
}

async function executeCronRunner(request) {
  try {
    // 1. Verify cron authorization if CRON_SECRET is configured
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get("authorization") || request.headers.get("x-cron-secret");
      const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : authHeader;
      if (bearerToken !== cronSecret) {
        return buildError("Unauthorized cron invocation.", 401);
      }
    }

    const { searchParams } = new URL(request.url);
    const job = searchParams.get("job"); // e.g. "daily_ai_manager", "weekly_email_report"
    const now = new Date();

    // 2. Process Pending Custom Event Notifications
    const pendingNotifications = await prisma.customNotification.findMany({
      where: {
        status: "PENDING",
        triggerAt: {
          lte: now,
        },
      },
      include: {
        event: {
          include: {
            attendees: true,
          },
        },
      },
    });

    let processedCount = 0;

    for (const notif of pendingNotifications) {
      const { event } = notif;
      if (!event) {
        await prisma.customNotification.update({
          where: { id: notif.id },
          data: { status: "CANCELLED" },
        });
        continue;
      }

      const attendeeUserIds = event.attendees.map((a) => a.userId);

      if (attendeeUserIds.length > 0) {
        await createNotification({
          prismaClient: prisma,
          type: "PLANNER_EVENT",
          actorId: event.createdById,
          message: notif.message || `Reminder: "${event.title}" is scheduled to start.`,
          projectId: event.projectId,
          recipientIds: attendeeUserIds,
        });
      }

      await prisma.customNotification.update({
        where: { id: notif.id },
        data: {
          status: "SENT",
        },
      });

      processedCount++;
    }

    // 3. Time zone evaluation for Asia/Karachi (PKT)
    const pktHourFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Karachi",
      weekday: "short",
      hour: "numeric",
      hour12: false,
    });
    const parts = pktHourFormatter.formatToParts(now);
    const day = parts.find((p) => p.type === "weekday")?.value; // "Sun", "Mon", etc.
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0); // 0-23

    let emailReportsSent = 0;
    let skippedInactiveUsers = 0;
    let aiDoctorReportsRun = 0;

    const shouldRunDailyAi = job === "daily_ai_manager" || (!job && hour === 2);
    const shouldRunWeeklyEmail = job === "weekly_email_report" || (!job && day === "Sun" && hour === 14);

    // 4. Automated Daily AI Manager Reports (Generated & Saved to DB only, every day for completed shift)
    if (shouldRunDailyAi) {
      const { runAiDoctorDiagnosis } = await import("@/lib/aiDoctorService");
      const activeUsers = await prisma.user.findMany({
        where: { status: "ACTIVE" },
        select: { id: true, name: true },
      });

      // Target shift date is the completed day (yesterday relative to 2:00 AM PKT)
      const targetDate = new Date(now.getTime() - 10 * 3600 * 1000);
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      // Process users concurrently to prevent serverless function timeouts
      const results = await Promise.allSettled(
        activeUsers.map(async (u) => {
          // Check if DAILY report already exists for target date to prevent duplicates
          const existing = await prisma.aiDoctorReport.findFirst({
            where: {
              userId: u.id,
              type: "DAILY",
              date: {
                gte: startOfDay,
                lte: endOfDay,
              },
            },
          });

          if (!existing) {
            await runAiDoctorDiagnosis({
              userId: u.id,
              period: "daily",
              targetDate,
            });
            return { userId: u.id, created: true };
          }
          return { userId: u.id, created: false };
        })
      );

      results.forEach((res, idx) => {
        if (res.status === "fulfilled" && res.value?.created) {
          aiDoctorReportsRun++;
        } else if (res.status === "rejected") {
          console.error(`[Cron] Failed daily AI Manager diagnosis for user ${activeUsers[idx]?.name || activeUsers[idx]?.id}:`, res.reason);
        }
      });
    }

    // 5. Automated Weekly Performance Email Reports on Sunday at 2:00 PM PKT (14:00)
    // Sent ONLY to users who logged attendance or activity during the week (Mon-Sat)
    if (shouldRunWeeklyEmail) {
      const { sendPerformanceReportEmail } = await import("@/lib/sendPerformanceReportEmail");
      const { startDate, endDate } = getWeeklyBoundsForCron(now);
      const weeklyDateFilter = { gte: startDate, lte: endDate };

      // Identify users who actually logged something during the week
      const [weeklyAttendances, weeklyActivityLogs, weeklyWorkSessions, activeUsers] = await Promise.all([
        prisma.attendance.findMany({
          where: { date: weeklyDateFilter },
          select: { userId: true },
          distinct: ["userId"],
        }),
        prisma.activityLog.findMany({
          where: { date: weeklyDateFilter },
          select: { userId: true },
          distinct: ["userId"],
        }),
        prisma.taskWorkSession.findMany({
          where: { startedAt: weeklyDateFilter },
          select: { userId: true },
          distinct: ["userId"],
        }),
        prisma.user.findMany({
          where: { status: "ACTIVE" },
          select: { id: true, name: true, email: true },
        }),
      ]);

      const activeUserIdsWithLogs = new Set([
        ...weeklyAttendances.map((a) => a.userId),
        ...weeklyActivityLogs.map((a) => a.userId),
        ...weeklyWorkSessions.map((w) => w.userId),
      ]);

      const eligibleUsers = activeUsers.filter((u) => activeUserIdsWithLogs.has(u.id));
      skippedInactiveUsers = activeUsers.length - eligibleUsers.length;

      // Process weekly email dispatch with concurrency
      const emailResults = await Promise.allSettled(
        eligibleUsers.map(async (u) => {
          return sendPerformanceReportEmail({ userId: u.id, period: "weekly" });
        })
      );

      emailResults.forEach((res, idx) => {
        if (res.status === "fulfilled") {
          emailReportsSent++;
        } else {
          console.error(`[Cron] Failed automated weekly report email for ${eligibleUsers[idx]?.name || eligibleUsers[idx]?.id}:`, res.reason);
        }
      });
    }

    return buildSuccess("Planner cron processed successfully.", {
      job: job || "auto",
      timePkt: `${day} ${hour}:00 PKT`,
      processedCount,
      emailReportsSent,
      skippedInactiveUsers,
      aiDoctorReportsRun,
    });
  } catch (error) {
    console.error("[Cron] Failed to run planner alerts runner:", error);
    return buildError("Failed to process cron alerts.", 500);
  }
}

export async function GET(request) {
  return executeCronRunner(request);
}

export async function POST(request) {
  return executeCronRunner(request);
}
