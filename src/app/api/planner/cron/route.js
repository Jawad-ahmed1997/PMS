import { prisma } from "@/lib/prisma";
import { buildSuccess, buildError } from "@/lib/api";
import { createNotification } from "@/lib/notifications";

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
    let aiDoctorReportsRun = 0;

    // 4. Automated Daily AI Manager Reports at 2:00 AM PKT (or Saturday/Sunday audit)
    if (hour === 2) {
      const { runAiDoctorDiagnosis } = await import("@/lib/aiDoctorService");
      const activeUsers = await prisma.user.findMany({
        where: { status: "ACTIVE" },
        select: { id: true, name: true },
      });

      // Target shift date is the completed day (e.g. yesterday relative to 2:00 AM)
      const targetDate = new Date(now.getTime() - 4 * 3600 * 1000);
      const isWeekendWeeklyAudit = day === "Sat" || day === "Sun";
      const periodType = isWeekendWeeklyAudit ? "WEEKLY" : "DAILY";

      // Start of target day for deduplication
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      for (const u of activeUsers) {
        try {
          // Check if report already exists for target date to prevent duplicate creation
          const existing = await prisma.aiDoctorReport.findFirst({
            where: {
              userId: u.id,
              type: periodType,
              date: {
                gte: startOfDay,
                lte: endOfDay,
              },
            },
          });

          if (!existing) {
            await runAiDoctorDiagnosis({
              userId: u.id,
              period: isWeekendWeeklyAudit ? "weekly" : "daily",
              targetDate,
            });
            aiDoctorReportsRun++;
          }
        } catch (err) {
          console.error(`[Cron] Failed automated AI Manager diagnosis for ${u.name || u.id}:`, err);
        }
      }
    }

    // 5. Automated Weekly Performance Email Reports on Sunday at 2:00 PM PKT (14:00)
    if (day === "Sun" && hour === 14) {
      const { sendPerformanceReportEmail } = await import("@/lib/sendPerformanceReportEmail");
      const activeUsers = await prisma.user.findMany({
        where: { status: "ACTIVE" },
        select: { id: true, name: true, email: true },
      });

      for (const u of activeUsers) {
        try {
          await sendPerformanceReportEmail({ userId: u.id, period: "weekly" });
          emailReportsSent++;
        } catch (err) {
          console.error(`[Cron] Failed automated weekly report email for ${u.name || u.id}:`, err);
        }
      }
    }

    return buildSuccess("Planner cron processed successfully.", {
      timePkt: `${day} ${hour}:00 PKT`,
      processedCount,
      emailReportsSent,
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
