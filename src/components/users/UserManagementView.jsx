"use client";

import { useEffect, useState } from "react";
import ActionButton from "@/components/ui/ActionButton";
import { Dialog } from "@/components/ui/dialog";
import Avatar from "@/components/ui/Avatar";
import Pagination from "@/components/ui/Pagination";
import { Skeleton } from "@/components/ui/skeleton";
import CreateUserForm from "@/components/users/CreateUserForm";
import { roleOptions, normalizeRoleId } from "@/lib/roles";
import { useToast } from "@/components/ui/ToastProvider";

const getRoleLabel = (roleId) => {
  const normId = normalizeRoleId(roleId);
  return roleOptions.find((opt) => opt.id === normId)?.label ?? roleId;
};

export default function UserManagementView() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { addToast } = useToast();
  const [reinvitingIds, setReinvitingIds] = useState({});

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const handleReinvite = async (userId) => {
    setReinvitingIds((prev) => ({ ...prev, [userId]: true }));
    try {
      const response = await fetch("/api/users/reinvite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to resend invitation");
      }
      addToast({
        title: "Invitation sent",
        message: "A new invitation email has been sent successfully.",
        variant: "success",
      });
    } catch (err) {
      addToast({
        title: "Failed to reinvite",
        message: err instanceof Error ? err.message : "Could not send invitation email.",
        variant: "error",
      });
    } finally {
      setReinvitingIds((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/users");
      if (!response.ok) throw new Error("Failed to fetch users");
      const data = await response.json();
      setUsers(data?.users ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleUserCreated = () => {
    setIsCreateOpen(false);
    setSelectedUser(null);
    fetchUsers();
  };

  const filteredUsers = users.filter((user) => {
    const query = searchQuery.toLowerCase();
    return (
      user.name?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query) ||
      getRoleLabel(user.role)?.toLowerCase().includes(query)
    );
  });

  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="space-y-6">
      {/* Top controls: Search input & Create Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[color:var(--color-text-muted)] pointer-events-none">
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="1.8"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.608 10.608Z"
              />
            </svg>
          </span>
          <input
            type="text"
            placeholder="Search members by name, email or role..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] text-[color:var(--color-text)] placeholder-[color:var(--color-text-subtle)] focus:outline-none focus:border-[color:var(--color-accent)] transition-colors"
          />
        </div>

        <ActionButton
          label="Invite Member"
          variant="primary"
          onClick={() => {
            setSelectedUser(null);
            setIsCreateOpen(true);
          }}
          className="sm:w-auto"
        />
      </div>

      {/* Users List Table */}
      {loading ? (
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] border-collapse text-left text-sm text-[color:var(--color-text-muted)]">
              <thead>
                <tr className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] text-[color:var(--color-text-subtle)] font-medium">
                  <th className="px-6 py-4">Member</th>
                  <th className="px-6 py-4">Designation</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--color-border)]/50">
                {Array.from({ length: 5 }).map((_, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-9 w-9 rounded-full" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                    </td>
                    <td className="px-6 py-4"><Skeleton className="h-4 w-24" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-4 w-40" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-6 w-16 rounded-full" /></td>
                    <td className="px-6 py-4 text-right"><Skeleton className="h-8 w-20 ml-auto rounded-lg" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-8 text-center text-sm text-[color:var(--color-text-subtle)]">
          {searchQuery ? "No members match your search." : "No members found in database."}
        </div>
      ) : (
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] border-collapse text-left text-sm text-[color:var(--color-text-muted)]">
              <thead>
                <tr className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] text-[color:var(--color-text-subtle)] font-medium">
                  <th className="px-6 py-4">Member</th>
                  <th className="px-6 py-4">Designation</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--color-border)]/50">
                {paginatedUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-[color:var(--color-surface-muted)]/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar src={user.image} name={user.name} alt={`${user.name} avatar`} />
                        <div className="min-w-0">
                          <p className="font-medium text-[color:var(--color-text)] truncate">{user.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-[color:var(--color-text)]">
                      {getRoleLabel(user.role)}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs">
                      {user.email}
                    </td>
                    <td className="px-6 py-4">
                      {user.isActive !== false ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                          Pending Invite
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                      {user.isActive === false && (
                        <button
                          onClick={() => handleReinvite(user.id)}
                          disabled={reinvitingIds[user.id]}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--color-border)] px-2.5 py-1.5 text-xs font-medium text-amber-400 hover:border-amber-400 hover:text-amber-300 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {reinvitingIds[user.id] ? "Sending..." : "Resend Invite"}
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setSelectedUser(user);
                          setIsCreateOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--color-border)] px-2.5 py-1.5 text-xs font-medium text-[color:var(--color-text-subtle)] hover:border-[color:var(--color-accent)] hover:text-white transition-colors cursor-pointer"
                      >
                        <svg
                          className="h-3.5 w-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          strokeWidth="1.8"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.83 20.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125"
                          />
                        </svg>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="border-t border-[color:var(--color-border)]">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </div>
      )}

      {/* Reusable Dialog containing the creation/edit form */}
      <Dialog
        isOpen={isCreateOpen}
        title={selectedUser ? "Edit Member Account" : "Invite Team Member"}
        description={selectedUser ? "Modify account details for this team member." : "Enter their details to send an invitation email."}
        onClose={() => setIsCreateOpen(false)}
      >
        <div className="pb-6">
          <CreateUserForm
            key={selectedUser?.id ?? "new"}
            user={selectedUser}
            onSuccess={handleUserCreated}
            onCancel={() => setIsCreateOpen(false)}
          />
        </div>
      </Dialog>
    </div>
  );
}
