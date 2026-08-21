import { prisma } from "@/lib/prisma";
import { getUserDailyTimeline } from "@/lib/analytics/timeline";

/**
 * Clean up raw task movement/system strings into clean human text
 */
function cleanActivityDescription(desc) {
  if (!desc) return "";
  return desc
    .replace(/Task status updated by [^:]+:\s*/gi, "")
    .replace(/moved from [A-Z_]+ to [A-Z_]+\.?/gi, "")
    .replace(/Task created:\s*/gi, "")
    .replace(/\([A-Z_]+\)\.?/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * AI Engineering Manager & Comprehensive Reporting Service.
 * Audits all developer tasks, attendance, activities, timer sessions, and checklists using Gemini AI.
 */
export async function runAiManagerDiagnosis({
  userId,
  targetDate = new Date(),
  period = "weekly",
  customStartDate = null,
  customEndDate = null,
}) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true },
  });

  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  const now = new Date(targetDate);
  let startDate;
  let endDate;

  if (period === "custom" && customStartDate && customEndDate) {
    startDate = new Date(customStartDate);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(customEndDate);
    endDate.setHours(23, 59, 59, 999);
  } else if (period === "daily") {
    startDate = new Date(now);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);
  } else if (period === "monthly") {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    endDate.setHours(23, 59, 59, 999);
  } else {
    // Weekly: Monday to Saturday
    const dayOfWeek = now.getDay();
    const distanceToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    startDate = new Date(now);
    startDate.setDate(now.getDate() + distanceToMonday);
    startDate.setHours(0, 0, 0, 0);

    endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 5);
    endDate.setHours(23, 59, 59, 999);
  }

  const dateFilter = { gte: startDate, lte: endDate };

  // 1. Gather all attendance, activity logs, and timer work sessions
  const [attendances, activityLogs, workSessions, ownedTasks, statusChanges] = await Promise.all([
    prisma.attendance.findMany({
      where: { userId, date: dateFilter },
      include: { breaks: true, wfhIntervals: true },
      orderBy: { date: "asc" },
    }),
    prisma.activityLog.findMany({
      where: { userId, date: dateFilter },
      include: { task: { select: { id: true, title: true, type: true, status: true } } },
      orderBy: { date: "asc" },
    }),
    prisma.taskWorkSession.findMany({
      where: { userId, startedAt: dateFilter },
      include: { task: { select: { id: true, title: true, type: true, status: true } } },
      orderBy: { startedAt: "asc" },
    }),
    prisma.task.findMany({
      where: {
        ownerId: userId,
        updatedAt: dateFilter,
      },
      select: {
        id: true,
        title: true,
        status: true,
        type: true,
        estimatedHours: true,
        reworkCount: true,
        totalTimeSpent: true,
        checklistItems: { select: { id: true, label: true, isCompleted: true } },
      },
    }),
    prisma.taskStatusHistory.findMany({
      where: {
        changedById: userId,
        changedAt: dateFilter,
      },
      include: {
        task: { select: { id: true, title: true } },
      },
      orderBy: { changedAt: "desc" },
    }),
  ]);

  // 2. Compute Timeline Totals
  const daysList = [];
  let curr = new Date(startDate);
  while (curr <= endDate && curr <= now) {
    daysList.push(new Date(curr));
    curr.setDate(curr.getDate() + 1);
  }

  let totalDutySeconds = 0;
  let totalWorkSeconds = 0;
  let totalBreakSeconds = 0;
  let totalIdleSeconds = 0;

  for (const day of daysList) {
    const dailyTimeline = await getUserDailyTimeline(prisma, userId, day, now);
    totalDutySeconds += dailyTimeline.totals?.dutySeconds ?? 0;
    totalWorkSeconds += dailyTimeline.totals?.workSeconds ?? 0;
    totalBreakSeconds += dailyTimeline.totals?.breakSeconds ?? 0;
    totalIdleSeconds += dailyTimeline.totals?.idleSeconds ?? 0;
  }

  const totalDutyHours = Number((totalDutySeconds / 3600).toFixed(2));
  const totalWorkHours = Number((totalWorkSeconds / 3600).toFixed(2));
  const totalBreakHours = Number((totalBreakSeconds / 3600).toFixed(2));
  const totalIdleHours = Number((totalIdleSeconds / 3600).toFixed(2));

  // 3. Detect Continuous Work Without Breaks (Rule: > 5h shift with 0 breaks is suspicious)
  const suspiciousZeroBreakDays = [];
  attendances.forEach((att) => {
    if (att.inTime && att.outTime) {
      const shiftSpanHours = (new Date(att.outTime) - new Date(att.inTime)) / 3600000;
      const breaksCount = att.breaks?.length || 0;
      if (shiftSpanHours >= 5.0 && breaksCount === 0) {
        suspiciousZeroBreakDays.push({
          date: att.date.toISOString().slice(0, 10),
          hours: Number(shiftSpanHours.toFixed(2)),
        });
      }
    }
  });

  // 4. Task & Checklist Metrics
  const completedTasks = ownedTasks.filter((t) => t.status === "DONE");
  const inProgressTasks = ownedTasks.filter((t) => t.status === "IN_PROGRESS" || t.status === "DEV_TEST");
  const blockedTasks = ownedTasks.filter((t) => t.status === "BLOCKED");
  const totalRework = ownedTasks.reduce((acc, t) => acc + (t.reworkCount || 0), 0);

  let totalChecklistItems = 0;
  let completedChecklistItems = 0;
  ownedTasks.forEach((t) => {
    (t.checklistItems || []).forEach((c) => {
      totalChecklistItems++;
      if (c.isCompleted) completedChecklistItems++;
    });
  });
  const checklistComplianceRate = totalChecklistItems > 0
    ? Math.round((completedChecklistItems / totalChecklistItems) * 100)
    : 100;

  // 5. Clean Summaries for AI Prompt
  const cleanLogsSet = new Set();
  const logEntriesSummary = activityLogs
    .map((log) => {
      const durHours = Number(((log.durationSeconds ?? 0) / 3600).toFixed(2));
      const cleanedDesc = cleanActivityDescription(log.description);
      if (!cleanedDesc || cleanLogsSet.has(cleanedDesc)) return null;
      cleanLogsSet.add(cleanedDesc);
      const taskTag = log.task ? `[Task: ${log.task.title}]` : "[Activity]";
      return `${taskTag} Category: ${log.categories?.join(", ") || log.type} (${durHours}h): "${cleanedDesc}"`;
    })
    .filter(Boolean)
    .slice(0, 15)
    .join("\n");

  const attendanceSummary = attendances.map((att, i) => {
    const dStr = att.date.toISOString().slice(0, 10);
    const inStr = att.inTime ? new Date(att.inTime).toLocaleTimeString("en-US", { timeZone: "Asia/Karachi", hour: "2-digit", minute: "2-digit" }) : "Missing";
    const outStr = att.outTime ? new Date(att.outTime).toLocaleTimeString("en-US", { timeZone: "Asia/Karachi", hour: "2-digit", minute: "2-digit" }) : "Running/Missing";
    const breaksTotal = att.breaks?.length || 0;
    return `[Day #${i + 1} (${dStr})] In: ${inStr} | Out: ${outStr} | Breaks: ${breaksTotal} ${breaksTotal === 0 ? "(NO BREAKS LOGGED)" : ""}`;
  }).join("\n");

  const tasksSummary = ownedTasks.map((t, i) => {
    const timeSpentHours = Number(((t.totalTimeSpent || 0) / 3600).toFixed(2));
    return `[Task #${i + 1}] "${t.title}" | Status: ${t.status} | Type: ${t.type} | Est: ${t.estimatedHours}h | Logged: ${timeSpentHours}h`;
  }).join("\n");

  // 6. Prompt for Gemini AI
  const prompt = `
You are the **Chief AI Engineering Manager & Executive Auditor** for GateKod Solutions.
Generate an **executive-level, highly readable, concise summary audit** of this developer.

### Developer Profile:
- Name: ${user.name}
- Role: ${user.role}
- Audit Period: ${period.toUpperCase()} (${startDate.toISOString().slice(0, 10)} to ${endDate.toISOString().slice(0, 10)})
- Total Shift Duty: ${totalDutyHours} hrs
- Productive Active Work: ${totalWorkHours} hrs
- Recorded Breaks (Namaz / Meals / Rest): ${totalBreakHours} hrs (Total breaks taken: ${attendances.reduce((acc, a) => acc + (a.breaks?.length || 0), 0)})
- Unaccounted Idle Gap: ${totalIdleHours} hrs
- Checklist Compliance: ${checklistComplianceRate}%
- Tasks: ${completedTasks.length} Completed, ${inProgressTasks.length} In-Progress, ${blockedTasks.length} Blocked, ${totalRework} Rework items
- Zero-Break Long Shift Flags: ${suspiciousZeroBreakDays.length > 0 ? `YES (Worked ${suspiciousZeroBreakDays.map((d) => `${d.hours}h continuous on ${d.date}`).join(", ")} without ANY breaks)` : "None"}

### Shift Attendance Records:
${attendanceSummary || "No attendance records found."}

### Tasks Worked On:
${tasksSummary || "No assigned tasks modified during this period."}

### Cleaned Activity & Learning Work Items:
${logEntriesSummary || "No distinct activity logs recorded."}

### CRITICAL AUDIT RULES:
1. **Break Discipline & Shift Pacing Rule**: Developers naturally require meal, prayer, or rest breaks during a full shift. If the developer worked >= 5 continuous hours with 0 breaks recorded anywhere in the shift, flag this anomaly: "UNREALISTIC_CONTINUOUS_SHIFT" (e.g., "Logged 5.88 continuous hours without recording any rest, meal, or prayer breaks. Sustained work over 5 hours without breaks suggests possible unattended running timers or untracked break intervals.").
2. **Executive Synthesis (Do NOT repeat raw logs)**: Write polished, human-readable prose. Never repeat raw log text or mechanical task status movements. Synthesize what the engineer built or learned into clear, professional summary points.
3. **Domain Evaluation**: Group accomplishments into 1 to 3 clean technical domains (e.g., "Flutter Mobile Application Architecture", "Backend API Pagination & Optimization") with a 1-sentence value assessment and 1-3 synthesized deliverable bullets.

### Required JSON Output Format (Strictly valid JSON with no markdown wrapping):
{
  "healthScore": 75, // Integer 0-100 evaluating task delivery velocity, discipline, and description quality
  "statusLabel": "GOOD", // "EXCELLENT", "GOOD", "FAIR", or "NEEDS_ATTENTION"
  "clinicalSummary": "Concise 2-3 sentence executive digest summarizing key accomplishments, technical focus, and overall shift discipline.",
  "learningTopics": [
    {
      "topic": "Domain Name (e.g. Flutter Mobile Architecture & REST API Pagination)",
      "estimatedHours": 4.5,
      "assessment": "Clean 1-2 sentence executive assessment of technical progress and contribution.",
      "evidenceDescriptions": ["Synthesized deliverable summary 1", "Synthesized deliverable summary 2"]
    }
  ],
  "anomaliesDetected": [
    {
      "type": "UNREALISTIC_CONTINUOUS_SHIFT" | "GENERIC_LOGS" | "UNACCOUNTED_IDLE" | "AUTO_OFF",
      "description": "Specific finding in clear managerial terms (e.g., Worked 5.88 continuous hours with zero breaks recorded throughout the shift)",
      "severity": "HIGH" | "MEDIUM" | "LOW",
      "prescription": "Actionable managerial recommendation"
    }
  ],
  "doctorPrescriptions": [
    "Manager Action Item 1: Clear recommendation for the developer or Team Lead",
    "Manager Action Item 2: Recommendation for next sprint"
  ]
}
`;

  let aiResult = null;
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    const modelsToTry = [
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-1.5-flash",
      "gemini-1.5-pro",
    ];
    for (const model of modelsToTry) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.2,
              },
            }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            aiResult = JSON.parse(rawText);
            break;
          }
        }
      } catch (err) {
        console.warn(`Gemini model ${model} failed:`, err.message);
      }
    }
  }

  // Fallback if AI call failed
  if (!aiResult) {
    const fallbackAnomalies = [];
    if (suspiciousZeroBreakDays.length > 0) {
      fallbackAnomalies.push({
        type: "UNREALISTIC_CONTINUOUS_SHIFT",
        description: `Developer logged ${suspiciousZeroBreakDays[0].hours} continuous hours without taking any meal, rest, or prayer breaks. A continuous stretch over 5 hours without breaks suggests possible unattended running timers or untracked intervals.`,
        severity: "HIGH",
        prescription: "Verify with the developer whether the timer was left running unattended, and encourage recording regular breaks during long shifts.",
      });
    }

    aiResult = {
      healthScore: suspiciousZeroBreakDays.length > 0 ? 70 : 80,
      statusLabel: suspiciousZeroBreakDays.length > 0 ? "FAIR" : "GOOD",
      clinicalSummary: `${user.name} completed ${totalWorkHours} active work hours across ${activityLogs.length} logged sessions during this ${period} period.`,
      learningTopics: [
        {
          topic: "Core Engineering & Development",
          estimatedHours: totalWorkHours,
          assessment: "Active development updates and feature delivery logged during the shift.",
          evidenceDescriptions: activityLogs
            .map((l) => cleanActivityDescription(l.description))
            .filter(Boolean)
            .slice(0, 3),
        },
      ],
      anomaliesDetected: fallbackAnomalies,
      doctorPrescriptions: [
        "Record meal, prayer, and rest breaks regularly during long shifts to reflect accurate work pacing.",
        "Maintain concise, clear activity descriptions for every completed work session.",
      ],
    };
  }

  // Ensure deterministic inclusion of Zero-Break anomaly if detected and not yet present
  if (suspiciousZeroBreakDays.length > 0 && !aiResult.anomaliesDetected?.some((a) => a.type?.includes("BREAK") || a.type?.includes("CONTINUOUS"))) {
    aiResult.anomaliesDetected.unshift({
      type: "UNREALISTIC_CONTINUOUS_SHIFT",
      description: `Logged a continuous ${suspiciousZeroBreakDays[0].hours}-hour shift without recording any meal, prayer, or rest breaks. Working continuously for over 5 hours suggests an unattended timer or unrecorded break time.`,
      severity: "HIGH",
      prescription: "Check with the developer if timer was running during unrecorded break intervals, and ensure shift breaks are logged diligently.",
    });
  }

  // Clean evidence descriptions in learning topics
  if (Array.isArray(aiResult.learningTopics)) {
    aiResult.learningTopics.forEach((t) => {
      if (Array.isArray(t.evidenceDescriptions)) {
        t.evidenceDescriptions = t.evidenceDescriptions
          .map((d) => cleanActivityDescription(d))
          .filter((d) => d && d.length > 2);
      }
    });
  }

  // Save report to database
  const savedReport = await prisma.aiDoctorReport.create({
    data: {
      userId: user.id,
      type: period.toUpperCase(),
      date: startDate,
      healthScore: aiResult.healthScore || 75,
      statusLabel: aiResult.statusLabel || "GOOD",
      clinicalSummary: aiResult.clinicalSummary || "",
      learningTopics: aiResult.learningTopics || [],
      anomaliesDetected: aiResult.anomaliesDetected || [],
      doctorPrescriptions: aiResult.doctorPrescriptions || [],
      vitals: {
        totalDutyHours,
        totalWorkHours,
        totalBreakHours,
        totalIdleHours,
        attendanceDays: attendances.length,
        tasksCompletedCount: completedTasks.length,
        checklistComplianceRate,
        suspiciousZeroBreakShift: suspiciousZeroBreakDays.length > 0,
      },
    },
    include: {
      user: { select: { id: true, name: true, role: true, email: true, image: true } },
    },
  });

  return savedReport;
}
