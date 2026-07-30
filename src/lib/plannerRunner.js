import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";

let intervalStarted = false;

export function startPlannerRunner() {
  // Prevent duplicate intervals in development hot reloading
  if (intervalStarted || globalThis.plannerRunnerStarted) {
    return;
  }

  intervalStarted = true;
  globalThis.plannerRunnerStarted = true;

  console.log("[Planner Runner] Starting background notification alert dispatcher loop (10s interval)...");

  setInterval(async () => {
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

      if (pendingNotifications.length > 0) {
        console.log(`[Planner Runner] Found ${pendingNotifications.length} alerts to process.`);
      }

      for (const notif of pendingNotifications) {
        const { event } = notif;
        if (!event) {
          // If no event associated, just cancel/sent it
          await prisma.customNotification.update({
            where: { id: notif.id },
            data: { status: "CANCELLED" },
          });
          continue;
        }

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

        // Mark the custom notification trigger as SENT
        await prisma.customNotification.update({
          where: { id: notif.id },
          data: {
            status: "SENT",
          },
        });

        console.log(`[Planner Runner] Alert fired successfully for event: "${event.title}"`);
      }
    } catch (error) {
      console.error("[Planner Runner] Error in background dispatcher interval:", error);
    }
  }, 10000); // 10 seconds check for high-precision notification delivery
}
