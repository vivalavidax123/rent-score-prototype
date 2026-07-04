# Rent Score Prototype

A web-based prototype that helps renters evaluate the convenience and livability of a location based on nearby amenities and services.

The system allows users to search for an address, suburb, street, or approximate location, then generates convenience scores using nearby facilities such as shopping centres, groceries, cafes, gyms, fuel stations, pharmacies, post offices, and public transport.

This project is intended as a functional prototype rather than a production-ready platform.

---

# Project Goals

The purpose of this prototype is to:

* Help renters quickly evaluate the convenience of a location
* Demonstrate location-based scoring using real-world map/place APIs
* Visualise nearby amenities on an interactive map
* Provide a simple and understandable scoring breakdown
* Explore how geographic data can improve rental decision-making

---

# Core Features

## MVP Features

* Search for an address or suburb
* Convert search input into geographic coordinates
* Retrieve nearby amenities from map/place APIs
* Calculate category-based convenience scores
* Display an overall location score
* Show nearby places on an interactive map
* Highlight nearby amenities as the primary result detail
* Provide compact explanations for score calculations
* Save favourite locations and compare two of them side by side
* Show additional derived indicators such as walkability, transit access, amenity density, daily convenience, and car reliance

---

# Example Categories

The scoring system evaluates convenience using categories such as:

| Category          | Example Amenities                     |
| ----------------- | ------------------------------------- |
| Shopping Centres | Shopping malls, retail hubs           |
| Groceries         | Supermarkets, grocery stores          |
| Food & Cafes      | Cafes, restaurants, bakeries          |
| Fitness           | Gyms, fitness centres                 |
| Transport         | Train stations, tram stops, bus stops |
| Health            | Pharmacies, clinics, hospitals        |
| Services          | Post offices, banks                   |
| Fuel & Automotive | Fuel stations                         |

---

# Example Output

```text
Shopping Centres: 78/100
Groceries: 82/100
Food & Cafes: 76/100
Transport: 65/100
Fitness: 45/100
Health: 70/100

Overall Rent Convenience Score: 72/100
```

The current UI uses a compact dashboard layout: overall and category scores are intentionally small, while nearby amenities and map context receive more space. Additional indicators appear beside the map and distinguish between values derived from the current amenity data and planned future datasets.

---

# Proposed Scoring Logic

Each category score is based on:

* Number of nearby amenities
* Distance to the closest amenities
* Weighted importance of the category

Example factors:

* More supermarkets nearby -> higher groceries score
* Closer shopping centres within 10 km -> higher shopping centres score
* Closer train stations → higher transport score
* Fewer gyms nearby → lower fitness score

The overall score is calculated using weighted averages across all categories.

---

# Tech Stack

## Frontend

* Next.js
* React
* TypeScript
* Tailwind CSS

## Data & Persistence

* Prisma 6 (ORM + migrations)
* SQLite (local file database for searched locations and cached score results)

## APIs & Services

* Google Places API
* Google Geocoding API
* Google Maps or Mapbox

## Deployment

* Vercel

---

# Full-Stack Status

This is a full-stack Next.js prototype: the frontend UI, API routes, scoring/business logic, database persistence, and third-party data integrations live in one application.

Persistence is now included: searches, cached score results, recent-search history, and starred favourite locations are stored in a local SQLite database managed with Prisma. Implementation details and design rationale live in `dev_notes.md`.

It is not yet a production full-stack platform. The main missing pieces are:

* Authentication and user sessions
* Admin tooling for managing scoring weights and category configuration outside code
* Production backend safeguards such as rate limiting, observability, background jobs, and error tracking
* First-party or ingested datasets for rent trends, safety, schools, population density, and planning data

---

# Project Structure

```text
rent-score-prototype/
├── app/
│   ├── api/
│   │   ├── autocomplete/
│   │   ├── favourites/
│   │   ├── geocode/
│   │   ├── history/
│   │   └── places/
│   ├── components/
│   │   ├── AdditionalIndicators.tsx
│   │   ├── LocationMap.tsx
│   │   ├── NearbyPlacesList.tsx
│   │   ├── RecentSearches.tsx
│   │   ├── ScoreBreakdown.tsx
│   │   └── SearchForm.tsx
│   ├── hooks/
│   │   └── useLocationSearch.ts
│   ├── lib/
│   │   ├── categories.ts
│   │   ├── db.ts
│   │   ├── scoring.ts
│   │   └── services/
│   ├── layout.tsx
│   └── page.tsx
├── prisma/
│   ├── migrations/
│   ├── schema.prisma
│   └── dev.db (local, not committed)
├── public/
├── dev_notes.md
├── README.md
├── package.json
├── .env (DATABASE_URL, not committed)
└── .env.local (API keys, not committed)
```

---

# Development Roadmap

## Phase 1 — Initial Setup

* Create Next.js project
* Configure Tailwind CSS
* Set up GitHub repository
* Create initial homepage UI

## Phase 2 — Search & Geocoding

* Add address search input
* Convert addresses into latitude/longitude
* Handle invalid search results

## Phase 3 — Nearby Place Retrieval

* Query nearby amenities using APIs
* Organise results by category
* Display nearby places on map

## Phase 4 — Scoring System

* Implement category scoring logic
* Implement weighted overall score
* Add score explanations

## Phase 5 — UI Improvements

* Improve responsiveness
* Add loading states
* Improve map interactions
* Add category filters
* Refine amenities-first result layout
* Add derived and planned location indicators

## Phase 6 — Deployment

* Deploy prototype to Vercel
* Configure environment variables
* Test production deployment

---

# Environment Variables

Create a `.env.local` file:

```env
GOOGLE_MAPS_API_KEY=YOUR_API_KEY
NEXT_PUBLIC_MAPS_API_KEY=YOUR_PUBLIC_KEY
TRANSITLAND_API_KEY=YOUR_TRANSITLAND_KEY
```

`TRANSITLAND_API_KEY` is optional and is used to show bus route numbers and destinations for nearby bus stops.

Also create a `.env` file for the database (the Prisma CLI reads `.env`, not `.env.local`):

```env
DATABASE_URL="file:./dev.db"
```

---

# Installation

## Clone Repository

```bash
git clone https://github.com/YOUR_USERNAME/rent-score-prototype.git
cd rent-score-prototype
```

## Install Dependencies

```bash
npm install
```

## Create the Database

```bash
npx prisma migrate dev
```

This creates the local SQLite file at `prisma/dev.db` and applies all migrations. To browse the data visually, run `npm run db:studio`.

## Start Development Server

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

---

# Future Improvements

Potential future features include:

* Crime and safety scoring
* School quality integration
* Rental price analysis
* More detailed public transport accessibility metrics
* Walkability based on real walking routes instead of straight-line distance estimates
* Population density, suburb rent trends, schools, childcare, safety, and planned development datasets
* User accounts and saved locations
* Historical suburb trend analysis
* AI-generated suburb summaries
* Mobile-friendly optimisation

---

# Notes

This project is a prototype intended for experimentation and demonstration purposes.

The scoring system is not intended to represent official property valuations or guarantee rental quality.
