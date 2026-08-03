import crypto from "crypto";

export const INVITATION_TTL_MS = 48 * 60 * 60 * 1000;
export const INVITATION_TOKEN_PATTERN = /^[a-f0-9]{64}$/i;

export function generateInvitationToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function getInvitationExpiry(now = Date.now()) {
  return new Date(now + INVITATION_TTL_MS);
}

export function normalizeInvitationToken(value) {
  if (typeof value !== "string") return null;
  const token = value.trim();
  return INVITATION_TOKEN_PATTERN.test(token) ? token : null;
}

export function isInvitationExpired(expiresAt, now = Date.now()) {
  return !(expiresAt instanceof Date) || expiresAt.getTime() <= now;
}

export function invitationUrl(baseUrl, token) {
  return `${baseUrl}/auth/set-password?token=${encodeURIComponent(token)}`;
}
