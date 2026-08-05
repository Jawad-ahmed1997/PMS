import { DM_Sans } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import AppShell from "@/components/layout/AppShell";
import { ToastProvider } from "@/components/ui/ToastProvider";
import QueryProvider from "@/components/providers/QueryProvider";
import { getSession } from "@/lib/session-server";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

export const metadata = {
  title: "PMS Cloud | Project Management System",
  description:
    "Production-ready project management system with centralized delivery, reporting, and collaboration.",
};

export default async function RootLayout({ children }) {
  const session = await getSession();

  return (
    <html
      lang="en"
      data-theme="light"
      className={dmSans.variable}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased">
        <Script id="theme-init" strategy="beforeInteractive">
          {`(function(){try{var t=localStorage.getItem("pms.theme")||"system";var d=t==="dark"||t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=d;}catch(e){}})();`}
        </Script>
        <ToastProvider>
          <QueryProvider>
            <AppShell session={session}>{children}</AppShell>
          </QueryProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
