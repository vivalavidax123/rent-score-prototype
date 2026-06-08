"use client";

import { useLocationSearch } from "./hooks/useLocationSearch";
import { LocationMap } from "./components/LocationMap";
import { SearchForm } from "./components/SearchForm";
import { ScoreBreakdown } from "./components/ScoreBreakdown";
import { NearbyPlacesList } from "./components/NearbyPlacesList";

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
    handleSearch,
    handleSuggestionSelect,
    handleLocationKeyDown,
  } = useLocationSearch();

  return (
    <main className="min-h-screen bg-[#f3f6f4] px-5 py-8 text-slate-950 sm:px-8 lg:px-10">
      <section className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-emerald-700">
                Rental location insight
              </p>
              <h1 className="max-w-2xl text-4xl font-bold leading-tight text-slate-950 sm:text-5xl">
                Rent Convenience Score
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                Compare how practical a rental location is for everyday errands,
                transport, food, health, and fitness.
              </p>
            </div>

            <div className="w-full rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-left sm:w-44">
              <p className="text-sm font-medium text-emerald-800">
                {placesState === "success" ? "Overall score" : "Ready to score"}
              </p>
              <p className="mt-1 text-4xl font-bold text-emerald-950">
                {placesState === "loading" ? "..." : overallScore ?? "--"}
              </p>
              <p className="text-sm text-emerald-800">out of 100</p>
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

          <ScoreBreakdown
            placesState={placesState}
            categoryScores={categoryScores}
            placesError={placesError}
          />
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

          <NearbyPlacesList
            placesState={placesState}
            placesError={placesError}
            placeGroups={placeGroups}
          />
        </aside>
      </section>
    </main>
  );
}
