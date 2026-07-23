import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendInviteEmail } from "@/lib/email";
import {
  USER_CREATION_ROLES,
  buildError,
  buildSuccess,
  ensureAuthenticated,
  ensureRole,
  getAuthContext,
} from "@/lib/api";

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
  const userId = body?.userId;

  if (!userId) {
    return buildError("User ID is required.", 400);
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, isActive: true },
    });

    if (!user) {
      return buildError("User not found.", 404);
    }

    if (user.isActive) {
      return buildError("Cannot resend invitation to an active user.", 400);
    }

    const inviteToken = crypto.randomBytes(32).toString("hex");
    const inviteTokenExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const inviteUrl = `${base}/auth/set-password?token=${inviteToken}`;

    await prisma.user.update({
      where: { id: userId },
      data: { inviteToken, inviteTokenExpiresAt },
    });

    await sendInviteEmail({ to: user.email, name: user.name, inviteUrl });

    return buildSuccess("Invitation resent successfully.");
  } catch (error) {
    console.error("Reinvite error:", error);
    return buildError("Unable to resend invitation.", 500);
  }
}
