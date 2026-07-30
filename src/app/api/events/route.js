import { prisma } from "@/lib/prisma";
import {
  buildError,
  buildSuccess,
  ensureAuthenticated,
  getAuthContext,
} from "@/lib/api";

const LEADERSHIP_ROLES = ["CEO", "PM", "CTO", "TEAM_LEAD"];

export async function GET(request) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  try {
    const where = {};
    if (projectId) {
      // Show events linked to this project, plus global events (projectId: null)
      where.OR = [
        { projectId: projectId },
        { projectId: null },
      ];
    }

    const events = await prisma.plannerEvent.findMany({
      where,
      orderBy: { startDateTime: "asc" },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, role: true },
        },
        project: {
          select: { id: true, name: true },
        },
        attendees: {
          include: {
            user: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
        },
        notifications: {
          orderBy: { triggerAt: "asc" },
        },
      },
    });

    return buildSuccess("Events loaded successfully.", { events });
  } catch (error) {
    console.error("Failed to load events:", error);
    return buildError("Failed to load events.", 500);
  }
}

export async function POST(request) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const isLeadership = LEADERSHIP_ROLES.includes(context.role);
  if (!isLeadership) {
    return buildError("Only leadership members can create events.", 403);
  }

  try {
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

    if (!title || !startDateTime || !eventType) {
      return buildError("Title, start time, and event type are required.", 400);
    }

    if (!["MEETING", "NOTICE"].includes(eventType)) {
      return buildError("Event type must be MEETING or NOTICE.", 400);
    }

    const start = new Date(startDateTime);
    const end = endDateTime ? new Date(endDateTime) : null;

    if (isNaN(start.getTime())) {
      return buildError("Invalid start date format.", 400);
    }

    if (end && isNaN(end.getTime())) {
      return buildError("Invalid end date format.", 400);
    }

    if (end && start >= end) {
      return buildError("Start time must be before end time.", 400);
    }

    const event = await prisma.$transaction(async (tx) => {
      // 1. Create Planner Event
      const newEvent = await tx.plannerEvent.create({
        data: {
          title,
          description,
          startDateTime: start,
          endDateTime: end,
          eventType,
          createdById: context.user.id,
          projectId: projectId || null,
        },
      });

      // 2. Create Event Attendees
      if (attendeeUserIds.length > 0) {
        await tx.eventAttendee.createMany({
          data: attendeeUserIds.map((userId) => ({
            eventId: newEvent.id,
            userId,
            isNoticeDismissed: false,
          })),
        });
      }

      // 3. Create Custom Notifications (default: PENDING, type: SCHEDULED)
      if (notificationTriggers.length > 0) {
        await tx.customNotification.createMany({
          data: notificationTriggers.map((triggerStr) => {
            const triggerTime = new Date(triggerStr);
            return {
              eventId: newEvent.id,
              triggerAt: triggerTime,
              message: `Reminder: ${title} starts at ${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
              status: "PENDING",
              type: "SCHEDULED",
            };
          }),
        });
      }

      return tx.plannerEvent.findUnique({
        where: { id: newEvent.id },
        include: {
          createdBy: { select: { id: true, name: true, email: true, role: true } },
          project: { select: { id: true, name: true } },
          attendees: {
            include: {
              user: { select: { id: true, name: true, email: true, role: true } },
            },
          },
          notifications: true,
        },
      });
    });

    return buildSuccess("Event created successfully.", { event }, 201);
  } catch (error) {
    console.error("Failed to create event:", error);
    return buildError("Failed to create event.", 500);
  }
}
