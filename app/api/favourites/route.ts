import { auth } from "@/app/lib/auth";
import {
  listSavedLocations,
  setLocationSaved,
} from "@/app/lib/services/searchStore";

function errorResponse(error: unknown, fallback: string, status: number) {
  return Response.json(
    { ok: false, error: error instanceof Error ? error.message : fallback },
    { status },
  );
}

// Favourites are per-user, so every verb starts by resolving the session
// cookie to a user id. No session answers 401 ("we don't know who you are"),
// distinct from 400 (malformed request) and 404 (no such location).
async function getUserId(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user.id ?? null;
}

const unauthorised = () =>
  Response.json(
    { ok: false, error: "Sign in to use saved locations." },
    { status: 401 },
  );

export async function GET(request: Request) {
  try {
    const userId = await getUserId(request);

    if (!userId) {
      return unauthorised();
    }

    const searches = await listSavedLocations(userId);
    return Response.json({ ok: true, searches });
  } catch (error) {
    return errorResponse(error, "Could not load saved locations.", 500);
  }
}

export async function POST(request: Request) {
  let locationId: unknown;

  // Malformed JSON in the body throws, so parse inside the try block and
  // answer 400 (caller error) rather than crashing to a 500.
  try {
    const body = (await request.json()) as { locationId?: unknown };
    locationId = body.locationId;
  } catch {
    return Response.json(
      { ok: false, error: "Request body must be JSON." },
      { status: 400 },
    );
  }

  if (typeof locationId !== "string" || locationId.length === 0) {
    return Response.json(
      { ok: false, error: "locationId is required." },
      { status: 400 },
    );
  }

  try {
    const userId = await getUserId(request);

    if (!userId) {
      return unauthorised();
    }

    const found = await setLocationSaved(userId, locationId, true);

    if (!found) {
      return Response.json(
        { ok: false, error: "Location not found." },
        { status: 404 },
      );
    }

    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error, "Could not save this location.", 500);
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get("id");

  if (!locationId) {
    return Response.json(
      { ok: false, error: "id query parameter is required." },
      { status: 400 },
    );
  }

  try {
    const userId = await getUserId(request);

    if (!userId) {
      return unauthorised();
    }

    const found = await setLocationSaved(userId, locationId, false);

    if (!found) {
      return Response.json(
        { ok: false, error: "Location not found." },
        { status: 404 },
      );
    }

    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error, "Could not remove this saved location.", 500);
  }
}
