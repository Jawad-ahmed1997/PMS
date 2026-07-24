"use client";
import { useActionState } from "react";
import Link from "next/link";
import { forgotPasswordAction } from "./actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(forgotPasswordAction, { submitted: false });
  return <main className="flex min-h-screen items-center justify-center px-6"><form action={action} className="w-full max-w-md space-y-5" noValidate><h1 className="text-3xl font-semibold">Forgot password?</h1><p className="text-sm text-[color:var(--color-text-muted)]">Enter your email and we’ll send recovery instructions if the account exists.</p><div className="grid gap-2 text-sm"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" autoComplete="email" required className="h-11 rounded-lg" /></div>{state.message ? <p role="status" className="text-sm text-[color:var(--color-text-muted)]">{state.message}</p> : null}<Button type="submit" disabled={pending} className="h-11 w-full rounded-lg bg-[color:var(--button-primary-bg)] font-semibold text-[color:var(--button-primary-text)]">{pending ? "Sending..." : "Send reset link"}</Button><Link href="/login" className="block text-sm underline">Back to sign in</Link></form></main>;
}
