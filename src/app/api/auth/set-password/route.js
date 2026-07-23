import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(request) {
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token and password are required." },
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
      select: { id: true, inviteTokenExpiresAt: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid or expired invitation link." },
        { status: 400 }
      );
    }

    if (user.inviteTokenExpiresAt && new Date() > user.inviteTokenExpiresAt) {
      return NextResponse.json(
        { error: "Invitation link has expired. Please ask your admin to resend the invitation." },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        isActive: true,
        inviteToken: null,
        inviteTokenExpiresAt: null,
      },
    });

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
