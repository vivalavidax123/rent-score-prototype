import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/app/lib/auth";

// Catch-all: every auth endpoint (sign-up, sign-in, sign-out, the Google
// OAuth callback) is served by Better Auth through this one handler.
export const { GET, POST } = toNextJsHandler(auth.handler);
