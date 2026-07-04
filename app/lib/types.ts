export type GeocodeLocation = {
  query: string;
  formattedAddress: string;
  placeId: string;
  latitude: number;
  longitude: number;
  locationType: string;
  types: string[];
};

export type GeocodeSuccess = {
  ok: true;
  location: GeocodeLocation;
};

export type GeocodeFailure = {
  ok: false;
  error: string;
  status?: string;
};

export type SearchState = "idle" | "loading" | "success" | "error";

export type AddressSuggestion = {
  placeId: string;
  text: string;
  mainText: string;
  secondaryText: string;
};

export type AutocompleteSuccess = {
  ok: true;
  suggestions: AddressSuggestion[];
};

export type AutocompleteFailure = {
  ok: false;
  error: string;
};

export type PlaceSource = "brand" | "generic";

export type TransportService = {
  routeNumber: string;
  destination: string;
  departureTime: string | null;
};

export type NearbyPlace = {
  id: string;
  name: string;
  address: string;
  primaryType: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  rating: number | null;
  userRatingCount: number;
  source: PlaceSource;
  transportServices?: TransportService[];
};

export type PlaceGroup = {
  id: string;
  label: string;
  radiusMeters: number;
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
  radiusMeters: number;
  explanation: string;
};

export type PlacesSuccess = {
  ok: true;
  groups: PlaceGroup[];
  scores: CategoryScore[];
  overallScore: number;
  cached: boolean;
  fetchedAt: string;
};

export type RecentSearch = {
  id: string;
  query: string;
  formattedAddress: string;
  placeId: string;
  locationType: string;
  latitude: number;
  longitude: number;
  lastSearchedAt: string;
  savedAt: string | null;
  overallScore: number;
};

export type HistorySuccess = {
  ok: true;
  searches: RecentSearch[];
};

export type HistoryFailure = {
  ok: false;
  error: string;
};

export type ComparisonSide = {
  id: string;
  query: string;
  formattedAddress: string;
  overallScore: number;
  scores: CategoryScore[];
  fetchedAt: string;
};

export type CompareSuccess = {
  ok: true;
  a: ComparisonSide;
  b: ComparisonSide;
};

export type CompareFailure = {
  ok: false;
  error: string;
};

export type PlacesFailure = {
  ok: false;
  error: string;
};

export type PlacesState = "idle" | "loading" | "success" | "error";

// Google Places API Types
export type GooglePlace = {
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

export type GooglePlacesResponse = {
  places?: GooglePlace[];
  error?: {
    message?: string;
    status?: string;
  };
};

// Transitland API Types
export type TransitlandRoute = {
  route_short_name?: string;
  route_long_name?: string;
  route_id?: string;
};

export type TransitlandTrip = {
  trip_headsign?: string;
  trip_short_name?: string;
  route?: TransitlandRoute;
};

export type TransitlandStopTimeEvent = {
  estimated?: string;
  scheduled?: string;
};

export type TransitlandDeparture = {
  stop_headsign?: string;
  departure_time?: string;
  departure?: TransitlandStopTimeEvent;
  trip?: TransitlandTrip;
};

export type TransitlandStop = {
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

export type TransitlandStopsResponse = {
  stops?: TransitlandStop[];
};
