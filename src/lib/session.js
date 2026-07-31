import NextAuth from "next-auth";
import authConfig from "../../auth.config";

const { auth: edgeAuth } = NextAuth(authConfig);

export async function getSession() {
  const session = await edgeAuth();
  return session?.user ? session.user : null;
}

export async function getSessionFromRequest(request) {
  const session = await edgeAuth(request);
  return session?.user ? session.user : null;
}

export async function buildSessionCookie(token) {
  return {
    name: "session",
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    path: "/",
  };
}

export async function createSessionToken(user) {
  const token = await edgeAuth.createToken(user);
  return token;
}