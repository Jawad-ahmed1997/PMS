"use server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { newPasswordSchema } from "@/lib/auth/validation";
import { hashPassword } from "@/lib/auth/password";
import { sendPasswordChangedEmail } from "@/lib/auth/email";
import { recordSecurityEvent } from "@/lib/auth/audit";

export async function resetPasswordAction(_previous, formData) {
  const token = formData.get("token");
  const parsed = newPasswordSchema.safeParse({ password: formData.get("password"), confirmation: formData.get("confirmation") });
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/i.test(token) || !parsed.success) return { error: "The reset link is invalid or the passwords are not valid." };
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const reset = await prisma.passwordResetToken.findUnique({ where: { tokenHash }, include: { user: { select: { id: true, email: true, isActive: true, status: true } } } });
  if (!reset || reset.usedAt || reset.expiresAt <= new Date() || !reset.user.isActive || reset.user.status === "DISABLED") return { error: "The reset link is invalid or expired." };
  const passwordHash = await hashPassword(parsed.data.password);
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.passwordResetToken.updateMany({ where: { id: reset.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
    if (claimed.count !== 1) throw new Error("RESET_TOKEN_ALREADY_USED");
    await tx.user.update({ where: { id: reset.user.id }, data: { passwordHash, password: null, passwordChangedAt: new Date(), sessionVersion: { increment: 1 } } });
    await tx.passwordResetToken.deleteMany({ where: { userId: reset.user.id, id: { not: reset.id } } });
  });
  await sendPasswordChangedEmail(reset.user.email);
  await recordSecurityEvent("password_reset_completion", { userId: reset.user.id, email: reset.user.email });
  return { success: true };
}
