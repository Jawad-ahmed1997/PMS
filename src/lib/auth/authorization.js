import { redirect } from "next/navigation";
import { auth } from "../../../auth";
import { prisma } from "@/lib/prisma";

export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, name: true, email: true, role: true, image: true, isActive: true, status: true } });
}

export async function requireUser() {
  const user = await getCurrentUser();
  console.log("user:",user)
  if (!user || !user.isActive || user.status === "DISABLED") redirect("/login");
  return user;
}

export async function requireRole(allowedRoles) {
  const user = await requireUser();
  if (!allowedRoles.includes(user.role)) redirect("/dashboard");
  return user;
}
