import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Resend from "next-auth/providers/resend";
import { db } from "@/db";
import { accounts, users, verificationTokens } from "@/db/schema";
import { sendEmail } from "@/lib/email";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    verificationTokensTable: verificationTokens,
  }),
  // JWT sessions: required by the Credentials provider behind the demo
  // button, and they save a database read on every request. Trade-off: a
  // session can't be revoked server-side before it expires.
  session: { strategy: "jwt" },
  pages: { signIn: "/login", verifyRequest: "/login/check-email", error: "/login" },
  providers: [
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.EMAIL_FROM,
      async sendVerificationRequest({ identifier, url }) {
        await sendEmail({
          to: identifier,
          subject: "Your Slotwise sign-in link",
          text: `Sign in to Slotwise:\n${url}\n\nThe link expires in 24 hours. If you didn't ask for it, ignore this email.`,
          html: `<p>Sign in to Slotwise:</p><p><a href="${url}">Sign in</a></p><p>The link expires in 24 hours. If you didn't ask for it, ignore this email.</p>`,
        });
      },
    }),
    // One-click demo login. It accepts no input and can only ever sign in as
    // the seeded demo account, so it can't be used to reach anyone else's data.
    Credentials({
      id: "demo",
      name: "Demo",
      credentials: {},
      async authorize() {
        const email = process.env.DEMO_EMAIL;
        if (!email) return null;
        const user = await db.query.users.findFirst({ where: eq(users.email, email) });
        return user ?? null;
      },
    }),
  ],
  callbacks: {
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
