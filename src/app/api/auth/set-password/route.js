import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { isInvitationExpired, normalizeInvitationToken } from "@/lib/invitation";

export async function POST(request) {
  try {
    const body = await request.json();
    const token = normalizeInvitationToken(body?.token);
    const password = body?.password;

    if (!token || !password) {
      return NextResponse.json(
        { code: "INVALID", error: "Token and password are required." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findFirst({
      where: { inviteToken: token },
      select: { id: true, isActive: true, status: true, inviteTokenExpiresAt: true },
    });

    if (!user) {
      return NextResponse.json(
        { code: "INVALID", error: "This invitation link is invalid." },
        { status: 400 }
      );
    }

    if (user.isActive || user.status === "DISABLED") {
      return NextResponse.json(
        { code: "UNAVAILABLE", error: "This invitation has already been used or revoked." },
        { status: 409 }
      );
    }

    const now = new Date();
    if (isInvitationExpired(user.inviteTokenExpiresAt, now.getTime())) {
      return NextResponse.json(
        { code: "EXPIRED", error: "Invitation link has expired. Please ask your admin to resend the invitation." },
        { status: 410 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const claimed = await prisma.user.updateMany({
      where: {
        id: user.id,
        inviteToken: token,
        isActive: false,
        status: { not: "DISABLED" },
        inviteTokenExpiresAt: { gt: now },
      },
      data: { password: hashedPassword, isActive: true, inviteToken: null, inviteTokenExpiresAt: null },
    });

    if (claimed.count !== 1) {
      return NextResponse.json(
        { code: "UNAVAILABLE", error: "This invitation has already been used or revoked." },
        { status: 409 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Password set successfully. You can now sign in.",
    });
  } catch (error) {
    console.error("Set password error:", error);
    return NextResponse.json(
      { error: "Unable to set password. Please try again." },
      { status: 500 }
    );
  }
}
