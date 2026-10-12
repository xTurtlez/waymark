"use client";

import { passkeyClient } from "@better-auth/passkey/client";
import { magicLinkClient, twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  plugins: [
    twoFactorClient({
      onTwoFactorRedirect() {
        const next = new URLSearchParams(window.location.search).get("next");
        window.location.href = `/sign-in/two-factor${next ? `?next=${encodeURIComponent(next)}` : ""}`;
      },
    }),
    magicLinkClient(),
    passkeyClient(),
  ],
});
