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

    const mmsi = searchParams.get("mmsi");

    if (!mmsi) {
      return NextResponse.json(
        {
          error: "Missing mmsi query parameter.",
          positions: [],
          route: [],
        },
        { status: 400 }
      );
    }

    const limit = Math.min(Number(searchParams.get("limit") || "2000"), 10000);
    const from =
      searchParams.get("from") ||
      new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const to = searchParams.get("to") || new Date().toISOString();

    const { data, error } = await supabase
      .from("vessel_positions")
      .select("*")
      .eq("mmsi", mmsi)
      .gte("timestamp", from)
      .lte("timestamp", to)
      .order("timestamp", { ascending: true })
      .limit(limit);

    if (error) throw error;

    const positions = data || [];

    return NextResponse.json({
      source: "Supabase vessel history",
      mmsi,
      count: positions.length,
      from,
      to,
      updatedAt: new Date().toISOString(),
      route: positions.map((position) => [position.lng, position.lat]),
      positions,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not load vessel history",
        positions: [],
        route: [],
      },
      { status: 500 }
    );
  }
}
