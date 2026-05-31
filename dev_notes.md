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

## Places Retrieval

The Places API route combines two kinds of results:

* Brand matches, such as Woolworths, Coles, Chemist Warehouse, Australia Post, or major gyms.
* Generic nearby places, such as supermarkets, cafes, restaurants, pharmacies, banks, post offices, fuel stations, and transit stations.

Brand results use Google Places Text Search because brand names are query text. Generic results use Google Places Nearby Search with included place types. Results are deduped by Google place ID, and a brand match is kept over a generic match when the same place appears in both result sets.

## Scoring V1

The first scoring model intentionally stays simple and explainable:

* more nearby matches increase a category score
* closer matches increase a category score
* each category score is capped at 100
* overall score is a weighted average of category scores

This model is useful for a prototype but is not a final rental quality or property valuation model. Future scoring can add better walking-distance estimates, public transport frequency, school data, safety signals, and rental price context.

## Provider Choice

Google Maps and Google Places remain the provider for this phase because the app already uses Google Geocoding and Places APIs. Adding another provider before the core score flow is stable would add token/configuration complexity without improving the MVP enough.

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
