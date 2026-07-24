import { NextResponse } from "next/server";
import { auth } from "../../auth";
import { prisma } from "@/lib/prisma";

export const ADMIN_ROLES = ["CEO", "PM", "CTO", "SENIOR_DEVELOPER"];
export const PROJECT_MANAGEMENT_ROLES = ["CEO", "PM", "CTO"];
export const WORK_ITEM_CREATION_ROLES = ["PM", "CTO"];
export const USER_CREATION_ROLES = ["CEO", "PM", "CTO"];
export const ALL_ROLES = [...ADMIN_ROLES, "DEVELOPER", "INTERN", "JUNIOR_INTERN"];

export function normalizeRole(role) {
  if (!role) {
    return null;
  }

  const cleaned = role
    .toString()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_")
    .toUpperCase();

  if (cleaned === "SENIOR_DEV") {
    return "SENIOR_DEVELOPER";
  }

  if (cleaned === "DEV") {
    return "DEVELOPER";
  }

  return cleaned;
}

export async function getAuthContext() {
  const session = await auth();

  if (!session) {
    return { session: null, user: null, role: null };
  }

  const role = normalizeRole(session.user.role);
  const user = session?.user?.id
    ? await prisma.user.findUnique({ where: { id: session.user.id } })
    : null;

  return { session: session?.user ? session : null, user, role };
}

export function buildError(message, status = 400, details = null) {
  return NextResponse.json(
    {
      ok: false,
      message,
      error: message,
      ...(details ? { details } : {}),
    },
    { status }
  );
}

export function buildSuccess(message, data = {}, status = 200) {
  return NextResponse.json(
    {
      ok: true,
      message,
      ...data,
    },
    { status }
  );
}

export function ensureAuthenticated(context) {
  if (!context.session || !context.user) {
    return buildError("Authentication required.", 401);
  }

  if (!context.user.isActive || context.user.status === "DISABLED") {
    return buildError("User account is inactive.", 403);
  }

  return null;
}

export function ensureRole(role, allowedRoles) {
  if (!role || !allowedRoles.includes(role)) {
    return buildError("You do not have permission to perform this action.", 403);
  }

  return null;
}

export function parseBoolean(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (value === "true" || value === true) {
    return true;
  }

  if (value === "false" || value === false) {
    return false;
  }

  return null;
}

export function isAdminRole(role) {
  return ADMIN_ROLES.includes(role);
}

export function isManagementRole(role) {
  return ["PM", "CTO"].includes(role);
}
