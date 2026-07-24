"use client";
import { useActionState } from "react";
import Link from "next/link";
import { resetPasswordAction } from "./actions";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
export default function ResetPasswordPage({ searchParams }) {
  const token = searchParams?.token || "";
  const [state, action, pending] = useActionState(resetPasswordAction, { error: null });
  if (state.success) return <main className="flex min-h-screen items-center justify-center px-6"><div className="space-y-4"><h1 className="text-3xl font-semibold">Password updated</h1><p>Your password was changed. Sign in with the new password.</p><Link href="/login" className="underline">Go to sign in</Link></div></main>;
  return <main className="flex min-h-screen items-center justify-center px-6" referrerPolicy="no-referrer"><form action={action} className="w-full max-w-md space-y-5" noValidate><h1 className="text-3xl font-semibold">Set a new password</h1><input type="hidden" name="token" value={token} /><div className="grid gap-2 text-sm"><Label htmlFor="password">New password</Label><PasswordInput id="password" name="password" autoComplete="new-password" required minLength={12} className="h-11 rounded-lg" /></div><div className="grid gap-2 text-sm"><Label htmlFor="confirmation">Confirm password</Label><PasswordInput id="confirmation" name="confirmation" autoComplete="new-password" required minLength={12} className="h-11 rounded-lg" /></div>{state.error ? <p role="alert" className="text-sm text-rose-600">{state.error}</p> : null}<Button type="submit" disabled={pending} className="h-11 w-full rounded-lg bg-[color:var(--button-primary-bg)] font-semibold text-[color:var(--button-primary-text)]">{pending ? "Updating..." : "Update password"}</Button></form></main>;
}
