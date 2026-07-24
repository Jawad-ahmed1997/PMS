import { requireUser } from "@/lib/auth/authorization";
export default async function ActivityLayout({ children }) { await requireUser(); return children; }
