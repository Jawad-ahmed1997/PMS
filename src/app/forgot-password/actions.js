"use server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { emailSchema } from "@/lib/auth/validation";
import { consumeRateLimit } from "@/lib/auth/rate-limit";
import { recordSecurityEvent } from "@/lib/auth/audit";
import { sendPasswordResetEmail } from "@/lib/auth/email";
import { headers } from "next/headers";

export async function forgotPasswordAction(_previous, formData) {
  const parsed = emailSchema.safeParse(formData.get("email"));
  const email = parsed.success ? parsed.data : "";
  const requestHeaders = await headers();
  const configuredIpHeader = process.env.TRUSTED_PROXY_IP_HEADER;
  const ip = configuredIpHeader ? requestHeaders.get(configuredIpHeader)?.split(",")[0]?.trim() || "unknown" : "unknown";
  if (email) await consumeRateLimit(`reset:email:${email}`, 5);
  await consumeRateLimit(`reset:ip:${ip}`, 15);
  if (email) {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, isActive: true, status: true, passwordHash: true, password: true } });
    if (user?.isActive && user.status !== "DISABLED" && (user.passwordHash || user.password)) {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
      await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
      await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 45 * 60 * 1000) } });
      await sendPasswordResetEmail(user.email, rawToken);
      await recordSecurityEvent("password_reset_request", { userId: user.id, email });
    }
  }
  return { submitted: true, message: "If an account matches that email, a reset link has been sent." };
}
