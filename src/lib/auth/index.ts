import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { organizations, organizationMembers } from "@/lib/db/schema-org";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import type { SessionUser } from "@/types";
import { ldapAuthenticate, getLdapConfig } from "./ldap";
import { syncLdapUser } from "./ldap-sync";
import logger from "@/lib/logger";

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 heures
  },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === "production"
        ? "__Secure-next-auth.session-token"
        : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        domain: process.env.NEXTAUTH_COOKIE_DOMAIN ?? undefined,
      },
    },
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = (credentials.email as string).toLowerCase().trim();
        const password = credentials.password as string;

        // Step 1: Try local auth
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (user?.passwordHash) {
          const isValid = await bcrypt.compare(password, user.passwordHash);
          if (isValid) {
            return {
              id: user.id,
              email: user.email,
              name: user.name,
              image: user.avatarUrl,
            };
          }
        }

        // Step 2: If local auth fails, try LDAP (if enabled)
        try {
          const ldapConfig = await getLdapConfig();
          if (!ldapConfig.ldapEnabled) return null;

          const ldapUser = await ldapAuthenticate(email, password);
          if (!ldapUser) return null;

          // Sync LDAP user to local DB
          const syncedUser = await syncLdapUser(ldapUser);
          return {
            id: syncedUser.id,
            email: syncedUser.email,
            name: syncedUser.name,
            image: syncedUser.avatarUrl,
          };
        } catch (err) {
          logger.error({ err }, "Erreur authentification LDAP");
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const [dbUser] = await db
          .select()
          .from(users)
          .where(eq(users.id, user.id!))
          .limit(1);

        if (dbUser) {
          token.id = dbUser.id;
          token.globalRole = dbUser.globalRole;
          token.avatarUrl = dbUser.avatarUrl;

          const [membership] = await db
            .select({ slug: organizations.slug })
            .from(organizationMembers)
            .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
            .where(eq(organizationMembers.userId, dbUser.id))
            .limit(1);
          if (membership) token.orgSlug = membership.slug;
        }
      }

      // Invalider si le token a été révoqué côté serveur
      if (token.tokenInvalidatedAt && token.iat) {
        if ((token.tokenInvalidatedAt as number) > (token.iat as number)) {
          return null;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        const user = session.user as unknown as SessionUser;
        user.id = token.id as string;
        user.globalRole = token.globalRole as SessionUser["globalRole"];
        user.avatarUrl = token.avatarUrl as string | null;
      }
      return session;
    },
  },
});
