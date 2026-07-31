import { requireUser } from "@/lib/auth/authorization";
export default async function DashboardLayout({ children }) { await requireUser(); return children; }
