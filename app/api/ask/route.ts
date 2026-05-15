import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AskPayload = {
  question?: string;
  context?: unknown;
};

function buildContextSummary(context: any) {
  if (!context) return "No dashboard context was provided.";

  const selectedCamera = context.selectedCamera;
  const selectedShip = context.selectedShip;
  const selectedFlight = context.selectedFlight;
  const counts = context.counts || {};

  return JSON.stringify(
    {
      counts,
      selectedCamera: selectedCamera
        ? {
            name: selectedCamera.name,
            location: selectedCamera.location,
            status: selectedCamera.status,
            density: selectedCamera.density,
            speed: selectedCamera.speed,
          }
        : null,
      selectedShip: selectedShip
        ? {
            name: selectedShip.name,
            type: selectedShip.type,
            status: selectedShip.status,
            speed: selectedShip.speed,
            heading: selectedShip.heading,
            destination: selectedShip.destination,
            eta: selectedShip.eta,
            source: selectedShip.source,
          }
        : null,
      selectedFlight: selectedFlight
        ? {
            callsign: selectedFlight.callsign,
            icao24: selectedFlight.icao24,
            status: selectedFlight.status,
            altitude: selectedFlight.altitude,
            velocity: selectedFlight.velocity,
            origin: selectedFlight.origin,
            destination: selectedFlight.destination,
            source: selectedFlight.source,
          }
        : null,
      shipFeedStatus: context.shipFeedStatus,
      flightFeedStatus: context.flightFeedStatus,
      visibleShips: context.visibleShips,
      savedFlights: context.savedFlights,
      activeAlerts: context.activeAlerts,
      layers: context.layers,
    },
    null,
    2
  );
}

function extractGeminiText(data: any) {
  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((part: any) => part.text || "")
      ?.join("")
      ?.trim() || "";

  const finishReason = data?.candidates?.[0]?.finishReason;

  if (!text && finishReason) {
    return `Gemini returned no text. Finish reason: ${finishReason}`;
  }

  return text;
}

function getGeminiConfig() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  return { apiKey, model };
}

export async function GET() {
  const { apiKey, model } = getGeminiConfig();

  return NextResponse.json({
    route: "/api/ask",
    provider: "Gemini",
    configured: Boolean(apiKey),
    model,
    keyPreview: apiKey ? `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}` : null,
    message: apiKey
      ? "Gemini API key detected. Use POST /api/ask to ask Atlas AI."
      : "Missing GEMINI_API_KEY in .env.local.",
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AskPayload;
    const question = body.question?.trim();

    if (!question) {
      return NextResponse.json(
        { error: "Question is required." },
        { status: 400 }
      );
    }

    const { apiKey, model } = getGeminiConfig();

    if (!apiKey) {
      return NextResponse.json(
        {
          error: "GEMINI_API_KEY is missing.",
          hint:
            "Add GEMINI_API_KEY=your_real_key_here to .env.local, then stop and restart npm run dev.",
        },
        { status: 500 }
      );
    }

    const dashboardContext = buildContextSummary(body.context);

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
      apiKey
    )}`;

    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text:
                "You are Atlas AI inside a command-center dashboard. Give concise operational answers. Use the dashboard context. If the user asks to take an action the app cannot perform yet, explain the next manual step clearly. Do not invent live data.",
            },
          ],
        },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Dashboard context:\n${dashboardContext}\n\nUser question:\n${question}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 700,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            data?.error?.message ||
            "Gemini request failed. Check your API key, model name, or quota.",
          provider: "Gemini",
          model,
          status: response.status,
          details: data?.error || data,
        },
        { status: response.status }
      );
    }

    const answer = extractGeminiText(data);

    return NextResponse.json({
      answer: answer || "No answer returned by Gemini.",
      source: "Atlas AI via Gemini",
      model,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Atlas AI route failed.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
