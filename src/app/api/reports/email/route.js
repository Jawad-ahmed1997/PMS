import { prisma } from "@/lib/prisma";
import { buildError, buildSuccess, ensureAuthenticated, getAuthContext } from "@/lib/api";
import { sendPerformanceReportEmail } from "@/lib/sendPerformanceReportEmail";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request) {
  const authHeader = request.headers.get("x-cron-secret");
  const isInternalCron = authHeader && authHeader === (process.env.CRON_SECRET || "internal_cron");

  if (!isInternalCron) {
    const context = await getAuthContext();
    const authError = ensureAuthenticated(context);
    if (authError) {
      return authError;
    }
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { searchParams } = new URL(request.url);

    const userId = body.userId || searchParams.get("userId");
    const period = body.period || searchParams.get("period") || "weekly";
    const recipientEmail = body.recipientEmail || searchParams.get("recipientEmail");

    if (userId) {
      // Send individual report for single user
      const result = await sendPerformanceReportEmail({ userId, period, recipientEmail });
      return buildSuccess(`Performance report email sent to ${result.user} (${result.recipient}).`, result);
    } else {
      // Bulk send to all active users with logged activity/attendance
      const activeUsers = await prisma.user.findMany({
        where: { status: "ACTIVE" },
        select: { id: true, name: true, email: true },
      });

      const results = [];
      const errors = [];

      const emailPromises = activeUsers.map(async (u) => {
        try {
          const res = await sendPerformanceReportEmail({ userId: u.id, period });
          results.push(res);
        } catch (err) {
          console.error(`Failed to send report email to ${u.name}:`, err);
          errors.push({ user: u.name, error: err instanceof Error ? err.message : String(err) });
        }
      });

      await Promise.allSettled(emailPromises);

      return buildSuccess(`Sent ${results.length} performance report emails.`, {
        sentCount: results.length,
        results,
        errors,
      });
    }
  } catch (error) {
    console.error("Failed to send performance report email:", error);
    return buildError(error instanceof Error ? error.message : "Unable to send email report.", 500);
  }
}
