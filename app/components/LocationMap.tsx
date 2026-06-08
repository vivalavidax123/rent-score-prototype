"use client";

import { useEffect, useRef, useState } from "react";

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

type GoogleMap = object;
type GoogleMarker = {
  addListener: (eventName: "click", handler: () => void) => void;
};

type GoogleInfoWindow = {
  open: (options: { anchor: GoogleMarker; map: GoogleMap }) => void;
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

export function LocationMap({
  location,
  placeGroups,
}: {
  location: MapLocation | null;
  placeGroups: PlaceGroup[];
}) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const [mapError, setMapError] = useState("");
  const apiKey = process.env.NEXT_PUBLIC_MAPS_API_KEY;

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

        new google.maps.Marker({
          position: center,
          map,
          title: location.formattedAddress,
          label: "H",
        });

        for (const group of placeGroups) {
          const color = categoryColors[group.id] ?? "#334155";

          for (const place of group.places.slice(0, 8)) {
            const marker = new google.maps.Marker({
              position: {
                lat: place.latitude,
                lng: place.longitude,
              },
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
              content: `
                <div style="max-width:220px">
                  <strong>${escapeHtml(place.name)}</strong>
                  <div>${escapeHtml(group.label)} · ${formatDistance(place.distanceMeters)}</div>
                  <div style="margin-top:4px;color:#475569">${escapeHtml(place.address)}</div>
                </div>
              `,
            });

            marker.addListener("click", () => {
              infoWindow.open({ anchor: marker, map });
            });
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
  }, [apiKey, location, placeGroups]);

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
      <div ref={mapRef} className="aspect-[4/3] w-full" />
      {mapError ? (
        <p className="border-t border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {mapError}
        </p>
      ) : null}
    </div>
  );
}
