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
      .from("vessels")
      .select("*")
      .gte("last_seen", since)
      .order("last_seen", { ascending: false })
      .limit(limit);

    if (error) throw error;

    const ships =
      data?.map((ship) => ({
        id: `ais-${ship.mmsi}`,
        mmsi: ship.mmsi,
        imo: ship.imo,
        name: ship.name || `MMSI ${ship.mmsi}`,
        type: ship.type || "Unknown",
        location:
          typeof ship.lat === "number" && typeof ship.lng === "number"
            ? `${ship.lat.toFixed(4)}, ${ship.lng.toFixed(4)}`
            : "Unknown AIS position",
        status: ship.status || "Unknown",
        speed: ship.speed || "Unknown",
        heading: ship.heading || "Unknown",
        destination: ship.destination || "Unknown",
        eta: ship.eta || "Unknown",
        lng: ship.lng,
        lat: ship.lat,
        source: ship.source || "Supabase cache",
        updatedAt: ship.last_seen || ship.updated_at,
        route: [[ship.lng, ship.lat]],
        history: [],
      })) || [];

    return NextResponse.json({
      source: "Supabase vessel cache",
      count: ships.length,
      since,
      updatedAt: new Date().toISOString(),
      ships,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not load latest vessels",
        source: "Supabase vessel cache",
        count: 0,
        ships: [],
      },
      { status: 500 }
    );
  }
}
