import MyTasksView from "@/components/my-tasks/MyTasksView";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export default async function MyTasksPage() {
  const session = await getSession();
  const hasDatabase = Boolean(process.env.DATABASE_URL);
  const currentUser =
    hasDatabase && session?.email
      ? await prisma.user.findUnique({
          where: { email: session.email },
          select: { id: true },
        })
      : null;

  return (
    <MyTasksView
      role={session?.role}
      currentUserId={currentUser?.id ?? null}
    />
  );
}
