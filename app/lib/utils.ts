import type { NearbyPlace, PlaceGroup } from "./types";

export function formatDistance(distanceMeters: number) {
  return distanceMeters < 1000
    ? `${distanceMeters} m`
    : `${(distanceMeters / 1000).toFixed(1)} km`;
}

export function formatRadius(radiusMeters: number) {
  return radiusMeters < 1000
    ? `${radiusMeters} m`
    : `${radiusMeters / 1000} km`;
}

export function formatReviewSummary(place: NearbyPlace) {
  if (place.userRatingCount === 0) {
    return "No reviews";
  }

  const rating = place.rating === null ? "" : `${place.rating.toFixed(1)} rating, `;
  const reviewLabel = place.userRatingCount === 1 ? "review" : "reviews";

  return `${rating}${place.userRatingCount.toLocaleString()} ${reviewLabel}`;
}

export function formatGroupScope(group: PlaceGroup) {
  if (group.id === "transport") {
    return "bus stops within 1 km or closest found + nearest stations";
  }

  return `${group.places.length} found within ${formatRadius(group.radiusMeters)}`;
}

export function formatPlaceType(primaryType: string) {
  return primaryType.replaceAll("_", " ");
}

export function formatDepartureTime(value: string | null) {
  if (!value) {
    return null;
  }

  const gtfsTime = value.match(/^(\d{1,2}):(\d{2})/);

  if (gtfsTime) {
    return `${gtfsTime[1].padStart(2, "0")}:${gtfsTime[2]}`;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function parseCoordinate(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replaceAll("&", "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function normalizeStationName(value: string) {
  return normalizeText(value)
    .replace(/\b(railway|train|metro|v line|vline)\b/g, " ")
    .replace(/\bstation\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
