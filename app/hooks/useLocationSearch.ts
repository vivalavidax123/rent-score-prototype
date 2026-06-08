import { useState, useEffect, useRef, type FormEvent, type KeyboardEvent } from "react";
import type {
  GeocodeLocation,
  AddressSuggestion,
  SearchState,
  PlacesState,
  PlaceGroup,
  CategoryScore,
  AutocompleteSuccess,
  AutocompleteFailure,
  GeocodeSuccess,
  GeocodeFailure,
  PlacesSuccess,
  PlacesFailure,
} from "../lib/types";

export function useLocationSearch() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [selectedSuggestionText, setSelectedSuggestionText] = useState("");
  
  const [searchState, setSearchState] = useState<SearchState>("idle");
  const [location, setLocation] = useState<GeocodeLocation | null>(null);
  const [error, setError] = useState("");
  
  const [placesState, setPlacesState] = useState<PlacesState>("idle");
  const [placeGroups, setPlaceGroups] = useState<PlaceGroup[]>([]);
  const [categoryScores, setCategoryScores] = useState<CategoryScore[]>([]);
  const [overallScore, setOverallScore] = useState<number | null>(null);
  const [placesError, setPlacesError] = useState("");
  
  const autocompleteRequestId = useRef(0);

  useEffect(() => {
    const trimmedQuery = query.trim();

    if (
      trimmedQuery.length < 3 ||
      trimmedQuery === selectedSuggestionText ||
      searchState === "loading"
    ) {
      return;
    }

    const requestId = autocompleteRequestId.current + 1;
    autocompleteRequestId.current = requestId;
    const controller = new AbortController();
    
    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/autocomplete?query=${encodeURIComponent(trimmedQuery)}`,
          { signal: controller.signal },
        );
        const data = (await response.json()) as
          | AutocompleteSuccess
          | AutocompleteFailure;

        if (requestId !== autocompleteRequestId.current) {
          return;
        }

        if (!response.ok || !data.ok) {
          setSuggestions([]);
          setShowSuggestions(false);
          setActiveSuggestionIndex(-1);
          return;
        }

        setSuggestions(data.suggestions);
        setShowSuggestions(data.suggestions.length > 0);
        setActiveSuggestionIndex(data.suggestions.length > 0 ? 0 : -1);
      } catch {
        if (controller.signal.aborted) {
          return;
        }

        setSuggestions([]);
        setShowSuggestions(false);
        setActiveSuggestionIndex(-1);
      }
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [query, searchState, selectedSuggestionText]);

  async function loadNearbyPlaces(nextLocation: GeocodeLocation) {
    setPlacesState("loading");
    setPlacesError("");
    setPlaceGroups([]);
    setCategoryScores([]);
    setOverallScore(null);

    try {
      const response = await fetch(
        `/api/places?lat=${nextLocation.latitude}&lng=${nextLocation.longitude}`,
      );
      const data = (await response.json()) as PlacesSuccess | PlacesFailure;

      if (!response.ok || !data.ok) {
        setPlacesError(data.ok ? "Could not load nearby places." : data.error);
        setPlacesState("error");
        return;
      }

      setPlaceGroups(data.groups);
      setCategoryScores(data.scores);
      setOverallScore(data.overallScore);
      setPlacesState("success");
    } catch {
      setPlacesError("Nearby places failed to load. Try searching again.");
      setPlacesState("error");
    }
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setShowSuggestions(false);

    const trimmedQuery = query.trim();

    if (trimmedQuery.length < 3) {
      setError("Enter at least 3 characters to search.");
      setSearchState("error");
      return;
    }

    setSearchState("loading");
    setError("");
    setPlacesState("idle");
    setPlacesError("");
    setPlaceGroups([]);
    setCategoryScores([]);
    setOverallScore(null);

    try {
      const response = await fetch(
        `/api/geocode?query=${encodeURIComponent(trimmedQuery)}`,
      );
      const data = (await response.json()) as GeocodeSuccess | GeocodeFailure;

      if (!response.ok || !data.ok) {
        setError(data.ok ? "Could not geocode this location." : data.error);
        setSearchState("error");
        return;
      }

      setLocation(data.location);
      setSearchState("success");
      await loadNearbyPlaces(data.location);
    } catch {
      setError("Search failed. Check your connection and try again.");
      setSearchState("error");
    }
  }

  function handleSuggestionSelect(suggestion: AddressSuggestion) {
    setQuery(suggestion.text);
    setSelectedSuggestionText(suggestion.text);
    setSuggestions([]);
    setShowSuggestions(false);
    setActiveSuggestionIndex(-1);
  }

  function handleLocationKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!showSuggestions || suggestions.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSuggestionIndex((index) => (index + 1) % suggestions.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestionIndex(
        (index) => (index - 1 + suggestions.length) % suggestions.length,
      );
      return;
    }

    if (event.key === "Enter" && activeSuggestionIndex >= 0) {
      event.preventDefault();
      handleSuggestionSelect(suggestions[activeSuggestionIndex]);
      return;
    }

    if (event.key === "Escape") {
      setShowSuggestions(false);
      setActiveSuggestionIndex(-1);
    }
  }

  return {
    query,
    setQuery,
    suggestions,
    setSuggestions,
    showSuggestions,
    setShowSuggestions,
    activeSuggestionIndex,
    setActiveSuggestionIndex,
    selectedSuggestionText,
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
  };
}
