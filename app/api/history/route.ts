import { auth } from "@/app/lib/auth";
import { listRecentSearches } from "@/app/lib/services/searchStore";

// History stays public (the search cache is shared), but the star state on
// each chip is per-user, so the session is read when present.
export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    const searches = await listRecentSearches(session?.user.id ?? null);
    return Response.json({ ok: true, searches });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not load recent searches.",
      },
      { status: 500 },
    );
  }
}
