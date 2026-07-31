import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

const digest = (value) => value ? crypto.createHash("sha256").update(value).digest("hex") : null;

export async function recordSecurityEvent(event, { userId, email, ip } = {}) {
  try {
    await prisma.securityAuditEvent.create({ data: { event, userId, emailHash: digest(email), ipHash: digest(ip) } });
  } catch {
    // Audit logging must never turn a successful auth operation into a failure.
  }
}
