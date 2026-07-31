const authConfig = {
  providers: [],
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  pages: { signIn: "/login" },
  trustHost: true,
  callbacks: {
    async jwt({ token, user }) {
      console.log("[auth.config.js] jwt callback: start token =", token, "user =", user);
      if (user) {
        token.sub = user.id;
        token.role = user.role;
      }
      console.log("[auth.config.js] jwt callback: end token =", token);
      return token;
    },
    async session({ session, token }) {
      console.log("[auth.config.js] session callback: token =", token);
      if (!token.sub) {
        console.log("[auth.config.js] session callback: token.sub is missing!");
        return { ...session, user: undefined, expires: new Date(0).toISOString() };
      }
      session.user = {
        id: token.sub,
        name: token.name,
        email: token.email,
        image: token.picture,
        role: token.role,
      };
      console.log("[auth.config.js] session callback: returning session =", session);
      return session;
    },
  },
};

export default authConfig;
