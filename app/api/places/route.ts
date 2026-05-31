import {
  rentScoreCategories,
  searchRadiusMeters,
  type RentScoreCategory,
} from "@/app/lib/categories";
import {
  getDistanceMeters,
  scorePlaceGroups,
  type NearbyPlace,
  type PlaceSource,
} from "@/app/lib/scoring";

type GooglePlace = {
  id?: string;
  displayName?: {
    text?: string;
  };
  formattedAddress?: string;
  location?: {
    latitude?: number;
    longitude?: number;
  };
  primaryType?: string;
};

type GooglePlacesResponse = {
  places?: GooglePlace[];
  error?: {
    message?: string;
    status?: string;
  };
};

function parseCoordinate(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replaceAll("&", "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function placeMatchesBrand(placeName: string, brandTerm: string) {
  return normalizeText(placeName).includes(normalizeText(brandTerm));
}

async function fetchPlacesForBrand({
  apiKey,
  brandTerm,
  latitude,
  longitude,
}: {
  apiKey: string;
  brandTerm: string;
  latitude: number;
  longitude: number;
}) {
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.location,places.primaryType",
    },
    body: JSON.stringify({
      textQuery: brandTerm,
      pageSize: 3,
      locationBias: {
        circle: {
          center: {
            latitude,
            longitude,
          },
          radius: searchRadiusMeters,
        },
      },
      regionCode: "AU",
    }),
  });

  const data = (await response.json()) as GooglePlacesResponse;

  if (!response.ok) {
    throw new Error(data.error?.message ?? "Places text search failed.");
  }

  return data.places ?? [];
}

async function fetchPlacesForTypes({
  apiKey,
  placeTypes,
  latitude,
  longitude,
}: {
  apiKey: string;
  placeTypes: string[];
  latitude: number;
  longitude: number;
}) {
  const response = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.location,places.primaryType",
    },
    body: JSON.stringify({
      includedTypes: placeTypes,
      maxResultCount: 10,
      locationRestriction: {
        circle: {
          center: {
            latitude,
            longitude,
          },
          radius: searchRadiusMeters,
        },
      },
      regionCode: "AU",
    }),
  });

  const data = (await response.json()) as GooglePlacesResponse;

  if (!response.ok) {
    throw new Error(data.error?.message ?? "Places nearby search failed.");
  }

  return data.places ?? [];
}

function addPlaceToMap({
  placesById,
  place,
  origin,
  source,
  brandTerm,
}: {
  placesById: Map<string, NearbyPlace>;
  place: GooglePlace;
  origin: { latitude: number; longitude: number };
  source: PlaceSource;
  brandTerm?: string;
}) {
  const placeLatitude = place.location?.latitude;
  const placeLongitude = place.location?.longitude;

  if (
    !place.id ||
    !place.displayName?.text ||
    typeof placeLatitude !== "number" ||
    typeof placeLongitude !== "number"
  ) {
    return;
  }

  if (brandTerm && !placeMatchesBrand(place.displayName.text, brandTerm)) {
    return;
  }

  const distanceMeters = getDistanceMeters(origin, {
    latitude: placeLatitude,
    longitude: placeLongitude,
  });

  if (distanceMeters > searchRadiusMeters) {
    return;
  }

  const existing = placesById.get(place.id);

  if (existing?.source === "brand" && source === "generic") {
    return;
  }

  placesById.set(place.id, {
    id: place.id,
    name: place.displayName.text,
    address: place.formattedAddress ?? "Address unavailable",
    primaryType: place.primaryType ?? "place",
    distanceMeters,
    source,
  });
}

async function fetchPlacesForCategory({
  apiKey,
  category,
  latitude,
  longitude,
}: {
  apiKey: string;
  category: RentScoreCategory;
  latitude: number;
  longitude: number;
}) {
  const origin = { latitude, longitude };
  const placesById = new Map<string, NearbyPlace>();

  const [brandResults, genericPlaces] = await Promise.all([
    Promise.all(
      category.brandTerms.map(async (brandTerm) => ({
        brandTerm,
        places: await fetchPlacesForBrand({
          apiKey,
          brandTerm,
          latitude,
          longitude,
        }),
      })),
    ),
    fetchPlacesForTypes({
      apiKey,
      placeTypes: category.placeTypes,
      latitude,
      longitude,
    }),
  ]);

  for (const place of genericPlaces) {
    addPlaceToMap({
      placesById,
      place,
      origin,
      source: "generic",
    });
  }

  for (const brandResult of brandResults) {
    for (const place of brandResult.places) {
      addPlaceToMap({
        placesById,
        place,
        origin,
        source: "brand",
        brandTerm: brandResult.brandTerm,
      });
    }
  }

  return {
    id: category.id,
    label: category.label,
    places: Array.from(placesById.values()).sort(
      (a, b) => a.distanceMeters - b.distanceMeters,
    ),
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const latitude = parseCoordinate(searchParams.get("lat"));
  const longitude = parseCoordinate(searchParams.get("lng"));

  if (latitude === null || longitude === null) {
    return Response.json(
      { ok: false, error: "Latitude and longitude are required." },
      { status: 400 },
    );
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return Response.json(
      {
        ok: false,
        error: "Missing GOOGLE_MAPS_API_KEY in .env.local.",
      },
      { status: 500 },
    );
  }

  try {
    const groups = await Promise.all(
      rentScoreCategories.map((category) =>
        fetchPlacesForCategory({
          apiKey,
          category,
          latitude,
          longitude,
        }),
      ),
    );
    const { overallScore, scores } = scorePlaceGroups(groups);

    return Response.json({ ok: true, groups, scores, overallScore });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not retrieve nearby places.",
      },
      { status: 502 },
    );
  }
}
