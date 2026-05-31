# Rent Score Prototype

A web-based prototype that helps renters evaluate the convenience and livability of a location based on nearby amenities and services.

The system allows users to search for an address, suburb, street, or approximate location, then generates convenience scores using nearby facilities such as shopping centres, cafes, gyms, fuel stations, pharmacies, post offices, and public transport.

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
* Provide explanations for score calculations

---

# Example Categories

The scoring system evaluates convenience using categories such as:

| Category          | Example Amenities                     |
| ----------------- | ------------------------------------- |
| Shopping          | Supermarkets, shopping centres        |
| Food & Cafes      | Cafes, restaurants, bakeries          |
| Fitness           | Gyms, fitness centres                 |
| Transport         | Train stations, tram stops, bus stops |
| Health            | Pharmacies, clinics, hospitals        |
| Services          | Post offices, banks                   |
| Fuel & Automotive | Fuel stations                         |

---

# Example Output

```text
Shopping: 82/100
Food & Cafes: 76/100
Transport: 65/100
Fitness: 45/100
Health: 70/100

Overall Rent Convenience Score: 72/100
```

---

# Proposed Scoring Logic

Each category score is based on:

* Number of nearby amenities
* Distance to the closest amenities
* Weighted importance of the category

Example factors:

* More supermarkets nearby → higher shopping score
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

## APIs & Services

* Google Places API
* Google Geocoding API
* Google Maps or Mapbox

## Deployment

* Vercel

---

# Project Structure

```text
rent-score-prototype/
├── app/
│   ├── api/
│   │   ├── geocode/
│   │   └── places/
│   ├── lib/
│   │   ├── categories.ts
│   │   └── scoring.ts
│   ├── layout.tsx
│   └── page.tsx
├── public/
├── dev_notes.md
├── README.md
├── package.json
└── .env.local
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
* Public transport accessibility metrics
* Walkability scoring
* User accounts and saved locations
* Historical suburb trend analysis
* AI-generated suburb summaries
* Mobile-friendly optimisation

---

# Notes

This project is a prototype intended for experimentation and demonstration purposes.

The scoring system is not intended to represent official property valuations or guarantee rental quality.
