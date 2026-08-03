import AppShell from "@/components/layout/AppShell";
import { getSession } from "@/lib/session-server";

export default async function ApplicationLayout({ children }) {
  const session = await getSession();
  return <AppShell session={session}>{children}</AppShell>;
}
