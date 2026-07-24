export function getAuthBaseUrl() {
  const value = process.env.AUTH_URL || process.env.NEXTAUTH_URL;
  if (!value && process.env.NODE_ENV === "production") throw new Error("AUTH_URL must be configured in production.");
  return value || "http://localhost:3000";
}

export function assertAuthConfiguration() {
  if (process.env.NODE_ENV === "production" && !process.env.AUTH_SECRET) throw new Error("AUTH_SECRET must be configured in production.");
  return true;
}
