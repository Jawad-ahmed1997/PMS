import { redirect } from "next/navigation";
import { getSession } from "@/lib/session-server";
import { getRoleById } from "@/lib/roles";

function getInitials(name, email) {
  const value = name?.trim() || email?.trim() || "U";
  const parts = value.split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : value.slice(0, 2)).toUpperCase();
}

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const name = session.name || session.email || "User";
  const role = getRoleById(session.role);

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">Account</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">Profile</h1>
        <p className="mt-2 text-sm text-muted-foreground">Your authenticated account information.</p>
      </div>
      <div className="max-w-xl rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-lg font-semibold text-foreground">
            {session.image ? <img src={session.image} alt="" className="h-full w-full object-cover" /> : getInitials(session.name, session.email)}
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-foreground">{name}</h2>
            <p className="truncate text-sm text-muted-foreground">{session.email}</p>
          </div>
        </div>
        <dl className="mt-6 grid gap-4 border-t border-border/70 pt-5 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Email</dt>
            <dd className="mt-1 truncate text-sm text-foreground">{session.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Role</dt>
            <dd className="mt-1 text-sm text-foreground">{role?.label || session.role}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
