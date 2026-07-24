import { auth } from "../../auth";

export async function getSession() {
  const session = await auth();
  return session?.user ? session.user : null;
}

export async function getSessionFromRequest(request) {
  const session = await auth(request);
  return session?.user ? session.user : null;
}
