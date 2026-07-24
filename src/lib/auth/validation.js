import { z } from "zod";
import { isPasswordInput, MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "./password";

export const emailSchema = z.string().trim().email().max(320).transform((value) => value.toLowerCase());
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(MAX_PASSWORD_LENGTH),
});
export const newPasswordSchema = z.object({
  password: z.string().refine((value) => isPasswordInput(value, { requirePolicy: true }), `Password must be ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} characters.`),
  confirmation: z.string().min(1).max(MAX_PASSWORD_LENGTH),
}).refine((value) => value.password === value.confirmation, { path: ["confirmation"], message: "Passwords do not match." });
