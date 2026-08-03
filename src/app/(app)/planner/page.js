import GlobalPlanner from "@/components/planner/GlobalPlanner";
import { getSession } from "@/lib/session-server";
import { prisma } from "@/lib/prisma";

export default async function PlannerPage() {
  const session = await getSession();
  const hasDatabase = Boolean(process.env.DATABASE_URL);
  
  const currentUser =
    hasDatabase && session?.email
      ? await prisma.user.findUnique({
          where: { email: session.email },
          select: { id: true, name: true, role: true },
        })
      : null;

  return (
    <GlobalPlanner
      role={session?.role}
      currentUser={currentUser}
    />
  );
}
