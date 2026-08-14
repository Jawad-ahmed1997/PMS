import { requireRole } from "@/lib/auth/authorization";
export default async function ReportsLayout({ children }) { await requireRole(["CEO", "PM", "CTO", "TEAM_LEAD"]); return children; }
