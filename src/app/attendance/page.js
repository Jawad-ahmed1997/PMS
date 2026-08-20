import AttendanceDashboard from "@/components/attendance/AttendanceDashboard";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session-server";
import { normalizeRole, PROJECT_MANAGEMENT_ROLES } from "@/lib/api";
import { getTodayInPSTDateString } from "@/lib/pstDate";

export default async function AttendancePage() {
  const session = await getSession();
  const hasDatabase = Boolean(process.env.DATABASE_URL);
  const role = normalizeRole(session?.role);
  const isLeader = PROJECT_MANAGEMENT_ROLES.includes(role);

  let currentUser = null;
  let users = [];
  const todayPST = getTodayInPSTDateString();

  if (hasDatabase && session?.email) {
    currentUser = await prisma.user.findUnique({
      where: { email: session.email },
      select: { id: true, name: true, email: true, role: true, timezone: true },
    });

    if (currentUser) {
      const userFilter = isLeader ? { isActive: true } : { id: currentUser.id, isActive: true };
      users = await prisma.user.findMany({
        where: userFilter,
        orderBy: { name: "asc" },
        select: { id: true, name: true, email: true, role: true },
      });
    }
  }

  return (
    <AttendanceDashboard
      initialAttendance={null}
      initialPresenceNow={null}
      users={users}
      currentUser={currentUser}
      isLeader={isLeader}
      initialRange={{
        preset: "today",
        from: todayPST,
        to: todayPST,
      }}
    />
  );
}
