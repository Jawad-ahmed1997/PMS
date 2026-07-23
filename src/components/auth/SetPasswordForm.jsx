"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import ActionButton from "@/components/ui/ActionButton";

export default function SetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  if (!token) {
    return (
      <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">
        <p className="font-semibold">Invalid invitation link</p>
        <p className="mt-1 text-red-400/70">
          Please check your email for the correct invitation link, or ask your admin to resend the invitation.
        </p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="mt-6 space-y-4">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-400">
          <p className="font-semibold">✓ Password set successfully!</p>
          <p className="mt-1 text-emerald-400/70">
            Your account is now active. You can sign in with your credentials.
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/auth/sign-in")}
          className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-400 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:shadow-indigo-500/30"
        >
          Go to Sign In →
        </button>
      </div>
    );
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to set password.");
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to set password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <label className="block text-xs text-[color:var(--color-text-muted)]">
        New Password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Minimum 6 characters"
          className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-sm text-[color:var(--color-text)] placeholder-[color:var(--color-text-subtle)]"
          required
          minLength={6}
        />
      </label>

      <label className="block text-xs text-[color:var(--color-text-muted)]">
        Confirm Password
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Re-enter your password"
          className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-input)] px-3 py-2 text-sm text-[color:var(--color-text)] placeholder-[color:var(--color-text-subtle)]"
          required
          minLength={6}
        />
      </label>

      <ActionButton
        label={loading ? "Setting password..." : "Set Password & Activate Account"}
        variant="primary"
        type="submit"
        className={`w-full ${loading ? "pointer-events-none opacity-60" : ""}`}
      />

      <p className="text-center text-xs text-[color:var(--color-text-subtle)]">
        This link expires 48 hours after it was sent.
      </p>
    </form>
  );
}
