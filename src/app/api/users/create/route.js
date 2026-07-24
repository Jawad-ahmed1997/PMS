import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword, isPasswordInput } from "@/lib/auth/password";
import { sendInviteEmail } from "@/lib/email";
import {
  ALL_ROLES,
  USER_CREATION_ROLES,
  buildError,
  buildSuccess,
  ensureAuthenticated,
  ensureRole,
  getAuthContext,
  normalizeRole,
} from "@/lib/api";

function generateInviteToken() {
  return crypto.randomBytes(32).toString("hex");
}

function getInviteExpiry() {
  return new Date(Date.now() + 48 * 60 * 60 * 1000);
}

function buildInviteUrl(token) {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${base}/auth/set-password?token=${token}`;
}

export async function POST(request) {
  const context = await getAuthContext();
  const authError = ensureAuthenticated(context);
  if (authError) {
    return authError;
  }

  const roleError = ensureRole(context.role, USER_CREATION_ROLES);
  if (roleError) {
    return roleError;
  }

  const body = await request.json();
  const name = body?.name?.trim();
  const email = body?.email?.trim().toLowerCase();
  const role = normalizeRole(body?.role);

  if (!name || !email || !role) {
    return buildError("Name, email, and role are required.", 400);
  }

  if (!ALL_ROLES.includes(role)) {
    return buildError("Role is invalid.", 400);
  }

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, isActive: true },
    });

    if (existingUser && existingUser.isActive) {
      return buildError("A user with this email already exists and is active.", 409);
    }

    const inviteToken = generateInviteToken();
    const inviteTokenExpiresAt = getInviteExpiry();
    const inviteUrl = buildInviteUrl(inviteToken);

    let user;

    if (existingUser) {
      // Re-invite: update the existing inactive user
      user = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          name,
          role,
          inviteToken,
          inviteTokenExpiresAt,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } else {
      user = await prisma.user.create({
        data: {
          name,
          email,
          password: null,
          role,
          isActive: false,
          inviteToken,
          inviteTokenExpiresAt,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    }

    await sendInviteEmail({ to: email, name, inviteUrl });

    return buildSuccess("Invitation sent.", { user }, 201);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return buildError("A user with this email already exists.", 409);
      }
    }

    console.error("Invite error:", error);
    return buildError("Unable to send invitation.", 500);
  }
}
