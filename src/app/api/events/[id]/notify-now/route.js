import { prisma } from "@/lib/prisma";
import {
  buildError,
  buildSuccess,
  ensureAuthenticated,
  getAuthContext,
} from "@/lib/api";
import { createNotification } from "@/lib/notifications";

const LEADERSHIP_ROLES = ["CEO", "PM", "CTO", "TEAM_LEAD"];

export async function POST(request, { params }) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const { id: eventId } = await params;
  if (!eventId) {
    return buildError("Event ID is required.", 400);
  }

  const isLeadership = LEADERSHIP_ROLES.includes(context.role);
  if (!isLeadership) {
    return buildError("Only leadership members can send event alerts.", 403);
  }

  try {
    const event = await prisma.plannerEvent.findUnique({
      where: { id: eventId },
      include: {
        attendees: true,
      },
    });

    if (!event) {
      return buildError("Event not found.", 404);
    }

    const attendeeUserIds = event.attendees.map((a) => a.userId);
    if (attendeeUserIds.length === 0) {
      return buildError("No attendees registered for this event.", 400);
    }

    const actorName = context.user.name || "Administrator";
    const alertMessage = `Instant Alert: "${event.title}" has an announcement from ${actorName}.`;

    // 1. Generate in-app notifications
    await createNotification({
      prismaClient: prisma,
      type: "PLANNER_EVENT",
      actorId: context.user.id,
      message: alertMessage,
      projectId: event.projectId,
      recipientIds: attendeeUserIds,
    });

    // 2. Insert CustomNotification entry with status: SENT, type: MANUAL_INSTANT
    await prisma.customNotification.create({
      data: {
        eventId,
        triggerAt: new Date(),
        message: alertMessage,
        status: "SENT",
        type: "MANUAL_INSTANT",
      },
    });

    return buildSuccess("Announcement sent successfully.");
  } catch (error) {
    console.error("Failed to send instant announcement alert:", error);
    return buildError("Failed to send alert.", 500);
  }
}
