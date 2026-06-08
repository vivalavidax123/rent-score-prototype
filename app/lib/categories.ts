export type RentScoreCategory = {
  id: string;
  label: string;
  weight: number;
  radiusMeters: number;
  colorClass: string;
  detail: string;
  brandTerms: string[];
  placeTypes: string[];
};

export const defaultSearchRadiusMeters = 3000;

export const rentScoreCategories: RentScoreCategory[] = [
  {
    id: "shopping_centres",
    label: "Shopping Centres",
    weight: 12,
    radiusMeters: 10000,
    colorClass: "bg-teal-500",
    detail: "Major shopping centres and retail hubs within a broader area",
    brandTerms: ["Westfield", "Stockland", "DFO", "shopping centre", "shopping mall"],
    placeTypes: ["shopping_mall"],
  },
  {
    id: "groceries",
    label: "Groceries",
    weight: 20,
    colorClass: "bg-emerald-500",
    radiusMeters: defaultSearchRadiusMeters,
    detail: "Supermarkets and everyday grocery options nearby",
    brandTerms: ["Woolworths", "Coles", "ALDI", "IGA", "Harris Farm"],
    placeTypes: ["supermarket", "grocery_store"],
  },
  {
    id: "food",
    label: "Food & Cafes",
    weight: 15,
    radiusMeters: defaultSearchRadiusMeters,
    colorClass: "bg-amber-500",
    detail: "Cafes, restaurants, and casual food options nearby",
    brandTerms: [
      "McDonald's",
      "KFC",
      "Hungry Jack's",
      "Guzman y Gomez",
      "Starbucks",
      "Gloria Jean's",
    ],
    placeTypes: ["cafe", "restaurant", "bakery", "meal_takeaway"],
  },
  {
    id: "transport",
    label: "Transport",
    weight: 20,
    radiusMeters: defaultSearchRadiusMeters,
    colorClass: "bg-sky-500",
    detail:
      "Bus stops within 1 km, or closest bus stops if none are found nearby, plus the nearest metro/train and V/Line stations",
    brandTerms: ["Sydney Trains", "Metro station", "light rail station"],
    placeTypes: ["train_station", "bus_station", "subway_station", "light_rail_station"],
  },
  {
    id: "health",
    label: "Health",
    weight: 15,
    radiusMeters: defaultSearchRadiusMeters,
    colorClass: "bg-rose-500",
    detail: "Pharmacies, clinics, and everyday health services nearby",
    brandTerms: [
      "Chemist Warehouse",
      "Priceline Pharmacy",
      "TerryWhite Chemmart",
      "Amcal Pharmacy",
    ],
    placeTypes: ["pharmacy", "doctor", "hospital"],
  },
  {
    id: "fitness",
    label: "Fitness",
    weight: 10,
    radiusMeters: defaultSearchRadiusMeters,
    colorClass: "bg-violet-500",
    detail: "Gyms and fitness facilities in the surrounding area",
    brandTerms: [
      "Anytime Fitness",
      "Fitness First",
      "Snap Fitness",
      "Plus Fitness",
      "Zip Fitness",
    ],
    placeTypes: ["gym"],
  },
  {
    id: "fuel",
    label: "Fuel & Automotive",
    weight: 10,
    radiusMeters: defaultSearchRadiusMeters,
    colorClass: "bg-orange-500",
    detail: "Fuel stations and car-related services nearby",
    brandTerms: ["Ampol", "BP", "Shell", "7-Eleven"],
    placeTypes: ["gas_station", "car_repair"],
  },
  {
    id: "services",
    label: "Services",
    weight: 10,
    radiusMeters: defaultSearchRadiusMeters,
    colorClass: "bg-indigo-500",
    detail: "Banks, post offices, and practical services nearby",
    brandTerms: ["Australia Post", "Commonwealth Bank", "ANZ", "NAB", "Westpac"],
    placeTypes: ["post_office", "bank", "atm"],
  },
];
