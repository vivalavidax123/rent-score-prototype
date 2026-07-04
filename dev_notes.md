# Development Notes

## Current Product Direction

The application is a functional prototype for evaluating rental locations by nearby everyday amenities. The near-term priority is a working MVP over production infrastructure, accounts, saved searches, or advanced scoring inputs.

The UI direction is now amenities-first. Overall score and category scores are intentionally compact summary elements, while nearby amenities, the map, and additional location indicators carry the main result detail. This keeps the interface closer to a decision dashboard than a score report.

## Full-Stack Status

The project can be described as a full-stack Next.js prototype because it includes:

* a React/Next.js frontend
* server-side route handlers under `app/api/*`
* API integrations with Google Places, Google Geocoding, Google Maps, and optional Transitland
* backend business logic for category retrieval, filtering, deduplication, scoring, and transport enrichment
* environment-based server and browser API key configuration

It should not yet be described as a production full-stack platform. The backend layer is request/response API orchestration rather than a persistent application backend.

Missing production-grade full-stack pieces:

* **Authentication:** needed for accounts, saved searches, personal comparisons, and user-specific settings. Deliberately deferred; the schema can later add a user ID column to `SearchLocation`.
* **Backend operations:** no rate limiting, background jobs, observability, structured logging, or error tracking. Request caching now exists via the database snapshot cache.
* **Admin/data management:** category weights and brand lists are code-managed; there is no admin UI or config storage.
* **First-party datasets:** rent trends, crime/safety, schools, childcare, population density, and planning/development signals are placeholders until dedicated sources are integrated.

## Persistence and Caching

Database persistence was added with Prisma 6 and SQLite (`prisma/dev.db`, ignored by git). Prisma 7 was intentionally avoided for now because it requires a driver-adapter setup; upgrade later with the official guide if needed.

Two tables in `prisma/schema.prisma`:

* **SearchLocation:** one row per searched location. `cacheKey` is the lat/lng rounded to 4 decimal places (~11 m), so repeat searches of the same spot reuse the row even if geocoding jitters.
* **ScoreSnapshot:** one row per computed result, holding `overallScore` plus the full category scores and place groups as JSON strings (SQLite has no native JSON column in Prisma). Multiple snapshots per location preserve history.

Flow in `/api/places`: look up the newest snapshot for the cache key; if it is younger than 24 hours, return it with `cached: true` and skip all Google calls. Otherwise fetch from Google, score, save a new snapshot, and return `cached: false`. Database errors are caught and logged so a broken database degrades to a normal Google lookup instead of failing the search.

Supporting pieces:

* `app/lib/db.ts` — PrismaClient singleton guarded against dev hot-reload connection leaks.
* `app/lib/services/searchStore.ts` — cache key builder, snapshot lookup/save, recent-search and saved-location listing, and save/unsave.
* `/api/history` — returns recent searches ordered by `lastSearchedAt`.
* `RecentSearches` component — chips under the search form; clicking one re-runs the search from stored coordinates without geocoding.
* The UI shows a small "loaded from saved results" note when a response came from cache.

## Saved Locations

Users can star any recent search to keep it permanently. Implementation:

* `SearchLocation.savedAt DateTime?` — null means not saved; a timestamp doubles as the save date and the sort key for the saved list. Same pattern as soft-delete `deletedAt` columns.
* `/api/favourites` — REST verbs on one route: GET lists saved locations, POST (`{ locationId }`) saves, DELETE (`?id=`) unsaves. Input is validated at the route boundary: missing/invalid ids answer 400, unknown ids answer 404 (Prisma error `P2025` is caught in `setLocationSaved` and mapped to `false`).
* `RecentSearches` renders both a "Saved locations" and a "Recent searches" chip row. Each chip is a div with two sibling buttons (address re-runs the search, star toggles saving) because HTML forbids nesting buttons. After a toggle the component refetches both lists instead of hand-editing local state, keeping the database the single source of truth.

This completes CRUD coverage over the persistence layer (create/read via search caching, update via save toggling; snapshot deletion is still only via cascade).

### Why these choices

* **Nullable timestamp instead of a boolean `isSaved`.** One column carries two facts — whether it is saved and when — so the saved list can sort by save date without another column and another migration. Timestamps-as-state is a widely used pattern (`deletedAt`, `verifiedAt`, `publishedAt`).
* **Validation lives at the API boundary, not in the service layer.** The route is the front door: everything past it can assume clean input, so `searchStore` stays free of defensive checks and is easier to read and test. Error codes are deliberately split — 400 means "your request is malformed", 404 means "well-formed but no such row", 500 means "our bug" — because callers debug very different problems depending on which one they get.
* **Refetch after every mutation instead of hand-editing component state.** The database is the single source of truth; the UI is a mirror of it (`UI = f(data)`). Hand-edited local state can drift — e.g. a star lights up even though the request failed, or two open tabs disagree. The cost is one extra GET per toggle, which is trivial for a prototype and removes a whole class of sync bugs.
* **Route handlers only translate HTTP; `searchStore` owns all Prisma calls.** Swapping SQLite for Postgres, adding caching, or writing tests touches one file instead of every route. This is the same layering as Controller → Service → Repository in Spring-style backends.
* **One component owns both chip rows.** Saved and Recent refresh at exactly the same moments (page load, search completion, star toggle); a single fetch effect guarantees they can never fall out of sync with each other.

`DATABASE_URL` lives in `.env` (Prisma CLI reads `.env`, not `.env.local`). An older unfinished persistence attempt had left a PostgreSQL `DATABASE_URL` in `.env.local` and an empty migration folder; both were cleaned up because `.env.local` overrides `.env` in Next.js and was breaking the SQLite connection.

## Comparison View

Two saved locations can be compared side by side. Implementation:

* `/api/compare?a=id1&b=id2` — GET with query params (a read-only endpoint, so the whole comparison is shareable as a URL). Both snapshot lookups run through `Promise.all` so total latency is the slower query, not the sum. Missing/equal ids answer 400, unknown ids 404.
* `getComparisonSide` in `searchStore` returns a location plus its latest snapshot with the full `CategoryScore[]` parsed back out of `scoresJson` — the read-side twin of the `JSON.stringify` done at save time.
* `ComparePanel` renders two controlled selects over the saved list and fetches automatically once both sides are chosen. The higher score per row is highlighted. It renders nothing until at least two locations are saved.

### Why these choices

* **State lifted into `useSavedSearches`.** The chips and the comparison panel both need the saved list; if each fetched its own copy they would drift apart after a star toggle. The hook owns one copy in `page.tsx` and both components receive it as props — `RecentSearches` became purely presentational in the process.
* **No new database columns or Google calls.** Comparison is a pure read over existing snapshots — the payoff of persisting results in week one.
* **Stale-selection guard.** If a location is unstarred while selected in a dropdown, an effect clears that selection so the UI and the saved list never disagree.

Recommended next full-stack milestone: deploy to Vercel with a hosted Postgres (swap the Prisma datasource provider), since the core loop — search, score, save, compare — is now complete. Authentication remains the follow-up after that if multi-user support becomes a goal.

## Category Configuration

Category metadata lives in `app/lib/categories.ts` instead of inside the Places API route. This keeps one source of truth for:

* category IDs and labels
* score weights
* UI colors
* branded search terms
* generic Google Places types

This avoids duplicating category labels, weights, or colors between the API, scoring logic, and UI.

Places should be assigned to one primary category only. Category order is also the dedupe priority:

1. Shopping Centres
2. Groceries
3. Food & Cafes
4. Transport
5. Health
6. Fitness
7. Fuel & Automotive
8. Services

This keeps mixed-use results such as fast food, fuel stations, convenience stores, and banks from appearing in multiple score buckets.

## Places Retrieval

The search bar uses a server-side autocomplete route backed by Google Places Autocomplete (New). Suggestions are restricted to Australia, keep the Google API key server-side, and feed the selected suggestion text into the existing geocoding flow.

The Places API route combines two kinds of results:

* Brand matches, such as Woolworths, Coles, Chemist Warehouse, Australia Post, or major gyms.
* Generic nearby places, such as supermarkets, cafes, restaurants, pharmacies, banks, post offices, fuel stations, and transit stations.

Brand results use Google Places Text Search because brand names are query text. Generic results use Google Places Nearby Search with included place types. Results are deduped by Google place ID, and a brand match is kept over a generic match when the same place appears in both result sets.

Category-level duplicate place IDs are filtered after retrieval using the category priority above. Shopping Centres use a 10 km search radius; the other MVP categories use the default 3 km radius.

Within each category, returned places are sorted for display by Google review count, then rating, then distance. Scoring still calculates closest distance from all places in the category, so popularity ordering does not weaken the proximity score.

Transport is the exception to the general category retrieval. It shows up to four nearest bus stops within 1 km, or the closest bus stops from a wider fallback search if none are found within 1 km. It also shows one nearest metro/train station from nearby rail station results, and one nearest V/Line station with no hard distance cutoff. Bus stops query both Google Places `bus_stop` and `bus_station` types so ordinary stop-level results are not missed.

When `TRANSITLAND_API_KEY` is configured, the transport lookup prefers Transitland bus stop data and enriches each returned bus stop with upcoming distinct route numbers, destinations, and departure times. Google Places remains the fallback for bus stops if Transitland is not configured or does not return nearby matches. V/Line classification is based on the local station list in `app/lib/vline-stations.txt`, which avoids relying on Google Places to label regional rail stations consistently. Transport rows do not show review counts because popularity is less useful for stops and stations.

## Search Criteria Refinements

To guarantee high-quality results, the API applies strict filtering:
* **Review Thresholds:** Any non-transport place returned from Google Places with fewer than 30 reviews is globally excluded from scoring and the UI.
* **Narrow Categories:** The Fuel & Automotive category strictly searches for `gas_station` and specific auto parts brands, intentionally filtering out minor local mechanics (`car_repair`). The Services category strictly searches for `post_office` and `bank`, dropping standalone ATMs.

## Scoring V2

The scoring algorithm assigns each category a score out of 100, which is split across three pillars:
1. **Proximity Score (Max 50 points):** Uses a stepped decay based on typical Australian travel norms. Walkable distances (<500m) score a perfect 50, short drives (<2000m) score 40, and longer normal drives linearly scale down to a baseline of 15 points (accommodating Australian driving norms where having a car is common).
2. **Variety Score (Max 30 points):** Rewards the quantity of amenities found, but caps differently based on the category type. High-variety categories (Food & Cafes, Fitness) require 5+ places to maximize points, whereas low-variety categories (Groceries, Transport, Services, Shopping) hit max points with just 2 places.
3. **Quality Score (Max 20 points):** Evaluates the average user rating of the top 3 best-rated businesses in that category. An average of 4.5+ awards 20 points, 4.0+ awards 15 points, and below 4.0 awards 5 points. Locations without ratings (like Transit stops) default to full points to avoid penalization.

Overall score remains a weighted average of these individual category scores. Future scoring can add better walking-distance estimates, public transport frequency, school data, safety signals, and rental price context.

## Provider Choice

Google Maps and Google Places remain the primary providers for geocoding, place retrieval, and map rendering. Transitland is used only as optional transport enrichment because Google Places can identify bus stops but does not expose stop-level route numbers, destinations, or departures.

## Map Preview

The location preview uses the Google Maps JavaScript API through `NEXT_PUBLIC_MAPS_API_KEY`. The same underlying Google Cloud project can be used as the server key, but the browser-exposed key must be restricted by HTTP referrer.

The first map version shows:

* one primary marker for the searched location
* category-colored markers for nearby amenities
* slightly larger markers for brand matches
* marker popups with name, category, distance, and address

Nearby place latitude and longitude are included in the `/api/places` response so the map can render amenity markers without making extra client-side Places requests.

## Amenities-First UI

The main page layout is split into a wider left column and narrower right column:

* Left column: search, compact overall score, compact category scores, and nearby amenities.
* Right column: map preview and additional indicators.

`NearbyPlacesList` is now part of the primary result area rather than a side panel. It summarizes total places found and the nearest amenity, then displays each category as a dense card with the closest visible place rows. This is intended to make the actual nearby services easier to inspect than the score math.

`ScoreBreakdown` remains compact and uses category score, count, closest distance, and a short progress bar. Longer category explanations are deliberately omitted from the main UI for now so they do not compete with amenities.

## Additional Indicators

`AdditionalIndicators` renders below the map in the right column. It separates currently derived indicators from future dataset placeholders.

Currently derived indicators:

* **Walkability:** Uses straight-line distance estimates from current nearby place results. Walking time is estimated at 80 metres per minute. It shows the nearest bus stop/route, nearest major grocery, and nearest shopping centre as separate rows so long names can wrap.
* **Transit access:** Uses the transport category score, closest transport distance, and available Transitland departure counts when configured.
* **Amenity density:** Uses total nearby places across all current categories.
* **Daily convenience:** Averages groceries, food, health, services, and shopping category scores.
* **Car reliance:** Estimates whether core categories are beyond short walking range, with fuel/automotive availability providing a small offset.

Walkability grocery selection is intentionally restricted to major supermarket brands: Coles, Woolworths, Aldi, and IGA. Nearby grocery-like places such as specialty food stores are still useful in the amenities list and category scoring, but they are not used as the headline walkability grocery target.

The walkability badge color is based on average estimated walking time to the nearest bus, major grocery, and shopping centre:

* 10 minutes or less: green
* 15 minutes or less: blue
* 25 minutes or less: amber
* above 25 minutes: slate

Planned indicators are shown as placeholders and must not be treated as live data until dedicated sources are added:

* population density
* median rent / rent trend
* schools / childcare
* safety
* planned development

## Deferred Work

Deployment, authentication, saved locations, AI summaries, crime data, school quality, and rental price analysis are deferred. Map/list interactions, such as clicking a list item to focus the matching marker, are also deferred.

## Architecture Refactoring

To improve maintainability, the bloated monolithic files (`app/page.tsx` and `app/api/places/route.ts`) have been refactored using component-based and service-layer patterns:
- **Shared code:** Extracted TypeScript interfaces to `app/lib/types.ts` and generic formatters to `app/lib/utils.ts`.
- **Frontend Components:** Split `app/page.tsx` into a layout orchestrator coordinating `SearchForm`, `ScoreBreakdown`, and `NearbyPlacesList`. Complex React state and search side-effects were extracted into `app/hooks/useLocationSearch.ts`.
- **Backend Services:** Separated API integration logic into dedicated services (`app/lib/services/googlePlaces.ts` and `app/lib/services/transitland.ts`), leaving `app/api/places/route.ts` responsible only for request coordination and score computation.

*Note on Transitland API Refactor Issue:* During the initial service extraction, an issue occurred where Transitland bus stops were returned without fetching their distinct route departures. This was quickly identified and patched by ensuring `fetchTransitlandBusDepartures` iterates over the sorted stops and attaches `transportServices` prior to returning to the places route.
