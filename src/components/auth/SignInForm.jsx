"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ActionButton from "@/components/ui/ActionButton";
import { useToast } from "@/components/ui/ToastProvider";
import { Eye, EyeOff } from "lucide-react";

export default function SignInForm() {
  const router = useRouter();
  const { addToast } = useToast();
  const [viewPassword, setviewPassword] = useState(true)
  const [formState, setFormState] = useState({
    email: "",
    password: "",
  });
  const [status, setStatus] = useState({ loading: false, error: null });

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus({ loading: true, error: null });

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formState),
    });

    if (!response.ok) {
      const data = await response.json();
      setStatus({ loading: false, error: data?.error ?? "Sign-in failed." });
      addToast({
        title: "Sign-in failed",
        message: data?.error ?? "Please check your credentials.",
        variant: "error",
      });
      return;
    }

    addToast({
      title: "Signed in",
      message: "Welcome back to PMS Cloud.",
      variant: "success",
    });
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
      <label className="grid gap-2 text-sm text-[color:var(--color-text-muted)]">
        Work email
        <input
          type="email"
          name="email"
          value={formState.email}
          onChange={handleChange}
          placeholder="name@company.com"
          className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-sm text-[color:var(--color-text)] outline-none focus:border-[color:var(--color-accent)]"
        />
      </label>
      <label className="grid gap-2 text-sm text-[color:var(--color-text-muted)]">
        Password
        <div className="relative">
          <input
            type={viewPassword ? "text" : "password"}
            name="password"
            value={formState.password}
            onChange={handleChange}
            placeholder="••••••••"
            className="w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 pr-10 text-sm text-[color:var(--color-text)] outline-none focus:border-[color:var(--color-accent)]"
          />

          <button
            type="button"
            onClick={() => setviewPassword((prev) => !prev)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--color-text)] opacity-70 hover:opacity-100"
          >
            {viewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </label>
      {status.error && (
        <p className="text-xs text-rose-300">{status.error}</p>
      )}
      <div className="flex flex-wrap gap-3">
        <ActionButton
          label={status.loading ? "Signing in..." : "Sign in"}
          variant="primary"
          type="submit"
          className="min-w-[140px]"
        />
        <ActionButton
          label="Reset password"
          variant="secondary"
          toast={{
            title: "Password reset",
            message: "Password reset flows are staged for integration.",
            variant: "warning",
          }}
          type="button"
        />
      </div>

    </form>
  );
}
