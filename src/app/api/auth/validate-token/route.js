import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isInvitationExpired, normalizeInvitationToken } from "@/lib/invitation";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const token = normalizeInvitationToken(url.searchParams.get("token"));

    if (!token) {
      return NextResponse.json(
        { valid: false, error: "Invitation token is required." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findFirst({
      where: { inviteToken: token },
      select: { id: true, isActive: true, status: true, inviteTokenExpiresAt: true },
    });

    if (!user) {
      return NextResponse.json(
        { valid: false, code: "INVALID", error: "This invitation link is invalid." },
        { status: 400 }
      );
    }

    if (user.isActive || user.status === "DISABLED") {
      return NextResponse.json(
        { valid: false, code: "UNAVAILABLE", error: "This invitation has already been used or revoked." },
        { status: 409 }
      );
    }

    if (isInvitationExpired(user.inviteTokenExpiresAt)) {
      return NextResponse.json(
        { valid: false, code: "EXPIRED", error: "Invitation link has expired. Please ask your admin to resend the invitation." },
        { status: 410 }
      );
    }

    return NextResponse.json({
      valid: true,
      message: "Token is valid.",
    });
  } catch (error) {
    console.error("Token validation error:", error);
    return NextResponse.json(
      { valid: false, error: "Unable to validate token." },
      { status: 500 }
    );
  }
}
