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

  const notes = await prisma.personalNote.findMany({
    where: { userId: context.user.id },
    orderBy: { updatedAt: "desc" },
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

  return buildSuccess("Personal notes loaded.", { notes });
}

export async function POST(request) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const body = await request.json();
  const title = body?.title?.trim() || "Untitled Note";
  const content = body?.content || "";
  const taskId = body?.taskId || null;

  if (taskId) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });
    if (!task) {
      return buildError("Linked task not found.", 404);
    }
  }

  const note = await prisma.personalNote.create({
    data: {
      userId: context.user.id,
      title,
      content,
      taskId,
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

  return buildSuccess("Note created successfully.", { note }, 201);
}
