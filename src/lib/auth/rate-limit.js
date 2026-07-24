import { prisma } from "@/lib/prisma";

const WINDOW_MS = 15 * 60 * 1000;

export async function consumeRateLimit(key, limit) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + WINDOW_MS);
  const bucket = await prisma.rateLimitBucket.findUnique({ where: { key } });
  if (!bucket || bucket.expiresAt <= now) {
    await prisma.rateLimitBucket.upsert({ where: { key }, update: { count: 1, expiresAt }, create: { key, count: 1, expiresAt } });
    return { allowed: true, retryAfter: Math.ceil(WINDOW_MS / 1000) };
  }
  if (bucket.count >= limit) return { allowed: false, retryAfter: Math.max(1, Math.ceil((bucket.expiresAt.getTime() - now.getTime()) / 1000)) };
  await prisma.rateLimitBucket.update({ where: { key }, data: { count: { increment: 1 } } });
  return { allowed: true, retryAfter: Math.ceil((bucket.expiresAt.getTime() - now.getTime()) / 1000) };
}

export function getClientIp(request) {
  const configured = process.env.TRUSTED_PROXY_IP_HEADER;
  if (configured) return request.headers.get(configured)?.split(",")[0]?.trim() || "unknown";
  return "unknown";
}
