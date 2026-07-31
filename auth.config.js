const authConfig = {
  providers: [],
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  pages: { signIn: "/auth/sign-in" },
  cookies: {
    sessionToken: {
      name: `${process.env.NODE_ENV === "production" ? "__Secure-" : ""}authjs.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (!token.sub) {
        return { ...session, user: undefined, expires: new Date(0).toISOString() };
      }
      session.user = {
        id: token.sub,
        name: token.name,
        email: token.email,
        image: token.picture,
        role: token.role,
      };
      return session;
    },
  },
};

export default authConfig;
