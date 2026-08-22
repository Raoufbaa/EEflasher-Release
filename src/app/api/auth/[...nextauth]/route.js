import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { query } from "@/lib/db";
import bcrypt from "bcryptjs";
import { checkIsAdmin, checkIsVerified } from "@/lib/auth";

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required.");
        }

        // Query database for user
        const result = await query(
          "SELECT id, email, password_hash, verified, plan, plan_expires_at, name, profile_image FROM users WHERE LOWER(email) = $1",
          [credentials.email.toLowerCase()]
        );

        const user = result.rows[0];
        if (!user) {
          throw new Error("Invalid email or password.");
        }

        // Compare password hash
        const isMatch = await bcrypt.compare(credentials.password, user.password_hash);
        if (!isMatch) {
          throw new Error("Invalid email or password.");
        }

        const { getUserPlan } = await import("@/lib/auth");
        const activePlan = getUserPlan(user);

        return {
          id: user.id,
          email: user.email,
          verified: checkIsVerified(user),
          plan: activePlan,
          plan_expires_at: user.plan_expires_at || null,
          name: user.name,
          profile_image: user.profile_image,
        };
      }
    })
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.verified = user.verified;
        token.plan = user.plan;
        token.plan_expires_at = user.plan_expires_at;
        token.name = user.name;
        token.profile_image = user.profile_image;
      } else if (trigger === "update") {
        try {
          // Fetch the latest state from the database
          const result = await query(
            "SELECT verified, plan, plan_expires_at, name, profile_image FROM users WHERE id = $1",
            [token.id]
          );
          const dbUser = result.rows[0];
          if (dbUser) {
            const { getUserPlan } = await import("@/lib/auth");
            token.verified = checkIsVerified(dbUser);
            token.plan = getUserPlan(dbUser);
            token.plan_expires_at = dbUser.plan_expires_at || null;
            token.name = dbUser.name;
            token.profile_image = dbUser.profile_image;
          }
        } catch (err) {
          console.error("Error refreshing JWT callback token:", err);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id;
        session.user.email = token.email;
        session.user.verified = token.verified;
        session.user.plan = token.plan || "FREE";
        session.user.plan_expires_at = token.plan_expires_at || null;
        session.user.name = token.name;
        session.user.profile_image = token.profile_image;
      }
      return session;
    }
  },
  pages: {
    signIn: "/authenticate",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
