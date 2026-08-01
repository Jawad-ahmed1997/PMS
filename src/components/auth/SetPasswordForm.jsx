"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";

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
      <div className="mt-6 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
        <p className="font-semibold">Invalid invitation link</p>
        <p className="mt-1 text-destructive/70">
          Please check your email for the correct invitation link, or ask your admin to resend the invitation.
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
            </DialogContent>
          </DialogPortal>
        </DialogRoot>
      </>
    );
  }

  if (success) {
    return (
      <div className="mt-6 space-y-4">
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-600 dark:text-emerald-400">
          <p className="font-semibold">Password set successfully!</p>
          <p className="mt-1 text-emerald-600/70 dark:text-emerald-400/70">
            Your account is now active. You can sign in with your credentials.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => router.push("/login")}
          size="lg"
          className="w-full bg-primary text-primary-foreground transition-colors duration-150 hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring"
        >
          Go to Sign In →
        </Button>
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
    <form onSubmit={handleSubmit} className="grid gap-6">
      {error && <p className="text-sm text-destructive" role="alert" aria-live="polite">{error}</p>}

      <div className="grid gap-2">
        <Label htmlFor="password" className="text-sm font-medium text-foreground">New password</Label>
        <PasswordInput
          id="password"
          name="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Minimum 6 characters"
          autoComplete="new-password"
          className="h-11 rounded-lg border-input bg-background text-foreground focus-visible:border-ring focus-visible:ring-ring"
          required
          minLength={6}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="confirm-password" className="text-sm font-medium text-foreground">Confirm password</Label>
        <PasswordInput
          id="confirm-password"
          name="confirm-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Re-enter your password"
          autoComplete="new-password"
          className="h-11 rounded-lg border-input bg-background text-foreground focus-visible:border-ring focus-visible:ring-ring"
          required
          minLength={6}
        />
      </div>

      <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Password requirements</p>
        <p className="mt-1">Use at least 6 characters and enter the same password in both fields.</p>
      </div>

      <Button type="submit" size="lg" className={`w-full ${loading ? "pointer-events-none opacity-60" : ""}`}>
        {loading ? "Setting password..." : "Set Password & Activate Account"}
      </Button>

      <p className="text-center text-xs text-[color:var(--color-text-subtle)]">
        This link expires 24 hours after it was sent.
      </p>
    </form>
  );
}
