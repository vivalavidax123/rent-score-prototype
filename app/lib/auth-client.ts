import { createAuthClient } from "better-auth/react";

// Browser-side counterpart of app/lib/auth.ts: talks to /api/auth/* and
// exposes the useSession hook. Same-origin, so no baseURL is needed.
export const authClient = createAuthClient();
