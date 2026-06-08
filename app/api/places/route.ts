import {
  rentScoreCategories,
  type RentScoreCategory,
} from "@/app/lib/categories";
import {
  getDistanceMeters,
  scorePlaceGroups,
  type NearbyPlace,
  type PlaceSource,
  type TransportService,
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

type TransitlandRoute = {
  route_short_name?: string;
  route_long_name?: string;
  route_id?: string;
};

type TransitlandTrip = {
  trip_headsign?: string;
  trip_short_name?: string;
  route?: TransitlandRoute;
};

type TransitlandStopTimeEvent = {
  estimated?: string;
  scheduled?: string;
};

type TransitlandDeparture = {
  stop_headsign?: string;
  departure_time?: string;
  departure?: TransitlandStopTimeEvent;
  trip?: TransitlandTrip;
};

type TransitlandStop = {
  id?: number;
  onestop_id?: string;
  stop_id?: string;
  stop_name?: string;
  stop_desc?: string;
  stop_code?: string;
  geometry?: {
    coordinates?: [number, number];
  };
  departures?: TransitlandDeparture[];
};

type TransitlandStopsResponse = {
  stops?: TransitlandStop[];
};

const transportBusRadiusMeters = 500;
const maxTransportBusStops = 4;
const maxTransportBusServicesPerStop = 4;
const transitlandDepartureWindowSeconds = 7200;
const transitlandBaseUrl = "https://transit.land/api/v2/rest";
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

function withTransportServices(
  place: NearbyPlace,
  transportServices: TransportService[],
) {
  return { ...place, transportServices };
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

function getTransitlandStopKey(stop: TransitlandStop) {
  return stop.onestop_id ?? (typeof stop.id === "number" ? String(stop.id) : null);
}

function getTransitlandRouteNumber(departure: TransitlandDeparture) {
  return (
    departure.trip?.route?.route_short_name ??
    departure.trip?.route?.route_id ??
    departure.trip?.trip_short_name ??
    ""
  ).trim();
}

function getTransitlandDestination(departure: TransitlandDeparture) {
  return (
    departure.stop_headsign ??
    departure.trip?.trip_headsign ??
    departure.trip?.route?.route_long_name ??
    ""
  ).trim();
}

function getTransitlandDepartureTime(departure: TransitlandDeparture) {
  return (
    departure.departure?.estimated ??
    departure.departure?.scheduled ??
    departure.departure_time ??
    null
  );
}

function getTransitlandBusServices(departures: TransitlandDeparture[] = []) {
  const servicesByRouteAndDestination = new Map<string, TransportService>();

  for (const departure of departures) {
    const routeNumber = getTransitlandRouteNumber(departure);
    const destination = getTransitlandDestination(departure);

    if (!routeNumber || !destination) {
      continue;
    }

    const key = `${normalizeText(routeNumber)}:${normalizeText(destination)}`;

    if (!servicesByRouteAndDestination.has(key)) {
      servicesByRouteAndDestination.set(key, {
        routeNumber,
        destination,
        departureTime: getTransitlandDepartureTime(departure),
      });
    }

    if (servicesByRouteAndDestination.size >= maxTransportBusServicesPerStop) {
      break;
    }
  }

  return Array.from(servicesByRouteAndDestination.values());
}

async function fetchTransitlandJson<T>({
  apiKey,
  pathName,
  searchParams,
}: {
  apiKey: string;
  pathName: string;
  searchParams: Record<string, string>;
}) {
  const url = new URL(`${transitlandBaseUrl}${pathName}`);

  for (const [key, value] of Object.entries(searchParams)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      apikey: apiKey,
    },
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as T;
}

async function fetchTransitlandBusDepartures({
  apiKey,
  stop,
}: {
  apiKey: string;
  stop: TransitlandStop;
}) {
  const stopKey = getTransitlandStopKey(stop);

  if (!stopKey) {
    return [];
  }

  const data = await fetchTransitlandJson<TransitlandStopsResponse>({
    apiKey,
    pathName: `/stops/${encodeURIComponent(stopKey)}/departures`,
    searchParams: {
      next: String(transitlandDepartureWindowSeconds),
      limit: "20",
      include_geometry: "false",
    },
  });

  return getTransitlandBusServices(data?.stops?.[0]?.departures);
}

async function fetchTransitlandBusStops({
  apiKey,
  latitude,
  longitude,
}: {
  apiKey: string;
  latitude: number;
  longitude: number;
}) {
  const origin = { latitude, longitude };
  const data = await fetchTransitlandJson<TransitlandStopsResponse>({
    apiKey,
    pathName: "/stops",
    searchParams: {
      lat: String(latitude),
      lon: String(longitude),
      radius: String(transportBusRadiusMeters),
      served_by_route_type: "3",
      limit: "20",
    },
  });

  if (!data?.stops) {
    return [];
  }

  const stops = sortPlacesByDistance(
    data.stops.flatMap((stop) => {
      const [stopLongitude, stopLatitude] = stop.geometry?.coordinates ?? [];

      if (
        !stop.stop_name ||
        typeof stopLatitude !== "number" ||
        typeof stopLongitude !== "number"
      ) {
        return [];
      }

      const stopKey = getTransitlandStopKey(stop) ?? stop.stop_id;

      if (!stopKey) {
        return [];
      }

      const distanceMeters = getDistanceMeters(origin, {
        latitude: stopLatitude,
        longitude: stopLongitude,
      });

      if (distanceMeters > transportBusRadiusMeters) {
        return [];
      }

      return [
        {
          stop,
          place: {
            id: `transitland:${stopKey}`,
            name: stop.stop_name,
            address: stop.stop_desc ?? stop.stop_code ?? "Stop details unavailable",
            primaryType: "bus_stop",
            latitude: stopLatitude,
            longitude: stopLongitude,
            distanceMeters,
            rating: null,
            userRatingCount: 0,
            source: "generic" as const,
          },
        },
      ];
    }).map(({ place }) => place),
  ).slice(0, maxTransportBusStops);

  const stopsByPlaceId = new Map<string, TransitlandStop>(
    data.stops.flatMap((stop) => {
      const stopKey = getTransitlandStopKey(stop) ?? stop.stop_id;
      return stopKey ? [[`transitland:${stopKey}`, stop] as const] : [];
    }),
  );

  return Promise.all(
    stops.map(async (place) => {
      const stop = stopsByPlaceId.get(place.id);
      const transportServices = stop
        ? await fetchTransitlandBusDepartures({ apiKey, stop })
        : [];

      return withTransportServices(place, transportServices);
    }),
  );
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
  const [busResults, metroResults, vlineResults, transitlandBusStops] =
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
    transitlandApiKey
      ? fetchTransitlandBusStops({
          apiKey: transitlandApiKey,
          latitude,
          longitude,
        }).catch(() => [])
      : Promise.resolve([]),
  ]);

  const googleBusStops = sortPlacesByDistance(
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
  const busStops =
    transitlandBusStops.length > 0 ? transitlandBusStops : googleBusStops;
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
