import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AtlasFlight = {
  icao24: string;
  callsign: string;
  originCountry: string;
  longitude: number | null;
  latitude: number | null;
  altitude: number | null;
  velocity: number | null;
  heading: number | null;
  verticalRate: number | null;
  onGround: boolean;
  source: string;
  updatedAt: string;
  origin?: string;
  destination?: string;
  departureTime?: string;
  eta?: string;
  status?: "En Route" | "Landed" | "Delayed" | "Holding" | "Unknown";
};

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase environment variables are missing.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function toNumber(value: unknown): number | null {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function computeRadiusNm({
  lamin,
  lomin,
  lamax,
  lomax,
}: {
  lamin: number;
  lomin: number;
  lamax: number;
  lomax: number;
}) {
  const latSpan = Math.abs(lamax - lamin);
  const lonSpan = Math.abs(lomax - lomin);
  const largestDegreeSpan = Math.max(latSpan, lonSpan);
  const radius = Math.ceil(largestDegreeSpan * 60);
  return Math.max(50, Math.min(radius, 250));
}

async function fetchFromAirplanesLive({
  lamin,
  lomin,
  lamax,
  lomax,
}: {
  lamin: number;
  lomin: number;
  lamax: number;
  lomax: number;
}) {
  const centerLat = (lamin + lamax) / 2;
  const centerLon = (lomin + lomax) / 2;
  const radiusNm = computeRadiusNm({ lamin, lomin, lamax, lomax });

  const response = await fetch(
    `https://api.airplanes.live/v2/point/${centerLat}/${centerLon}/${radiusNm}`,
    {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      flights: [] as AtlasFlight[],
      source: "Airplanes.live",
    };
  }

  const data = await response.json();

  const flights: AtlasFlight[] =
    data.ac?.slice(0, 800).map((aircraft: any) => ({
      icao24: aircraft.hex || "unknown",
      callsign: aircraft.flight?.trim() || aircraft.r || aircraft.hex || "Unknown",
      originCountry: aircraft.country || "Unknown",
      longitude: typeof aircraft.lon === "number" ? aircraft.lon : null,
      latitude: typeof aircraft.lat === "number" ? aircraft.lat : null,
      altitude:
        aircraft.alt_baro === "ground"
          ? 0
          : typeof aircraft.alt_baro === "number"
          ? aircraft.alt_baro
          : null,
      onGround: aircraft.alt_baro === "ground",
      velocity: typeof aircraft.gs === "number" ? aircraft.gs * 0.514444 : null,
      heading: typeof aircraft.track === "number" ? aircraft.track : null,
      verticalRate:
        typeof aircraft.baro_rate === "number" ? aircraft.baro_rate : null,
      source: "Airplanes.live",
      updatedAt: new Date().toISOString(),
      status: aircraft.alt_baro === "ground" ? "Landed" : "En Route",
    })) || [];

  return {
    ok: true,
    status: response.status,
    flights,
    source: "Airplanes.live",
  };
}

async function fetchFromOpenSky({
  lamin,
  lomin,
  lamax,
  lomax,
}: {
  lamin: number;
  lomin: number;
  lamax: number;
  lomax: number;
}) {
  const response = await fetch(
    `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`,
    {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      flights: [] as AtlasFlight[],
      source: "OpenSky Network",
    };
  }

  const data = await response.json();

  const flights: AtlasFlight[] =
    data.states?.slice(0, 800).map((state: any[]) => ({
      icao24: state[0] || "unknown",
      callsign: state[1]?.trim() || state[0] || "Unknown",
      originCountry: state[2] || "Unknown",
      longitude: typeof state[5] === "number" ? state[5] : null,
      latitude: typeof state[6] === "number" ? state[6] : null,
      altitude: typeof state[7] === "number" ? state[7] : null,
      onGround: Boolean(state[8]),
      velocity: typeof state[9] === "number" ? state[9] : null,
      heading: typeof state[10] === "number" ? state[10] : null,
      verticalRate: typeof state[11] === "number" ? state[11] : null,
      source: "OpenSky Network",
      updatedAt: new Date().toISOString(),
      status: state[8] ? "Landed" : "En Route",
    })) || [];

  return {
    ok: true,
    status: response.status,
    flights,
    source: "OpenSky Network",
  };
}

async function fetchFlights(bounds: {
  lamin: number;
  lomin: number;
  lamax: number;
  lomax: number;
}) {
  const providers = [fetchFromAirplanesLive, fetchFromOpenSky];
  const attemptedProviders: string[] = [];

  for (const provider of providers) {
    const result = await provider(bounds);
    attemptedProviders.push(`${result.source}:${result.status}`);

    if (result.ok && result.flights.length > 0) {
      return {
        source: result.source,
        flights: result.flights,
        attemptedProviders,
      };
    }
  }

  return {
    source: "No provider returned aircraft",
    flights: [] as AtlasFlight[],
    attemptedProviders,
  };
}

async function saveFlightsToSupabase(flights: AtlasFlight[], source: string) {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  if (flights.length === 0) {
    await supabase.from("flight_collector_logs").insert({
      provider: source,
      status: "success",
      message: "Collector ran but received no aircraft.",
      records_collected: 0,
    });

    return;
  }

  const validFlights = flights.filter(
    (flight) =>
      flight.icao24 &&
      flight.icao24 !== "unknown" &&
      typeof flight.latitude === "number" &&
      typeof flight.longitude === "number"
  );

  if (validFlights.length === 0) {
    await supabase.from("flight_collector_logs").insert({
      provider: source,
      status: "success",
      message: "Collector received aircraft but no valid positions.",
      records_collected: 0,
    });

    return;
  }

  const latestRows = validFlights.map((flight) => ({
    icao24: flight.icao24,
    callsign: flight.callsign,
    origin_country: flight.originCountry,
    operator: flight.originCountry,
    status: flight.status || "Unknown",
    altitude: flight.altitude,
    velocity: flight.velocity,
    heading: flight.heading,
    vertical_rate: flight.verticalRate,
    on_ground: flight.onGround,
    lat: flight.latitude,
    lng: flight.longitude,
    origin: flight.origin || null,
    destination: flight.destination || null,
    departure_time: flight.departureTime || null,
    eta: flight.eta || null,
    source: flight.source || source,
    last_seen: flight.updatedAt || now,
    updated_at: now,
  }));

  const { error: aircraftError } = await supabase
    .from("aircraft")
    .upsert(latestRows, { onConflict: "icao24" });

  if (aircraftError) throw aircraftError;

  const positionRows = validFlights.map((flight) => ({
    icao24: flight.icao24,
    callsign: flight.callsign,
    lat: flight.latitude,
    lng: flight.longitude,
    altitude: flight.altitude,
    velocity: flight.velocity,
    heading: flight.heading,
    vertical_rate: flight.verticalRate,
    on_ground: flight.onGround,
    source: flight.source || source,
    timestamp: flight.updatedAt || now,
  }));

  const { error: positionsError } = await supabase
    .from("aircraft_positions")
    .insert(positionRows);

  if (positionsError) throw positionsError;

  const eventRows = validFlights
    .filter((flight) => flight.onGround)
    .map((flight) => ({
      icao24: flight.icao24,
      callsign: flight.callsign,
      event_type: "Aircraft On Ground",
      severity: "Info",
      lat: flight.latitude,
      lng: flight.longitude,
      message: `${flight.callsign || flight.icao24} is reporting as on ground.`,
      started_at: flight.updatedAt || now,
    }));

  if (eventRows.length > 0) {
    const { error: eventsError } = await supabase
      .from("aircraft_events")
      .insert(eventRows);

    if (eventsError) throw eventsError;
  }

  await supabase.from("flight_collector_logs").insert({
    provider: source,
    status: "success",
    message: `Collected and stored ${validFlights.length} aircraft.`,
    records_collected: validFlights.length,
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const lamin = Number(searchParams.get("lamin") || "-21.2");
  const lomin = Number(searchParams.get("lomin") || "56.8");
  const lamax = Number(searchParams.get("lamax") || "-19.5");
  const lomax = Number(searchParams.get("lomax") || "58.2");

  try {
    const result = await fetchFlights({ lamin, lomin, lamax, lomax });

    await saveFlightsToSupabase(result.flights, result.source);

    return NextResponse.json({
      source: `${result.source} + Supabase`,
      count: result.flights.length,
      attemptedProviders: result.attemptedProviders,
      bounds: { lamin, lomin, lamax, lomax },
      updatedAt: new Date().toISOString(),
      flights: result.flights,
    });
  } catch (error) {
    const supabase = getSupabaseAdmin();

    await supabase.from("flight_collector_logs").insert({
      provider: "Flight collector",
      status: "error",
      message: error instanceof Error ? error.message : "Could not collect aircraft data",
      records_collected: 0,
    });

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not collect aircraft data",
        source: "Flight collector + Supabase",
        count: 0,
        flights: [],
      },
      { status: 502 }
    );
  }
}
