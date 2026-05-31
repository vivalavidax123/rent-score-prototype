import { rentScoreCategories, searchRadiusMeters } from "./categories";

export type PlaceSource = "brand" | "generic";

export type NearbyPlace = {
  id: string;
  name: string;
  address: string;
  primaryType: string;
  distanceMeters: number;
  source: PlaceSource;
};

export type PlaceGroup = {
  id: string;
  label: string;
  places: NearbyPlace[];
};

export type CategoryScore = {
  id: string;
  label: string;
  score: number;
  weight: number;
  colorClass: string;
  detail: string;
  count: number;
  closestDistanceMeters: number | null;
  explanation: string;
};

function getDistanceScore(distanceMeters: number | null) {
  if (distanceMeters === null) {
    return 0;
  }

  const normalizedDistance = Math.min(distanceMeters, searchRadiusMeters);
  return Math.round(((searchRadiusMeters - normalizedDistance) / searchRadiusMeters) * 45);
}

function getCountScore(count: number) {
  return Math.min(count * 11, 55);
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
    const closestDistanceMeters = places[0]?.distanceMeters ?? null;
    const score = Math.min(
      100,
      getCountScore(places.length) + getDistanceScore(closestDistanceMeters),
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
      explanation: getExplanation(places.length, closestDistanceMeters),
    };
  });

  const totalWeight = scores.reduce((sum, category) => sum + category.weight, 0);
  const weightedScore = scores.reduce(
    (sum, category) => sum + category.score * category.weight,
    0,
  );
  const overallScore = totalWeight === 0 ? 0 : Math.round(weightedScore / totalWeight);

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
