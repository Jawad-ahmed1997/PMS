import UserManagementView from "@/components/users/UserManagementView";
import PageHeader from "@/components/layout/PageHeader";
import { getSession } from "@/lib/session-server";
import { normalizeRoleId, roles } from "@/lib/roles";

export default async function CreateUserPage() {
  const session = await getSession();
  const roleId = normalizeRoleId(session?.role);
  const canCreate = [roles.CEO, roles.PM, roles.CTO].includes(roleId);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Member management"
        title="Members directory"
        subtitle="View existing accounts and provision new team access."
      />

      {canCreate ? (
        <UserManagementView />
      ) : (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-200">
          You do not have permission to access user directory.
        </div>
      )}
    </div>
  );
}
