import MyDeskView from "@/components/my-desk/MyDeskView";
import { getSession } from "@/lib/session-server";
import { prisma } from "@/lib/prisma";

export default async function MyDeskPage() {
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
    <MyDeskView
      role={session?.role}
      currentUserId={currentUser?.id ?? null}
    />
  );
}
