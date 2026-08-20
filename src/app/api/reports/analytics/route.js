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

  const { searchParams } = new URL(request.url);
  const userIdParam = searchParams.get("userId");
  const projectIdParam = searchParams.get("projectId");
  const startDateParam = searchParams.get("startDate");
  const endDateParam = searchParams.get("endDate");

  // Construct filters
  const taskWhere = {};
  if (projectIdParam) {
    taskWhere.projectId = projectIdParam;
  }
  if (userIdParam) {
    taskWhere.ownerId = userIdParam;
  }

  const attendanceWhere = {};
  if (userIdParam) {
    attendanceWhere.userId = userIdParam;
  }

  if (startDateParam || endDateParam) {
    const dateFilter = {};
    if (startDateParam) {
      const start = new Date(startDateParam);
      if (!Number.isNaN(start.getTime())) {
        dateFilter.gte = start;
      }
    }
    if (endDateParam) {
      const end = new Date(endDateParam);
      if (!Number.isNaN(end.getTime())) {
        end.setHours(23, 59, 59, 999);
        dateFilter.lte = end;
      }
    }
    if (Object.keys(dateFilter).length > 0) {
      attendanceWhere.date = dateFilter;
    }
  }

  try {
    // 1. Fetch Users
    const users = await prisma.user.findMany({
      where: userIdParam ? { id: userIdParam } : { status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        image: true,
      },
      orderBy: { name: "asc" },
    });

    // 2. Fetch Tasks
    const tasks = await prisma.task.findMany({
      where: taskWhere,
      select: {
        id: true,
        title: true,
        status: true,
        type: true,
        ownerId: true,
        projectId: true,
        milestoneId: true,
        estimatedHours: true,
        totalTimeSpent: true,
        reworkCount: true,
        blockedReason: true,
        blockedType: true,
        holdReason: true,
        createdAt: true,
        updatedAt: true,
        owner: { select: { id: true, name: true, image: true, role: true } },
        milestone: { select: { id: true, title: true, endDate: true } },
        project: { select: { id: true, name: true } },
      },
    });

    // 3. Fetch Attendances
    const attendances = await prisma.attendance.findMany({
      where: attendanceWhere,
      include: {
        user: { select: { id: true, name: true, image: true, role: true } },
        breaks: true,
        wfhIntervals: true,
      },
      orderBy: { date: "desc" },
    });

    // 4. Fetch Manual Activity Logs
    const activityLogs = await prisma.activityLog.findMany({
      where: userIdParam ? { userId: userIdParam } : {},
      select: {
        id: true,
        userId: true,
        categories: true,
        durationSeconds: true,
        type: true,
      },
    });

    // 5. Fetch Milestones
    const milestones = await prisma.milestone.findMany({
      where: projectIdParam ? { projectId: projectIdParam } : {},
      include: {
        project: { select: { id: true, name: true } },
        tasks: {
          select: {
            id: true,
            title: true,
            status: true,
            estimatedHours: true,
            totalTimeSpent: true,
            ownerId: true,
            owner: { select: { id: true, name: true } },
          },
        },
      },
    });

    // --- AGGREGATIONS ---

    // Overall KPI Summaries
    let totalCompletedTasks = 0;
    let totalCompletedLateTasks = 0;
    let totalReworkCount = 0;
    let totalSpentSecondsAll = 0;
    let totalEstimatedHoursAll = 0;

    // Stage-wise (TaskType) Time Utilization
    const stageTypeHours = { UI: 0, AUTH: 0, API: 0, REFACTOR: 0, CHART: 0 };
    // Task Status Distribution
    const statusCounts = {
      BACKLOG: 0,
      READY: 0,
      IN_PROGRESS: 0,
      ON_HOLD: 0,
      DEV_TEST: 0,
      TESTING: 0,
      DONE: 0,
      REJECTED: 0,
      BLOCKED: 0,
    };

    tasks.forEach((t) => {
      if (statusCounts[t.status] !== undefined) {
        statusCounts[t.status] += 1;
      }
      totalReworkCount += t.reworkCount ?? 0;
      totalSpentSecondsAll += t.totalTimeSpent ?? 0;
      totalEstimatedHoursAll += t.estimatedHours ?? 0;

      if (t.type && stageTypeHours[t.type] !== undefined) {
        stageTypeHours[t.type] += Number(((t.totalTimeSpent ?? 0) / 3600).toFixed(2));
      }

      if (t.status === "DONE") {
        totalCompletedTasks += 1;
        const estSec = (t.estimatedHours ?? 0) * 3600;
        const spentSec = t.totalTimeSpent ?? 0;
        if (estSec > 0 && spentSec > estSec) {
          totalCompletedLateTasks += 1;
        }
      }
    });

    // Per User Performance Scorecard Map
    const userScorecardMap = {};
    users.forEach((u) => {
      userScorecardMap[u.id] = {
        user: u,
        totalAssigned: 0,
        completedTasks: 0,
        completedOnTime: 0,
        completedLate: 0,
        reworkCount: 0,
        totalSpentHours: 0,
        totalEstimatedHours: 0,
        totalManualHours: 0,
        taskTypeHours: { UI: 0, AUTH: 0, API: 0, REFACTOR: 0, CHART: 0 },
        manualCategoryHours: { LEARNING: 0, RESEARCH: 0, OTHER: 0 },
        attendanceDays: 0,
        lateArrivals: 0,
        autoOffCount: 0,
        officeHours: 0,
        wfhHours: 0,
        breakHours: 0,
      };
    });

    // Aggregate Tasks per user
    tasks.forEach((t) => {
      const card = userScorecardMap[t.ownerId];
      if (card) {
        card.totalAssigned += 1;
        const hrs = Number(((t.totalTimeSpent ?? 0) / 3600).toFixed(2));
        card.totalSpentHours += hrs;
        card.totalEstimatedHours += t.estimatedHours ?? 0;
        card.reworkCount += t.reworkCount ?? 0;

        if (t.type && card.taskTypeHours[t.type] !== undefined) {
          card.taskTypeHours[t.type] += hrs;
        }

        if (t.status === "DONE") {
          card.completedTasks += 1;
          const estSec = (t.estimatedHours ?? 0) * 3600;
          const spentSec = t.totalTimeSpent ?? 0;
          if (estSec > 0 && spentSec > estSec) {
            card.completedLate += 1;
          } else {
            card.completedOnTime += 1;
          }
        }
      }
    });

    // Aggregate Attendance metrics per user
    let totalLateArrivalsAll = 0;
    let totalAutoOffAll = 0;

    attendances.forEach((att) => {
      const card = userScorecardMap[att.userId];
      if (card) {
        card.attendanceDays += 1;
        if (att.autoOff) {
          card.autoOffCount += 1;
          totalAutoOffAll += 1;
        }

        // Late arrival check (Office Shift: 3:00 PM - 1:00 AM, Grace Cutoff: 3:15 PM)
        if (att.inTime) {
          const inDate = new Date(att.inTime);
          const hours = inDate.getHours();
          const minutes = inDate.getMinutes();
          if (hours > 15 || (hours === 15 && minutes > 15) || hours < 5) {
            card.lateArrivals += 1;
            totalLateArrivalsAll += 1;
          }
        }

        // Duration calculation
        if (att.inTime && att.outTime) {
          const durSec = Math.max(0, (new Date(att.outTime) - new Date(att.inTime)) / 1000);
          card.officeHours += Number((durSec / 3600).toFixed(2));
        }

        (att.breaks ?? []).forEach((b) => {
          card.breakHours += Number(((b.durationMinutes ?? 0) / 60).toFixed(2));
        });

        (att.wfhIntervals ?? []).forEach((w) => {
          const wfhSec = Math.max(0, (new Date(w.endAt) - new Date(w.startAt)) / 1000);
          card.wfhHours += Number((wfhSec / 3600).toFixed(2));
        });
      }
    });

    // Aggregate Manual Activity Categories
    const categoryHours = { LEARNING: 0, RESEARCH: 0, OTHER: 0 };
    activityLogs.forEach((act) => {
      const card = userScorecardMap[act.userId];
      const hrs = Number(((act.durationSeconds ?? 0) / 3600).toFixed(2));

      if (card) {
        card.totalManualHours += hrs;
      }

      (act.categories ?? []).forEach((cat) => {
        if (categoryHours[cat] !== undefined) {
          categoryHours[cat] += hrs;
        }
        if (card && card.manualCategoryHours[cat] !== undefined) {
          card.manualCategoryHours[cat] += hrs;
        }
      });
    });

    // Calculate final metrics per user (Utilization %, Avg Duty/Day, Time Distribution %, Performance Score)
    const userScorecards = Object.values(userScorecardMap).map((card) => {
      const totalDutyHours = Number((card.officeHours + card.wfhHours).toFixed(2));
      const avgDutyHoursPerDay = card.attendanceDays > 0
        ? Number((totalDutyHours / card.attendanceDays).toFixed(1))
        : 0;

      const totalActiveHours = Number((card.totalSpentHours + card.totalManualHours).toFixed(2));

      const utilizationPercent = totalDutyHours > 0
        ? Math.min(100, Math.round((totalActiveHours / totalDutyHours) * 100))
        : 0;

      // Time distribution array for badges/percentages (e.g. 30% UI, 15% Refactor, 50% Learning)
      const distribution = [];
      const denom = totalActiveHours > 0 ? totalActiveHours : 1;

      Object.entries(card.taskTypeHours).forEach(([type, h]) => {
        if (h > 0) {
          distribution.push({
            label: `${type} Tasks`,
            hours: Number(h.toFixed(1)),
            percent: Math.round((h / denom) * 100),
          });
        }
      });

      Object.entries(card.manualCategoryHours).forEach(([cat, h]) => {
        if (h > 0) {
          const formattedLabel = cat.charAt(0) + cat.slice(1).toLowerCase();
          distribution.push({
            label: formattedLabel,
            hours: Number(h.toFixed(1)),
            percent: Math.round((h / denom) * 100),
          });
        }
      });

      distribution.sort((a, b) => b.percent - a.percent);

      // Performance Score Calculation (0 - 100 pts)
      const punctualityScore = card.attendanceDays > 0
        ? Math.round(((card.attendanceDays - card.lateArrivals) / card.attendanceDays) * 30)
        : 30;

      const taskOutputScore = card.totalAssigned > 0
        ? Math.round(((card.completedOnTime + card.completedTasks * 0.5) / Math.max(1, card.totalAssigned)) * 40)
        : (card.completedTasks > 0 ? 30 : 15);

      const utilizationScore = Math.round((utilizationPercent / 100) * 20);

      const qualityScore = Math.max(0, 10 - card.reworkCount * 2);

      const performanceScore = Math.min(100, Math.max(0, punctualityScore + taskOutputScore + utilizationScore + qualityScore));

      return {
        ...card,
        totalDutyHours,
        avgDutyHoursPerDay,
        totalActiveHours,
        utilizationPercent,
        distribution,
        performanceScore,
      };
    });

    // Sort user scorecards by Performance Score descending (Top Performers on Top!)
    userScorecards.sort((a, b) => {
      if (b.performanceScore !== a.performanceScore) {
        return b.performanceScore - a.performanceScore;
      }
      return b.completedTasks - a.completedTasks;
    });

    // Aggregate Milestone Impact Analysis
    const milestoneImpact = milestones.map((m) => {
      const now = new Date();
      const isPastDue = new Date(m.endDate) < now;
      let milestoneSpentSec = 0;
      let milestoneEstHours = 0;
      let completedCount = 0;
      let lateTasksCount = 0;

      (m.tasks ?? []).forEach((t) => {
        milestoneSpentSec += t.totalTimeSpent ?? 0;
        milestoneEstHours += t.estimatedHours ?? 0;
        if (t.status === "DONE") {
          completedCount += 1;
          if ((t.estimatedHours ?? 0) * 3600 > 0 && (t.totalTimeSpent ?? 0) > (t.estimatedHours ?? 0) * 3600) {
            lateTasksCount += 1;
          }
        }
      });

      return {
        id: m.id,
        title: m.title,
        project: m.project,
        endDate: m.endDate,
        isPastDue,
        totalTasks: m.tasks.length,
        completedTasks: completedCount,
        lateTasksCount,
        spentHours: Number((milestoneSpentSec / 3600).toFixed(2)),
        estimatedHours: milestoneEstHours,
      };
    });

    return buildSuccess("Analytics data loaded.", {
      kpi: {
        totalCompletedTasks,
        totalCompletedLateTasks,
        completedLatePercentage: totalCompletedTasks > 0
          ? Number(((totalCompletedLateTasks / totalCompletedTasks) * 100).toFixed(1))
          : 0,
        totalReworkCount,
        totalLateArrivals: totalLateArrivalsAll,
        totalAutoOff: totalAutoOffAll,
        totalSpentHours: Number((totalSpentSecondsAll / 3600).toFixed(2)),
        totalEstimatedHours: totalEstimatedHoursAll,
      },
      stageTypeHours,
      statusCounts,
      categoryHours,
      userScorecards,
      milestoneImpact,
    });
  } catch (error) {
    console.error("Failed to compute analytics reports:", error);
    return buildError("Unable to compute analytics reports.", 500);
  }
}
