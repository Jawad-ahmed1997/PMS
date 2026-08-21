import { prisma } from "@/lib/prisma";
import {
  buildError,
  buildSuccess,
  ensureAuthenticated,
  getAuthContext,
} from "@/lib/api";
import { getUserDailyTimeline } from "@/lib/analytics/timeline";

function getCutoffForUser(user) {
  if (!user) return { cutoffHour: 15, cutoffMinute: 15 };
  const nameLower = (user.name ?? "").toLowerCase();
  const emailLower = (user.email ?? "").toLowerCase();

  // Saad Raza: 6:30 PM shift start -> 6:45 PM cutoff (18:45 PKT)
  if (nameLower.includes("saad") || emailLower.includes("saad")) {
    return { cutoffHour: 18, cutoffMinute: 45 };
  }
  // Sabir: 9:00 PM shift start -> 9:15 PM cutoff (21:15 PKT)
  if (nameLower.includes("sabir") || emailLower.includes("sabir")) {
    return { cutoffHour: 21, cutoffMinute: 15 };
  }
  // Default: 3:00 PM shift start -> 3:15 PM cutoff (15:15 PKT)
  return { cutoffHour: 15, cutoffMinute: 15 };
}

function isLateCheckIn(inTime, user, timeZone = "Asia/Karachi") {
  if (!inTime) return false;
  const date = inTime instanceof Date ? inTime : new Date(inTime);
  if (Number.isNaN(date.getTime())) return false;

  const { cutoffHour, cutoffMinute } = getCutoffForUser(user);

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const lookup = parts.reduce((acc, part) => {
    if (part.type !== "literal") {
      acc[part.type] = Number(part.value);
    }
    return acc;
  }, {});

  const hour = lookup.hour ?? 0;
  const minute = lookup.minute ?? 0;

  if (hour > cutoffHour || (hour === cutoffHour && minute > cutoffMinute) || hour < 5) {
    return true;
  }
  return false;
}

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

  const activityLogWhere = {};
  if (userIdParam) {
    activityLogWhere.userId = userIdParam;
  }

  let dateFilter = null;
  if (startDateParam || endDateParam) {
    dateFilter = {};
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
      activityLogWhere.date = dateFilter;
      taskWhere.createdAt = dateFilter;
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
        user: { select: { id: true, name: true, email: true, image: true, role: true } },
        breaks: true,
        wfhIntervals: true,
      },
      orderBy: { date: "desc" },
    });

    // 4. Fetch Manual Activity Logs
    const activityLogs = await prisma.activityLog.findMany({
      where: activityLogWhere,
      select: {
        id: true,
        userId: true,
        categories: true,
        durationSeconds: true,
        date: true,
        startAt: true,
        endAt: true,
        type: true,
        workSession: { select: { id: true } },
      },
    });

    // 4b. Fetch Task Work Sessions for period
    const workSessionWhere = {};
    if (userIdParam) workSessionWhere.userId = userIdParam;
    if (dateFilter) workSessionWhere.startedAt = dateFilter;

    const workSessions = await prisma.taskWorkSession.findMany({
      where: workSessionWhere,
      include: {
        task: { select: { id: true, type: true } },
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
            type: true,
            estimatedHours: true,
            totalTimeSpent: true,
            ownerId: true,
          },
        },
      },
    });

    // --- AGGREGATIONS ---

    // Overall KPI Totals
    let totalTasksAll = tasks.length;
    let totalCompletedTasks = 0;
    let totalCompletedLateTasks = 0;
    let totalReworkCount = 0;
    let totalSpentSecondsAll = 0;
    let totalEstimatedHoursAll = 0;

    // Stage-wise (TaskType) Time Utilization
    const stageTypeHours = {
      UI: 0,
      AUTH: 0,
      API: 0,
      REFACTOR: 0,
      CHART: 0,
      FULL_STACK: 0,
      THIRD_PARTY: 0,
      BUSINESS_LOGIC: 0,
      DATABASE: 0,
      BUG_FIX: 0,
      DEVOPS: 0,
      TESTING: 0,
      PERFORMANCE: 0,
      DOCUMENTATION: 0,
    };
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
        lateManualDumpsCount: 0,
        taskTypeHours: {
          UI: 0,
          AUTH: 0,
          API: 0,
          REFACTOR: 0,
          CHART: 0,
          FULL_STACK: 0,
          THIRD_PARTY: 0,
          BUSINESS_LOGIC: 0,
          DATABASE: 0,
          BUG_FIX: 0,
          DEVOPS: 0,
          TESTING: 0,
          PERFORMANCE: 0,
          DOCUMENTATION: 0,
        },
        manualCategoryHours: { LEARNING: 0, RESEARCH: 0, OTHER: 0 },
        attendanceDays: 0,
        lateArrivals: 0,
        autoOffCount: 0,
        officeHours: 0,
        wfhHours: 0,
        breakHours: 0,
      };
    });

    // Aggregate Task Work Sessions per user in period
    workSessions.forEach((ws) => {
      const card = userScorecardMap[ws.userId];
      if (card) {
        const hrs = Number(((ws.durationSeconds ?? 0) / 3600).toFixed(2));
        card.totalSpentHours += hrs;
        const type = ws.task?.type;
        if (type && card.taskTypeHours[type] !== undefined) {
          card.taskTypeHours[type] += hrs;
        }
      }
    });

    // Aggregate Tasks metadata per user
    tasks.forEach((t) => {
      const card = userScorecardMap[t.ownerId];
      if (card) {
        card.totalAssigned += 1;
        card.totalEstimatedHours += t.estimatedHours ?? 0;
        card.reworkCount += t.reworkCount ?? 0;

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

        // Late arrival check (custom cutoff per user/role)
        if (att.inTime && isLateCheckIn(att.inTime, card.user, context.timezone ?? "Asia/Karachi")) {
          card.lateArrivals += 1;
          totalLateArrivalsAll += 1;
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

      if (!act.workSessionId && act.type === "MANUAL") {
        const hrs = Number(((act.durationSeconds ?? 0) / 3600).toFixed(2));

        if (card) {
          card.totalManualHours += hrs;

          // Check if manual log was dumped retroactively late (entry created > 2 hrs after endAt)
          if (act.date && act.endAt) {
            const creationTime = new Date(act.date).getTime();
            const activityEndTime = new Date(act.endAt).getTime();
            if (creationTime - activityEndTime > 2 * 3600 * 1000) {
              card.lateManualDumpsCount += 1;
            }
          }
        }

        (act.categories ?? []).forEach((cat) => {
          if (categoryHours[cat] !== undefined) {
            categoryHours[cat] += hrs;
          }
          if (card && card.manualCategoryHours[cat] !== undefined) {
            card.manualCategoryHours[cat] += hrs;
          }
        });
      }
    });

    // Generate dates list for period
    const now = new Date();
    const effectiveStart = dateFilter?.gte ? new Date(dateFilter.gte) : new Date(now.getFullYear(), now.getMonth(), 1);
    const effectiveEnd = dateFilter?.lte ? new Date(dateFilter.lte) : new Date(now);

    const datesList = [];
    let cur = new Date(effectiveStart);
    while (cur <= effectiveEnd && cur <= now) {
      datesList.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }

    // Precompute timeline metrics for each user in parallel
    const userTimelineTotalsMap = {};
    await Promise.all(
      users.map(async (u) => {
        let dutySec = 0;
        let workSec = 0;
        let breakSec = 0;
        let idleSec = 0;
        for (const day of datesList) {
          const t = await getUserDailyTimeline(prisma, u.id, day, now);
          dutySec += t.totals?.dutySeconds ?? 0;
          workSec += t.totals?.workSeconds ?? 0;
          breakSec += t.totals?.breakSeconds ?? 0;
          idleSec += t.totals?.idleSeconds ?? 0;
        }
        userTimelineTotalsMap[u.id] = { dutySec, workSec, breakSec, idleSec };
      })
    );

    // Max attendance days in team
    const maxAttendanceDaysInTeam = Math.max(
      1,
      ...Object.values(userScorecardMap).map((c) => c.attendanceDays)
    );

    // Calculate final metrics per user
    const allScorecards = Object.values(userScorecardMap).map((card) => {
      const timelineTotals = userTimelineTotalsMap[card.user.id] || { dutySec: 0, workSec: 0, breakSec: 0, idleSec: 0 };
      const totalDutyHours = Number((timelineTotals.dutySec / 3600).toFixed(2));
      const totalActiveHours = Number((timelineTotals.workSec / 3600).toFixed(2));

      const avgDutyHoursPerDay = card.attendanceDays > 0
        ? Number((totalDutyHours / card.attendanceDays).toFixed(1))
        : 0;

      const utilizationPercent = totalDutyHours > 0
        ? Math.min(100, Math.round((totalActiveHours / totalDutyHours) * 100))
        : 0;

      // Time distribution array
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

      const isUnranked = card.attendanceDays === 0 && card.totalActiveHours === 0 && card.totalAssigned === 0;

      if (isUnranked) {
        return {
          ...card,
          totalDutyHours: 0,
          avgDutyHoursPerDay: 0,
          totalActiveHours: 0,
          utilizationPercent: 0,
          distribution: [],
          performanceScore: 0,
          professionalismPercent: 0,
          manualRatioPercent: 0,
          isUnranked: true,
        };
      }

      // Professionalism Rating (0 - 100%)
      // Pillar 1: Auto-Off Discipline (35% weight)
      const autoOffRating = Math.max(0, 100 - card.autoOffCount * 25);

      // Pillar 2: Check-In Punctuality (35% weight)
      const punctualityRating = card.attendanceDays > 0
        ? Math.round(((card.attendanceDays - card.lateArrivals) / card.attendanceDays) * 100)
        : 100;

      // Pillar 3: Log Timing Discipline (20% weight - penalizes end-of-day retroactive manual dumping)
      const trackingRating = Math.max(0, 100 - card.lateManualDumpsCount * 25);

      // Pillar 4: Quality & Low Rework (10% weight)
      const qualityRating = Math.max(0, 100 - card.reworkCount * 20);

      // Overall Professionalism Rating %
      const professionalismPercent = Math.min(
        100,
        Math.max(
          0,
          Math.round(
            autoOffRating * 0.35 +
            punctualityRating * 0.35 +
            trackingRating * 0.20 +
            qualityRating * 0.10
          )
        )
      );

      // Overall Leaderboard Performance Score (0 - 100 pts)
      // 1. Attendance Volume (25 pts Max)
      const attendanceVolumeScore = Math.round((card.attendanceDays / maxAttendanceDaysInTeam) * 25);

      // 2. Task Output & Delivery Velocity (35 pts Max)
      let taskOutputScore = 0;
      if (card.totalAssigned > 0) {
        taskOutputScore = Math.round(((card.completedOnTime + card.completedTasks * 0.5) / card.totalAssigned) * 35);
      } else if (card.completedTasks > 0) {
        taskOutputScore = Math.min(35, card.completedTasks * 10);
      } else if (totalActiveHours > 0) {
        taskOutputScore = 10;
      }

      // 3. Work Utilization Rate (20 pts Max)
      const utilizationScore = Math.round((utilizationPercent / 100) * 20);

      // 4. Dedicated Professionalism Pillar (20 pts Max)
      const professionalismScore = Math.round((professionalismPercent / 100) * 20);

      const performanceScore = Math.min(
        100,
        Math.max(0, attendanceVolumeScore + taskOutputScore + utilizationScore + professionalismScore)
      );

      return {
        ...card,
        totalEstimatedHours: Number(card.totalEstimatedHours.toFixed(2)),
        totalSpentHours: Number(card.totalSpentHours.toFixed(2)),
        totalManualHours: Number(card.totalManualHours.toFixed(2)),
        totalDutyHours,
        avgDutyHoursPerDay,
        totalActiveHours,
        utilizationPercent,
        distribution,
        performanceScore,
        professionalismPercent,
        manualRatioPercent: totalActiveHours > 0 ? Math.round((card.totalManualHours / totalActiveHours) * 100) : 0,
        isUnranked: false,
      };
    });

    // Separate main Developers from Junior Interns
    const developerScorecards = allScorecards
      .filter((s) => s.user.role !== "JUNIOR_INTERN")
      .sort((a, b) => {
        if (a.isUnranked !== b.isUnranked) return a.isUnranked ? 1 : -1;
        return b.performanceScore - a.performanceScore;
      });

    const internScorecards = allScorecards
      .filter((s) => s.user.role === "JUNIOR_INTERN")
      .sort((a, b) => {
        if (a.isUnranked !== b.isUnranked) return a.isUnranked ? 1 : -1;
        return b.performanceScore - a.performanceScore;
      });

    const userScorecards = [...developerScorecards, ...internScorecards];

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
