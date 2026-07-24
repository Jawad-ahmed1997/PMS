"use client";

import { useActionState, useRef, useState } from "react";
import { loginAction } from "@/app/login/actions";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
import { Eye, EyeOff } from "lucide-react";

export default function SignInForm({ callbackUrl = "/dashboard" }) {
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const [viewPassword, setviewPassword] = useState(true)
  const [formState, setFormState] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [status, formAction, isPending] = useActionState(loginAction, { error: null, fields: {} });

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormState((previous) => ({ ...previous, [name]: value }));
    setErrors((previous) => ({ ...previous, [name]: null }));
  };

  const validate = () => {
    const nextErrors = {};
    const email = formState.email.trim();

    if (!email) {
      nextErrors.email = "Enter your work email.";
    } else if (!EMAIL_PATTERN.test(email)) {
      nextErrors.email = "Enter a valid email address.";
    }
    if (!formState.password) {
      nextErrors.password = "Enter your password.";
    }

    setErrors(nextErrors);
    if (nextErrors.email) emailRef.current?.focus();
    else if (nextErrors.password) passwordRef.current?.focus();
    return nextErrors;
  };

  const handleSubmit = (event) => {
    if (isPending || Object.keys(validate()).length > 0) event.preventDefault();
  };

  return (
    <form className="auth-form-enter grid gap-6" action={formAction} onSubmit={handleSubmit} noValidate>
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <div className="grid gap-2">
        <Label htmlFor="email" className="text-sm font-medium text-foreground">Work email</Label>
        <Input
          ref={emailRef}
          id="email"
          type="email"
          name="email"
          value={formState.email}
          placeholder="Enter Your Email"
          onChange={handleChange}
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck="false"
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "email-error" : undefined}
          className="h-11 rounded-lg border-input bg-background text-foreground focus-visible:border-ring focus-visible:ring-ring"
        />
        {errors.email ? <p id="email-error" className="text-xs text-rose-600">{errors.email}</p> : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="password" className="text-sm font-medium text-foreground">Password</Label>
        <div className="relative">
          <PasswordInput
            ref={passwordRef}
            id="password"
            name="password"
            placeholder="Enter Your Password"
            value={formState.password}
            onChange={handleChange}
            autoComplete="current-password"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? "password-error" : undefined}
            className="h-11 rounded-lg border-input bg-background text-foreground focus-visible:border-ring focus-visible:ring-ring"
          />
        </div>
        {errors.password ? <p id="password-error" className="text-xs text-rose-600">{errors.password}</p> : null}
      </div>

      {status?.error ? (
        <p className="text-sm text-destructive" role="alert" aria-live="polite">{status.error}</p>
      ) : null}

      <Button
        type="submit"
        disabled={isPending}
        size="lg"
        className="w-full bg-primary text-primary-foreground transition-colors duration-150 hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring"
        label={isPending ? "Signing in..." : "Sign in"}
      />
    </form>
  );
}
