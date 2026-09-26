import { cookies } from "next/headers";
import { auth } from "../../auth";
import { verifySessionToken } from "@/lib/session";

export async function getSession() {
  try {
    const session = await auth();
    if (session?.user) return session.user;
  } catch (err) {
    // Stale or corrupted JWT session token in cookies
  }

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
