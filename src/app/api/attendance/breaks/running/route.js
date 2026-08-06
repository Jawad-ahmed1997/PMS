import { prisma } from "@/lib/prisma";
import {
  buildSuccess,
  ensureAuthenticated,
  getAuthContext,
} from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const runningBreak = await prisma.attendanceBreak.findFirst({
    where: {
      attendance: { userId: context.user.id },
      endAt: null,
    },
    select: { id: true, startAt: true, types: true, notes: true },
  });

  return buildSuccess("Running break fetched.", { runningBreak });
}
