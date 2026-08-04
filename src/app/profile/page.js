import { redirect } from "next/navigation";
import { getSession } from "@/lib/session-server";
import { getRoleById } from "@/lib/roles";
import Avatar from "@/components/ui/Avatar";
import ProfileSettingsForm from "@/components/profile/ProfileSettingsForm";
import { prisma } from "@/lib/prisma";

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { email: session.email },
    select: { id: true, name: true, email: true, role: true, timezone: true },
  });

  if (!dbUser) redirect("/login");

  const name = dbUser.name || "User";
  const role = getRoleById(dbUser.role);

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">Account</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">Profile</h1>
        <p className="mt-2 text-sm text-muted-foreground">Your authenticated account information.</p>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <Avatar src={session.image} name={name} alt={`${name} avatar`} className="h-16 w-16 border border-border text-lg shadow-sm" />
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-foreground">{name}</h2>
              <p className="truncate text-sm text-muted-foreground">{dbUser.email}</p>
            </div>
          </div>
          <dl className="mt-6 grid gap-4 border-t border-border/70 pt-5 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Email</dt>
              <dd className="mt-1 truncate text-sm text-foreground">{dbUser.email}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Role</dt>
              <dd className="mt-1 text-sm text-foreground">{role?.label || dbUser.role}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Settings</h2>
          <ProfileSettingsForm initialUser={dbUser} />
        </div>
      </div>
    </section>
  );
}
