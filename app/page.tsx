"use client";

import { useLocationSearch } from "./hooks/useLocationSearch";
import { useSavedSearches } from "./hooks/useSavedSearches";
import { ComparePanel } from "./components/ComparePanel";
import { LocationMap } from "./components/LocationMap";
import { SearchForm } from "./components/SearchForm";
import { ScoreBreakdown } from "./components/ScoreBreakdown";
import { NearbyPlacesList } from "./components/NearbyPlacesList";
import { AdditionalIndicators } from "./components/AdditionalIndicators";
import { RecentSearches } from "./components/RecentSearches";

export default function Home() {
  const {
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
    location,
    error,
    placesState,
    placeGroups,
    categoryScores,
    overallScore,
    placesError,
    resultFromCache,
    handleSearch,
    handleSuggestionSelect,
    handleLocationKeyDown,
    searchFromHistory,
  } = useLocationSearch();

  // Shared by the chips and the comparison panel — one copy of the lists.
  const { recent, saved, toggleSaved } = useSavedSearches(placesState);

  return (
    <main className="min-h-screen bg-[#f3f6f4] px-4 py-5 text-slate-950 sm:px-6 lg:px-8">
      <section className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Rental location insight
              </p>
              <h1 className="mt-1 text-2xl font-bold leading-tight text-slate-950 sm:text-3xl">
                Rent Convenience Score
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
                Compare everyday convenience, transport access, food, health,
                fitness, and practical services around a rental.
              </p>
            </div>

            <div className="grid w-full grid-cols-[auto_1fr] items-center gap-3 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-left sm:w-52">
              <div className="flex size-16 items-center justify-center rounded-full border-[6px] border-emerald-500 bg-white">
                <span className="text-2xl font-bold text-emerald-900">
                  {placesState === "loading" ? "..." : overallScore ?? "--"}
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-950">
                  {placesState === "success" ? "Overall score" : "Ready to score"}
                </p>
                <p className="text-xs font-medium text-emerald-800">out of 100</p>
              </div>
            </div>
          </div>

          <SearchForm
            query={query}
            setQuery={setQuery}
            suggestions={suggestions}
            setSuggestions={setSuggestions}
            showSuggestions={showSuggestions}
            setShowSuggestions={setShowSuggestions}
            activeSuggestionIndex={activeSuggestionIndex}
            setActiveSuggestionIndex={setActiveSuggestionIndex}
            setSelectedSuggestionText={setSelectedSuggestionText}
            searchState={searchState}
            placesState={placesState}
            location={location}
            error={error}
            handleSearch={handleSearch}
            handleSuggestionSelect={handleSuggestionSelect}
            handleLocationKeyDown={handleLocationKeyDown}
          />

          <RecentSearches
            recent={recent}
            saved={saved}
            disabled={placesState === "loading"}
            onSelect={searchFromHistory}
            onToggleSaved={toggleSaved}
          />

          {placesState === "success" && resultFromCache && (
            <p className="mt-3 text-xs text-slate-500">
              Loaded from saved results — this location was scored within the
              last 24 hours, so no new map lookups were needed.
            </p>
          )}

          <ScoreBreakdown
            placesState={placesState}
            categoryScores={categoryScores}
            placesError={placesError}
          />

          <NearbyPlacesList
            placesState={placesState}
            placesError={placesError}
            placeGroups={placeGroups}
          />

          <ComparePanel saved={saved} />
        </div>

        <aside className="space-y-6">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-950">Location preview</h2>
            <LocationMap location={location} placeGroups={placeGroups} />
            <p className="mt-4 text-sm leading-6 text-slate-600">
              {location
                ? `Matched as ${location.locationType.toLowerCase().replaceAll("_", " ")}. Map markers show the searched location and nearby amenities using each category radius.`
                : "Search for a location to show nearby amenities on the map."}
            </p>
          </div>

          <AdditionalIndicators
            placesState={placesState}
            categoryScores={categoryScores}
            placeGroups={placeGroups}
          />
        </aside>
      </section>
    </main>
  );
}
