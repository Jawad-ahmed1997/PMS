import { NextResponse } from "next/server";
import { auth } from "../../auth";
import { prisma } from "@/lib/prisma";

export const ADMIN_ROLES = ["CEO", "PM", "CTO", "TEAM_LEAD", "SENIOR_DEVELOPER"];
export const PROJECT_MANAGEMENT_ROLES = ["CEO", "PM", "CTO", "TEAM_LEAD"];
export const WORK_ITEM_CREATION_ROLES = ["PM", "CTO", "TEAM_LEAD"];
export const USER_CREATION_ROLES = ["CEO", "PM", "CTO", "TEAM_LEAD"];
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

  if (cleaned === "TEAM_LEAD") {
    return "TEAM_LEAD";
  }

  return cleaned;
}

import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/session";

export async function getAuthContext() {
  let session = await auth();

  if (!session || !session.user) {
    try {
      const cookieStore = await cookies();
      const token = cookieStore.get("pms-session")?.value;
      if (token) {
        const decoded = await verifySessionToken(token);
        if (decoded) {
          session = { user: decoded };
        }
      }
    } catch (err) {
      // ignore
    }
  }

  if (!session || !session.user) {
    return { session: null, user: null, role: null, timezone: "Asia/Karachi" };
  }

  const role = normalizeRole(session.user.role);
  const user = session.user.id
    ? await prisma.user.findUnique({ where: { id: session.user.id } })
    : (session.user.email ? await prisma.user.findUnique({ where: { email: session.user.email } }) : null);

  const timezone = user?.timezone ?? session.user.timezone ?? "Asia/Karachi";

  return { session, user: user || session.user, role: role || normalizeRole(user?.role), timezone };
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
  return ["PM", "CTO", "TEAM_LEAD"].includes(role);
}
