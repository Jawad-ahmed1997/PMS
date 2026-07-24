"use client";

import { useToast } from "./ToastProvider";
import { Card, CardContent } from "./card";
import { useNotificationSound } from "@/lib/useNotificationSound";

export default function PlaceholderUpload({ label, helperText }) {
  const { addToast } = useToast();
  const playSound = useNotificationSound();

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <p className="mt-1 text-sm text-muted-foreground">{helperText}</p>
        </div>
        <input
          type="file"
          className="w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-foreground sm:w-48"
          onChange={(event) => {
            if (!event.target.files?.length) {
              return;
            }
            playSound();
            addToast({
              title: "Upload placeholder",
              message: "Image uploads will be available in the next release.",
              variant: "info",
            });
          }}
        />
      </CardContent>
    </Card>
  );
}
