"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/ToastProvider";
import { roleOptions, roles, normalizeRoleId } from "@/lib/roles";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const buildErrorMessage = (data) =>
  data?.error ?? data?.message ?? "Unable to create member.";

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
        error instanceof Error ? error.message : `Unable to ${user ? "update" : "invite"} member.`;
      addToast({
        title: user ? "Member update failed" : "Invitation failed",
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
            {user ? "Edit member" : "Create member"}
          </p>
          <p className="mt-2 text-sm text-[color:var(--color-text-muted)]">
            {user ? "Modify role or profile details." : "Assign a role and set a secure password for the new account."}
          </p>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs text-[color:var(--color-text-muted)]">
          Name
          <Input
            name="name"
            value={formState.name}
            onChange={handleChange}
            className="mt-1 rounded-xl py-2"
            required
          />
        </label>
        <label className="text-xs text-[color:var(--color-text-muted)]">
          Email
          <Input
            type="email"
            name="email"
            value={formState.email}
            onChange={handleChange}
            className="mt-1 rounded-xl py-2"
            required
          />
        </label>
        <label className="text-xs text-[color:var(--color-text-muted)]">
          Role
          <Select
            name="role"
            value={formState.role}
            onValueChange={(role) => setFormState((prev) => ({ ...prev, role }))}
            required
          >
            <SelectTrigger className="mt-1 rounded-xl">
              <SelectValue placeholder="Select a role" />
            </SelectTrigger>
            <SelectContent>{roleOptions.map((role) => <SelectItem key={role.id} value={role.id}>{role.label}</SelectItem>)}</SelectContent>
          </Select>
        </label>

        {user ? (
          <label className="text-xs text-[color:var(--color-text-muted)]">
            Status
            <Select
              name="isActive"
              value={formState.isActive ? "true" : "false"}
              onValueChange={(value) => setFormState(prev => ({ ...prev, isActive: value === "true" }))}
              required
            >
              <SelectTrigger className="mt-1 rounded-xl">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Active</SelectItem>
                <SelectItem value="false">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </label>
        ) : null}

      </div>

      <div className="flex flex-wrap gap-2 justify-end mt-5">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            label="Cancel"
            onClick={onCancel}
            className="rounded-xl"
          />
        )}
        <Button
          label={status.loading ? (user ? "Updating..." : "Sending invite...") : (user ? "Update member" : "Send Invitation")}
          variant="primary"
          type="submit"
          className={status.loading ? "pointer-events-none opacity-60" : ""}
        />
      </div>
    </form>
  );
}
