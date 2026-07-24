"use server";
import { signOut } from "../../../auth";
import { auth } from "../../../auth";
import { prisma } from "@/lib/prisma";

export async function logoutAction() {
  const session = await auth();
  try {
    if (session?.user?.id) {
      await prisma.user.updateMany({ where: { id: session.user.id }, data: { sessionVersion: { increment: 1 } } });
    }
  } catch (error) {
    console.error("Session revocation failed during logout.", error);
  } finally {
    // Cookie destruction must still happen if server-side revocation is unavailable.
    await signOut({ redirect: false });
  }
  return { ok: true };
}
