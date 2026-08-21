import { cookies } from "next/headers";
import { auth } from "../../auth";
import { verifySessionToken } from "@/lib/session";

export async function getSession() {
  const session = await auth();
  if (session?.user) return session.user;

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("pms-session")?.value;
    if (token) {
      const decoded = await verifySessionToken(token);
      if (decoded) return decoded;
    }
  } catch (err) {}

  return null;
}
