import { prisma } from "@/lib/prisma";
import {
  ADMIN_ROLES,
  buildError,
  buildSuccess,
  ensureAuthenticated,
  getAuthContext,
  PROJECT_MANAGEMENT_ROLES,
} from "@/lib/api";
import { runAiManagerDiagnosis } from "@/lib/aiManagerService";

export async function GET(request) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const { searchParams } = new URL(request.url);
  const requestedUserId = searchParams.get("userId");
  const type = searchParams.get("type"); // "DAILY", "WEEKLY", "MONTHLY", "CUSTOM"
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const limit = Math.min(100, Number(searchParams.get("limit")) || 50);

  const isManager = ADMIN_ROLES.includes(context.role) || PROJECT_MANAGEMENT_ROLES.includes(context.role);
  const targetUserId = isManager && requestedUserId ? requestedUserId : (isManager ? (requestedUserId || null) : context.user.id);

  const where = {};
  if (targetUserId) {
    where.userId = targetUserId;
  }
  if (type && type.toUpperCase() !== "ALL") {
    where.type = type.toUpperCase();
  }
  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = new Date(startDate);
    if (endDate) where.date.lte = new Date(endDate);
  }

  try {
    const [reports, teamUsers] = await Promise.all([
      prisma.aiDoctorReport.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          user: { select: { id: true, name: true, role: true, email: true, image: true } },
        },
      }),
      isManager
        ? prisma.user.findMany({
            where: { status: { not: "DISABLED" } },
            select: { id: true, name: true, role: true, email: true, image: true },
            orderBy: { name: "asc" },
          })
        : context.user
        ? [{ id: context.user.id, name: context.user.name, role: context.user.role, email: context.user.email, image: context.user.image }]
        : [],
    ]);

    return buildSuccess("AI Manager reports loaded.", {
      reports,
      teamUsers,
    });
  } catch (error) {
    console.error("Failed to load AI Manager reports:", error);
    return buildError("Failed to load AI Manager reports.", 500);
  }
}

export async function POST(request) {
  const authHeader = request.headers.get("x-cron-secret");
  const isInternal = authHeader && authHeader === (process.env.CRON_SECRET || "internal_cron");

  if (!isInternal) {
    const context = await getAuthContext();
    const authError = ensureAuthenticated(context);
    if (authError) {
      return authError;
    }
  }

  try {
    const body = await request.json();
    const { userId, targetDate, period, customStartDate, customEndDate } = body || {};

    if (!userId) {
      return buildError("userId is required.", 400);
    }

    const report = await runAiManagerDiagnosis({
      userId,
      targetDate: targetDate ? new Date(targetDate) : new Date(),
      period: period || "weekly",
      customStartDate,
      customEndDate,
    });

    return buildSuccess("AI Manager report generated successfully.", {
      report,
      ...report,
    });
  } catch (error) {
    console.error("AI Manager generation error:", error);
    return buildError(error.message || "Failed to generate AI Manager report.", 500);
  }
}

export async function DELETE(request) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return buildError("Report id is required for deletion.", 400);
  }

  const isManager = ADMIN_ROLES.includes(context.role) || PROJECT_MANAGEMENT_ROLES.includes(context.role);

  try {
    const existing = await prisma.aiDoctorReport.findUnique({
      where: { id },
    });

    if (!existing) {
      return buildError("Report not found.", 404);
    }

    if (!isManager && existing.userId !== context.user.id) {
      return buildError("You do not have permission to delete this report.", 403);
    }

    await prisma.aiDoctorReport.delete({
      where: { id },
    });

    return buildSuccess("Report deleted successfully.", { id });
  } catch (error) {
    console.error("Failed to delete report:", error);
    return buildError("Failed to delete report.", 500);
  }
}
