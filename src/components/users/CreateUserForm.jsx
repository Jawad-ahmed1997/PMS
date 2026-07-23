"use client";

import { useState } from "react";
import ActionButton from "@/components/ui/ActionButton";
import { useToast } from "@/components/ui/ToastProvider";
import { roleOptions, roles, normalizeRoleId } from "@/lib/roles";

const buildErrorMessage = (data) =>
  data?.error ?? data?.message ?? "Unable to create user.";

export default function CreateUserForm({ onSuccess, onCancel, user }) {
  const { addToast } = useToast();
  const [formState, setFormState] = useState({
    name: user?.name ?? "",
    email: user?.email ?? "",
    role: normalizeRoleId(user?.role) ?? roles.DEV,
    password: "",
    isActive: user?.isActive !== false,
  });
  const [status, setStatus] = useState({ loading: false });

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus({ loading: true });

    try {
      const url = user ? `/api/users/${user.id}` : "/api/users/create";
      const method = user ? "PATCH" : "POST";
      const body = user
        ? {
            name: formState.name,
            email: formState.email,
            role: formState.role,
            isActive: formState.isActive,
          }
        : {
            name: formState.name,
            email: formState.email,
            role: formState.role,
          };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(buildErrorMessage(data));
      }

      addToast({
        title: user ? "User updated successfully" : "Invitation sent",
        message: user ? "The user details have been updated." : "An invitation email has been sent to the user.",
        variant: "success",
      });

      if (!user) {
        setFormState({
          name: "",
          email: "",
          role: roles.DEV,
          password: "",
          isActive: true,
        });
      }
      onSuccess?.();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : `Unable to ${user ? "update" : "invite"} user.`;
      addToast({
        title: user ? "User update failed" : "Invitation failed",
        message,
        variant: "error",
      });
    } finally {
      setStatus({ loading: false });
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`space-y-4 ${onCancel ? "" : "rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-6"}`}
    >
      {!onCancel && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
            {user ? "Edit user" : "Create user"}
          </p>
          <p className="mt-2 text-sm text-[color:var(--color-text-muted)]">
            {user ? "Modify role or profile details." : "Assign a role and set a secure password for the new account."}
          </p>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs text-[color:var(--color-text-muted)]">
          Name
          <input
            name="name"
            value={formState.name}
            onChange={handleChange}
            className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-sm text-[color:var(--color-text)]"
            required
          />
        </label>
        <label className="text-xs text-[color:var(--color-text-muted)]">
          Email
          <input
            type="email"
            name="email"
            value={formState.email}
            onChange={handleChange}
            className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-sm text-[color:var(--color-text)]"
            required
          />
        </label>
        <label className="text-xs text-[color:var(--color-text-muted)]">
          Role
          <select
            name="role"
            value={formState.role}
            onChange={handleChange}
            className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-sm text-[color:var(--color-text)]"
            required
          >
            {roleOptions.map((role) => (
              <option key={role.id} value={role.id}>
                {role.label}
              </option>
            ))}
          </select>
        </label>

        {user ? (
          <label className="text-xs text-[color:var(--color-text-muted)]">
            Status
            <select
              name="isActive"
              value={formState.isActive ? "true" : "false"}
              onChange={(e) => setFormState(prev => ({ ...prev, isActive: e.target.value === "true" }))}
              className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-sm text-[color:var(--color-text)]"
              required
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </label>
        ) : null}

        {user && (
          <label className="text-xs text-[color:var(--color-text-muted)] opacity-60">
            Password (Read-only)
            <input
              type="password"
              value="••••••••"
              readOnly
              disabled
              className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)]/50 px-3 py-2 text-sm text-[color:var(--color-text-subtle)] cursor-not-allowed select-none"
            />
          </label>
        )}
      </div>

      <div className="flex flex-wrap gap-2 justify-end">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-[color:var(--color-border)] bg-transparent px-4 py-2 text-sm font-medium text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-border)] transition"
          >
            Cancel
          </button>
        )}
        <ActionButton
          label={status.loading ? (user ? "Updating..." : "Sending invite...") : (user ? "Update user" : "Send Invitation")}
          variant="primary"
          type="submit"
          className={status.loading ? "pointer-events-none opacity-60" : ""}
        />
      </div>
    </form>
  );
}
