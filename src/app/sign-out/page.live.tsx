"use client";

import { useEffect } from "react";
import { AuthFrame } from "@/components/auth/AuthFrame";
import { authClient } from "@/lib/auth-client";

export default function SignOut() {
  useEffect(() => {
    authClient.signOut().finally(() => {
      // Full navigation so no signed-in server state survives.
      window.location.replace(new URL("/sign-in", window.location.origin).href);
    });
  }, []);
  return (
    <AuthFrame>
      <p className="text-center text-lg text-ink-3" role="status">
        Signing you out…
      </p>
    </AuthFrame>
  );
}
