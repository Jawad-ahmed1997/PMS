export const roles = {
  CEO: "ceo",
  PM: "pm",
  CTO: "cto",
  TEAM_LEAD: "team-lead",
  SENIOR_DEV: "senior-developer",
  DEV: "developer",
  INTERN: "intern",
  JUNIOR_INTERN: "junior-intern",
};

export const roleOptions = [
  {
    id: roles.CEO,
    label: "CEO",
    description: "Executive dashboard visibility",
  },
  {
    id: roles.PM,
    label: "PM",
    description: "Delivery leadership and planning",
  },
  {
    id: roles.CTO,
    label: "CTO",
    description: "Technical portfolio oversight",
  },
  {
    id: roles.TEAM_LEAD,
    label: "Team Lead",
    description: "Technical leadership and team oversight",
  },
  {
    id: roles.SENIOR_DEV,
    label: "Senior Developer",
    description: "Lead implementation and review",
  },
  {
    id: roles.DEV,
    label: "Developer",
    description: "Execute and update tasks",
  },
  {
    id: roles.INTERN,
    label: "Intern",
    description: "Execute and update tasks",
  },
  {
    id: roles.JUNIOR_INTERN,
    label: "Junior Intern",
    description: "Execute and update tasks",
  },
];

export const routeAccess = {
  "/dashboard": [
    roles.CEO,
    roles.PM,
    roles.CTO,
    roles.TEAM_LEAD,
    roles.SENIOR_DEV,
    roles.DEV,
    roles.INTERN,
    roles.JUNIOR_INTERN,
  ],
  "/projects": [
    roles.CEO,
    roles.PM,
    roles.CTO,
    roles.TEAM_LEAD,
    roles.SENIOR_DEV,
    roles.DEV,
    roles.INTERN,
    roles.JUNIOR_INTERN,
  ],
  "/my-tasks": [
    roles.CEO,
    roles.PM,
    roles.CTO,
    roles.TEAM_LEAD,
    roles.SENIOR_DEV,
    roles.DEV,
    roles.INTERN,
    roles.JUNIOR_INTERN,
  ],
  "/my-desk": [
    roles.CEO,
    roles.PM,
    roles.CTO,
    roles.TEAM_LEAD,
    roles.SENIOR_DEV,
    roles.DEV,
    roles.INTERN,
    roles.JUNIOR_INTERN,
  ],
  "/activity": [
    roles.CEO,
    roles.PM,
    roles.CTO,
    roles.TEAM_LEAD,
    roles.SENIOR_DEV,
    roles.DEV,
    roles.INTERN,
    roles.JUNIOR_INTERN,
  ],
  "/attendance": [
    roles.CEO,
    roles.PM,
    roles.CTO,
    roles.TEAM_LEAD,
    roles.SENIOR_DEV,
    roles.DEV,
    roles.INTERN,
    roles.JUNIOR_INTERN,
  ],
  "/reports": [roles.CEO, roles.PM, roles.CTO, roles.TEAM_LEAD],
  "/ai-manager": [roles.CEO, roles.PM, roles.CTO, roles.TEAM_LEAD, roles.SENIOR_DEV],
  "/ai-doctor": [roles.CEO, roles.PM, roles.CTO, roles.TEAM_LEAD, roles.SENIOR_DEV],
  "/users": [roles.CEO, roles.PM, roles.CTO, roles.TEAM_LEAD],
};

export const taskPermissions = {
  [roles.CEO]: {
    canMoveTask: false,
    canMarkDone: false,
  },
  [roles.PM]: {
    canMoveTask: true,
    canMarkDone: true,
  },
  [roles.CTO]: {
    canMoveTask: true,
    canMarkDone: true,
  },
  [roles.TEAM_LEAD]: {
    canMoveTask: true,
    canMarkDone: true,
  },
  [roles.SENIOR_DEV]: {
    canMoveTask: true,
    canMarkDone: false,
  },
  [roles.DEV]: {
    canMoveTask: true,
    canMarkDone: false,
  },
  [roles.INTERN]: {
    canMoveTask: true,
    canMarkDone: false,
  },
  [roles.JUNIOR_INTERN]: {
    canMoveTask: true,
    canMarkDone: false,
  },
};

export const allRoles = roleOptions.map((role) => role.id);

export function normalizeRoleId(roleId) {
  if (!roleId) {
    return null;
  }

  const normalized = roleId
    .toString()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_")
    .toUpperCase();

  const mapping = {
    CEO: roles.CEO,
    PM: roles.PM,
    CTO: roles.CTO,
    TEAM_LEAD: roles.TEAM_LEAD,
    SENIOR_DEV: roles.SENIOR_DEV,
    SENIOR_DEVELOPER: roles.SENIOR_DEV,
    DEVELOPER: roles.DEV,
    DEV: roles.DEV,
    INTERN: roles.INTERN,
    JUNIOR_INTERN: roles.JUNIOR_INTERN,
  };

  return mapping[normalized] ?? null;
}

export function getRoleById(roleId) {
  const normalized = normalizeRoleId(roleId) ?? roleId;
  return roleOptions.find((role) => role.id === normalized) ?? null;
}

export function roleHasRouteAccess(roleId, pathname) {
  const normalized = normalizeRoleId(roleId);
  if (!normalized) {
    return false;
  }

  const matchingRoute = Object.keys(routeAccess).find((route) =>
    pathname === route || pathname.startsWith(`${route}/`)
  );

  if (!matchingRoute) {
    return true;
  }

  return routeAccess[matchingRoute].includes(normalized);
}

export function getDefaultRouteForRole(roleId) {
  const normalized = normalizeRoleId(roleId);
  const allowedRoutes = Object.entries(routeAccess)
    .filter(([, roles]) => roles.includes(normalized))
    .map(([route]) => route);

  return allowedRoutes[0] ?? "/dashboard";
}

export function canMoveTask(roleId) {
  const normalized = normalizeRoleId(roleId);
  return taskPermissions[normalized]?.canMoveTask ?? false;
}

export function canMarkTaskDone(roleId) {
  const normalized = normalizeRoleId(roleId);
  return taskPermissions[normalized]?.canMarkDone ?? false;
}

export function canCreateMilestones(roleId) {
  const normalized = normalizeRoleId(roleId);
  return [roles.PM, roles.CTO, roles.TEAM_LEAD].includes(normalized);
}

export function canCreateTasks(roleId) {
  const normalized = normalizeRoleId(roleId);
  return [roles.PM, roles.CTO, roles.TEAM_LEAD].includes(normalized);
}
