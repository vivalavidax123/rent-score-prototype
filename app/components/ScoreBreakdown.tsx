import type { CategoryScore, PlacesState } from "../lib/types";

type ScoreBreakdownProps = {
  placesState: PlacesState;
  categoryScores: CategoryScore[];
  placesError: string;
};

export function ScoreBreakdown({ placesState, categoryScores, placesError }: ScoreBreakdownProps) {
  return (
    <div className="mt-8">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-slate-950">Score breakdown</h2>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
          {placesState === "success" ? "Live nearby data" : "Search required"}
        </span>
      </div>

      {placesState === "idle" ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
          Search for a location to calculate scores from nearby shops,
          shopping centres, services, transport, health, food, and fitness
          options.
        </p>
      ) : null}

      {placesState === "loading" ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-600">
          Loading nearby amenities and calculating scores...
        </p>
      ) : null}

      {placesState === "error" ? (
        <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {placesError}
        </p>
      ) : null}

      {placesState === "success" ? (
        <div className="space-y-4">
          {categoryScores.map((category) => (
            <article
              key={category.id}
              className="rounded-lg border border-slate-200 bg-white p-4"
            >
              <div className="mb-3 flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-slate-950">
                    {category.label}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {category.explanation}
                  </p>
                </div>
                <p className="shrink-0 text-lg font-bold text-slate-950">
                  {category.score}/100
                </p>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div
                  className={`h-2 rounded-full ${category.colorClass}`}
                  style={{ width: `${category.score}%` }}
                />
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">
                {category.detail}
              </p>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}
