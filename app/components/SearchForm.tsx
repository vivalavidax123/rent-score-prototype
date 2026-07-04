import type { FormEvent, KeyboardEvent } from "react";
import type { AddressSuggestion, SearchState, PlacesState } from "../lib/types";

type SearchFormProps = {
  query: string;
  setQuery: (val: string) => void;
  suggestions: AddressSuggestion[];
  setSuggestions: (val: AddressSuggestion[]) => void;
  showSuggestions: boolean;
  setShowSuggestions: (val: boolean) => void;
  activeSuggestionIndex: number;
  setActiveSuggestionIndex: (val: number) => void;
  setSelectedSuggestionText: (val: string) => void;
  searchState: SearchState;
  placesState: PlacesState;
  error: string;
  handleSearch: (event: FormEvent<HTMLFormElement>) => void;
  handleSuggestionSelect: (suggestion: AddressSuggestion) => void;
  handleLocationKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
};

export function SearchForm({
  query,
  setQuery,
  suggestions,
  setSuggestions,
  showSuggestions,
  setShowSuggestions,
  activeSuggestionIndex,
  setActiveSuggestionIndex,
  setSelectedSuggestionText,
  searchState,
  placesState,
  error,
  handleSearch,
  handleSuggestionSelect,
  handleLocationKeyDown,
}: SearchFormProps) {
  return (
    <form
      className="rounded-lg border border-slate-200 bg-slate-50 p-3 shadow-inner"
      onSubmit={handleSearch}
    >
      <label
        htmlFor="location"
        className="mb-2 block text-sm font-semibold text-slate-800"
      >
        Address or suburb
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <input
            id="location"
            type="text"
            value={query}
            onChange={(event) => {
              const nextQuery = event.target.value;

              setQuery(nextQuery);
              setSelectedSuggestionText("");

              if (nextQuery.trim().length < 3) {
                setSuggestions([]);
                setShowSuggestions(false);
                setActiveSuggestionIndex(-1);
              }
            }}
            onFocus={() => {
              if (suggestions.length > 0) {
                setShowSuggestions(true);
              }
            }}
            onBlur={() => {
              window.setTimeout(() => setShowSuggestions(false), 120);
            }}
            onKeyDown={handleLocationKeyDown}
            placeholder="Try: Parramatta NSW"
            autoComplete="off"
            aria-autocomplete="list"
            aria-controls="location-suggestions"
            className="min-h-12 w-full rounded-md border border-slate-300 bg-white px-4 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
          />
          {showSuggestions ? (
            <div className="absolute left-0 right-0 top-[calc(100%+0.375rem)] z-20 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
              <ul id="location-suggestions" role="listbox" className="py-1">
                {suggestions.map((suggestion, index) => (
                  <li
                    key={suggestion.placeId}
                    role="option"
                    aria-selected={index === activeSuggestionIndex}
                  >
                    <button
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        handleSuggestionSelect(suggestion);
                      }}
                      onMouseEnter={() => setActiveSuggestionIndex(index)}
                      className={`w-full px-4 py-2.5 text-left transition ${
                        index === activeSuggestionIndex
                          ? "bg-emerald-50"
                          : "bg-white hover:bg-slate-50"
                      }`}
                    >
                      <span className="block truncate text-sm font-semibold text-slate-900">
                        {suggestion.mainText}
                      </span>
                      {suggestion.secondaryText ? (
                        <span className="mt-0.5 block truncate text-xs text-slate-500">
                          {suggestion.secondaryText}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="border-t border-slate-100 px-4 py-1.5 text-right text-[11px] font-medium text-slate-400">
                Powered by Google
              </div>
            </div>
          ) : null}
        </div>
        <button
          type="submit"
          disabled={searchState === "loading" || placesState === "loading"}
          className="min-h-12 rounded-md bg-slate-950 px-6 text-base font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-300 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {searchState === "loading" ? "Searching..." : "Search"}
        </button>
      </div>
      {searchState === "error" ? (
        <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}
    </form>
  );
}
