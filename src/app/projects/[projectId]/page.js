import ProjectDetailView from "@/components/projects/ProjectDetailView";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canCreateMilestones, normalizeRoleId } from "@/lib/roles";

export default async function ProjectDetailPage({ params }) {
  const { projectId } = await params;
  const session = await getSession();
  const roleId = normalizeRoleId(session?.role);
  const canManageMilestones = canCreateMilestones(roleId);

  const hasDatabase = Boolean(process.env.DATABASE_URL);
  const currentUser =
    hasDatabase && session?.email
      ? await prisma.user.findUnique({
          where: { email: session.email },
          select: { id: true },
        })
      : null;

  return (
    <ProjectDetailView
      projectId={projectId}
      canManageMilestones={canManageMilestones}
      role={session?.role}
      currentUserId={currentUser?.id ?? null}
    />
  );
}
