"use client"

import React from "react";
import { cn } from "@/lib/utils";

const BG_COLORS = [
  "bg-teal-500",
  "bg-indigo-500",
  "bg-rose-500",
  "bg-amber-500",
  "bg-sky-500",
  "bg-purple-500",
  "bg-emerald-500",
];

function stringToColorIndex(str) {
  let hash = 0;
  if (!str) return 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % BG_COLORS.length;
}

export function Avatar({ src, name, alt, className, fallbackClassName }) {
  const [imageError, setImageError] = React.useState(false);
  const initials = (name ?? "U").trim().charAt(0).toUpperCase();

  const colorClass = BG_COLORS[stringToColorIndex(name)];

  if (src && !imageError) {
    return (
      <div className={cn("relative flex h-9 w-9 shrink-0 overflow-hidden rounded-full", className)}>
        <img
          src={src}
          alt={alt || name || "Avatar"}
          className="aspect-square h-full w-full object-cover"
          onError={() => setImageError(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm",
        colorClass,
        className,
        fallbackClassName
      )}
    >
      {initials}
    </div>
  );
}

export default Avatar;
