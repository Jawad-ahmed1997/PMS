import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { buildPerformanceReportEmailHtml } from "@/lib/emailReportTemplate";
import { getUserDailyTimeline } from "@/lib/analytics/timeline";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function getCutoffForUser(user) {
  if (!user) return { cutoffHour: 15, cutoffMinute: 15 };
  const nameLower = (user.name ?? "").toLowerCase();
  const emailLower = (user.email ?? "").toLowerCase();

  if (nameLower.includes("saad") || emailLower.includes("saad")) {
    return { cutoffHour: 18, cutoffMinute: 45 };
  }
  if (nameLower.includes("sabir") || emailLower.includes("sabir")) {
    return { cutoffHour: 21, cutoffMinute: 15 };
  }
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

/**
 * Calculate weekly Monday to Saturday or monthly date bounds.
 */
function getPeriodDateRange(period = "weekly", referenceDate = new Date()) {
  const now = new Date(referenceDate);

  if (period === "monthly") {
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { startDate, endDate, periodTitle: "Monthly Performance Report" };
  }

  // Weekly: Strictly Monday 00:00:00 to Saturday 23:59:59 of current/target week
  const dayOfWeek = now.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const distanceToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const startDate = new Date(now);
  startDate.setDate(now.getDate() + distanceToMonday);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 5); // Monday + 5 days = Saturday
  endDate.setHours(23, 59, 59, 999);

  return { startDate, endDate, periodTitle: "Weekly Performance Report" };
}

/**
 * Send individual performance report email to a user.
 * @param {string} userId - User ID to send report to.
 * @param {string} period - "weekly" or "monthly".
 * @param {string} recipientEmail - Optional override recipient email.
 */
export async function sendPerformanceReportEmail({ userId, period = "weekly", recipientEmail = null }) {
  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true },
  });

  if (!targetUser) {
    throw new Error(`User not found with ID: ${userId}`);
  }

  const emailTo = recipientEmail || targetUser.email;
  if (!emailTo) {
    throw new Error(`No email address available for user: ${targetUser.name}`);
  }

  const { startDate, endDate, periodTitle } = getPeriodDateRange(period);

  const startStr = startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const endStr = endDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const periodLabel = `${periodTitle} (${startStr} – ${endStr})`;

  const dateFilter = { gte: startDate, lte: endDate };
  const now = new Date();

  // Fetch user data for timeframe
  const [tasks, workSessions, attendances, activityLogs] = await Promise.all([
    prisma.task.findMany({
      where: { ownerId: userId },
      select: {
        id: true,
        title: true,
        status: true,
        type: true,
        estimatedHours: true,
        totalTimeSpent: true,
        reworkCount: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.taskWorkSession.findMany({
      where: {
        userId,
        startedAt: dateFilter,
      },
      include: {
        task: { select: { id: true, type: true, title: true } },
      },
    }),
    prisma.attendance.findMany({
      where: { userId, date: dateFilter },
      include: { breaks: true, wfhIntervals: true },
    }),
    prisma.activityLog.findMany({
      where: { userId, date: dateFilter },
      select: {
        id: true,
        categories: true,
        durationSeconds: true,
        date: true,
        endAt: true,
        type: true,
        workSession: { select: { id: true } },
      },
    }),
  ]);

  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const manualLogMap = new Map(activityLogs.map((a) => [a.id, a]));

  // Max attendance days across all active users in team for relative volume score
  const totalTeamAttendanceCount = await prisma.attendance.groupBy({
    by: ["userId"],
    where: { date: dateFilter },
    _count: { id: true },
  });

  const maxTeamAttendanceDays = Math.max(
    1,
    ...totalTeamAttendanceCount.map((c) => c._count.id)
  );

  // Compute unified Timeline totals (Work, Breaks, Idle, Duty) and track work categories from duty segments
  const daysList = [];
  let curr = new Date(startDate);
  while (curr <= endDate && curr <= now) {
    daysList.push(new Date(curr));
    curr.setDate(curr.getDate() + 1);
  }

  let totalTimelineDutySeconds = 0;
  let totalTimelineWorkSeconds = 0;
  let totalTimelineBreakSeconds = 0;
  let totalTimelineIdleSeconds = 0;

  const taskTypeSeconds = {
    UI: 0, AUTH: 0, API: 0, REFACTOR: 0, CHART: 0,
    FULL_STACK: 0, THIRD_PARTY: 0, BUSINESS_LOGIC: 0,
    DATABASE: 0, BUG_FIX: 0, DEVOPS: 0, TESTING: 0,
    PERFORMANCE: 0, DOCUMENTATION: 0,
  };
  const manualCategorySeconds = { LEARNING: 0, RESEARCH: 0, OTHER: 0 };
  let taskSessionSpentSeconds = 0;

  for (const day of daysList) {
    const dailyTimeline = await getUserDailyTimeline(prisma, userId, day, now);
    totalTimelineDutySeconds += dailyTimeline.totals?.dutySeconds ?? 0;
    totalTimelineWorkSeconds += dailyTimeline.totals?.workSeconds ?? 0;
    totalTimelineBreakSeconds += dailyTimeline.totals?.breakSeconds ?? 0;
    totalTimelineIdleSeconds += dailyTimeline.totals?.idleSeconds ?? 0;

    (dailyTimeline.segments ?? []).forEach((segment) => {
      if (segment.type === "WORK" && segment.startAt && segment.endAt) {
        const sec = Math.max(
          0,
          Math.floor((new Date(segment.endAt).getTime() - new Date(segment.startAt).getTime()) / 1000)
        );
        if (sec <= 0) return;

        if (segment.taskId) {
          taskSessionSpentSeconds += sec;
          const task = taskMap.get(segment.taskId);
          const type = task?.type || "UI";
          if (taskTypeSeconds[type] !== undefined) {
            taskTypeSeconds[type] += sec;
          } else {
            taskTypeSeconds.UI += sec;
          }
        } else if (segment.manualLogId) {
          const log = manualLogMap.get(segment.manualLogId);
          const cats = log?.categories?.length ? log.categories : ["LEARNING"];
          const share = sec / cats.length;
          cats.forEach((cat) => {
            if (manualCategorySeconds[cat] !== undefined) {
              manualCategorySeconds[cat] += share;
            } else {
              manualCategorySeconds.OTHER += share;
            }
          });
        } else {
          manualCategorySeconds.OTHER += sec;
        }
      }
    });
  }

  const totalDutyHours = Number((totalTimelineDutySeconds / 3600).toFixed(2));
  const totalActiveHours = Number((totalTimelineWorkSeconds / 3600).toFixed(2));
  const breakHours = Number((totalTimelineBreakSeconds / 3600).toFixed(2));
  const idleHours = Number((totalTimelineIdleSeconds / 3600).toFixed(2));
  const utilizationPercent = totalDutyHours > 0
    ? Math.min(100, Math.round((totalActiveHours / totalDutyHours) * 100))
    : 0;

  // Filter tasks active or assigned during the selected period
  const activeTaskIdsInPeriod = new Set(workSessions.map((ws) => ws.taskId));
  const periodTasks = tasks.filter((t) => {
    if (activeTaskIdsInPeriod.has(t.id)) return true;
    if (t.createdAt >= startDate && t.createdAt <= endDate) return true;
    if (t.updatedAt >= startDate && t.updatedAt <= endDate) return true;
    return false;
  });

  let totalAssigned = periodTasks.length;
  let completedTasks = 0;
  let completedOnTime = 0;
  let completedLate = 0;
  let reworkCount = 0;
  let totalEstimatedHours = 0;

  periodTasks.forEach((t) => {
    totalEstimatedHours += t.estimatedHours ?? 0;
    reworkCount += t.reworkCount ?? 0;

    if (t.status === "DONE" && t.updatedAt >= startDate && t.updatedAt <= endDate) {
      completedTasks += 1;
      const estSec = (t.estimatedHours ?? 0) * 3600;
      const spentSec = t.totalTimeSpent ?? 0;
      if (estSec > 0 && spentSec > estSec) {
        completedLate += 1;
      } else {
        completedOnTime += 1;
      }
    }
  });

  // Compute Attendance discipline flags
  let attendanceDays = attendances.length;
  let lateArrivals = 0;
  let autoOffCount = 0;

  attendances.forEach((att) => {
    if (att.autoOff) autoOffCount += 1;
    if (att.inTime && isLateCheckIn(att.inTime, targetUser)) {
      lateArrivals += 1;
    }
  });

  // Compute Late Manual Dumps
  let lateManualDumpsCount = 0;
  activityLogs.forEach((act) => {
    if (!act.workSession && act.type === "MANUAL") {
      if (act.date && act.endAt) {
        const creationTime = new Date(act.date).getTime();
        const activityEndTime = new Date(act.endAt).getTime();
        if (creationTime - activityEndTime > 2 * 3600 * 1000) {
          lateManualDumpsCount += 1;
        }
      }
    }
  });

  // Time Distribution (clamped to 100% of actual work)
  const distribution = [];
  const denomSeconds = totalTimelineWorkSeconds > 0 ? totalTimelineWorkSeconds : 1;

  Object.entries(taskTypeSeconds).forEach(([type, sec]) => {
    if (sec >= 60) {
      distribution.push({
        label: `${type} Tasks`,
        hours: Number((sec / 3600).toFixed(2)),
        percent: Math.min(100, Math.round((sec / denomSeconds) * 100)),
      });
    }
  });

  Object.entries(manualCategorySeconds).forEach(([cat, sec]) => {
    if (sec >= 60) {
      const formattedLabel = cat.charAt(0) + cat.slice(1).toLowerCase();
      distribution.push({
        label: formattedLabel,
        hours: Number((sec / 3600).toFixed(2)),
        percent: Math.min(100, Math.round((sec / denomSeconds) * 100)),
      });
    }
  });

  distribution.sort((a, b) => b.percent - a.percent);

  // Professionalism %
  const autoOffRating = Math.max(0, 100 - autoOffCount * 25);
  const punctualityRating = attendanceDays > 0
    ? Math.round(((attendanceDays - lateArrivals) / attendanceDays) * 100)
    : 100;
  const trackingRating = Math.max(0, 100 - lateManualDumpsCount * 25);
  const qualityRating = Math.max(0, 100 - reworkCount * 20);

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

  // Performance Score (0 - 100 pts)
  const attendanceVolumeScore = Math.round((attendanceDays / maxTeamAttendanceDays) * 25);
  let taskOutputScore = 0;
  if (totalAssigned > 0) {
    taskOutputScore = Math.round(((completedOnTime + completedTasks * 0.5) / totalAssigned) * 35);
  } else if (completedTasks > 0) {
    taskOutputScore = Math.min(35, completedTasks * 10);
  } else if (totalActiveHours > 0) {
    taskOutputScore = 10;
  }
  const utilizationScore = Math.round((utilizationPercent / 100) * 20);
  const professionalismScore = Math.round((professionalismPercent / 100) * 20);

  const performanceScore = Math.min(
    100,
    Math.max(0, attendanceVolumeScore + taskOutputScore + utilizationScore + professionalismScore)
  );

  const totalTaskSpentHours = Number((taskSessionSpentSeconds / 3600).toFixed(2));

  const metrics = {
    performanceScore,
    utilizationPercent,
    professionalismPercent,
    totalDutyHours,
    totalActiveHours,
    breakHours,
    idleHours,
    attendanceDays,
    lateArrivals,
    autoOffCount,
    lateManualDumpsCount,
    completedTasks,
    totalAssigned,
    completedOnTime,
    completedLate,
    totalEstimatedHours: Number(totalEstimatedHours.toFixed(2)),
    totalSpentHours: totalTaskSpentHours,
    distribution,
  };

  const html = buildPerformanceReportEmailHtml({
    user: targetUser,
    periodLabel,
    metrics,
  });

  const mailOptions = {
    from: `PMS Gatekod <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to: emailTo,
    subject: `📊 Your ${periodLabel} - ${targetUser.name}`,
    html,
  };

  await transporter.sendMail(mailOptions);

  return {
    success: true,
    user: targetUser.name,
    recipient: emailTo,
    periodLabel,
    performanceScore,
    metrics,
  };
}
