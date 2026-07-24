import { prisma } from "@/lib/prisma";

const LEADERSHIP_ROLES = ["CEO", "PM", "CTO", "TEAM_LEAD"];

export function isLeadershipRole(role) {
  return LEADERSHIP_ROLES.includes(role);
}

export async function getLeadershipUserIds(prismaClient = prisma) {
  const leaders = await prismaClient.user.findMany({
    where: { role: { in: LEADERSHIP_ROLES }, isActive: true },
    select: { id: true },
  });
  return leaders.map((leader) => leader.id);
}

export async function getProjectMemberIds(projectId, prismaClient = prisma) {
  if (!projectId) {
    return [];
  }

  const project = await prismaClient.project.findUnique({
    where: { id: projectId },
    select: {
      members: {
        where: { user: { isActive: true } },
        select: { userId: true },
      },
    },
  });

  return project?.members?.map((member) => member.userId) ?? [];
}

export async function getTaskMemberIds(taskId, prismaClient = prisma) {
  if (!taskId) {
    return [];
  }

  const task = await prismaClient.task.findUnique({
    where: { id: taskId },
    select: {
      owner: { select: { id: true, isActive: true } },
      milestone: {
        select: {
          project: {
            select: {
              members: {
                where: { user: { isActive: true } },
                select: { userId: true },
              },
            },
          },
        },
      },
    },
  });

  const memberIds =
    task?.milestone?.project?.members?.map((member) => member.userId) ?? [];
  const ownerId = task?.owner?.isActive ? task.owner.id : null;
  return Array.from(new Set([ownerId, ...memberIds].filter(Boolean)));
}

export async function createNotification({
  prismaClient = prisma,
  type,
  actorId,
  message,
  taskId = null,
  projectId = null,
  milestoneId = null,
  recipientIds = [],
}) {
  const uniqueRecipients = Array.from(
    new Set(recipientIds.filter((userId) => userId && userId !== actorId))
  );
  if (!uniqueRecipients.length) {
    return null;
  }

  return prismaClient.notification.create({
    data: {
      type,
      actorId,
      message,
      taskId,
      projectId,
      milestoneId,
      recipients: {
        create: uniqueRecipients.map((userId) => ({
          userId,
          readAt: null,
        })),
      },
    },
  });
}
