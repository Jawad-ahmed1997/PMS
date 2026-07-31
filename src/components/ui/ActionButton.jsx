"use client";

import { Button } from "./button";

export default function ActionButton({
  label,
  toast,
  onClick,
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  disabled = false,
  title,
}) {
  const mappedVariant = { primary: "default", success: "default", danger: "destructive", warning: "secondary", info: "secondary", secondary: "outline" }[variant] ?? "default";
  const mappedSize = { sm: "sm", md: "default", lg: "lg" }[size] ?? "default";
  return <Button type={type} disabled={disabled} title={title} variant={mappedVariant} size={mappedSize} className={className} toast={toast} onClick={onClick}>{label}</Button>;
}
