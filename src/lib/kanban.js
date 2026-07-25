export const TASK_STATUSES = [
  { id: "BACKLOG", label: "BACKLOG" },
  { id: "READY", label: "READY" },
  { id: "IN_PROGRESS", label: "IN_PROGRESS" },
  { id: "ON_HOLD", label: "ON_HOLD" },
  { id: "DEV_TEST", label: "DEV_TEST" },
  { id: "TESTING", label: "TESTING" },
  { id: "DONE", label: "DONE" },
  { id: "REJECTED", label: "REJECTED" },
  { id: "BLOCKED", label: "BLOCKED" },
];

// ─── Role constants (keep in sync with src/lib/api.js) ───────────────────────
const MANAGER_ROLES = ["PM", "CTO", "TEAM_LEAD"];

// ─── Developer-only transitions ───────────────────────────────────────────────
// These represent a developer actively executing their task.
// PM / CTO / Team Lead cannot drag tasks through these stages —
// only the assigned developer can.
export const DEVELOPER_ONLY_TRANSITIONS = [
  { from: "READY",       to: "IN_PROGRESS" },
  { from: "IN_PROGRESS", to: "DEV_TEST"    },
  { from: "DEV_TEST",    to: "TESTING"     },
  { from: "REJECTED",    to: "IN_PROGRESS" },
];

export function isDeveloperOnlyTransition(from, to) {
  return DEVELOPER_ONLY_TRANSITIONS.some((t) => t.from === from && t.to === to);
}

// ─── Management-only transitions ─────────────────────────────────────────────
// These are grooming/approval actions that only PM / CTO / Team Lead can do.
// The assigned developer cannot move tasks through these stages.
export const MANAGEMENT_ONLY_TRANSITIONS = [
  { from: "BACKLOG", to: "READY" },
];

export function isManagementOnlyTransition(from, to) {
  return MANAGEMENT_ONLY_TRANSITIONS.some((t) => t.from === from && t.to === to);
}

export const TASK_TRANSITIONS = {
  BACKLOG:     ["READY", "BLOCKED"],
  READY:       ["IN_PROGRESS", "ON_HOLD", "BLOCKED"],
  IN_PROGRESS: ["DEV_TEST", "ON_HOLD", "BLOCKED"],
  ON_HOLD:     ["READY", "IN_PROGRESS", "BLOCKED"],
  DEV_TEST:    ["TESTING", "ON_HOLD", "BLOCKED"],
  TESTING:     ["DONE", "REJECTED", "ON_HOLD", "BLOCKED"],
  REJECTED:    ["READY", "IN_PROGRESS", "ON_HOLD", "BLOCKED"],
  BLOCKED:     ["READY", "IN_PROGRESS", "ON_HOLD"],
  DONE:        [],
};

export function getStatusLabel(status) {
  return TASK_STATUSES.find((item) => item.id === status)?.label ?? status;
}

export function getNextStatuses(status) {
  return TASK_TRANSITIONS[status] ?? [];
}

export function isValidTransition(fromStatus, toStatus) {
  return getNextStatuses(fromStatus).includes(toStatus);
}

/**
 * Checks whether a role/owner combination is allowed to make a status transition.
 *
 * Business rules:
 *  - Assignee (task owner) can move their task through ANY valid transition
 *    including all developer-only stages.
 *  - PM / CTO / Team Lead can:
 *      • Move BACKLOG → READY  (grooming/prioritisation)
 *      • Move TESTING → DONE   (approve)
 *      • Move TESTING → REJECTED (reject)
 *      • Move to ON_HOLD / BLOCKED on any task they manage
 *    They CANNOT execute developer-only transitions (READY→IN_PROGRESS,
 *    IN_PROGRESS→DEV_TEST, DEV_TEST→TESTING) unless they are also the assignee.
 */
export function canTransition({ from, to, role, isOwner }) {
  if (!from || !to) {
    return { ok: false, message: "Status transition is required." };
  }

  if (from === to) {
    return { ok: true };
  }

  if (!isValidTransition(from, to)) {
    return {
      ok: false,
      message: `Invalid transition from ${getStatusLabel(from)} to ${getStatusLabel(to)}.`,
    };
  }

  const isManager = MANAGER_ROLES.includes(role);

  // Only PM / CTO / Team Lead can approve to Done or Rejected
  if (["DONE", "REJECTED"].includes(to) && !isManager) {
    return {
      ok: false,
      message: "Only PMs, CTOs, or Team Leads can move tasks to Done or Rejected.",
    };
  }

  // Management-only transitions (e.g. BACKLOG → READY = grooming)
  // Assignees cannot self-promote tasks out of the backlog.
  if (isManagementOnlyTransition(from, to) && !isManager) {
    return {
      ok: false,
      message: "Only PMs, CTOs, or Team Leads can move tasks from Backlog to Ready.",
    };
  }

  // Developer-only transitions: manager roles cannot do these unless also the assignee
  if (isManager && isDeveloperOnlyTransition(from, to) && !isOwner) {
    return {
      ok: false,
      message: "Only the assigned developer can move their task through this stage.",
    };
  }

  // Non-managers can only move their own tasks
  if (!isManager && !isOwner) {
    return {
      ok: false,
      message: "You can only move tasks assigned to you.",
    };
  }

  return { ok: true };
}
