import { describe, expect, it } from "vitest";
import { getDistanceMeters, scorePlaceGroups } from "./scoring";
import type { NearbyPlace, PlaceGroup } from "./types";

// The scoring pillars are private functions, so every test goes through the
// public scorePlaceGroups API. That is deliberate: tests pinned to internals
// break on refactors; tests pinned to observable behaviour only break when
// behaviour actually changes.

function makePlace(overrides: Partial<NearbyPlace> = {}): NearbyPlace {
  return {
    id: `place-${Math.random().toString(36).slice(2)}`,
    name: "Test Place",
    address: "1 Test St",
    primaryType: "supermarket",
    latitude: 0,
    longitude: 0,
    distanceMeters: 500,
    rating: null,
    userRatingCount: 100,
    source: "generic",
    ...overrides,
  };
}

// One groceries group (standard 3 km radius) with places at given distances.
function groceriesAt(...distanceMeters: number[]): PlaceGroup[] {
  return [
    {
      id: "groceries",
      label: "Groceries",
      radiusMeters: 3000,
      places: distanceMeters.map((d) => makePlace({ distanceMeters: d })),
    },
  ];
}

function groceriesScore(groups: PlaceGroup[], profile?: "carFree" | "carOwner") {
  const { scores } = scorePlaceGroups(groups, profile);
  return scores.find((s) => s.id === "groceries")!.score;
}

describe("scorePlaceGroups", () => {
  it("scores zero everywhere when nothing is nearby", () => {
    const { overallScore, scores } = scorePlaceGroups([]);

    expect(overallScore).toBe(0);
    for (const category of scores) {
      expect(category.score).toBe(0);
      expect(category.count).toBe(0);
      expect(category.closestDistanceMeters).toBeNull();
    }
  });

  it("treats everywhere inside the 400 m walkable ring the same", () => {
    // Boundary test: the design says "walkable is walkable" — 50 m and
    // 399 m must not differ, or the ring would create a hidden cliff.
    expect(groceriesAt(50).length).toBe(1);
    expect(groceriesScore(groceriesAt(50))).toBe(
      groceriesScore(groceriesAt(399)),
    );
  });

  it("never rewards moving farther away (monotonic decay, no cliffs)", () => {
    // Property test: instead of asserting exact numbers (which would break
    // every time a constant is retuned), assert the shape of the curve.
    const distances = [400, 700, 1200, 2000, 3000];
    const scores = distances.map((d) => groceriesScore(groceriesAt(d)));

    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThan(scores[i - 1]);
    }
  });

  it("lets car owners tolerate distance better than car-free renters", () => {
    const farAway = groceriesAt(2000);

    expect(groceriesScore(farAway, "carOwner")).toBeGreaterThan(
      groceriesScore(farAway, "carFree"),
    );
    // Inside the walkable ring the profiles agree by construction.
    const walkable = groceriesAt(200);
    expect(groceriesScore(walkable, "carOwner")).toBe(
      groceriesScore(walkable, "carFree"),
    );
  });

  it("judges quality against the category baseline, neutral when unrated", () => {
    const rated = (rating: number | null) =>
      groceriesScore(groceriesAt(100).map((group) => ({
        ...group,
        places: group.places.map((place) => ({ ...place, rating })),
      })));

    // Groceries' typical rating is 4.2: well above it beats unrated (the
    // neutral midpoint), which beats well below it. Places with no rating
    // data must not get free full marks.
    expect(rated(5.0)).toBeGreaterThan(rated(null));
    expect(rated(null)).toBeGreaterThan(rated(3.4));
  });

  it("weights fuel at zero for car-free renters", () => {
    const fuelGroup: PlaceGroup[] = [
      {
        id: "fuel",
        label: "Fuel & Automotive",
        radiusMeters: 3000,
        places: [makePlace({ distanceMeters: 100, primaryType: "gas_station" })],
      },
    ];

    const carFree = scorePlaceGroups(fuelGroup, "carFree");
    const carOwner = scorePlaceGroups(fuelGroup, "carOwner");

    expect(carFree.scores.find((s) => s.id === "fuel")!.weight).toBe(0);
    expect(carOwner.scores.find((s) => s.id === "fuel")!.weight).toBeGreaterThan(0);
    // A perfect fuel score contributes nothing car-free...
    expect(carFree.overallScore).toBe(0);
    // ...but does count for car owners.
    expect(carOwner.overallScore).toBeGreaterThan(0);
  });

  it("computes the overall score as the weight-blended category average", () => {
    // Invariant test: recompute the aggregation from the returned parts and
    // require them to agree, so the formula can never silently drift.
    const { overallScore, scores } = scorePlaceGroups(
      groceriesAt(300, 900, 1600),
    );

    const totalWeight = scores.reduce((sum, s) => sum + s.weight, 0);
    const expected = Math.round(
      scores.reduce((sum, s) => sum + s.score * s.weight, 0) / totalWeight,
    );

    expect(totalWeight).toBe(100);
    expect(overallScore).toBe(expected);
  });
});

describe("getDistanceMeters", () => {
  const melbourneCbd = { latitude: -37.8136, longitude: 144.9631 };

  it("returns zero for the same point", () => {
    expect(getDistanceMeters(melbourneCbd, melbourneCbd)).toBe(0);
  });

  it("matches the known length of one degree of latitude (~111.2 km)", () => {
    // Oracle test: compare against an independently known real-world value
    // rather than re-deriving the haversine formula in the test.
    const oneDegreeNorth = { ...melbourneCbd, latitude: melbourneCbd.latitude + 1 };
    const distance = getDistanceMeters(melbourneCbd, oneDegreeNorth);

    expect(distance).toBeGreaterThan(111_000);
    expect(distance).toBeLessThan(111_400);
  });

  it("is symmetric", () => {
    const richmond = { latitude: -37.8183, longitude: 145.0 };

    expect(getDistanceMeters(melbourneCbd, richmond)).toBe(
      getDistanceMeters(richmond, melbourneCbd),
    );
  });
});
