"use client";

import { useEffect, useState } from "react";
import type {
  CompareFailure,
  CompareSuccess,
  ComparisonSide,
  RecentSearch,
} from "../lib/types";

type ComparePanelProps = {
  saved: RecentSearch[];
};

type LocationSelectProps = {
  label: string;
  value: string;
  otherValue: string;
  saved: RecentSearch[];
  onChange: (id: string) => void;
};

// Controlled select: the chosen id lives in React state so an effect can
// react to it. The location picked on the other side is disabled to make
// "compare something with itself" unselectable.
function LocationSelect({ label, value, otherValue, saved, onChange }: LocationSelectProps) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-semibold text-slate-500">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm font-normal text-slate-900"
      >
        <option value="">Choose a saved location…</option>
        {saved.map((search) => (
          <option
            key={search.id}
            value={search.id}
            disabled={search.id === otherValue}
          >
            {search.formattedAddress}
          </option>
        ))}
      </select>
    </label>
  );
}

function scoreCell(score: number, otherScore: number) {
  const isWinner = score > otherScore;

  return (
    <td
      className={`px-3 py-2 text-right tabular-nums ${
        isWinner ? "font-bold text-emerald-700" : "text-slate-700"
      }`}
    >
      {Math.round(score)}
    </td>
  );
}

export function ComparePanel({ saved }: ComparePanelProps) {
  const [aId, setAId] = useState("");
  const [bId, setBId] = useState("");
  const [result, setResult] = useState<{ a: ComparisonSide; b: ComparisonSide } | null>(null);
  // Errors are stored with the selection pair they belong to, so an error
  // for an old pair is simply not shown rather than needing a reset.
  const [error, setError] = useState<{ pair: string; message: string } | null>(null);

  // A selection goes stale when its location is unstarred. Instead of
  // fixing the state in an effect (which causes a second render pass),
  // derive the effective value on every render: a stale id counts as
  // "nothing selected" until the user picks again.
  const effectiveAId = saved.some((search) => search.id === aId) ? aId : "";
  const effectiveBId = saved.some((search) => search.id === bId) ? bId : "";

  // Fetch automatically once both sides are chosen. State is only set in
  // the async callbacks — never synchronously in the effect body — and
  // stale results/errors are filtered out at render time instead of being
  // reset here.
  useEffect(() => {
    if (!effectiveAId || !effectiveBId || effectiveAId === effectiveBId) {
      return;
    }

    const pair = `${effectiveAId}|${effectiveBId}`;
    let cancelled = false;

    fetch(`/api/compare?a=${effectiveAId}&b=${effectiveBId}`)
      .then(
        (response) => response.json() as Promise<CompareSuccess | CompareFailure>,
      )
      .then((data) => {
        if (cancelled) {
          return;
        }

        if (data.ok) {
          setResult({ a: data.a, b: data.b });
          setError(null);
        } else {
          setError({ pair, message: data.error });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError({ pair, message: "Comparison failed to load. Try again." });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [effectiveAId, effectiveBId]);

  // Derived at render: only show a result or error that matches what is
  // currently selected.
  const activeResult =
    result && result.a.id === effectiveAId && result.b.id === effectiveBId
      ? result
      : null;
  const activeError =
    error && error.pair === `${effectiveAId}|${effectiveBId}`
      ? error.message
      : "";

  if (saved.length < 2) {
    return null;
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold text-slate-950">Compare saved locations</h2>
      <p className="mt-1 text-xs text-slate-600">
        Pick two saved locations to see their category scores side by side.
        The higher score in each row is highlighted.
      </p>

      <div className="mt-3 flex flex-col gap-3">
        <LocationSelect
          label="Location A"
          value={effectiveAId}
          otherValue={effectiveBId}
          saved={saved}
          onChange={setAId}
        />
        <LocationSelect
          label="Location B"
          value={effectiveBId}
          otherValue={effectiveAId}
          saved={saved}
          onChange={setBId}
        />
      </div>

      {activeError && <p className="mt-3 text-sm text-red-600">{activeError}</p>}

      {activeResult && (
        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-300 text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2 text-left font-semibold">Category</th>
              <th className="max-w-40 truncate px-3 py-2 text-right font-semibold">
                {activeResult.a.formattedAddress}
              </th>
              <th className="max-w-40 truncate px-3 py-2 text-right font-semibold">
                {activeResult.b.formattedAddress}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-200 bg-white font-semibold">
              <td className="px-3 py-2">Overall</td>
              {scoreCell(activeResult.a.overallScore, activeResult.b.overallScore)}
              {scoreCell(activeResult.b.overallScore, activeResult.a.overallScore)}
            </tr>
            {activeResult.a.scores.map((scoreA) => {
              const scoreB = activeResult.b.scores.find(
                (candidate) => candidate.id === scoreA.id,
              );

              if (!scoreB) {
                return null;
              }

              return (
                <tr key={scoreA.id} className="border-b border-slate-200">
                  <td className="px-3 py-2 text-slate-700">{scoreA.label}</td>
                  {scoreCell(scoreA.score, scoreB.score)}
                  {scoreCell(scoreB.score, scoreA.score)}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
