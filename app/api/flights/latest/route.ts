import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function GET(request: Request) {
  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);

    const limit = Math.min(Number(searchParams.get("limit") || "500"), 2000);
    const sinceHours = Number(searchParams.get("sinceHours") || "24");

    const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("aircraft")
      .select("*")
      .gte("last_seen", since)
      .order("last_seen", { ascending: false })
      .limit(limit);

    if (error) throw error;

    const flights =
      data?.map((flight) => ({
        icao24: flight.icao24,
        callsign: flight.callsign || flight.icao24,
        originCountry: flight.origin_country || "Unknown",
        longitude: flight.lng,
        latitude: flight.lat,
        altitude: flight.altitude,
        velocity: flight.velocity,
        heading: flight.heading,
        verticalRate: flight.vertical_rate,
        onGround: flight.on_ground,
        source: flight.source || "Supabase aircraft cache",
        updatedAt: flight.last_seen || flight.updated_at,
        origin: flight.origin || undefined,
        destination: flight.destination || undefined,
        departureTime: flight.departure_time || undefined,
        eta: flight.eta || undefined,
        status: flight.status || "Unknown",
        actualTrack: [[flight.lng, flight.lat]],
        plannedRoute: [],
        history: [],
        routeQuality: flight.origin || flight.destination ? "Partial" : "Unavailable",
      })) || [];

    return NextResponse.json({
      source: "Supabase aircraft cache",
      count: flights.length,
      since,
      updatedAt: new Date().toISOString(),
      flights,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not load latest aircraft",
        source: "Supabase aircraft cache",
        count: 0,
        flights: [],
      },
      { status: 500 }
    );
  }
}
