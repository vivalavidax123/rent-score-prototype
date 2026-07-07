import {
  rentScoreCategories,
  type RentScoreCategory,
  type WeightProfile,
} from "@/app/lib/categories";
import {
  getDistanceMeters,
  scorePlaceGroups,
} from "@/app/lib/scoring";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseCoordinate, normalizeStationName, normalizeText } from "@/app/lib/utils";
import { fetchPlacesForBrand, fetchPlacesForTypes } from "@/app/lib/services/googlePlaces";
import { fetchTransitlandBusStops } from "@/app/lib/services/transitland";
import { auth } from "@/app/lib/auth";
import {
  buildCacheKey,
  findFreshSnapshot,
  recordUserSearch,
  saveSnapshot,
} from "@/app/lib/services/searchStore";
import type { GooglePlace, NearbyPlace, PlaceSource } from "@/app/lib/types";

const transportBusRadiusMeters = 1000;
const transportBusFallbackRadiusMeters = 5000;
const maxTransportBusStops = 4;

let vlineStationNamesPromise: Promise<Set<string>> | null = null;

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

  if (category.excludedPrimaryTypes?.includes(place.primaryType ?? "")) {
    return;
  }

  if (
    category.id !== "transport" &&
    (typeof place.userRatingCount !== "number" || place.userRatingCount < 30)
  ) {
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
  const transitlandApiKey = process.env.TRANSITLAND_API_KEY;
  const [nearbyBusResults, fallbackBusResults, metroResults, vlineResults] =
    await Promise.all([
    fetchPlacesForTypes({
      apiKey,
      category,
      placeTypes: ["bus_stop", "bus_station"],
      latitude,
      longitude,
      radiusMeters: transportBusRadiusMeters,
    }),
    fetchPlacesForTypes({
      apiKey,
      category,
      placeTypes: ["bus_stop", "bus_station"],
      latitude,
      longitude,
      radiusMeters: transportBusFallbackRadiusMeters,
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
  const transitlandBusStops =
    transitlandApiKey
      ? await fetchTransitlandBusStops({
          apiKey: transitlandApiKey,
          latitude,
          longitude,
          radiusMeters: transportBusRadiusMeters,
        }).catch(() => [])
      : [];
  const transitlandFallbackBusStops =
    transitlandApiKey && transitlandBusStops.length === 0
      ? await fetchTransitlandBusStops({
          apiKey: transitlandApiKey,
          latitude,
          longitude,
          radiusMeters: transportBusFallbackRadiusMeters,
        }).catch(() => [])
      : [];
  const transitlandPreferredBusStops =
    transitlandBusStops.length > 0
      ? transitlandBusStops
      : transitlandFallbackBusStops;

  const nearbyGoogleBusStops = sortPlacesByDistance(
    collectPlaces({
      googlePlaces: nearbyBusResults,
      origin,
      category,
      source: "generic",
      radiusMeters: transportBusRadiusMeters,
    }),
  )
    .slice(0, maxTransportBusStops)
    .map((place) => withPrimaryType(place, "bus_stop"));
  const fallbackGoogleBusStops = sortPlacesByDistance(
    collectPlaces({
      googlePlaces: fallbackBusResults,
      origin,
      category,
      source: "generic",
      radiusMeters: transportBusFallbackRadiusMeters,
    }),
  )
    .slice(0, maxTransportBusStops)
    .map((place) => withPrimaryType(place, "bus_stop"));
  const googleBusStops =
    nearbyGoogleBusStops.length > 0
      ? nearbyGoogleBusStops
      : fallbackGoogleBusStops;
  const busStops =
    transitlandPreferredBusStops.length > 0
      ? transitlandPreferredBusStops
      : googleBusStops;

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

function parseProfile(value: string | null): WeightProfile {
  return value === "carOwner" ? "carOwner" : "carFree";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const latitude = parseCoordinate(searchParams.get("lat"));
  const longitude = parseCoordinate(searchParams.get("lng"));
  const profile = parseProfile(searchParams.get("profile"));

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

  const cacheKey = buildCacheKey(latitude, longitude);

  // Search history is per-account; a failed session read just means the
  // search is treated as anonymous and not recorded.
  const session = await auth.api
    .getSession({ headers: request.headers })
    .catch(() => null);
  const userId = session?.user.id ?? null;

  // History writes must never break the search itself — same degradation
  // philosophy as the snapshot cache below.
  const recordSearch = async () => {
    if (userId) {
      await recordUserSearch(userId, cacheKey).catch((error) => {
        console.error("Recording search history failed:", error);
      });
    }
  };

  // A database problem should degrade to a normal Google lookup, not break
  // the search, so cache reads and writes never throw past this point.
  try {
    const cachedResult = await findFreshSnapshot(cacheKey);

    if (cachedResult) {
      // Cached raw places, freshly scored with the requested profile.
      const { overallScore, scores } = scorePlaceGroups(
        cachedResult.groups,
        profile,
      );

      await recordSearch();

      return Response.json({
        ok: true,
        groups: cachedResult.groups,
        scores,
        overallScore,
        cached: true,
        fetchedAt: cachedResult.fetchedAt,
      });
    }
  } catch (error) {
    console.error("Search cache lookup failed:", error);
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
    const { overallScore, scores } = scorePlaceGroups(groups, profile);

    // Snapshots always store the carFree view (the product's primary
    // audience) so history and comparisons share one yardstick regardless
    // of which profile triggered the fetch.
    const canonical =
      profile === "carFree"
        ? { overallScore, scores }
        : scorePlaceGroups(groups, "carFree");

    const fallbackLabel = `${latitude}, ${longitude}`;

    try {
      await saveSnapshot({
        cacheKey,
        locationInput: {
          query: searchParams.get("query") ?? fallbackLabel,
          formattedAddress: searchParams.get("address") ?? fallbackLabel,
          placeId: searchParams.get("placeId") ?? "",
          locationType: searchParams.get("locationType") ?? "UNKNOWN",
          latitude,
          longitude,
        },
        groups,
        scores: canonical.scores,
        overallScore: canonical.overallScore,
      });
    } catch (error) {
      console.error("Saving search result failed:", error);
    }

    // After saveSnapshot so the location row exists to attach history to.
    await recordSearch();

    return Response.json({
      ok: true,
      groups,
      scores,
      overallScore,
      cached: false,
      fetchedAt: new Date().toISOString(),
    });
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
