type GoogleAutocompleteSuggestion = {
  placePrediction?: {
    placeId?: string;
    text?: {
      text?: string;
    };
    structuredFormat?: {
      mainText?: {
        text?: string;
      };
      secondaryText?: {
        text?: string;
      };
    };
  };
};

type GoogleAutocompleteResponse = {
  suggestions?: GoogleAutocompleteSuggestion[];
  error?: {
    message?: string;
    status?: string;
  };
};

function parseQuery(value: string | null) {
  return value?.trim() ?? "";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const input = parseQuery(searchParams.get("query"));

  if (input.length < 3) {
    return Response.json({ ok: true, suggestions: [] });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return Response.json(
      {
        ok: false,
        error: "Missing GOOGLE_MAPS_API_KEY in .env.local.",
      },
      { status: 500 },
    );
  }

  const response = await fetch(
    "https://places.googleapis.com/v1/places:autocomplete",
    {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat.mainText.text,suggestions.placePrediction.structuredFormat.secondaryText.text",
      },
      body: JSON.stringify({
        input,
        includedRegionCodes: ["au"],
        includeQueryPredictions: false,
      }),
    },
  );
  const data = (await response.json()) as GoogleAutocompleteResponse;

  if (!response.ok) {
    return Response.json(
      {
        ok: false,
        error: data.error?.message ?? "Autocomplete failed.",
      },
      { status: 502 },
    );
  }

  const suggestions =
    data.suggestions
      ?.map((suggestion) => {
        const prediction = suggestion.placePrediction;
        const text = prediction?.text?.text;

        if (!prediction?.placeId || !text) {
          return null;
        }

        return {
          placeId: prediction.placeId,
          text,
          mainText: prediction.structuredFormat?.mainText?.text ?? text,
          secondaryText:
            prediction.structuredFormat?.secondaryText?.text ?? "",
        };
      })
      .filter((suggestion) => suggestion !== null) ?? [];

  return Response.json({ ok: true, suggestions });
}
