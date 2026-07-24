"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import { toast as sonnerToast, Toaster } from "sonner";
import {
  CheckCircle2,
  CircleAlert,
  Info,
  Loader2,
  TriangleAlert,
} from "lucide-react";
import { useTheme } from "@/lib/theme";

import "sonner/dist/styles.css";

const ToastContext = createContext(null);

const toastIcons = {
  success: <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />,
  error: <CircleAlert className="h-5 w-5 text-rose-600 dark:text-rose-400" aria-hidden="true" />,
  warning: <TriangleAlert className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden="true" />,
  info: <Info className="h-5 w-5 text-sky-600 dark:text-sky-400" aria-hidden="true" />,
  loading: <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />,
};

const toastMethods = {
  success: sonnerToast.success,
  error: sonnerToast.error,
  warning: sonnerToast.warning,
  info: sonnerToast.info,
  loading: sonnerToast.loading,
};

function showToast(toast = {}) {
  const variant = toast.variant ?? "info";
  const method = toastMethods[variant] ?? sonnerToast;
  const title = toast.title ?? "Notification";
  const message = toast.message ?? "Your action is ready.";

  return method(title, {
    description: message,
    duration: toast.duration ?? 4500,
    icon: toastIcons[variant] ?? toastIcons.info,
    id: toast.id,
    closeButton: true,
  });
}

const toastOptions = {
  classNames: {
    toast: "!w-[calc(100vw-2rem)] !max-w-[460px] !rounded-xl !border !bg-card !px-4 !py-3 !text-card-foreground !shadow-xl",
    title: "!text-sm !font-medium !leading-5",
    description: "!mt-1 !text-sm !leading-5 !text-muted-foreground",
    closeButton: "!border-border !bg-transparent !text-muted-foreground hover:!bg-muted hover:!text-foreground",
    success: "!border-emerald-500/35",
    error: "!border-rose-500/35",
    warning: "!border-amber-500/35",
    info: "!border-sky-500/35",
    loading: "!border-primary/35",
  },
};

export function ToastProvider({ children }) {
  const addToast = useCallback((toast) => showToast(toast), []);
  const value = useMemo(() => ({ addToast }), [addToast]);
  const { resolvedTheme } = useTheme();

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toaster
        theme={resolvedTheme}
        className="pms-toaster"
        position="top-right"
        visibleToasts={4}
        expand={false}
        closeButton
        gap={12}
        offset={24}
        toastOptions={toastOptions}
      />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}
