"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type MapLocation = {
  formattedAddress: string;
  latitude: number;
  longitude: number;
};

type NearbyPlace = {
  id: string;
  name: string;
  address: string;
  primaryType: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  rating: number | null;
  userRatingCount: number;
  source: "brand" | "generic";
  transportServices?: {
    routeNumber: string;
    destination: string;
    departureTime: string | null;
  }[];
};

type PlaceGroup = {
  id: string;
  label: string;
  radiusMeters: number;
  places: NearbyPlace[];
};

type LatLngLiteral = {
  lat: number;
  lng: number;
};

type GoogleMap = {
  panTo: (position: LatLngLiteral) => void;
};
type GoogleMarker = {
  addListener: (eventName: "click", handler: () => void) => void;
};

type GoogleInfoWindow = {
  open: (options: { anchor: GoogleMarker; map: GoogleMap }) => void;
  close: () => void;
  setContent: (content: string) => void;
};

type GoogleMapsApi = {
  maps: {
    Map: new (
      element: HTMLElement,
      options: {
        center: LatLngLiteral;
        zoom: number;
        mapTypeControl: boolean;
        streetViewControl: boolean;
        fullscreenControl: boolean;
      },
    ) => GoogleMap;
    Marker: new (options: {
      position: LatLngLiteral;
      map: GoogleMap;
      title: string;
      label?: string;
      icon?: {
        path: number;
        scale: number;
        fillColor: string;
        fillOpacity: number;
        strokeColor: string;
        strokeWeight: number;
      };
    }) => GoogleMarker;
    InfoWindow: new (options: { content: string }) => GoogleInfoWindow;
    SymbolPath: {
      CIRCLE: number;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleMapsApi;
    rentScoreGoogleMapsReady?: () => void;
  }
}

const categoryColors: Record<string, string> = {
  shopping_centres: "#14b8a6",
  groceries: "#10b981",
  food: "#f59e0b",
  transport: "#0ea5e9",
  health: "#f43f5e",
  fitness: "#8b5cf6",
  fuel: "#f97316",
  services: "#6366f1",
};

let googleMapsPromise: Promise<GoogleMapsApi> | null = null;

function loadGoogleMaps(apiKey: string) {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps can only load in the browser."));
  }

  if (window.google) {
    return Promise.resolve(window.google);
  }

  if (googleMapsPromise) {
    return googleMapsPromise;
  }

  googleMapsPromise = new Promise((resolve, reject) => {
    window.rentScoreGoogleMapsReady = () => {
      if (window.google) {
        resolve(window.google);
      } else {
        reject(new Error("Google Maps loaded without an API object."));
      }
    };

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey,
    )}&callback=rentScoreGoogleMapsReady&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("Google Maps failed to load."));
    document.head.appendChild(script);
  });

  return googleMapsPromise;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character];
  });
}

function formatDistance(distanceMeters: number) {
  return distanceMeters < 1000
    ? `${distanceMeters} m`
    : `${(distanceMeters / 1000).toFixed(1)} km`;
}

type MarkerEntry = {
  marker: GoogleMarker;
  infoWindow: GoogleInfoWindow;
  position: LatLngLiteral;
  place: NearbyPlace;
  group: PlaceGroup;
  photoState: "idle" | "loading" | "loaded" | "unavailable";
  photo: PlacePhoto | null;
};

type PlacePhoto = {
  imageUrl: string;
  attributions: {
    displayName: string;
    uri: string | null;
  }[];
};

function getInfoWindowContent(
  entry: Pick<MarkerEntry, "place" | "group" | "photoState" | "photo">,
) {
  const { place, group, photoState, photo } = entry;
  const photoMarkup =
    photoState === "loading"
      ? `<div style="height:120px;margin-bottom:10px;border-radius:8px;background:#e2e8f0;display:flex;align-items:center;justify-content:center;color:#64748b;font-size:12px">Loading photo...</div>`
      : photoState === "loaded" && photo
        ? `<img src="${escapeHtml(photo.imageUrl)}" alt="${escapeHtml(place.name)}" style="display:block;width:100%;height:120px;margin-bottom:8px;border-radius:8px;object-fit:cover" />${
            photo.attributions.length > 0
              ? `<div style="margin:-2px 0 8px;color:#64748b;font-size:10px">Photo by ${photo.attributions
                  .map((attribution) =>
                    attribution.uri
                      ? `<a href="${escapeHtml(attribution.uri)}" target="_blank" rel="noopener noreferrer" style="color:#475569">${escapeHtml(attribution.displayName)}</a>`
                      : escapeHtml(attribution.displayName),
                  )
                  .join(", ")}</div>`
              : ""
          }`
        : "";

  return `
    <div style="width:220px;max-width:220px">
      ${photoMarkup}
      <strong>${escapeHtml(place.name)}</strong>
      <div>${escapeHtml(group.label)} · ${formatDistance(place.distanceMeters)}</div>
      <div style="margin-top:4px;color:#475569">${escapeHtml(place.address)}</div>
    </div>
  `;
}

async function loadPlacePhoto(entry: MarkerEntry) {
  if (entry.photoState !== "idle" || entry.place.id.startsWith("transitland:")) {
    return;
  }

  entry.photoState = "loading";
  entry.infoWindow.setContent(getInfoWindowContent(entry));

  try {
    const response = await fetch(
      `/api/place-photo?placeId=${encodeURIComponent(entry.place.id)}`,
      { cache: "no-store" },
    );

    if (!response.ok) {
      entry.photoState = "unavailable";
      entry.infoWindow.setContent(getInfoWindowContent(entry));
      return;
    }

    entry.photo = (await response.json()) as PlacePhoto;
    entry.photoState = "loaded";
    entry.infoWindow.setContent(getInfoWindowContent(entry));
  } catch {
    entry.photoState = "unavailable";
    entry.infoWindow.setContent(getInfoWindowContent(entry));
  }
}

function createPlaceMarker(
  google: GoogleMapsApi,
  map: GoogleMap,
  place: NearbyPlace,
  group: PlaceGroup,
  onMarkerClick: (entry: MarkerEntry) => void,
): MarkerEntry {
  const color = categoryColors[group.id] ?? "#334155";
  const position = {
    lat: place.latitude,
    lng: place.longitude,
  };
  const marker = new google.maps.Marker({
    position,
    map,
    title: place.name,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: place.source === "brand" ? 7 : 5,
      fillColor: color,
      fillOpacity: 0.9,
      strokeColor: "#ffffff",
      strokeWeight: 2,
    },
  });
  const infoWindow = new google.maps.InfoWindow({
    content: "",
  });
  const entry: MarkerEntry = {
    marker,
    infoWindow,
    position,
    place,
    group,
    photoState: "idle",
    photo: null,
  };

  infoWindow.setContent(getInfoWindowContent(entry));

  marker.addListener("click", () => onMarkerClick(entry));

  return entry;
}

export function LocationMap({
  location,
  placeGroups,
  selectedPlace,
  onAutoScroll,
}: {
  location: MapLocation | null;
  placeGroups: PlaceGroup[];
  selectedPlace: { placeId: string } | null;
  onAutoScroll: () => void;
}) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<GoogleMap | null>(null);
  const googleApiRef = useRef<GoogleMapsApi | null>(null);
  const markerEntriesRef = useRef(new Map<string, MarkerEntry>());
  const openInfoWindowRef = useRef<GoogleInfoWindow | null>(null);
  const [mapError, setMapError] = useState("");
  const apiKey = process.env.NEXT_PUBLIC_MAPS_API_KEY;

  // Single entry point for opening info windows so only one stays open,
  // whether triggered by a marker click or a list-row click.
  const openEntry = useCallback((entry: MarkerEntry) => {
    const map = mapInstanceRef.current;

    if (!map) {
      return;
    }

    openInfoWindowRef.current?.close();
    entry.infoWindow.open({ anchor: entry.marker, map });
    openInfoWindowRef.current = entry.infoWindow;
    void loadPlacePhoto(entry);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function renderMap() {
      if (!apiKey || !location || !mapRef.current) {
        return;
      }

      try {
        const google = await loadGoogleMaps(apiKey);

        if (!isMounted || !mapRef.current) {
          return;
        }

        const center = {
          lat: location.latitude,
          lng: location.longitude,
        };
        const map = new google.maps.Map(mapRef.current, {
          center,
          zoom: 14,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });

        googleApiRef.current = google;
        mapInstanceRef.current = map;
        markerEntriesRef.current = new Map();
        openInfoWindowRef.current = null;

        new google.maps.Marker({
          position: center,
          map,
          title: location.formattedAddress,
          label: "H",
        });

        for (const group of placeGroups) {
          for (const place of group.places.slice(0, 8)) {
            markerEntriesRef.current.set(
              place.id,
              createPlaceMarker(google, map, place, group, openEntry),
            );
          }
        }

        setMapError("");
      } catch (error) {
        if (isMounted) {
          setMapError(
            error instanceof Error ? error.message : "Google Maps failed to load.",
          );
        }
      }
    }

    renderMap();

    return () => {
      isMounted = false;
    };
  }, [apiKey, location, placeGroups, openEntry]);

  // Pan to a place picked from the amenity list. Only the first few places
  // per category get markers up front, so build one on demand if needed.
  useEffect(() => {
    const google = googleApiRef.current;
    const map = mapInstanceRef.current;

    if (!selectedPlace || !google || !map) {
      return;
    }

    let entry = markerEntriesRef.current.get(selectedPlace.placeId);

    if (!entry) {
      for (const group of placeGroups) {
        const place = group.places.find(
          (candidate) => candidate.id === selectedPlace.placeId,
        );

        if (place) {
          entry = createPlaceMarker(google, map, place, group, openEntry);
          markerEntriesRef.current.set(place.id, entry);
          break;
        }
      }
    }

    if (!entry) {
      return;
    }

    map.panTo(entry.position);
    openEntry(entry);

    // Bring the map into view when the clicked row is far down the page,
    // but stay put if the map is already fully visible.
    const mapElement = mapRef.current;

    if (mapElement) {
      const rect = mapElement.getBoundingClientRect();
      const fullyVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;

      if (!fullyVisible) {
        mapElement.scrollIntoView({ behavior: "smooth", block: "start" });
        onAutoScroll();
      }
    }
  }, [selectedPlace, placeGroups, openEntry, onAutoScroll]);

  if (!apiKey) {
    return (
      <div className="mt-5 flex aspect-[4/3] items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-5 text-center text-sm leading-6 text-slate-600">
        Add NEXT_PUBLIC_MAPS_API_KEY to show the live map.
      </div>
    );
  }

  if (!location) {
    return (
      <div className="mt-5 flex aspect-[4/3] items-center justify-center rounded-lg border border-slate-200 bg-[#dfe8e3] p-5 text-center text-sm leading-6 text-slate-600">
        Search for a location to preview it on the map.
      </div>
    );
  }

  return (
    <div className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
      <div ref={mapRef} className="aspect-[4/3] w-full scroll-mt-16" />
      {mapError ? (
        <p className="border-t border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {mapError}
        </p>
      ) : null}
    </div>
  );
}
