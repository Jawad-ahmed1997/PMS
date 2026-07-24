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
    return buildError("You do not have permission to update this todo.", 403);
  }

  const updated = await prisma.personalTodo.update({
    where: { id: todoId },
    data: { reminderSent: true },
  });

  return buildSuccess("Reminder marked as sent.", { todo: updated });
}
