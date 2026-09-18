import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";

/**
 * Same-origin by default so LAN access (phone/tablet → PC IP) works.
 * NEXT_PUBLIC_APP_URL is only a SSR/fallback hint.
 */
function resolveBaseURL(): string | undefined {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_APP_URL;
}

export const authClient = createAuthClient({
  baseURL: resolveBaseURL(),
  plugins: [organizationClient()],
});
