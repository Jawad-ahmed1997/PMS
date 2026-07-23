import { prisma } from "@/lib/prisma";
import {
  buildError,
  buildSuccess,
  ensureAuthenticated,
  getAuthContext,
} from "@/lib/api";

export async function GET(request) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const todos = await prisma.personalTodo.findMany({
    where: { userId: context.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      task: {
        select: {
          id: true,
          title: true,
          status: true,
        },
      },
    },
  });

  return buildSuccess("Personal todos loaded.", { todos });
}

export async function POST(request) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const body = await request.json();
  const content = body?.content?.trim();
  const taskId = body?.taskId || null;
  const reminderAt = body?.reminderAt ? new Date(body.reminderAt) : null;

  if (!content) {
    return buildError("Todo content is required.", 400);
  }

  if (taskId) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });
    if (!task) {
      return buildError("Linked task not found.", 404);
    }
  }

  const todo = await prisma.personalTodo.create({
    data: {
      userId: context.user.id,
      content,
      taskId,
      reminderAt,
      isCompleted: false,
      reminderSent: false,
    },
    include: {
      task: {
        select: {
          id: true,
          title: true,
          status: true,
        },
      },
    },
  });

  return buildSuccess("Todo created successfully.", { todo }, 201);
}
