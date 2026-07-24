import { prisma } from "@/lib/prisma";
import {
  buildError,
  buildSuccess,
  ensureAuthenticated,
  getAuthContext,
} from "@/lib/api";

export async function PATCH(request, { params }) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const { todoId } = await params;
  if (!todoId) {
    return buildError("Todo id is required.", 400);
  }

  const todo = await prisma.personalTodo.findUnique({
    where: { id: todoId },
  });

  if (!todo) {
    return buildError("Todo not found.", 404);
  }

  if (todo.userId !== context.user.id) {
    return buildError("You do not have permission to modify this todo.", 403);
  }

  const body = await request.json();
  const updates = {};

  if (body.content !== undefined) {
    updates.content = body.content.trim();
    if (!updates.content) {
      return buildError("Todo content cannot be empty.", 400);
    }
  }

  if (body.isCompleted !== undefined) {
    updates.isCompleted = Boolean(body.isCompleted);
  }

  if (body.taskId !== undefined) {
    updates.taskId = body.taskId || null;
    if (updates.taskId) {
      const task = await prisma.task.findUnique({
        where: { id: updates.taskId },
      });
      if (!task) {
        return buildError("Linked task not found.", 404);
      }
    }
  }

  if (body.reminderAt !== undefined) {
    updates.reminderAt = body.reminderAt ? new Date(body.reminderAt) : null;
    updates.reminderSent = false;
  }

  if (body.reminderSent !== undefined) {
    updates.reminderSent = Boolean(body.reminderSent);
  }

  const updatedTodo = await prisma.personalTodo.update({
    where: { id: todoId },
    data: updates,
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

  return buildSuccess("Todo updated successfully.", { todo: updatedTodo });
}

export async function DELETE(request, { params }) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const { todoId } = await params;
  if (!todoId) {
    return buildError("Todo id is required.", 400);
  }

  const todo = await prisma.personalTodo.findUnique({
    where: { id: todoId },
  });

  if (!todo) {
    return buildError("Todo not found.", 404);
  }

  if (todo.userId !== context.user.id) {
    return buildError("You do not have permission to delete this todo.", 403);
  }

  await prisma.personalTodo.delete({
    where: { id: todoId },
  });

  return buildSuccess("Todo deleted successfully.");
}
