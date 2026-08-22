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
 * Audits developer tasks, attendance, break discipline, timer sessions, and checklists using Gemini AI.
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

  // 3. Operational Discipline Analysis (Breaks, Auto-Off, Continuous Shifts)
  let totalBreaksCount = 0;
  let autoOffCount = 0;
  const suspiciousZeroBreakDays = [];
  const breakDeficitDays = [];

  attendances.forEach((att) => {
    const bCount = att.breaks?.length || 0;
    totalBreaksCount += bCount;

    if (att.autoOff) {
      autoOffCount++;
    }

    if (att.inTime && att.outTime) {
      const shiftSpanHours = (new Date(att.outTime) - new Date(att.inTime)) / 3600000;
      if (shiftSpanHours >= 5.0 && bCount === 0) {
        suspiciousZeroBreakDays.push({
          date: att.date.toISOString().slice(0, 10),
          hours: Number(shiftSpanHours.toFixed(2)),
        });
      }
      // Standard 3-break expectation for any shift >= 6 hours
      if (shiftSpanHours >= 6.0 && bCount < 3) {
        breakDeficitDays.push({
          date: att.date.toISOString().slice(0, 10),
          hours: Number(shiftSpanHours.toFixed(2)),
          breaksCount: bCount,
        });
      }
    }
  });

  const totalShifts = attendances.length;
  const expectedBreaks = totalShifts * 3;

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
    .slice(0, 20)
    .join("\n");

  const attendanceSummary = attendances.map((att, i) => {
    const dStr = att.date.toISOString().slice(0, 10);
    const inStr = att.inTime ? new Date(att.inTime).toLocaleTimeString("en-US", { timeZone: "Asia/Karachi", hour: "2-digit", minute: "2-digit" }) : "Missing";
    const outStr = att.outTime ? new Date(att.outTime).toLocaleTimeString("en-US", { timeZone: "Asia/Karachi", hour: "2-digit", minute: "2-digit" }) : "Running/Missing";
    const breaksTotal = att.breaks?.length || 0;
    const autoOffTag = att.autoOff ? `[AUTO_OFF: ${att.autoOffReason || "10H"}]` : "[MANUAL_CHECKOUT]";
    return `[Day #${i + 1} (${dStr})] In: ${inStr} | Out: ${outStr} | Breaks Logged: ${breaksTotal} (Standard: 3) | ${autoOffTag}`;
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
- Total Shift Duty: ${totalDutyHours} hrs across ${totalShifts} shift(s)
- Productive Active Work: ${totalWorkHours} hrs
- Recorded Breaks: ${totalBreakHours} hrs (Total breaks logged: ${totalBreaksCount} vs Expected standard of ${expectedBreaks} [~3 breaks/shift for Namaz, Meals, Tea])
- Unaccounted Idle Gap: ${totalIdleHours} hrs
- System Auto-Off Checkouts: ${autoOffCount} out of ${totalShifts} shift(s)
- Checklist Compliance: ${checklistComplianceRate}%
- Tasks: ${completedTasks.length} Completed, ${inProgressTasks.length} In-Progress, ${blockedTasks.length} Blocked, ${totalRework} Rework items
- Zero-Break Shifts: ${suspiciousZeroBreakDays.length > 0 ? `YES (${suspiciousZeroBreakDays.map((d) => `${d.hours}h continuous on ${d.date}`).join(", ")})` : "None"}

### Shift Attendance Records:
${attendanceSummary || "No attendance records found."}

### Tasks Worked On:
${tasksSummary || "No assigned tasks modified during this period."}

### Raw Activity Notes:
${logEntriesSummary || "No distinct activity logs recorded."}

### CRITICAL AUDIT & SYNTHESIS RULES:
1. **STRICT SYNTHESIS (NEVER COPY-PASTE RAW LOGS)**: 
   - Never output verbatim activity descriptions, raw markdown bullets, or API route paths.
   - Synthesize what the engineer actually accomplished or learned into concise, professional business-level technical bullet points (1-2 sentences each).
2. **BREAK DISCIPLINE (3-Break Daily Rule)**:
   - Modern shift standard requires ~3 breaks per full shift (Namaz, Meals/Dinner, Refreshments).
   - If the developer logged fewer than 3 breaks, flag this anomaly (e.g. \`BREAK_DEFICIT\` or \`BREAK_ABSENCE_HABIT\`), noting whether breaks were missed or not logged properly.
3. **SHIFT CHECKOUT DISCIPLINE (Auto-Off Rule)**:
   - If multiple shifts were terminated by \`AUTO_OFF_10H\`, flag persistent unclosed shift habit.
4. **DOMAIN CLUSTERING**:
   - Cluster work into 1 to 3 distinct technical knowledge/feature domains with estimated hours, a 1-sentence value assessment, and synthesized deliverables.
5. **DYNAMIC, CONTEXTUAL MANAGER COACHING**:
   - Provide 2-3 high-impact, actionable managerial recommendations specific to this developer's actual tasks, pacing, and time-tracking hygiene.

### Required JSON Output Format (Strictly valid JSON with no markdown wrapping):
{
  "healthScore": 75, // Integer 0-100 evaluating task delivery velocity, discipline, and description quality
  "statusLabel": "GOOD", // "EXCELLENT", "GOOD", "FAIR", or "NEEDS_ATTENTION"
  "clinicalSummary": "Concise 2-3 sentence executive digest summarizing key accomplishments, technical focus, and overall shift discipline.",
  "learningTopics": [
    {
      "topic": "Domain Name (e.g. Mobile Architecture & Checkout Flow Refactoring)",
      "estimatedHours": 4.5,
      "assessment": "Clean 1-2 sentence executive assessment of technical progress and contribution.",
      "evidenceDescriptions": ["Synthesized deliverable summary 1", "Synthesized deliverable summary 2"]
    }
  ],
  "anomaliesDetected": [
    {
      "type": "BREAK_DEFICIT" | "PERSISTENT_AUTO_OFF" | "UNACCOUNTED_IDLE" | "GENERIC_LOGS",
      "description": "Specific finding in clear managerial terms (e.g. Logged only 1 break across 10h shift; standard protocol expects ~3 intervals for Namaz, meals, and rest)",
      "severity": "HIGH" | "MEDIUM" | "LOW",
      "prescription": "Actionable managerial recommendation"
    }
  ],
  "doctorPrescriptions": [
    "Manager Action Item 1: Specific recommendation for the developer or Team Lead",
    "Manager Action Item 2: Recommendation for next sprint"
  ]
}
`;

  let aiResult = null;
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    // Models tested and verified active on Gemini v1beta
    const modelsToTry = [
      "gemini-3.6-flash",
      "gemini-3.7-flash",
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
        } else {
          const errData = await response.json().catch(() => ({}));
          console.warn(`[AI Manager] Gemini model ${model} returned ${response.status}:`, errData?.error?.message);
        }
      } catch (err) {
        console.warn(`[AI Manager] Gemini model ${model} failed:`, err.message);
      }
    }
  }

  // 7. Intelligent Synthesizer Fallback (Runs if offline or AI call fails)
  if (!aiResult) {
    const fallbackAnomalies = [];

    // Break Deficit Anomaly
    if (breakDeficitDays.length > 0 || (totalShifts > 0 && totalBreaksCount < expectedBreaks)) {
      fallbackAnomalies.push({
        type: "BREAK_DEFICIT",
        description: `Logged only ${totalBreaksCount} break(s) across ${totalShifts} shift(s) (expected ~${expectedBreaks} breaks for Namaz, meals, and rest intervals).`,
        severity: totalBreaksCount === 0 ? "HIGH" : "MEDIUM",
        prescription: "Ensure standard 3-break daily logging (Namaz, lunch/dinner, refreshments) is followed for accurate shift pacing.",
      });
    }

    // Auto-Off Anomaly
    if (autoOffCount > 0) {
      fallbackAnomalies.push({
        type: "PERSISTENT_AUTO_OFF",
        description: `${autoOffCount} of ${totalShifts} shift(s) were terminated by system AUTO_OFF_10H due to missed manual checkouts.`,
        severity: autoOffCount >= totalShifts / 2 ? "HIGH" : "MEDIUM",
        prescription: "Encourage the developer to manually check out at the end of each work shift.",
      });
    }

    // High Idle Gap
    if (totalIdleHours > totalWorkHours && totalDutyHours > 4) {
      fallbackAnomalies.push({
        type: "UNACCOUNTED_IDLE",
        description: `Logged ${totalIdleHours} hours of unrecorded idle time during a ${totalDutyHours}-hour duty span.`,
        severity: "HIGH",
        prescription: "Align task timers with ongoing work to ensure all development activities are properly recorded.",
      });
    }

    // Synthesize tasks and activity categories
    const categoryMap = {};
    activityLogs.forEach((log) => {
      const cat = log.categories?.[0] || (log.task ? "Task Development" : "General Engineering");
      if (!categoryMap[cat]) categoryMap[cat] = { hours: 0, items: new Set() };
      categoryMap[cat].hours += Number(((log.durationSeconds || 0) / 3600).toFixed(2));
      const cleaned = cleanActivityDescription(log.description);
      if (cleaned && cleaned.length > 5) {
        categoryMap[cat].items.add(cleaned);
      }
    });

    const fallbackTopics = Object.entries(categoryMap).slice(0, 3).map(([cat, data]) => ({
      topic: cat === "LEARNING" ? "Technical Research & Learning" : cat === "OTHER" ? "Core Feature Engineering & Maintenance" : cat,
      estimatedHours: Number(data.hours.toFixed(1)),
      assessment: `Active engineering and research contributions logged in ${cat.toLowerCase()} focus area.`,
      evidenceDescriptions: Array.from(data.items).slice(0, 3).map((item) => {
        return item.length > 120 ? `${item.slice(0, 117)}...` : item;
      }),
    }));

    if (fallbackTopics.length === 0) {
      fallbackTopics.push({
        topic: "Core Engineering & Development",
        estimatedHours: totalWorkHours,
        assessment: "Active development updates and feature delivery logged during the shift.",
        evidenceDescriptions: ["Completed assigned project work and operational activities."],
      });
    }

    const calculatedScore = Math.max(45, Math.min(95, Math.round(
      (totalWorkHours > 0 ? 50 : 20) +
      (checklistComplianceRate * 0.2) -
      (autoOffCount * 5) -
      (fallbackAnomalies.length * 8)
    )));

    aiResult = {
      healthScore: calculatedScore,
      statusLabel: calculatedScore >= 80 ? "EXCELLENT" : calculatedScore >= 65 ? "GOOD" : "NEEDS_ATTENTION",
      clinicalSummary: `${user.name} completed ${totalWorkHours} active productive hours across ${activityLogs.length} logged sessions during this ${period} period, with ${totalBreakHours} hours of recorded breaks and ${totalIdleHours} hours of idle shift time.`,
      learningTopics: fallbackTopics,
      anomaliesDetected: fallbackAnomalies,
      doctorPrescriptions: [
        totalBreaksCount < expectedBreaks
          ? "Establish the standard 3-break daily logging routine (Namaz, meals, and rest) during long shifts."
          : "Maintain regular shift break logging across all work days.",
        autoOffCount > 0
          ? "Ensure manual shift checkout is performed at the end of duty to eliminate Auto-Off triggers."
          : "Continue maintaining accurate shift check-in and check-out times.",
      ],
    };
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
