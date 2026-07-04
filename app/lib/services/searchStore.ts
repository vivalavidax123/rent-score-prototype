import { Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/db";
import type { CategoryScore, PlaceGroup, RecentSearch } from "@/app/lib/types";

// Cached score results are reused for this long before Google is queried
// again. Nearby amenities change slowly, so a day-old result is still useful.
const cacheTtlMs = 24 * 60 * 60 * 1000;

export type SearchLocationInput = {
  query: string;
  formattedAddress: string;
  placeId: string;
  locationType: string;
  latitude: number;
  longitude: number;
};

export type CachedSearchResult = {
  groups: PlaceGroup[];
  scores: CategoryScore[];
  overallScore: number;
  fetchedAt: string;
};

// Coordinates rounded to 4 decimal places (~11 metres) so searches of the
// same address map to the same cache row even if geocoding jitters slightly.
export function buildCacheKey(latitude: number, longitude: number) {
  return `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
}

export async function findFreshSnapshot(
  cacheKey: string,
): Promise<CachedSearchResult | null> {
  const location = await prisma.searchLocation.findUnique({
    where: { cacheKey },
    include: { snapshots: { orderBy: { createdAt: "desc" }, take: 1 } },
  });

  const snapshot = location?.snapshots[0];

  if (!location || !snapshot) {
    return null;
  }

  if (Date.now() - snapshot.createdAt.getTime() > cacheTtlMs) {
    return null;
  }

  await prisma.searchLocation.update({
    where: { id: location.id },
    data: { lastSearchedAt: new Date() },
  });

  return {
    groups: JSON.parse(snapshot.groupsJson) as PlaceGroup[],
    scores: JSON.parse(snapshot.scoresJson) as CategoryScore[],
    overallScore: snapshot.overallScore,
    fetchedAt: snapshot.createdAt.toISOString(),
  };
}

export async function saveSnapshot({
  cacheKey,
  locationInput,
  groups,
  scores,
  overallScore,
}: {
  cacheKey: string;
  locationInput: SearchLocationInput;
  groups: PlaceGroup[];
  scores: CategoryScore[];
  overallScore: number;
}) {
  const location = await prisma.searchLocation.upsert({
    where: { cacheKey },
    update: {
      lastSearchedAt: new Date(),
      query: locationInput.query,
      formattedAddress: locationInput.formattedAddress,
      placeId: locationInput.placeId,
      locationType: locationInput.locationType,
    },
    create: { cacheKey, ...locationInput },
  });

  await prisma.scoreSnapshot.create({
    data: {
      locationId: location.id,
      overallScore,
      scoresJson: JSON.stringify(scores),
      groupsJson: JSON.stringify(groups),
    },
  });
}

type LocationWithLatestSnapshot = {
  id: string;
  query: string;
  formattedAddress: string;
  placeId: string;
  locationType: string;
  latitude: number;
  longitude: number;
  lastSearchedAt: Date;
  savedAt: Date | null;
  snapshots: { overallScore: number }[];
};

function toRecentSearch(location: LocationWithLatestSnapshot): RecentSearch {
  return {
    id: location.id,
    query: location.query,
    formattedAddress: location.formattedAddress,
    placeId: location.placeId,
    locationType: location.locationType,
    latitude: location.latitude,
    longitude: location.longitude,
    lastSearchedAt: location.lastSearchedAt.toISOString(),
    savedAt: location.savedAt?.toISOString() ?? null,
    overallScore: location.snapshots[0].overallScore,
  };
}

export async function listRecentSearches(limit = 8): Promise<RecentSearch[]> {
  const locations = await prisma.searchLocation.findMany({
    orderBy: { lastSearchedAt: "desc" },
    take: limit,
    include: { snapshots: { orderBy: { createdAt: "desc" }, take: 1 } },
  });

  return locations
    .filter((location) => location.snapshots.length > 0)
    .map(toRecentSearch);
}

export async function listSavedLocations(): Promise<RecentSearch[]> {
  const locations = await prisma.searchLocation.findMany({
    where: { savedAt: { not: null } },
    orderBy: { savedAt: "desc" },
    include: { snapshots: { orderBy: { createdAt: "desc" }, take: 1 } },
  });

  return locations
    .filter((location) => location.snapshots.length > 0)
    .map(toRecentSearch);
}

// Full category scores for one location, for the comparison view. Returns
// null when the id is unknown or the location has no snapshot yet.
export async function getComparisonSide(id: string) {
  const location = await prisma.searchLocation.findUnique({
    where: { id },
    include: { snapshots: { orderBy: { createdAt: "desc" }, take: 1 } },
  });

  const snapshot = location?.snapshots[0];

  if (!location || !snapshot) {
    return null;
  }

  return {
    id: location.id,
    query: location.query,
    formattedAddress: location.formattedAddress,
    overallScore: snapshot.overallScore,
    scores: JSON.parse(snapshot.scoresJson) as CategoryScore[],
    fetchedAt: snapshot.createdAt.toISOString(),
  };
}

// Saving writes the current time; unsaving writes null. Returns false when
// the location id does not exist so the API can answer 404 instead of 500.
export async function setLocationSaved(id: string, saved: boolean) {
  try {
    await prisma.searchLocation.update({
      where: { id },
      data: { savedAt: saved ? new Date() : null },
    });
    return true;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return false;
    }

    throw error;
  }
}
