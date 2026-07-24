"use server";

import { AuthError } from "next-auth";
import { signIn } from "../../../auth";
import { loginSchema } from "@/lib/auth/validation";

function safeCallback(value) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value : "/dashboard";
}

export async function loginAction(_previous, formData) {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) {
    return { error: "Enter a valid email and password.", fields: parsed.error.flatten().fieldErrors };
  }
  try {
    await signIn("credentials", { ...parsed.data, redirectTo: safeCallback(formData.get("callbackUrl")) });
    return { error: null };
  } catch (error) {
    if (error instanceof AuthError) return { error: "The email or password is incorrect." };
    throw error;
  }
}
