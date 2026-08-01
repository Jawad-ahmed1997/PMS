import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { valid: false, error: "Invitation token is required." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findFirst({
      where: { inviteToken: token },
      select: { id: true, inviteTokenExpiresAt: true },
    });

    if (!user) {
      return NextResponse.json(
        { valid: false, error: "Invalid or expired invitation link." },
        { status: 400 }
      );
    }

    if (user.inviteTokenExpiresAt && new Date() > user.inviteTokenExpiresAt) {
      return NextResponse.json(
        { valid: false, error: "Invitation link has expired. Please ask your admin to resend the invitation." },
        { status: 400 }
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
