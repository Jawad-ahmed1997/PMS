"use client";

import { useEffect, useState } from "react";
import ActionButton from "@/components/ui/ActionButton";
import Modal from "@/components/ui/Modal";
import CreateUserForm from "@/components/users/CreateUserForm";
import { roleOptions, normalizeRoleId } from "@/lib/roles";

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
            placeholder="Search users by name, email or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] text-[color:var(--color-text)] placeholder-[color:var(--color-text-subtle)] focus:outline-none focus:border-[color:var(--color-accent)] transition-colors"
          />
        </div>

        <ActionButton
          label="Create User"
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
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-8 text-center text-sm text-[color:var(--color-text-muted)]">
          Loading users directory...
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-8 text-center text-sm text-[color:var(--color-text-subtle)]">
          {searchQuery ? "No users match your search." : "No users found in database."}
        </div>
      ) : (
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] border-collapse text-left text-sm text-[color:var(--color-text-muted)]">
              <thead>
                <tr className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] text-[color:var(--color-text-subtle)] font-medium">
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">Designation</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--color-border)]/50">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-[color:var(--color-surface-muted)]/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#253242] text-sm font-bold text-white/90">
                          {(user.name ?? "U").trim().charAt(0).toUpperCase()}
                        </div>
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
                        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-500/10 px-2 py-1 text-xs font-semibold text-zinc-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => {
                          setSelectedUser(user);
                          setIsCreateOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--color-border)] px-2.5 py-1.5 text-xs font-medium text-[color:var(--color-text-subtle)] hover:border-[color:var(--color-accent)] hover:text-white transition-colors"
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
        </div>
      )}

      {/* Reusable Modal containing the creation/edit form */}
      <Modal
        isOpen={isCreateOpen}
        title={selectedUser ? "Edit User Account" : "Create User Account"}
        description={selectedUser ? "Modify account details for this team member." : "Fill in the details below to add a new team member."}
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
      </Modal>
    </div>
  );
}
