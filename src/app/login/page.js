import { redirect } from "next/navigation";
import SignInForm from "@/components/auth/SignInForm";
import { getSession } from "@/lib/session-server";
import { getDefaultRouteForRole } from "@/lib/roles";
import ThemeToggle from "@/components/ui/ThemeToggle";
import Logo from "@/components/ui/Logo";

export default async function LoginPage({ searchParams }) {
  const session = await getSession();
  if (session) redirect(getDefaultRouteForRole(session.role));
  const params = await searchParams;
  const callbackUrl =
    typeof params?.callbackUrl === "string"
      ? params.callbackUrl
      : typeof params?.next === "string"
        ? params.next
        : "/dashboard";
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-10 py-10 text-foreground sm:px-6">
      <Logo
        alt="Gatkod Logo"
        priority
        className="absolute left-6 top-6 z-10 h-10 w-auto object-contain sm:left-16 sm:top-8"
      />
      <div className="absolute right-16 top-6 z-10 sm:right-16 sm:top-8">
        <ThemeToggle />
      </div>
      <section
        aria-labelledby="login-title"
        className="relative z-10 w-full max-w-[448px] -translate-y-[8%]"
      >
        <div className="flex flex-col items-center text-center ">
          <div className="mt-6">
            <h1
              id="login-title"
              className="text-[28px] font-semibold tracking-[-0.03em] text-foreground"
            >
              Welcome PMS Cloud
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Sign in to continue managing your operations.
            </p>
          </div>
        </div>
        <div className="mt-8">
          <SignInForm callbackUrl={callbackUrl} />
        </div>
      </section>
      <div className="absolute bottom-7 flex justify-center text-xs w-full">
        <div>
          <span className="font-medium text-muted-foreground">Powered By</span>{" "}
          <a href="https://www.gatekod.com/" target="_blank">
            {" "}
            <span className="font-bold text-primary hover:underline">
              GatKod Solution
            </span>
          </a>
        </div>
      </div>
    </main>
  );
}
