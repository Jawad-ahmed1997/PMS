"use client";

import { useEffect } from "react";
import { DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./dialog";

export default function Modal({
  isOpen,
  title,
  description,
  onClose,
  children,
}) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <DialogRoot open={isOpen} onOpenChange={(open) => !open && onClose?.()}>
      <DialogPortal>
        <DialogOverlay />
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>
          <div className="mt-6">{children}</div>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  );
}
