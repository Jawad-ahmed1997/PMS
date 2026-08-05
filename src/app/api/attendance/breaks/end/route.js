import { prisma } from "@/lib/prisma";
import {
  buildError,
  buildSuccess,
  ensureAuthenticated,
  getAuthContext,
} from "@/lib/api";

export async function POST(request) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  // Find the active break for this user
  const activeBreak = await prisma.attendanceBreak.findFirst({
    where: {
      attendance: { userId: context.user.id },
      endAt: null,
    },
    include: {
      attendance: true,
    },
  });

  if (!activeBreak) {
    return buildError("No active break found.", 404);
  }

  const now = new Date();
  const durationMinutes = Math.max(
    1,
    Math.round((now.getTime() - activeBreak.startAt.getTime()) / 60000)
  );

  const updatedBreak = await prisma.attendanceBreak.update({
    where: { id: activeBreak.id },
    data: {
      endAt: now,
      durationMinutes,
    },
  });

  return buildSuccess("Break ended successfully.", { break: updatedBreak });
}
