import { prisma } from "@/lib/prisma";
import {
  buildError,
  buildSuccess,
  ensureAuthenticated,
  getAuthContext,
  isManagementRole,
} from "@/lib/api";
import { computeTaskSpentTime } from "@/lib/taskTimeCalculator";
import { TASK_TYPE_CHECKLISTS } from "@/lib/taskChecklists";
import { createNotification } from "@/lib/notifications";

async function getTask(taskId, userId) {
  const select = {
    id: true,
    title: true,
    description: true,
    status: true,
    type: true,
    ownerId: true,
    milestoneId: true,
    projectId: true,
    project: {
      select: {
        id: true,
        name: true,
        createdById: true,
        members: { select: { userId: true, role: true } },
      },
    },
    estimatedHours: true,
    blockedReason: true,
    ktLink: true,
    blockedType: true,
    holdReason: true,
    holdNote: true,
    reworkCount: true,
    totalTimeSpent: true,
    lastStartedAt: true,
    coverImage: true,
    createdAt: true,
    owner: { select: { id: true, name: true, email: true, role: true } },
    milestone: {
      select: {
        id: true,
        title: true,
        projectId: true,
        project: {
          select: {
            id: true,
            name: true,
            createdById: true,
            members: { select: { userId: true, role: true } },
          },
        },
      },
    },
    checklistItems: true,
    statusHistory: true,
    activityLogs: true,
    timeLogs: true,
    workSessions: { orderBy: { startedAt: "desc" } },
    breaks: { orderBy: { startedAt: "desc" } },
  };

  if (userId) {
    select.personalTodos = {
      where: { userId },
      select: { id: true, content: true, isCompleted: true, reminderAt: true },
    };
    select.personalNotes = {
      where: { userId },
      select: { id: true, title: true, content: true },
    };
  }

  return prisma.task.findUnique({
    where: { id: taskId },
    select,
  });
}

function canAccessTask(context, task, isProjectAdmin = false) {
  if (!task) {
    return false;
  }

  if (isManagementRole(context.role) || isProjectAdmin) {
    return true;
  }

  if (task.ownerId === context.user.id) {
    return true;
  }

  const projectMembers = task.project?.members || task.milestone?.project?.members || [];
  const isMember = projectMembers.some((member) => member.userId === context.user.id);
  const isCreator =
    task.project?.createdById === context.user.id ||
    task.milestone?.project?.createdById === context.user.id;

  return isMember || isCreator;
}

export async function GET(request, { params }) {
  const { id: taskId } = await params;

  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  if (!taskId) {
    return buildError("Task id is required.", 400);
  }

  const task = await getTask(taskId, context.user.id);
  if (!task) {
    return buildError("Task not found.", 404);
  }

  const projectMembers = task.project?.members || task.milestone?.project?.members || [];
  const isProjectAdmin =
    task.project?.createdById === context.user.id ||
    task.milestone?.project?.createdById === context.user.id ||
    projectMembers.some(
      (member) => member.userId === context.user.id && member.role === "ADMIN"
    );

  if (!canAccessTask(context, task, isProjectAdmin)) {
    return buildError("You do not have permission to view this task.", 403);
  }

  const computed = await computeTaskSpentTime(prisma, task.id, task.ownerId);

  return buildSuccess("Task loaded.", {
    task: {
      ...task,
      spentTimeSeconds: computed.effectiveSpentSeconds,
      breakSeconds: computed.breakSeconds,
      dutyOverlapSeconds: computed.dutyOverlapSeconds,
      rawWorkSeconds: computed.rawWorkSeconds,
      lastComputedAt: computed.lastComputedAt,
      presenceStatusNow: computed.presenceStatusNow,
      isOnDutyNow: computed.isOnDutyNow,
      isWFHNow: computed.isWFHNow,
      isOffDutyNow: computed.isOffDutyNow,
      activeBreak:
        task.breaks?.find(
          (brk) => !brk.endedAt && brk.userId === task.ownerId
        ) ?? null,
    },
  });
}

export async function PATCH(request, { params }) {
  const { id: taskId } = await params;

  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  if (!taskId) {
    return buildError("Task id is required.", 400);
  }

  const task = await getTask(taskId, context.user.id);
  if (!task) {
    return buildError("Task not found.", 404);
  }

  const projectMembers = task.project?.members || task.milestone?.project?.members || [];
  const isProjectAdmin =
    task.project?.createdById === context.user.id ||
    task.milestone?.project?.createdById === context.user.id ||
    projectMembers.some(
      (member) => member.userId === context.user.id && member.role === "ADMIN"
    );

  const body = await request.json();
  const updates = {};

  const isAssignee = task.ownerId === context.user.id;
  const bodyKeys = Object.keys(body || {});
  const isCoverImageOnlyUpdate = bodyKeys.length === 1 && bodyKeys.includes("coverImage");

  if (!isManagementRole(context.role) && !isProjectAdmin) {
    if (isCoverImageOnlyUpdate && isAssignee) {
      // Allow task assignee to update cover image only
    } else {
      return buildError("Only PM/CTO or Project Admins can edit tasks.", 403);
    }
  }

  if (!canAccessTask(context, task, isProjectAdmin)) {
    return buildError("You do not have permission to update this task.", 403);
  }

  if (body?.title !== undefined) {
    const trimmedTitle = body.title.trim();
    if (!trimmedTitle) {
      return buildError("Task title is required.", 400);
    }
    updates.title = trimmedTitle;
  }

  if (body?.description !== undefined) {
    const trimmedDescription = body.description.trim();
    if (!trimmedDescription) {
      return buildError("Task description is required.", 400);
    }
    updates.description = trimmedDescription;
  }

  if (body?.type !== undefined) {
    if (!Object.keys(TASK_TYPE_CHECKLISTS).includes(body.type)) {
      return buildError("Task type is invalid.", 400);
    }
    updates.type = body.type;
  }

  if (body?.estimatedHours !== undefined) {
    const estimatedHours = Number(body.estimatedHours ?? 0);
    if (!Number.isFinite(estimatedHours) || estimatedHours < 0) {
      return buildError("Estimated hours must be a valid number.", 400);
    }
    updates.estimatedHours = estimatedHours;
  }

  if (body?.ownerId !== undefined) {
    if (body.ownerId) {
      const owner = await prisma.user.findUnique({
        where: { id: body.ownerId },
        select: { id: true },
      });
      if (!owner) {
        return buildError("Task owner not found.", 404);
      }

      const isOwnerProjectMember =
        projectMembers.some((member) => member.userId === body.ownerId) ||
        task.project?.createdById === body.ownerId ||
        task.milestone?.project?.createdById === body.ownerId;

      if (!isOwnerProjectMember) {
        return buildError(
          "The assigned user is not a member of this project.",
          400
        );
      }
    } else {
      return buildError("Task owner is required.", 400);
    }
    updates.ownerId = body.ownerId;
  }

  if (body?.milestoneId !== undefined) {
    if (body.milestoneId) {
      const milestone = await prisma.milestone.findUnique({
        where: { id: body.milestoneId },
        select: { id: true, projectId: true },
      });
      if (!milestone) {
        return buildError("Milestone not found.", 404);
      }
      if (milestone.projectId !== task.projectId) {
        return buildError("Milestone does not belong to this project.", 400);
      }
      updates.milestoneId = body.milestoneId;
    } else {
      updates.milestoneId = null;
    }
  }

  if (body?.ktLink !== undefined) {
    updates.ktLink = body.ktLink ? body.ktLink.trim() : null;
  }

  if (body?.coverImage !== undefined) {
    updates.coverImage = body.coverImage ? body.coverImage.trim() : null;

    if (task.coverImage) {
      try {
        const oldUrl = task.coverImage;
        const s3Marker = ".amazonaws.com/";
        const markerIndex = oldUrl.indexOf(s3Marker);
        if (markerIndex !== -1) {
          const key = decodeURIComponent(oldUrl.substring(markerIndex + s3Marker.length));
          const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
          const { s3Client } = await import("@/lib/s3");
          await s3Client.send(
            new DeleteObjectCommand({
              Bucket: process.env.AWS_S3_BUCKET_NAME,
              Key: key,
            })
          );
        }
      } catch (s3Err) {
        console.error("Failed to delete old S3 cover image object:", s3Err);
      }
    }
  }

  if (body?.status) {
    return buildError("Task status changes must use the status endpoint.", 400);
  }

  const checklistItems = Array.isArray(body?.checklistItems)
    ? body.checklistItems
    : null;
  const ownerChanged =
    body?.ownerId !== undefined && body.ownerId !== task.ownerId;

  const updatedTask = await prisma.$transaction(async (tx) => {
    const updated = await tx.task.update({
      where: { id: taskId },
      data: updates,
    });

    if (checklistItems) {
      const normalizedItems = checklistItems
        .map((item) => ({
          id: item.id,
          label: item.label?.trim() ?? "",
          isCompleted: Boolean(item.isCompleted),
        }))
        .filter((item) => item.label);

      const existingIds = new Set(task.checklistItems.map((item) => item.id));
      const incomingIds = new Set(
        normalizedItems.filter((item) => item.id).map((item) => item.id)
      );

      const deleteIds = Array.from(existingIds).filter(
        (id) => !incomingIds.has(id)
      );

      if (deleteIds.length > 0) {
        await tx.checklistItem.deleteMany({
          where: { id: { in: deleteIds } },
        });
      }

      await Promise.all(
        normalizedItems.map((item) => {
          if (item.id && existingIds.has(item.id)) {
            return tx.checklistItem.update({
              where: { id: item.id },
              data: { label: item.label, isCompleted: item.isCompleted },
            });
          }
          return tx.checklistItem.create({
            data: {
              taskId,
              label: item.label,
              isCompleted: item.isCompleted,
            },
          });
        })
      );
    }

    const nextTask = await tx.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        type: true,
        ownerId: true,
        milestoneId: true,
        projectId: true,
        project: {
          select: {
            id: true,
            name: true,
            createdById: true,
            members: { select: { userId: true, role: true } },
          },
        },
        estimatedHours: true,
        blockedReason: true,
        ktLink: true,
        blockedType: true,
        holdReason: true,
        holdNote: true,
        reworkCount: true,
        totalTimeSpent: true,
        lastStartedAt: true,
        createdAt: true,
        owner: { select: { id: true, name: true, email: true, role: true } },
        milestone: {
          select: { id: true, title: true, projectId: true },
        },
        checklistItems: true,
        statusHistory: true,
        activityLogs: true,
        timeLogs: true,
        workSessions: { orderBy: { startedAt: "desc" } },
        breaks: { orderBy: { startedAt: "desc" } },
        personalTodos: {
          where: { userId: context.user.id },
          select: { id: true, content: true, isCompleted: true, reminderAt: true },
        },
        personalNotes: {
          where: { userId: context.user.id },
          select: { id: true, title: true, content: true },
        },
      },
    });

    if (ownerChanged && nextTask?.ownerId && nextTask.ownerId !== context.user.id) {
      await createNotification({
        prismaClient: tx,
        type: "TASK_ASSIGNED",
        actorId: context.user.id,
        message: `${context.user?.name || context.user?.email || "A leader"} assigned you task ${nextTask.title}.`,
        taskId: nextTask.id,
        projectId: nextTask.projectId,
        milestoneId: nextTask.milestoneId,
        recipientIds: [nextTask.ownerId],
      });
    }

    return nextTask;
  });

  const computed = await computeTaskSpentTime(
    prisma,
    updatedTask.id,
    updatedTask.ownerId
  );

  return buildSuccess("Task updated.", {
    task: {
      ...updatedTask,
      spentTimeSeconds: computed.effectiveSpentSeconds,
      breakSeconds: computed.breakSeconds,
      dutyOverlapSeconds: computed.dutyOverlapSeconds,
      rawWorkSeconds: computed.rawWorkSeconds,
      lastComputedAt: computed.lastComputedAt,
      presenceStatusNow: computed.presenceStatusNow,
      isOnDutyNow: computed.isOnDutyNow,
      isWFHNow: computed.isWFHNow,
      isOffDutyNow: computed.isOffDutyNow,
      activeBreak: updatedTask.breaks?.find((brk) => !brk.endedAt) ?? null,
    },
  });
}

export async function DELETE(request, { params }) {
  const { id: taskId } = await params;

  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  if (!taskId) {
    return buildError("Task id is required.", 400);
  }

  const task = await getTask(taskId);
  if (!task) {
    return buildError("Task not found.", 404);
  }

  const projectMembers = task.project?.members || task.milestone?.project?.members || [];
  const isProjectAdmin =
    task.project?.createdById === context.user.id ||
    task.milestone?.project?.createdById === context.user.id ||
    projectMembers.some(
      (member) => member.userId === context.user.id && member.role === "ADMIN"
    );

  const isAssignee = task.ownerId === context.user.id;

  if (!isManagementRole(context.role) && !isProjectAdmin && !isAssignee) {
    return buildError("You do not have permission to delete this task.", 403);
  }

  // Deletion is strictly blocked for tasks from TESTING onwards (TESTING, REJECTED, DONE)
  const NON_DELETABLE_STATUSES = ["TESTING", "REJECTED", "DONE"];
  if (NON_DELETABLE_STATUSES.includes(task.status)) {
    return buildError(
      `Tasks in ${task.status} status cannot be deleted. Once a task enters testing, rejection, or completion, it must be retained for history and metrics.`,
      400
    );
  }

  try {
    // 1. Clean up S3 attachments if any
    const attachments = await prisma.taskAttachment.findMany({
      where: { taskId },
      select: { key: true },
    });

    if (attachments.length > 0) {
      try {
        const { DeleteObjectsCommand } = await import("@aws-sdk/client-s3");
        const { s3Client } = await import("@/lib/s3");
        if (process.env.AWS_S3_BUCKET_NAME) {
          await s3Client.send(
            new DeleteObjectsCommand({
              Bucket: process.env.AWS_S3_BUCKET_NAME,
              Delete: {
                Objects: attachments.filter((a) => a.key).map((a) => ({ Key: a.key })),
              },
            })
          );
        }
      } catch (s3Err) {
        console.error("Failed to delete task attachments from S3:", s3Err);
      }
    }

    // 2. Clean up cover image from S3 if present
    if (task.coverImage) {
      try {
        const s3Marker = ".amazonaws.com/";
        const markerIndex = task.coverImage.indexOf(s3Marker);
        if (markerIndex !== -1) {
          const key = decodeURIComponent(task.coverImage.substring(markerIndex + s3Marker.length));
          const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
          const { s3Client } = await import("@/lib/s3");
          if (process.env.AWS_S3_BUCKET_NAME) {
            await s3Client.send(
              new DeleteObjectCommand({
                Bucket: process.env.AWS_S3_BUCKET_NAME,
                Key: key,
              })
            );
          }
        }
      } catch (coverErr) {
        console.error("Failed to delete cover image from S3:", coverErr);
      }
    }

    // 3. Transactional cascade deletion of all related entities and the task
    await prisma.$transaction([
      prisma.taskAttachment.deleteMany({ where: { taskId } }),
      prisma.checklistItem.deleteMany({ where: { taskId } }),
      prisma.taskStatusHistory.deleteMany({ where: { taskId } }),
      prisma.taskTimeLog.deleteMany({ where: { taskId } }),
      prisma.taskTimeRequest.deleteMany({ where: { taskId } }),
      prisma.taskBreak.deleteMany({ where: { taskId } }),
      prisma.taskWorkSession.deleteMany({ where: { taskId } }),
      prisma.personalTodo.deleteMany({ where: { taskId } }),
      prisma.personalNote.deleteMany({ where: { taskId } }),
      prisma.activityLog.deleteMany({ where: { taskId } }),
      prisma.notification.deleteMany({ where: { taskId } }),
      prisma.task.delete({ where: { id: taskId } }),
    ]);

    return buildSuccess("Task deleted successfully.");
  } catch (error) {
    console.error("Failed to delete task:", error);
    return buildError("Unable to delete task.", 500);
  }
}
