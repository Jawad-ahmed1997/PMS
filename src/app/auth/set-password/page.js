import SetPasswordForm from "@/components/auth/SetPasswordForm";
import ThemeToggle from "@/components/ui/ThemeToggle";
import Logo from "@/components/ui/Logo";

export default function SetPasswordPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-10 py-10 text-foreground sm:px-6">
      <Logo alt="Gatkod Logo" priority className="absolute left-6 top-6 z-10 h-10 w-auto object-contain sm:left-16 sm:top-8" />
      <div className="absolute right-16 top-6 z-10 sm:right-16 sm:top-8"><ThemeToggle /></div>
      <section aria-labelledby="setup-title" className="relative z-10 w-full max-w-[448px] -translate-y-[8%]">
        <div className="flex flex-col items-center text-center">
          <div className="mt-6">
            <h1 id="setup-title" className="text-[28px] font-semibold tracking-[-0.03em] text-foreground">Complete your account setup</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Create a password to activate your PMS Cloud account.</p>
          </div>
        </div>
        <div className="mt-8"><SetPasswordForm /></div>
      </section>
      <div className="absolute bottom-7 flex w-full justify-center text-xs">
        <div><span className="font-medium text-muted-foreground">Powered By</span>{" "}<a href="https://www.gatekod.com/" target="_blank"><span className="font-bold text-primary hover:underline">GatKod Solution</span></a></div>
      </div>
    </main>
  );
}
