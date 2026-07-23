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

  const now = new Date();
  const dueTodos = await prisma.personalTodo.findMany({
    where: {
      userId: context.user.id,
      isCompleted: false,
      reminderAt: {
        not: null,
        lte: now,
      },
      reminderSent: false,
    },
    orderBy: { reminderAt: "asc" },
  });

  return buildSuccess("Reminders fetched.", { reminders: dueTodos });
}
