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
  const [error, setError] = useState("");

  // A selection can go stale when its location is unstarred; clear it so
  // the select and the state never disagree.
  useEffect(() => {
    if (aId && !saved.some((search) => search.id === aId)) {
      setAId("");
    }

    if (bId && !saved.some((search) => search.id === bId)) {
      setBId("");
    }
  }, [saved, aId, bId]);

  // Fetch automatically once both sides are chosen.
  useEffect(() => {
    if (!aId || !bId || aId === bId) {
      setResult(null);
      setError("");
      return;
    }

    let cancelled = false;

    fetch(`/api/compare?a=${aId}&b=${bId}`)
      .then(
        (response) => response.json() as Promise<CompareSuccess | CompareFailure>,
      )
      .then((data) => {
        if (cancelled) {
          return;
        }

        if (data.ok) {
          setResult({ a: data.a, b: data.b });
          setError("");
        } else {
          setResult(null);
          setError(data.error);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResult(null);
          setError("Comparison failed to load. Try again.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [aId, bId]);

  if (saved.length < 2) {
    return null;
  }

  return (
    <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <h2 className="text-lg font-bold text-slate-950">Compare saved locations</h2>
      <p className="mt-1 text-xs text-slate-600">
        Pick two saved locations to see their category scores side by side.
        The higher score in each row is highlighted.
      </p>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <LocationSelect
          label="Location A"
          value={aId}
          otherValue={bId}
          saved={saved}
          onChange={setAId}
        />
        <LocationSelect
          label="Location B"
          value={bId}
          otherValue={aId}
          saved={saved}
          onChange={setBId}
        />
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {result && (
        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-300 text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2 text-left font-semibold">Category</th>
              <th className="max-w-40 truncate px-3 py-2 text-right font-semibold">
                {result.a.formattedAddress}
              </th>
              <th className="max-w-40 truncate px-3 py-2 text-right font-semibold">
                {result.b.formattedAddress}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-200 bg-white font-semibold">
              <td className="px-3 py-2">Overall</td>
              {scoreCell(result.a.overallScore, result.b.overallScore)}
              {scoreCell(result.b.overallScore, result.a.overallScore)}
            </tr>
            {result.a.scores.map((scoreA) => {
              const scoreB = result.b.scores.find(
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
