export type RentScoreCategory = {
  id: string;
  label: string;
  weight: number;
  colorClass: string;
  detail: string;
  brandTerms: string[];
  placeTypes: string[];
};

export const searchRadiusMeters = 3000;

export const rentScoreCategories: RentScoreCategory[] = [
  {
    id: "shopping",
    label: "Shopping",
    weight: 20,
    colorClass: "bg-emerald-500",
    detail: "Supermarkets and everyday retail options nearby",
    brandTerms: ["Woolworths", "Coles", "ALDI", "IGA"],
    placeTypes: ["supermarket", "shopping_mall", "store"],
  },
  {
    id: "food",
    label: "Food & Cafes",
    weight: 15,
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
    colorClass: "bg-sky-500",
    detail: "Public transport stops and stations within reach",
    brandTerms: ["Sydney Trains", "Metro station", "light rail station"],
    placeTypes: ["train_station", "bus_station", "subway_station", "light_rail_station"],
  },
  {
    id: "health",
    label: "Health",
    weight: 15,
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
    id: "services",
    label: "Services",
    weight: 10,
    colorClass: "bg-indigo-500",
    detail: "Banks, post offices, and practical services nearby",
    brandTerms: ["Australia Post", "Commonwealth Bank", "ANZ", "NAB", "Westpac"],
    placeTypes: ["post_office", "bank", "atm"],
  },
  {
    id: "fuel",
    label: "Fuel & Automotive",
    weight: 10,
    colorClass: "bg-orange-500",
    detail: "Fuel stations and car-related services nearby",
    brandTerms: ["Ampol", "BP", "Shell", "7-Eleven"],
    placeTypes: ["gas_station", "car_repair"],
  },
];
