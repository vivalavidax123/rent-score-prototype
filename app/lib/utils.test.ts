import { describe, expect, it } from "vitest";
import {
  formatDepartureTime,
  formatDistance,
  normalizeStationName,
  normalizeText,
  parseCoordinate,
} from "./utils";

// Formatters and parsers are the classic unit-test sweet spot: lots of edge
// cases, zero dependencies, and bugs here are silent (a wrong label renders
// fine, it just lies).

describe("formatDistance", () => {
  it("uses metres below one kilometre and kilometres above", () => {
    expect(formatDistance(999)).toBe("999 m");
    expect(formatDistance(1000)).toBe("1.0 km");
    expect(formatDistance(1550)).toBe("1.6 km");
  });
});

describe("parseCoordinate", () => {
  it("parses valid coordinate strings", () => {
    expect(parseCoordinate("-37.8136")).toBe(-37.8136);
  });

  it("rejects the sneaky falsy and non-numeric cases", () => {
    expect(parseCoordinate(null)).toBeNull();
    expect(parseCoordinate("abc")).toBeNull();
    // Number("") is 0 in JavaScript — an empty query parameter must not
    // silently become the coordinate (0, 0) in the Gulf of Guinea.
    expect(parseCoordinate("")).toBeNull();
    // Number("Infinity") parses but is not a usable coordinate.
    expect(parseCoordinate("Infinity")).toBeNull();
  });
});

describe("normalizeText", () => {
  it("lowercases, expands ampersands, and strips punctuation", () => {
    expect(normalizeText("Food & Cafés!")).toBe("food and caf s");
    expect(normalizeText("  Coles   Local  ")).toBe("coles local");
  });
});

describe("normalizeStationName", () => {
  it("reduces station names to their comparable core", () => {
    // The V/Line list and Google Places label the same station differently;
    // both must normalize to the same key or regional stations mismatch.
    expect(normalizeStationName("Tarneit Railway Station")).toBe("tarneit");
    expect(normalizeStationName("Southern Cross Station")).toBe("southern cross");
    expect(normalizeStationName("tarneit")).toBe("tarneit");
  });
});

describe("formatDepartureTime", () => {
  it("pads GTFS clock times", () => {
    expect(formatDepartureTime("7:05:00")).toBe("07:05");
  });

  it("keeps GTFS past-midnight times as-is", () => {
    // GTFS uses 25:10 to mean 1:10 am on the service day after midnight;
    // "fixing" it to 01:10 would move the departure to the wrong day.
    expect(formatDepartureTime("25:10:00")).toBe("25:10");
  });

  it("returns null for missing or unparseable input", () => {
    expect(formatDepartureTime(null)).toBeNull();
    expect(formatDepartureTime("not a time")).toBeNull();
  });

  // The ISO-date branch is deliberately untested here: its output goes
  // through toLocaleTimeString, which depends on the machine's locale and
  // timezone — asserting it would make the suite fail on other machines.
});
