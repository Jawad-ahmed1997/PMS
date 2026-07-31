import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const args = new Map(process.argv.slice(2).reduce((items, value, index, values) => value.startsWith("--") ? [...items, [value.slice(2), values[index + 1]]] : items, []));
const role = args.get("role") || "DEVELOPER";
const allowed = ["CEO", "PM", "CTO", "SENIOR_DEVELOPER", "DEVELOPER"];
if (!args.get("email") || !args.get("name") || !allowed.includes(role)) { console.error("Usage: node scripts/create-user.mjs --name \"Name\" --email user@example.com --role DEVELOPER"); process.exit(1); }
const rl = createInterface({ input: stdin, output: stdout });
const password = process.env.CREATE_USER_PASSWORD || await rl.question("Password (input is hidden by your shell): ");
rl.close();
if (password.length < 12 || password.length > 1024) { console.error("Password must be between 12 and 1024 characters."); process.exit(1); }
const prisma = new PrismaClient();
try {
  const email = args.get("email").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Email is invalid.");
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) throw new Error("A user with this email already exists.");
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({ data: { name: args.get("name").trim(), email, passwordHash, role, password: null, isActive: true, status: "ACTIVE" } });
  console.log("User created.");
} catch (error) { console.error(error instanceof Error ? error.message : "Unable to create user."); process.exitCode = 1; } finally { await prisma.$disconnect(); }
