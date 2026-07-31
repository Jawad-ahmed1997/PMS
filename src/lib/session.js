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
