"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Sheet({ isOpen, title, onClose, children, width = "24rem" }) {
  return <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => !open && onClose?.()}><DialogPrimitive.Portal><DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" /><DialogPrimitive.Content style={{ width }} className="fixed inset-y-0 right-0 z-50 flex h-full max-w-full flex-col border-l border-border/80 bg-card text-card-foreground shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right duration-200"><div className="flex items-center justify-between border-b border-border/70 px-5 py-4"><DialogPrimitive.Title className="text-sm font-semibold">{title}</DialogPrimitive.Title><DialogPrimitive.Close className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"><X className="h-4 w-4" /><span className="sr-only">Close</span></DialogPrimitive.Close></div><div className="min-h-0 flex-1 overflow-auto px-5 py-4">{children}</div></DialogPrimitive.Content></DialogPrimitive.Portal></DialogPrimitive.Root>;
}
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;
export function SheetContent({ side = "right", className, children, ...props }) {
  return <DialogPrimitive.Portal><DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/45" /><DialogPrimitive.Content className={cn("fixed z-50 flex h-full max-w-full flex-col border-border bg-card text-card-foreground shadow-lg", side === "left" ? "inset-y-0 left-0 border-r" : "inset-y-0 right-0 border-l", className)} {...props}>{children}<DialogPrimitive.Close className="absolute right-4 top-4 rounded p-1 text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"><X className="h-4 w-4" /><span className="sr-only">Close</span></DialogPrimitive.Close></DialogPrimitive.Content></DialogPrimitive.Portal>;
}
export const SheetHeader = ({ className, ...props }) => <div className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />;
export const SheetTitle = ({ className, ...props }) => <DialogPrimitive.Title className={cn("text-lg font-semibold", className)} {...props} />;
