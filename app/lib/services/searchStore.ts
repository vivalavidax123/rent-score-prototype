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

// The cache hands back the raw place data only. Scores are cheap to
// recompute and depend on the requested weight profile, so the API route
// rescores on every hit instead of reusing the stored (balanced) scores.
export type CachedSearchResult = {
  groups: PlaceGroup[];
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
  snapshots: { overallScore: number }[];
};

// savedAt is per-user (UserSavedLocation join table), so it arrives as a
// separate argument instead of living on the location row.
function toRecentSearch(
  location: LocationWithLatestSnapshot,
  savedAt: Date | null,
): RecentSearch {
  return {
    id: location.id,
    query: location.query,
    formattedAddress: location.formattedAddress,
    placeId: location.placeId,
    locationType: location.locationType,
    latitude: location.latitude,
    longitude: location.longitude,
    lastSearchedAt: location.lastSearchedAt.toISOString(),
    savedAt: savedAt?.toISOString() ?? null,
    // A location can exist without a snapshot (snapshots are cleared when
    // the scoring algorithm changes). It must still be listed — a saved
    // place should never disappear because of cache state.
    overallScore: location.snapshots[0]?.overallScore ?? null,
  };
}

// Search history is per-account (UserSearch rows), so a new account starts
// blank and never sees other users' searches. Signed-out visitors get an
// empty list — the shared SearchLocation rows are a score cache, not a feed.
export async function listRecentSearches(
  userId: string | null,
  limit = 8,
): Promise<RecentSearch[]> {
  if (!userId) {
    return [];
  }

  const rows = await prisma.userSearch.findMany({
    where: { userId },
    orderBy: { lastSearchedAt: "desc" },
    take: limit,
    include: {
      location: {
        include: {
          snapshots: { orderBy: { createdAt: "desc" }, take: 1 },
          savedBy: { where: { userId }, take: 1 },
        },
      },
    },
  });

  return rows.map((row) =>
    toRecentSearch(
      // The chip should show when *this user* last searched the spot, not
      // when anyone did, so the row's timestamp overrides the location's.
      { ...row.location, lastSearchedAt: row.lastSearchedAt },
      row.location.savedBy[0]?.savedAt ?? null,
    ),
  );
}

// Called after a successful search by a signed-in user. Upserts so
// re-searching a spot bumps it to the top instead of duplicating it. The
// location row is created by saveSnapshot; if that failed (or the cache row
// vanished) there is nothing to attach history to, so it is a silent no-op.
export async function recordUserSearch(userId: string, cacheKey: string) {
  const location = await prisma.searchLocation.findUnique({
    where: { cacheKey },
    select: { id: true },
  });

  if (!location) {
    return;
  }

  await prisma.userSearch.upsert({
    where: { userId_locationId: { userId, locationId: location.id } },
    update: { lastSearchedAt: new Date() },
    create: { userId, locationId: location.id },
  });
}

export async function listSavedLocations(
  userId: string,
): Promise<RecentSearch[]> {
  const rows = await prisma.userSavedLocation.findMany({
    where: { userId },
    orderBy: { savedAt: "desc" },
    include: {
      location: {
        include: { snapshots: { orderBy: { createdAt: "desc" }, take: 1 } },
      },
    },
  });

  return rows.map((row) => toRecentSearch(row.location, row.savedAt));
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

// Saving upserts the user's star row (idempotent — saving twice is fine);
// unsaving deletes it. Returns false when the location id does not exist
// (P2003 foreign-key violation on create, P2025 missing row on delete) so
// the API can answer 404 instead of 500.
export async function setLocationSaved(
  userId: string,
  locationId: string,
  saved: boolean,
) {
  try {
    if (saved) {
      await prisma.userSavedLocation.upsert({
        where: { userId_locationId: { userId, locationId } },
        update: {},
        create: { userId, locationId },
      });
    } else {
      await prisma.userSavedLocation.delete({
        where: { userId_locationId: { userId, locationId } },
      });
    }
    return true;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2025" || error.code === "P2003")
    ) {
      return false;
    }

    throw error;
  }
}
