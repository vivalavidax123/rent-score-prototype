# Development Notes

## Current Product Direction

The application is a functional prototype for evaluating rental locations by nearby everyday amenities. The near-term priority is a working MVP over production infrastructure, accounts, saved searches, or advanced scoring inputs.

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

The Places API route combines two kinds of results:

* Brand matches, such as Woolworths, Coles, Chemist Warehouse, Australia Post, or major gyms.
* Generic nearby places, such as supermarkets, cafes, restaurants, pharmacies, banks, post offices, fuel stations, and transit stations.

Brand results use Google Places Text Search because brand names are query text. Generic results use Google Places Nearby Search with included place types. Results are deduped by Google place ID, and a brand match is kept over a generic match when the same place appears in both result sets.

Category-level duplicate place IDs are filtered after retrieval using the category priority above. Shopping Centres use a 10 km search radius; the other MVP categories use the default 3 km radius.

Within each category, returned places are sorted for display by Google review count, then rating, then distance. Scoring still calculates closest distance from all places in the category, so popularity ordering does not weaken the proximity score.

Transport is the exception to the general category retrieval. It shows up to four nearest bus stops within 500 m, one nearest metro/train station from nearby rail station results, and one nearest V/Line station with no hard distance cutoff. Bus stops query both Google Places `bus_stop` and `bus_station` types so ordinary stop-level results are not missed.

When `TRANSITLAND_API_KEY` is configured, the transport lookup prefers Transitland bus stop data and enriches each returned bus stop with upcoming distinct route numbers, destinations, and departure times. Google Places remains the fallback for bus stops if Transitland is not configured or does not return nearby matches. V/Line classification is based on the local station list in `app/lib/vline-stations.txt`, which avoids relying on Google Places to label regional rail stations consistently. Transport rows do not show review counts because popularity is less useful for stops and stations.

## Scoring V1

The first scoring model intentionally stays simple and explainable:

* more nearby matches increase a category score
* closer matches increase a category score
* each category score is capped at 100
* overall score is a weighted average of category scores

This model is useful for a prototype but is not a final rental quality or property valuation model. Future scoring can add better walking-distance estimates, public transport frequency, school data, safety signals, and rental price context.

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

## Deferred Work

Deployment, authentication, saved locations, AI summaries, crime data, school quality, and rental price analysis are deferred. Map/list interactions, such as clicking a list item to focus the matching marker, are also deferred.
