"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Clock } from "lucide-react";
import ActionButton from "@/components/ui/ActionButton";
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function SetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isValidating, setIsValidating] = useState(true);
  const [validationError, setValidationError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setValidationError("Invalid invitation link.");
      setIsModalOpen(true);
      setIsValidating(false);
      return;
    }

    const validateToken = async () => {
      try {
        const response = await fetch(`/api/auth/validate-token?token=${token}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Invitation link has expired.");
        }
      } catch (err) {
        setValidationError(err instanceof Error ? err.message : "Invitation link is invalid or expired.");
        setIsModalOpen(true);
      } finally {
        setIsValidating(false);
      }
    };

    validateToken();
  }, [token]);

  if (isValidating) {
    return (
      <div className="mt-6 flex flex-col items-center justify-center py-6 space-y-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
        <p className="text-sm text-[color:var(--color-text-muted)] animate-pulse">
          Validating invitation link...
        </p>
      </div>
    );
  }

  if (validationError) {
    return (
      <>
        <div className="mt-6 space-y-4">
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">
            <p className="font-semibold">Link Expired or Invalid</p>
            <p className="mt-1 text-red-400/70">{validationError}</p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="w-full rounded-xl bg-[color:var(--color-input)] border border-[color:var(--color-border)] px-4 py-2.5 text-sm font-semibold text-[color:var(--color-text)] transition hover:bg-muted"
          >
            Go to Sign In
          </button>
        </div>

        <DialogRoot open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogPortal>
            <DialogOverlay />
            <DialogContent className="sm:max-w-md border-red-500/20">
              <DialogHeader className="flex flex-col items-center text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-400">
                  <Clock className="h-6 w-6 animate-pulse" />
                </div>
                <DialogTitle className="mt-4 text-xl font-semibold text-[color:var(--color-text)]">
                  Invitation Link Expired
                </DialogTitle>
                <DialogDescription className="mt-2 text-sm text-[color:var(--color-text-muted)] leading-relaxed">
                  {validationError}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
                <Button
                  type="button"
                  variant="default"
                  onClick={() => {
                    setIsModalOpen(false);
                    router.push("/login");
                  }}
                  className="w-full sm:w-auto bg-gradient-to-r from-indigo-500 to-indigo-400 hover:from-indigo-600 hover:to-indigo-500 text-white font-semibold rounded-xl px-6 py-2.5 shadow-lg shadow-indigo-500/20"
                >
                  Go to Sign In
                </Button>
              </DialogFooter>
            </DialogContent>
          </DialogPortal>
        </DialogRoot>
      </>
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
          onClick={() => router.push("/login")}
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
        This link expires 5 minutes after it was sent.
      </p>
    </form>
  );
}
