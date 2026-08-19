"use client"

import React from "react";
import { cn } from "@/lib/utils";

export function Avatar({ src, name, alt, className, fallbackClassName }) {
  const [imageError, setImageError] = React.useState(false);

  React.useEffect(() => {
    setImageError(false);
  }, [src]);

  if (src && !imageError) {
    return (
      <div className={cn("relative flex h-9 w-9 shrink-0 overflow-hidden rounded-full", className)}>
        <img
          src={src}
          alt={alt || name || "Avatar"}
          loading="lazy"
          className="aspect-square h-full w-full object-cover"
          onError={() => setImageError(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700/80 text-slate-400 dark:text-slate-400 shadow-sm border border-slate-300/40 dark:border-slate-600/40",
        className,
        fallbackClassName
      )}
      title={alt || name || "User Avatar"}
    >
      <svg
        className="h-full w-full p-[8%] text-slate-400 dark:text-slate-400"
        viewBox="0 0 24 24"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
      </svg>
    </div>
  );
}

export default Avatar;
