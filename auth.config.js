const authConfig = {
  providers: [],
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  pages: { signIn: "/login" },
  trustHost: true,
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
