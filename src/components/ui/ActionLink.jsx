"use client";

import { useRouter } from "next/navigation";
import { useToast } from "./ToastProvider";
import { Button } from "./button";

export default function ActionLink({ href, label, toast, className = "" }) {
  const router = useRouter();
  const { addToast } = useToast();

  return (
    <Button
      type="button"
      variant="ghost"
      className={className}
      onClick={() => {
        addToast(toast);
        router.push(href);
      }}
    >
      {label}
    </Button>
  );
}
