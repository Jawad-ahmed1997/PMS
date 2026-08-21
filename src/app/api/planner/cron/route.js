import { prisma } from "@/lib/prisma";
import { buildSuccess, buildError } from "@/lib/api";
import { createNotification } from "@/lib/notifications";

export async function GET(request) {
  // Simple cron/runner endpoint to fire pending scheduled alerts.
  try {
    const now = new Date();

    // Find all custom notifications that are pending and should have fired by now
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
      if (!event) continue;

      const attendeeUserIds = event.attendees.map((a) => a.userId);

      if (attendeeUserIds.length > 0) {
        // Send in-app notification to all attendees
        await createNotification({
          prismaClient: prisma,
          type: "PLANNER_EVENT",
          actorId: event.createdById,
          message: notif.message || `Reminder: "${event.title}" is scheduled to start.`,
          projectId: event.projectId,
          recipientIds: attendeeUserIds,
        });
      }

      // Mark the scheduled notification trigger as SENT
      await prisma.customNotification.update({
        where: { id: notif.id },
        data: {
          status: "SENT",
        },
      });

      processedCount++;
    }

    // Check if automated Sunday 2:00 PM PKT performance report emails should be triggered
    const pktHourFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Karachi",
      weekday: "short",
      hour: "numeric",
      hour12: false,
    });
    const parts = pktHourFormatter.formatToParts(now);
    const day = parts.find((p) => p.type === "weekday")?.value;
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);

    let emailReportsSent = 0;
    let aiDoctorReportsRun = 0;

    // AI Doctor Nightly 2:00 AM PKT Inspection & Saturday Night Weekly Audit
    if (hour === 2) {
      const { runAiDoctorDiagnosis } = await import("@/lib/aiDoctorService");
      const activeUsers = await prisma.user.findMany({
        where: { status: "ACTIVE" },
        select: { id: true },
      });

      const isSaturdayWeeklyAudit = day === "Sat" || day === "Sun";
      for (const u of activeUsers) {
        try {
          await runAiDoctorDiagnosis({
            userId: u.id,
            period: isSaturdayWeeklyAudit ? "weekly" : "daily",
            targetDate: now,
          });
          aiDoctorReportsRun++;
        } catch (err) {
          console.error(`Failed automated AI Doctor diagnosis for ${u.id}:`, err);
        }
      }
    }

    if (day === "Sun" && hour === 14) {
      // Sunday 2:00 PM PKT window: send weekly performance report emails
      const { sendPerformanceReportEmail } = await import("@/lib/sendPerformanceReportEmail");
      const activeUsers = await prisma.user.findMany({
        where: { status: "ACTIVE" },
        select: { id: true },
      });
      for (const u of activeUsers) {
        try {
          await sendPerformanceReportEmail({ userId: u.id, period: "weekly" });
          emailReportsSent++;
        } catch (err) {
          console.error(`Failed automated weekly report email for ${u.id}:`, err);
        }
      }
    }

    return buildSuccess("Planner alerts processed successfully.", {
      processedCount,
      emailReportsSent,
      aiDoctorReportsRun,
    });
  } catch (error) {
    console.error("Failed to run planner alerts runner:", error);
    return buildError("Failed to process alerts.", 500);
  }
}
