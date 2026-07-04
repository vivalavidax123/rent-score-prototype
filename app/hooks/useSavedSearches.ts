import { useCallback, useEffect, useState } from "react";
import type {
  HistoryFailure,
  HistorySuccess,
  PlacesState,
  RecentSearch,
} from "../lib/types";

// Owns the recent-search and saved-location lists so every component that
// needs them (chips, comparison panel) reads the same single copy.
export function useSavedSearches(placesState: PlacesState) {
  const [recent, setRecent] = useState<RecentSearch[]>([]);
  const [saved, setSaved] = useState<RecentSearch[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  // Refetch on mount, after each completed search, and after every
  // save/unsave (via refreshKey) so the database stays the single source
  // of truth instead of hand-edited local state.
  useEffect(() => {
    if (placesState === "loading") {
      return;
    }

    let cancelled = false;

    Promise.all([
      fetch("/api/history").then(
        (response) => response.json() as Promise<HistorySuccess | HistoryFailure>,
      ),
      fetch("/api/favourites").then(
        (response) => response.json() as Promise<HistorySuccess | HistoryFailure>,
      ),
    ])
      .then(([historyData, favouritesData]) => {
        if (cancelled) {
          return;
        }

        if (historyData.ok) {
          setRecent(historyData.searches);
        }

        if (favouritesData.ok) {
          setSaved(favouritesData.searches);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [placesState, refreshKey]);

  const toggleSaved = useCallback(async (search: RecentSearch) => {
    const isSaved = search.savedAt !== null;

    try {
      await fetch(
        isSaved ? `/api/favourites?id=${search.id}` : "/api/favourites",
        isSaved
          ? { method: "DELETE" }
          : {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ locationId: search.id }),
            },
      );
    } finally {
      setRefreshKey((key) => key + 1);
    }
  }, []);

  return { recent, saved, toggleSaved };
}
