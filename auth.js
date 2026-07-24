import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import authConfig from "./auth.config";
import { prisma } from "@/lib/prisma";
import { DUMMY_PASSWORD_HASH, verifyPassword } from "@/lib/auth/password";
import { loginSchema } from "@/lib/auth/validation";
import { consumeRateLimit, getClientIp } from "@/lib/auth/rate-limit";
import { recordSecurityEvent } from "@/lib/auth/audit";
import { assertAuthConfiguration } from "@/lib/auth/env";

assertAuthConfiguration();

export const nodeAuthConfig = {
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [Credentials({
    credentials: { email: {}, password: {} },
    async authorize(credentials, request) {
      const parsed = loginSchema.safeParse(credentials);
      if (!parsed.success) return null;
      const { email, password } = parsed.data;
      const ip = getClientIp(request);
      const [emailLimit, ipLimit] = await Promise.all([
        consumeRateLimit(`login:email:${email}`, 10),
        consumeRateLimit(`login:ip:${ip}`, 30),
      ]);
      if (!emailLimit.allowed || !ipLimit.allowed) {
        await recordSecurityEvent("rate_limit_login", { email, ip });
        return null;
      }
      const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, email: true, role: true, isActive: true, status: true, passwordHash: true, password: true, image: true } });
      const passwordHash = user?.passwordHash || user?.password || DUMMY_PASSWORD_HASH;
      const matches = await verifyPassword(passwordHash, password);
      if (!user || !user.isActive || user.status === "DISABLED" || !matches) {
        await recordSecurityEvent(user?.status === "DISABLED" ? "disabled_login" : "failed_login", { userId: user?.id, email, ip });
        return null;
      }
      await recordSecurityEvent("successful_login", { userId: user.id, email, ip });
      return { id: user.id, name: user.name, email: user.email, role: user.role, image: user.image };
    },
  })],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.sub = user.id;
      if (!token.sub) return token;
      const current = await prisma.user.findUnique({ where: { id: token.sub }, select: { id: true, name: true, email: true, role: true, image: true, isActive: true, status: true, sessionVersion: true } });
      if (!current || !current.isActive || current.status === "DISABLED") return { ...token, invalidated: true };
      if (token.sessionVersion !== undefined && token.sessionVersion !== current.sessionVersion) return { ...token, invalidated: true };
      token.name = current.name;
      token.email = current.email;
      token.picture = current.image;
      token.role = current.role;
      token.sessionVersion = current.sessionVersion;
      return token;
    },
    async session({ session, token }) {
      if (token.invalidated || !token.sub) return { ...session, user: undefined, expires: new Date(0).toISOString() };
      session.user = { id: token.sub, name: token.name, email: token.email, image: token.picture, role: token.role };
      return session;
    },
  },
  events: { async signOut(message) { await recordSecurityEvent("logout", { userId: message.token?.sub }); } },
};

export const { handlers, auth, signIn, signOut } = NextAuth(nodeAuthConfig);
