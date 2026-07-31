import { prisma } from "@/lib/prisma";
import {
  buildError,
  buildSuccess,
  ensureAuthenticated,
  getAuthContext,
} from "@/lib/api";

const LEADERSHIP_ROLES = ["CEO", "PM", "CTO", "TEAM_LEAD"];

export async function PATCH(request, { params }) {
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
    return buildError("Only leadership members can modify events.", 403);
  }

  try {
    const event = await prisma.plannerEvent.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      return buildError("Event not found.", 404);
    }

    const body = await request.json();
    const {
      title,
      description,
      startDateTime,
      endDateTime,
      eventType,
      projectId,
      attendeeUserIds = [],
      notificationTriggers = [], // Array of ISO date strings
    } = body;

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (eventType !== undefined) {
      if (!["MEETING", "NOTICE"].includes(eventType)) {
        return buildError("Event type must be MEETING or NOTICE.", 400);
      }
      updateData.eventType = eventType;
    }
    if (projectId !== undefined) updateData.projectId = projectId || null;

    if (startDateTime !== undefined) updateData.startDateTime = new Date(startDateTime);
    if (endDateTime !== undefined) updateData.endDateTime = endDateTime ? new Date(endDateTime) : null;

    const start = updateData.startDateTime || event.startDateTime;
    const end = updateData.endDateTime !== undefined ? updateData.endDateTime : event.endDateTime;

    if (start && end) {
      if (start >= end) {
        return buildError("Start time must be before end time.", 400);
      }
    }

    const updatedEvent = await prisma.$transaction(async (tx) => {
      // 1. Update event details
      await tx.plannerEvent.update({
        where: { id: eventId },
        data: updateData,
      });

      // 2. Sync attendees (delete existing and insert new)
      if (body.attendeeUserIds !== undefined) {
        await tx.eventAttendee.deleteMany({
          where: { eventId },
        });

        if (attendeeUserIds.length > 0) {
          await tx.eventAttendee.createMany({
            data: attendeeUserIds.map((userId) => ({
              eventId,
              userId,
              isNoticeDismissed: false,
            })),
          });
        }
      }

      // 3. Sync custom notifications (delete pending and schedule new triggers)
      if (body.notificationTriggers !== undefined) {
        await tx.customNotification.deleteMany({
          where: { eventId, status: "PENDING" },
        });

        if (notificationTriggers.length > 0) {
          await tx.customNotification.createMany({
            data: notificationTriggers.map((triggerStr) => {
              const triggerTime = new Date(triggerStr);
              return {
                eventId,
                triggerAt: triggerTime,
                message: `Reminder: ${title || event.title} starts at ${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
                status: "PENDING",
                type: "SCHEDULED",
              };
            }),
          });
        }
      }

      return tx.plannerEvent.findUnique({
        where: { id: eventId },
        include: {
          createdBy: { select: { id: true, name: true, email: true, role: true } },
          project: { select: { id: true, name: true } },
          attendees: {
            include: {
              user: { select: { id: true, name: true, email: true, role: true } },
            },
          },
          notifications: {
            orderBy: { triggerAt: "asc" },
          },
        },
      });
    });

    return buildSuccess("Event updated successfully.", { event: updatedEvent });
  } catch (error) {
    console.error("Failed to update event:", error);
    return buildError("Failed to update event.", 500);
  }
}

export async function DELETE(request, { params }) {
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
    return buildError("Only leadership members can delete events.", 403);
  }

  try {
    const event = await prisma.plannerEvent.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      return buildError("Event not found.", 404);
    }

    await prisma.plannerEvent.delete({
      where: { id: eventId },
    });

    return buildSuccess("Event deleted successfully.");
  } catch (error) {
    console.error("Failed to delete event:", error);
    return buildError("Failed to delete event.", 500);
  }
}
