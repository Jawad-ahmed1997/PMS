import { requireUser } from "@/lib/auth/authorization";
export default async function AttendanceLayout({ children }) { await requireUser(); return children; }
