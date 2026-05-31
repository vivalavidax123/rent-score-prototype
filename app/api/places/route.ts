import {
  rentScoreCategories,
  type RentScoreCategory,
} from "@/app/lib/categories";
import {
  getDistanceMeters,
  scorePlaceGroups,
  type NearbyPlace,
  type PlaceSource,
} from "@/app/lib/scoring";
import { readFile } from "node:fs/promises";
import path from "node:path";

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
  rating?: number;
  userRatingCount?: number;
};

type GooglePlacesResponse = {
  places?: GooglePlace[];
  error?: {
    message?: string;
    status?: string;
  };
};

const transportBusRadiusMeters = 500;
const maxTransportBusStops = 4;
let vlineStationNamesPromise: Promise<Set<string>> | null = null;

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

function normalizeStationName(value: string) {
  return normalizeText(value)
    .replace(/\b(railway|train|metro|v line|vline)\b/g, " ")
    .replace(/\bstation\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function getVlineStationNames() {
  if (!vlineStationNamesPromise) {
    vlineStationNamesPromise = readFile(
      path.join(process.cwd(), "app", "lib", "vline-stations.txt"),
      "utf8",
    ).then((content) => {
      const names = content
        .split(/\r?\n/)
        .map((line) => normalizeStationName(line))
        .filter(Boolean);

      return new Set(names);
    });
  }

  return vlineStationNamesPromise;
}

async function isVlineStationName(placeName: string) {
  const stationNames = await getVlineStationNames();
  return stationNames.has(normalizeStationName(placeName));
}

function placeMatchesBrand(placeName: string, brandTerm: string) {
  return normalizeText(placeName).includes(normalizeText(brandTerm));
}

async function fetchPlacesForBrand({
  apiKey,
  category,
  brandTerm,
  latitude,
  longitude,
  radiusMeters = category.radiusMeters,
}: {
  apiKey: string;
  category: RentScoreCategory;
  brandTerm: string;
  latitude: number;
  longitude: number;
  radiusMeters?: number;
}) {
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.rating,places.userRatingCount",
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
          radius: radiusMeters,
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
  category,
  placeTypes,
  latitude,
  longitude,
  radiusMeters = category.radiusMeters,
}: {
  apiKey: string;
  category: RentScoreCategory;
  placeTypes: string[];
  latitude: number;
  longitude: number;
  radiusMeters?: number;
}) {
  const response = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.rating,places.userRatingCount",
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
          radius: radiusMeters,
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
  category,
  source,
  brandTerm,
  radiusMeters = category.radiusMeters,
}: {
  placesById: Map<string, NearbyPlace>;
  place: GooglePlace;
  origin: { latitude: number; longitude: number };
  category: RentScoreCategory;
  source: PlaceSource;
  brandTerm?: string;
  radiusMeters?: number | null;
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

  if (radiusMeters !== null && distanceMeters > radiusMeters) {
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
    latitude: placeLatitude,
    longitude: placeLongitude,
    distanceMeters,
    rating: typeof place.rating === "number" ? place.rating : null,
    userRatingCount:
      typeof place.userRatingCount === "number" ? place.userRatingCount : 0,
    source,
  });
}

function sortPlacesByDistance(places: NearbyPlace[]) {
  return [...places].sort((a, b) => a.distanceMeters - b.distanceMeters);
}

function sortPlacesForDisplay(places: NearbyPlace[]) {
  return [...places].sort((a, b) => {
    if (b.userRatingCount !== a.userRatingCount) {
      return b.userRatingCount - a.userRatingCount;
    }

    if ((b.rating ?? 0) !== (a.rating ?? 0)) {
      return (b.rating ?? 0) - (a.rating ?? 0);
    }

    return a.distanceMeters - b.distanceMeters;
  });
}

function withPrimaryType(place: NearbyPlace, primaryType: string) {
  return { ...place, primaryType };
}

function collectPlaces({
  googlePlaces,
  origin,
  category,
  source,
  brandTerm,
  radiusMeters,
}: {
  googlePlaces: GooglePlace[];
  origin: { latitude: number; longitude: number };
  category: RentScoreCategory;
  source: PlaceSource;
  brandTerm?: string;
  radiusMeters?: number | null;
}) {
  const placesById = new Map<string, NearbyPlace>();

  for (const place of googlePlaces) {
    addPlaceToMap({
      placesById,
      place,
      origin,
      category,
      source,
      brandTerm,
      radiusMeters,
    });
  }

  return Array.from(placesById.values());
}

async function fetchPlacesForTransportCategory({
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
  const [busResults, metroResults, vlineResults] = await Promise.all([
    fetchPlacesForTypes({
      apiKey,
      category,
      placeTypes: ["bus_station"],
      latitude,
      longitude,
      radiusMeters: transportBusRadiusMeters,
    }),
    fetchPlacesForTypes({
      apiKey,
      category,
      placeTypes: ["train_station", "subway_station"],
      latitude,
      longitude,
    }),
    fetchPlacesForBrand({
      apiKey,
      category,
      brandTerm: "V/Line station",
      latitude,
      longitude,
    }),
  ]);

  const busStops = sortPlacesByDistance(
    collectPlaces({
      googlePlaces: busResults,
      origin,
      category,
      source: "generic",
      radiusMeters: transportBusRadiusMeters,
    }),
  )
    .slice(0, maxTransportBusStops)
    .map((place) => withPrimaryType(place, "bus_stop"));
  const railPlaces = sortPlacesByDistance(
    collectPlaces({
      googlePlaces: metroResults,
      origin,
      category,
      source: "generic",
    }),
  );
  const vlineCandidatePlaces = sortPlacesByDistance([
    ...railPlaces,
    ...collectPlaces({
      googlePlaces: vlineResults,
      origin,
      category,
      source: "brand",
      radiusMeters: null,
    }),
  ]);
  const nearestVlineStation = (
    await Promise.all(
      vlineCandidatePlaces.map(async (place) =>
        (await isVlineStationName(place.name))
          ? withPrimaryType(place, "vline_station")
          : null,
      ),
    )
  ).find((place) => place !== null);
  const nearestMetroStation = (
    await Promise.all(
      railPlaces.map(async (place) =>
        (await isVlineStationName(place.name))
          ? null
          : withPrimaryType(place, "metro_train_station"),
      ),
    )
  ).find((place) => place !== null);

  const placesById = new Map<string, NearbyPlace>();

  for (const place of [
    ...busStops,
    nearestMetroStation,
    nearestVlineStation,
  ]) {
    if (place) {
      placesById.set(place.id, place);
    }
  }

  return {
    id: category.id,
    label: category.label,
    radiusMeters: category.radiusMeters,
    places: Array.from(placesById.values()),
  };
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
  if (category.id === "transport") {
    return fetchPlacesForTransportCategory({
      apiKey,
      category,
      latitude,
      longitude,
    });
  }

  const origin = { latitude, longitude };
  const placesById = new Map<string, NearbyPlace>();

  const [brandResults, genericPlaces] = await Promise.all([
    Promise.all(
      category.brandTerms.map(async (brandTerm) => ({
        brandTerm,
        places: await fetchPlacesForBrand({
          apiKey,
          category,
          brandTerm,
          latitude,
          longitude,
        }),
      })),
    ),
    fetchPlacesForTypes({
      apiKey,
      category,
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
      category,
      source: "generic",
    });
  }

  for (const brandResult of brandResults) {
    for (const place of brandResult.places) {
      addPlaceToMap({
        placesById,
        place,
        origin,
        category,
        source: "brand",
        brandTerm: brandResult.brandTerm,
      });
    }
  }

  return {
    id: category.id,
    label: category.label,
    radiusMeters: category.radiusMeters,
    places: sortPlacesForDisplay(Array.from(placesById.values())),
  };
}

function assignPlacesToPrimaryCategories(
  groups: Awaited<ReturnType<typeof fetchPlacesForCategory>>[],
) {
  const assignedPlaceIds = new Set<string>();

  return groups.map((group) => {
    const places = group.places.filter((place) => {
      if (assignedPlaceIds.has(place.id)) {
        return false;
      }

      assignedPlaceIds.add(place.id);
      return true;
    });

    return { ...group, places };
  });
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
    const fetchedGroups = await Promise.all(
      rentScoreCategories.map((category) =>
        fetchPlacesForCategory({
          apiKey,
          category,
          latitude,
          longitude,
        }),
      ),
    );
    const groups = assignPlacesToPrimaryCategories(fetchedGroups);
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
