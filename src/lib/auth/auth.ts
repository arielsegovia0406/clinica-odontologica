import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { dbMigrator } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { hashPassword, verifyPassword } from "./password";

const isDev = process.env.NODE_ENV !== "production";

const extraHosts = (process.env.AUTH_ALLOWED_HOSTS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/**
 * Better Auth with DB sessions (immediate revocation) + organization plugin.
 * organization ≈ clínica; member ≈ membresía (rol por clínica).
 *
 * Dynamic baseURL: allows localhost and private LAN in development so tablets
 * on Wi‑Fi can hit the clinic PC by IP (not only http://localhost:3000).
 */
export const auth = betterAuth({
  baseURL: {
    allowedHosts: [
      "localhost:*",
      "127.0.0.1:*",
      ...(isDev
        ? (["192.168.*.*:*", "10.*.*.*:*", "172.16.*.*:*", "172.17.*.*:*", "172.18.*.*:*", "172.19.*.*:*", "172.2*.*.*:*", "172.30.*.*:*", "172.31.*.*:*"] as string[])
        : []),
      ...extraHosts,
    ],
    protocol: isDev ? "http" : "https",
    fallback: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  },
  database: drizzleAdapter(dbMigrator, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      organization: schema.organization,
      member: schema.member,
      invitation: schema.invitation,
    },
  }),
  emailAndPassword: {
    enabled: true,
    password: {
      hash: hashPassword,
      verify: verifyPassword,
    },
  },
  session: {
    // Absolute session TTL; inactivity PIN lock is separate and does not destroy drafts
    expiresIn: 60 * 60 * 8,
    updateAge: 60 * 30,
  },
  plugins: [
    organization({
      allowUserToCreateOrganization: false,
      membershipLimit: 50,
      creatorRole: "admin",
    }),
  ],
});

export type Session = typeof auth.$Infer.Session;
