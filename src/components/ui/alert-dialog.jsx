"use client";

import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const AlertDialog = AlertDialogPrimitive.Root;
export const AlertDialogTrigger = AlertDialogPrimitive.Trigger;
export const AlertDialogPortal = AlertDialogPrimitive.Portal;

export function AlertDialogOverlay({ className, ...props }) {
  return (
    <AlertDialogPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className,
      )}
      {...props}
    />
  );
}

export function AlertDialogContent({ className, children, ...props }) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 rounded-2xl border border-border/80 bg-card p-6 text-card-foreground shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          className,
        )}
        {...props}
      >
        {children}
      </AlertDialogPrimitive.Content>
    </AlertDialogPortal>
  );
}

export const AlertDialogHeader = ({ className, ...props }) => (
  <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />
);

export const AlertDialogFooter = ({ className, ...props }) => (
  <div className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />
);

export const AlertDialogTitle = ({ className, ...props }) => (
  <AlertDialogPrimitive.Title className={cn("text-lg font-semibold", className)} {...props} />
);

export const AlertDialogDescription = ({ className, ...props }) => (
  <AlertDialogPrimitive.Description className={cn("text-sm text-muted-foreground", className)} {...props} />
);

const alertDialogButtonVariants = cva(
  "inline-flex h-9 items-center justify-center rounded-lg px-3 text-sm font-semibold transition-[background-color,border-color,color,box-shadow,opacity] duration-150 ease-out outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        outline: "border border-border bg-background hover:border-foreground/20 hover:bg-muted",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
      },
    },
    defaultVariants: { variant: "outline" },
  },
);

export const AlertDialogCancel = ({ className, ...props }) => (
  <AlertDialogPrimitive.Cancel className={cn(alertDialogButtonVariants({ variant: "outline", className }))} {...props} />
);

export const AlertDialogAction = ({ className, ...props }) => (
  <AlertDialogPrimitive.Action className={cn(alertDialogButtonVariants({ variant: "destructive", className }))} {...props} />
);
