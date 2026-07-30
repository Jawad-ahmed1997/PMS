import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;
export const MAX_PASSWORD_LENGTH = 1024;
export const MIN_PASSWORD_LENGTH = 12;

export function isPasswordInput(value, { requirePolicy = false } = {}) {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_PASSWORD_LENGTH) return false;
  return !requirePolicy || value.length >= MIN_PASSWORD_LENGTH;
}

export function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export function verifyPassword(hash, password) {
  // bcrypt.compare throws for null/invalid hashes. Treat those as a failed
  // login so a bad legacy row cannot turn into a CredentialsSignin crash.
  if (!isBcryptHash(hash) || typeof password !== "string") return Promise.resolve(false);
  return bcrypt.compare(password, hash).catch(() => false);
}

export function isBcryptHash(value) {
  return typeof value === "string" && /^\$2[aby]?\$\d{2}\$[./A-Za-z0-9]{53}$/.test(value);
}

export const DUMMY_PASSWORD_HASH = "$2b$12$LQv3c1yqBWVHxkd0LHAkCOq8N5b1g6l9YvX5hFf4wW2l5uKqz8jQe";
