import { prisma } from "@/lib/prisma";
import {
  buildSuccess,
  ensureAuthenticated,
  getAuthContext,
} from "@/lib/api";
import { findRunningManualLog } from "@/lib/manualLogMutations";

export const dynamic = "force-dynamic";

export async function GET() {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const runningLog = await findRunningManualLog(prisma, {
    userId: context.user.id,
  });

  return buildSuccess("Running manual activity fetched.", { runningLog });
}
