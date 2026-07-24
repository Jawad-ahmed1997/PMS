import { prisma } from "@/lib/prisma";
import {
  buildError,
  buildSuccess,
  ensureAuthenticated,
  getAuthContext,
  isAdminRole,
  isManagementRole,
} from "@/lib/api";

export async function GET(request) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get("taskId");

  const where = {};
  if (taskId) {
    where.taskId = taskId;
  }

  if (!isAdminRole(context.role)) {
    where.task = { ownerId: context.user.id };
  }

  const checklistItems = await prisma.checklistItem.findMany({
    where,
    orderBy: { label: "asc" },
    include: {
      task: { select: { id: true, title: true, ownerId: true } },
    },
  });

  return buildSuccess("Checklist items loaded.", { checklistItems });
}

export async function POST(request) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const body = await request.json();
  const label = body?.label?.trim();
  const taskId = body?.taskId;
  const isCompleted = Boolean(body?.isCompleted ?? false);
  const isCustom = Boolean(body?.isCustom ?? false);

  if (!label || !taskId) {
    return buildError("Label and task are required.", 400);
  }

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, ownerId: true, title: true },
  });

  if (!task) {
    return buildError("Task not found.", 404);
  }

  // Predefined checklists (isCustom: false) require management role.
  // Custom subtasks (isCustom: true) can be added by task owner or manager.
  if (!isCustom) {
    if (!isManagementRole(context.role)) {
      return buildError("Only PM/CTO can edit predefined checklist items.", 403);
    }
  } else {
    if (!isManagementRole(context.role) && task.ownerId !== context.user.id) {
      return buildError("You do not have permission to add custom subtasks to this task.", 403);
    }
  }

  const checklistItem = await prisma.checklistItem.create({
    data: {
      label,
      taskId,
      isCompleted,
      isCustom,
    },
    include: {
      task: { select: { id: true, title: true, ownerId: true } },
    },
  });

  return buildSuccess("Checklist item created.", { checklistItem }, 201);
}
