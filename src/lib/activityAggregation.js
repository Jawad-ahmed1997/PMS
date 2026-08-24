/**
 * Utility to aggregate activity logs:
 * 1. Consolidates multiple status transitions for the same task on the same day into a unified Journey Card.
 * 2. Consolidates multiple work intervals/sessions and breaks for the same task or manual log on the same day.
 */

export function aggregateActivityLogs(logs, userTimeZone = "Asia/Karachi") {
  if (!Array.isArray(logs) || logs.length === 0) {
    return [];
  }

  const result = [];
  const statusJourneys = new Map();
  const workGroups = new Map();

  for (const log of logs) {
    const logDate = new Date(log.date || log.startAt || log.createdAt);
    const dateKey = !Number.isNaN(logDate.getTime())
      ? logDate.toLocaleDateString("en-CA", { timeZone: userTimeZone })
      : "undated";

    const isStatusLog = Boolean(
      log.taskId &&
      (log.description?.startsWith("Task status updated by") ||
        log.description?.startsWith("Task created:") ||
        log.description?.includes("Auto moved to ON_HOLD"))
    );

    if (isStatusLog) {
      const journeyKey = `${dateKey}_${log.userId}_${log.taskId}`;
      if (!statusJourneys.has(journeyKey)) {
        statusJourneys.set(journeyKey, {
          id: `status-journey-${log.userId}-${log.taskId}-${dateKey}`,
          type: "TASK_STATUS_JOURNEY",
          userId: log.userId,
          user: log.user,
          taskId: log.taskId,
          task: log.task,
          date: log.date,
          latestDate: logDate,
          isStatusJourney: true,
          items: [],
        });
      }
      const journey = statusJourneys.get(journeyKey);
      journey.items.push({
        id: log.id,
        date: log.date,
        description: log.description,
      });
      if (new Date(log.date) > new Date(journey.date)) {
        journey.date = log.date;
        journey.latestDate = new Date(log.date);
      }
    } else if (log.startAt || log.endAt || log.type === "TASK" || log.durationSeconds > 0) {
      // Group multiple intervals of the same task or same manual log on the same day
      const isTask = Boolean(log.taskId);
      const groupIdentifier = isTask
        ? `task_${log.taskId}`
        : `manual_${(log.description || "").trim().toLowerCase()}_${(log.categories || []).join("_")}`;

      const workKey = `${dateKey}_${log.userId}_${groupIdentifier}`;

      if (!workGroups.has(workKey)) {
        workGroups.set(workKey, {
          id: log.id,
          type: log.type || (isTask ? "TASK" : "MANUAL"),
          userId: log.userId,
          user: log.user,
          taskId: log.taskId,
          task: log.task,
          description: log.description,
          categories: log.categories || [],
          date: log.date,
          startAt: log.startAt,
          endAt: log.endAt,
          durationSeconds: log.durationSeconds || 0,
          isPaused: log.isPaused,
          isVirtual: log.isVirtual,
          isGroupedSessions: false,
          sessions: [],
        });
      }

      const group = workGroups.get(workKey);
      group.sessions.push({
        id: log.id,
        startAt: log.startAt,
        endAt: log.endAt,
        durationSeconds: log.durationSeconds || 0,
        isPaused: log.isPaused,
        isVirtual: log.isVirtual,
      });

      if (group.sessions.length > 1) {
        group.isGroupedSessions = true;
        group.durationSeconds = group.sessions.reduce(
          (acc, s) => acc + (s.durationSeconds || 0),
          0
        );
        if (new Date(log.date) > new Date(group.date)) {
          group.date = log.date;
        }
        const runningSession = group.sessions.find((s) => s.endAt === null);
        if (runningSession) {
          group.endAt = null;
          group.startAt = runningSession.startAt;
          group.isPaused = runningSession.isPaused;
        }
      }
    } else {
      result.push(log);
    }
  }

  // Process all status journeys
  for (const journey of statusJourneys.values()) {
    journey.items.sort((a, b) => new Date(a.date) - new Date(b.date));

    const stages = [];
    const stageHistory = [];

    for (const item of journey.items) {
      const desc = item.description || "";
      const movedMatch = desc.match(/moved from ([A-Z_]+) to ([A-Z_]+)/i);
      const createdMatch = desc.match(/Task created:.*\(([A-Z_]+)\)/i);
      const autoHoldMatch = desc.includes("Auto moved to ON_HOLD");

      if (movedMatch) {
        const from = movedMatch[1].toUpperCase();
        const to = movedMatch[2].toUpperCase();
        if (stages.length === 0) stages.push(from);
        if (stages[stages.length - 1] !== to) stages.push(to);
        stageHistory.push({
          date: item.date,
          description: desc,
          from,
          to,
        });
      } else if (createdMatch) {
        const initial = createdMatch[1].toUpperCase();
        if (stages.length === 0) stages.push(initial);
        stageHistory.push({
          date: item.date,
          description: desc,
          to: initial,
        });
      } else if (autoHoldMatch) {
        if (stages[stages.length - 1] !== "ON_HOLD") stages.push("ON_HOLD");
        stageHistory.push({
          date: item.date,
          description: desc,
          to: "ON_HOLD",
        });
      } else {
        stageHistory.push({
          date: item.date,
          description: desc,
        });
      }
    }

    const taskTitle = journey.task?.title ?? "Task";
    const actorName = journey.user?.name ?? "User";

    journey.description = `Task status updated by ${actorName}: ${taskTitle}`;
    journey.stages = stages;
    journey.stageHistory = stageHistory;

    result.push(journey);
  }

  // Push work groups
  for (const group of workGroups.values()) {
    group.sessions.sort((a, b) => new Date(a.startAt || 0) - new Date(b.startAt || 0));
    result.push(group);
  }

  result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return result;
}
