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

export async function GET() {
  try {
    const searches = await listSavedLocations();
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
    const found = await setLocationSaved(locationId, true);

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
    const found = await setLocationSaved(locationId, false);

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
