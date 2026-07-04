"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  HistoryFailure,
  HistorySuccess,
  PlacesState,
  RecentSearch,
} from "../lib/types";

type RecentSearchesProps = {
  placesState: PlacesState;
  onSelect: (search: RecentSearch) => void;
};

type SearchChipProps = {
  search: RecentSearch;
  disabled: boolean;
  onSelect: (search: RecentSearch) => void;
  onToggleSaved: (search: RecentSearch) => void;
};

// Buttons cannot be nested in HTML, so the chip is a div holding two
// separate buttons: the address (re-run the search) and the star (save).
function SearchChip({ search, disabled, onSelect, onToggleSaved }: SearchChipProps) {
  const isSaved = search.savedAt !== null;

  return (
    <div className="flex items-center rounded-full border border-slate-200 bg-white text-xs font-medium text-slate-700 transition hover:border-emerald-300">
      <button
        type="button"
        onClick={() => onSelect(search)}
        disabled={disabled}
        className="flex items-center gap-2 rounded-l-full py-1.5 pl-3 pr-1 hover:bg-emerald-50 disabled:opacity-50"
      >
        <span className="max-w-52 truncate">{search.formattedAddress}</span>
        <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 font-semibold text-emerald-800">
          {Math.round(search.overallScore)}
        </span>
      </button>
      <button
        type="button"
        onClick={() => onToggleSaved(search)}
        disabled={disabled}
        aria-label={isSaved ? "Remove from saved locations" : "Save this location"}
        className="rounded-r-full py-1.5 pl-1 pr-2.5 text-sm leading-none hover:bg-amber-50 disabled:opacity-50"
      >
        <span className={isSaved ? "text-amber-500" : "text-slate-300"}>
          {isSaved ? "★" : "☆"}
        </span>
      </button>
    </div>
  );
}

export function RecentSearches({ placesState, onSelect }: RecentSearchesProps) {
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

  const handleToggleSaved = useCallback(async (search: RecentSearch) => {
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

  if (recent.length === 0 && saved.length === 0) {
    return null;
  }

  const chipDisabled = placesState === "loading";

  return (
    <div className="mt-4 space-y-3">
      {saved.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Saved locations
          </h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {saved.map((search) => (
              <li key={search.id}>
                <SearchChip
                  search={search}
                  disabled={chipDisabled}
                  onSelect={onSelect}
                  onToggleSaved={handleToggleSaved}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {recent.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Recent searches
          </h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {recent.map((search) => (
              <li key={search.id}>
                <SearchChip
                  search={search}
                  disabled={chipDisabled}
                  onSelect={onSelect}
                  onToggleSaved={handleToggleSaved}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
