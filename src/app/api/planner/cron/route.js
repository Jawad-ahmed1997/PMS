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

    return buildSuccess("Planner alerts processed successfully.", {
      processedCount,
    });
  } catch (error) {
    console.error("Failed to run planner alerts runner:", error);
    return buildError("Failed to process alerts.", 500);
  }
}
