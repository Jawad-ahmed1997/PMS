import PageHeader from "@/components/layout/PageHeader";
import AiManagerDashboard from "@/components/aiManager/AiManagerDashboard";
import { getSession } from "@/lib/session-server";
import { normalizeRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export const metadata = {
  title: "AI Manager | PMS Intelligence & Reporting Suite",
  description: "AI Engineering Manager for Developer Activity, Tasks, Attendance, & Quality Reporting",
};

export default async function AiManagerPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const role = normalizeRole(session?.role);
  const canViewAll = ["CEO", "PM", "CTO", "TEAM_LEAD", "SENIOR_DEVELOPER"].includes(role);

  // Fetch developers list
  const users = await prisma.user.findMany({
    where: canViewAll ? { status: { not: "DISABLED" } } : { id: session.id },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, role: true, image: true },
  });

  // Fetch all reports for the user/manager
  const initialReports = await prisma.aiDoctorReport.findMany({
    where: canViewAll ? {} : { userId: session.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      user: { select: { id: true, name: true, role: true, email: true, image: true } },
    },
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="PMS AI Manager"
        title="AI Engineering Management &amp; Reporting Suite"
        subtitle="Automated semantic analysis of developer tasks, attendance discipline, learning velocity, and quality audit."
      />
      <AiManagerDashboard
        session={session}
        initialUsers={users}
        initialReports={initialReports}
      />
    </div>
  );
}
