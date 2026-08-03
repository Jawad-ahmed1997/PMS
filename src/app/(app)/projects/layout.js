import { requireUser } from "@/lib/auth/authorization";
export default async function ProjectsLayout({ children }) { await requireUser(); return children; }
