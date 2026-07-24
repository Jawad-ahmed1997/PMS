"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/ToastProvider";
import { roleOptions, roles } from "@/lib/roles";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";

const buildErrorMessage = (data) =>
  data?.error ?? data?.message ?? "Unable to create user.";

export default function CreateUserForm() {
  const { addToast } = useToast();
  const [formState, setFormState] = useState({
    name: "",
    email: "",
    role: roles.DEV,
    password: "",
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
      const response = await fetch("/api/users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formState),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(buildErrorMessage(data));
      }

      addToast({
        title: "User created successfully",
        message: "The new user can now sign in.",
        variant: "success",
      });
      setFormState({
        name: "",
        email: "",
        role: roles.DEV,
        password: "",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to create user.";
      addToast({
        title: "User creation failed",
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
      className="space-y-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-6"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
          Create user
        </p>
        <p className="mt-2 text-sm text-[color:var(--color-text-muted)]">
          Assign a role and set a secure password for the new account.
        </p>
      </div>

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
            <SelectTrigger className="mt-1 rounded-xl" />
            <SelectContent>{roleOptions.map((role) => <SelectItem key={role.id} value={role.id}>{role.label}</SelectItem>)}</SelectContent>
          </Select>
        </label>
        <label className="text-xs text-[color:var(--color-text-muted)]">
          Password
          <PasswordInput
            name="password"
            value={formState.password}
            onChange={handleChange}
            className="mt-1 rounded-xl py-2"
            required
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          label={status.loading ? "Creating..." : "Create user"}
          variant="primary"
          type="submit"
          className={status.loading ? "pointer-events-none opacity-60" : ""}
        />
      </div>
    </form>
  );
}
