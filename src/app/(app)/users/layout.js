import { requireRole } from "@/lib/auth/authorization";
export default async function UsersLayout({ children }) { await requireRole(["CEO", "PM", "CTO"]); return children; }
