import { requireUser } from "@/lib/auth/authorization";
export default async function MilestonesLayout({ children }) {
  await requireUser();
  return children;
}
