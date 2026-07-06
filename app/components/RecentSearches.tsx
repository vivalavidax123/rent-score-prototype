"use client";

import type { RecentSearch } from "../lib/types";

// Purely presentational: the lists live in useSavedSearches and arrive as
// props, so this component and the comparison panel can never disagree.
type RecentSearchesProps = {
  recent: RecentSearch[];
  saved: RecentSearch[];
  disabled: boolean;
  onSelect: (search: RecentSearch) => void;
  onToggleSaved: (search: RecentSearch) => void;
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
        {search.overallScore !== null ? (
          <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 font-semibold text-emerald-800">
            {Math.round(search.overallScore)}
          </span>
        ) : null}
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

export function RecentSearches({
  recent,
  saved,
  disabled,
  onSelect,
  onToggleSaved,
}: RecentSearchesProps) {
  // Saved locations already appear in their own row; repeating them under
  // "Recent" would show the same chip twice, so recent keeps unsaved only.
  const unsavedRecent = recent.filter((search) => search.savedAt === null);

  if (unsavedRecent.length === 0 && saved.length === 0) {
    return null;
  }

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
                  disabled={disabled}
                  onSelect={onSelect}
                  onToggleSaved={onToggleSaved}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {unsavedRecent.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Recent searches
          </h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {unsavedRecent.map((search) => (
              <li key={search.id}>
                <SearchChip
                  search={search}
                  disabled={disabled}
                  onSelect={onSelect}
                  onToggleSaved={onToggleSaved}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
