import SetPasswordForm from "@/components/auth/SetPasswordForm";

export default function SetPasswordPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-text-subtle)]">
          Account setup
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-[color:var(--color-text)]">
          Set your password
        </h2>
        <p className="mt-2 text-sm text-[color:var(--color-text-muted)]">
          Create a secure password to activate your PMS Cloud account.
        </p>
        <SetPasswordForm />
      </div>
    </div>
  );
}
