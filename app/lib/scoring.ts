import { rentScoreCategories } from "./categories";
import type { PlaceGroup, NearbyPlace } from "./types";

// V3 scoring: every pillar is a continuous curve so that no 1-metre or
// 0.01-rating difference can ever jump the score by a whole tier. The
// constants here are first-pass calibration values, tuned against real
// snapshots of a CBD, an established suburb, and a new estate.

// Within this distance a place counts as genuinely walkable: full points.
const walkableRadiusMeters = 400;

// Categories where more choice keeps mattering (cafes, gyms) saturate
// slower than categories where two options are already plenty.
const highVarietyCategories = ["food", "fitness"];

function getProximityScore(
  closestDistanceMeters: number | null,
  radiusMeters: number,
) {
  if (closestDistanceMeters === null) {
    return 0;
  }

  if (closestDistanceMeters <= walkableRadiusMeters) {
    return 50;
  }

  // Exponential decay: the score halves every halfLifeMeters past the
  // walkable ring. Wider-radius categories (shopping centres) decay slower.
  const halfLifeMeters = 0.4 * radiusMeters;
  const metersPastWalkable = closestDistanceMeters - walkableRadiusMeters;

  return 50 * 2 ** (-metersPastWalkable / halfLifeMeters);
}

function getVarietyScore(count: number, categoryId: string) {
  if (count === 0) {
    return 0;
  }

  // Diminishing returns: every extra place still adds something, but the
  // 10th adds far less than the 2nd. Never fully saturates.
  const saturationCount = highVarietyCategories.includes(categoryId) ? 6 : 3;

  return 30 * (1 - Math.exp(-count / saturationCount));
}

function getQualityScore(places: NearbyPlace[], typicalRating: number) {
  if (places.length === 0) {
    return 0;
  }

  const topRatings = places
    .map((place) => place.rating)
    .filter((rating): rating is number => typeof rating === "number")
    .sort((a, b) => b - a)
    .slice(0, 3);

  // No rating data (e.g. bus stops): neutral midpoint, not free full marks.
  if (topRatings.length === 0) {
    return 10;
  }

  const avgRating =
    topRatings.reduce((sum, rating) => sum + rating, 0) / topRatings.length;

  // Compare against what is normal for this kind of place (banks trend low,
  // gyms trend high), so review culture cancels out: 0.8 above the category
  // baseline reaches 20, 0.8 below reaches 0.
  return Math.max(0, Math.min(20, 10 + 12.5 * (avgRating - typicalRating)));
}

function getExplanation(count: number, closestDistanceMeters: number | null) {
  if (count === 0 || closestDistanceMeters === null) {
    return "No nearby matches were found within the search radius.";
  }

  const distance =
    closestDistanceMeters < 1000
      ? `${closestDistanceMeters} m`
      : `${(closestDistanceMeters / 1000).toFixed(1)} km`;

  return `${count} nearby match${count === 1 ? "" : "es"} found; closest is ${distance} away.`;
}

export function scorePlaceGroups(groups: PlaceGroup[]) {
  const scores = rentScoreCategories.map((category) => {
    const group = groups.find((candidate) => candidate.id === category.id);
    const places = group?.places ?? [];
    const closestDistanceMeters =
      places.length > 0
        ? Math.min(...places.map((place) => place.distanceMeters))
        : null;

    const proximityScore = getProximityScore(
      closestDistanceMeters,
      category.radiusMeters,
    );
    const varietyScore = getVarietyScore(places.length, category.id);
    const qualityScore = getQualityScore(places, category.typicalRating);

    // Pillars are fractional now, so round once at the end.
    const score = Math.min(
      100,
      Math.round(proximityScore + varietyScore + qualityScore),
    );

    return {
      id: category.id,
      label: category.label,
      score,
      weight: category.weight,
      colorClass: category.colorClass,
      detail: category.detail,
      count: places.length,
      closestDistanceMeters,
      radiusMeters: category.radiusMeters,
      explanation: getExplanation(places.length, closestDistanceMeters),
    };
  });

  const totalWeight = scores.reduce(
    (sum, category) => sum + category.weight,
    0,
  );
  const weightedScore = scores.reduce(
    (sum, category) => sum + category.score * category.weight,
    0,
  );
  const overallScore =
    totalWeight === 0 ? 0 : Math.round(weightedScore / totalWeight);

  return { overallScore, scores };
}

export function getDistanceMeters(
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
) {
  const earthRadiusMeters = 6371000;
  const latA = (origin.latitude * Math.PI) / 180;
  const latB = (destination.latitude * Math.PI) / 180;
  const deltaLat = ((destination.latitude - origin.latitude) * Math.PI) / 180;
  const deltaLng = ((destination.longitude - origin.longitude) * Math.PI) / 180;
  const haversine =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(latA) *
      Math.cos(latB) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);
  const centralAngle =
    2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));

  return Math.round(earthRadiusMeters * centralAngle);
}
