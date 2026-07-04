import { getComparisonSide } from "@/app/lib/services/searchStore";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const aId = searchParams.get("a");
  const bId = searchParams.get("b");

  if (!aId || !bId) {
    return Response.json(
      { ok: false, error: "Both a and b location ids are required." },
      { status: 400 },
    );
  }

  if (aId === bId) {
    return Response.json(
      { ok: false, error: "Pick two different locations to compare." },
      { status: 400 },
    );
  }

  try {
    // Both lookups run in parallel; total time is the slower of the two,
    // not the sum.
    const [a, b] = await Promise.all([
      getComparisonSide(aId),
      getComparisonSide(bId),
    ]);

    if (!a || !b) {
      return Response.json(
        { ok: false, error: "One of the locations was not found." },
        { status: 404 },
      );
    }

    return Response.json({ ok: true, a, b });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not compare these locations.",
      },
      { status: 500 },
    );
  }
}
