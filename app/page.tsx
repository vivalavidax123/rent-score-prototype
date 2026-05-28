const scoreCategories = [
  {
    name: "Shopping",
    score: 82,
    detail: "Supermarkets and retail within easy reach",
    color: "bg-emerald-500",
  },
  {
    name: "Food & Cafes",
    score: 76,
    detail: "Good coverage of cafes, restaurants, and bakeries",
    color: "bg-amber-500",
  },
  {
    name: "Transport",
    score: 65,
    detail: "Useful public transport, but not every route is close",
    color: "bg-sky-500",
  },
  {
    name: "Health",
    score: 70,
    detail: "Pharmacies and clinics nearby for everyday needs",
    color: "bg-rose-500",
  },
  {
    name: "Fitness",
    score: 45,
    detail: "Limited gyms and fitness options in walking distance",
    color: "bg-violet-500",
  },
];

const nearbyPlaces = [
  "Woolworths Metro",
  "Central Station",
  "Neighbourhood Pharmacy",
  "Market Lane Cafe",
];

export default function Home() {
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

            <div className="w-full rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-left sm:w-40">
              <p className="text-sm font-medium text-emerald-800">Example score</p>
              <p className="mt-1 text-4xl font-bold text-emerald-950">72</p>
              <p className="text-sm text-emerald-800">out of 100</p>
            </div>
          </div>

          <form className="rounded-lg border border-slate-200 bg-slate-50 p-3 shadow-inner">
            <label
              htmlFor="location"
              className="mb-2 block text-sm font-semibold text-slate-800"
            >
              Address or suburb
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                id="location"
                type="text"
                placeholder="Try: Parramatta NSW"
                className="min-h-12 flex-1 rounded-md border border-slate-300 bg-white px-4 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
              />
              <button
                type="submit"
                className="min-h-12 rounded-md bg-slate-950 px-6 text-base font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-300"
              >
                Search
              </button>
            </div>
          </form>

          <div className="mt-8">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-slate-950">Score breakdown</h2>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                Prototype data
              </span>
            </div>

            <div className="space-y-4">
              {scoreCategories.map((category) => (
                <article
                  key={category.name}
                  className="rounded-lg border border-slate-200 bg-white p-4"
                >
                  <div className="mb-3 flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-slate-950">
                        {category.name}
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        {category.detail}
                      </p>
                    </div>
                    <p className="shrink-0 text-lg font-bold text-slate-950">
                      {category.score}/100
                    </p>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className={`h-2 rounded-full ${category.color}`}
                      style={{ width: `${category.score}%` }}
                    />
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-950">Location preview</h2>
            <div className="mt-5 aspect-[4/3] overflow-hidden rounded-lg border border-slate-200 bg-[#dfe8e3]">
              <div className="grid h-full grid-cols-3 grid-rows-3 gap-1 p-3">
                <div className="rounded-md bg-white/70" />
                <div className="rounded-md bg-emerald-200" />
                <div className="rounded-md bg-white/70" />
                <div className="rounded-md bg-sky-200" />
                <div className="relative rounded-md bg-white shadow-sm">
                  <div className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white bg-emerald-600 shadow-md" />
                </div>
                <div className="rounded-md bg-white/70" />
                <div className="rounded-md bg-white/70" />
                <div className="rounded-md bg-amber-200" />
                <div className="rounded-md bg-white/70" />
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              A live map can show nearby amenities once the search and places API
              are connected.
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-950">Nearby signals</h2>
            <ul className="mt-4 space-y-3">
              {nearbyPlaces.map((place) => (
                <li
                  key={place}
                  className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-4 py-3 text-sm text-slate-700"
                >
                  <span>{place}</span>
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </section>
    </main>
  );
}
