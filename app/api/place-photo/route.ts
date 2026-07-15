type GoogleAuthorAttribution = {
  displayName?: string;
  uri?: string;
};

type GooglePhoto = {
  name?: string;
  authorAttributions?: GoogleAuthorAttribution[];
};

type PlaceDetailsResponse = {
  photos?: GooglePhoto[];
  error?: { message?: string };
};

type PhotoMediaResponse = {
  photoUri?: string;
  error?: { message?: string };
};

const placeIdPattern = /^[A-Za-z0-9_-]{10,256}$/;

function noStoreJson(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function normalizeAttributionUri(uri: string | undefined) {
  if (!uri) {
    return null;
  }

  try {
    const url = new URL(uri.startsWith("//") ? `https:${uri}` : uri);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const placeId = new URL(request.url).searchParams.get("placeId") ?? "";

  if (!apiKey) {
    return noStoreJson({ error: "Place photos are not configured." }, 503);
  }

  if (!placeIdPattern.test(placeId)) {
    return noStoreJson({ error: "Invalid place ID." }, 400);
  }

  const detailsResponse = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
    {
      cache: "no-store",
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "photos",
      },
    },
  );
  const details = (await detailsResponse.json()) as PlaceDetailsResponse;

  if (!detailsResponse.ok) {
    return noStoreJson(
      { error: details.error?.message ?? "Could not retrieve place photos." },
      detailsResponse.status,
    );
  }

  const photo = details.photos?.[0];
  const expectedPrefix = `places/${placeId}/photos/`;

  if (!photo?.name || !photo.name.startsWith(expectedPrefix)) {
    return noStoreJson({ error: "No photo is available for this place." }, 404);
  }

  const mediaUrl = new URL(
    `https://places.googleapis.com/v1/${photo.name}/media`,
  );
  mediaUrl.searchParams.set("maxWidthPx", "480");
  mediaUrl.searchParams.set("maxHeightPx", "260");
  mediaUrl.searchParams.set("skipHttpRedirect", "true");
  mediaUrl.searchParams.set("key", apiKey);

  const mediaResponse = await fetch(mediaUrl, { cache: "no-store" });
  const media = (await mediaResponse.json()) as PhotoMediaResponse;

  if (!mediaResponse.ok || !media.photoUri) {
    return noStoreJson(
      { error: media.error?.message ?? "Could not load the place photo." },
      mediaResponse.ok ? 502 : mediaResponse.status,
    );
  }

  return noStoreJson({
    imageUrl: media.photoUri,
    attributions: (photo.authorAttributions ?? [])
      .filter((attribution) => Boolean(attribution.displayName))
      .map((attribution) => ({
        displayName: attribution.displayName as string,
        uri: normalizeAttributionUri(attribution.uri),
      })),
  });
}
