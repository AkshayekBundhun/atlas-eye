import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CustomPlaceRow = {
  id: string;
  name: string;
  aliases: string[] | null;
  address: string | null;
  category: string | null;
  lat: number;
  lng: number;
  zoom: number | null;
  created_at: string;
  updated_at: string | null;
};

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });
}

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function placeMatchesQuery(place: CustomPlaceRow, query: string) {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return true;

  const searchable = normalize(
    [
      place.name,
      place.address,
      place.category,
      ...(place.aliases || []),
    ]
      .filter(Boolean)
      .join(" ")
  );

  return searchable.includes(normalizedQuery);
}

function toApiPlace(place: CustomPlaceRow) {
  return {
    id: place.id,
    name: place.name,
    aliases: place.aliases || [],
    address: place.address || "",
    category: place.category || "Custom",
    lat: place.lat,
    lng: place.lng,
    zoom: place.zoom || 17,
  };
}

export async function GET(request: Request) {
  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";

    const { data, error } = await supabase
      .from("custom_places")
      .select("id,name,aliases,address,category,lat,lng,zoom,created_at,updated_at")
      .order("updated_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(250);

    if (error) {
      return NextResponse.json(
        {
          error: "Could not load custom places from Supabase.",
          details: error.message,
        },
        { status: 500 }
      );
    }

    const places = (data || [])
      .filter((place) => placeMatchesQuery(place as CustomPlaceRow, q))
      .map((place) => toApiPlace(place as CustomPlaceRow));

    return NextResponse.json({
      source: "Supabase custom_places",
      count: places.length,
      places,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Custom places route failed.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();

    const name = String(body.name || "").trim();
    const lat = Number(body.lat);
    const lng = Number(body.lng);

    if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json(
        {
          error: "name, lat, and lng are required.",
        },
        { status: 400 }
      );
    }

    const aliases = Array.isArray(body.aliases)
      ? body.aliases.map((alias: unknown) => String(alias).trim()).filter(Boolean)
      : [];

    const { data, error } = await supabase
      .from("custom_places")
      .insert({
        name,
        aliases,
        address: String(body.address || "").trim(),
        category: String(body.category || "Custom").trim(),
        lat,
        lng,
        zoom: Number.isFinite(Number(body.zoom)) ? Number(body.zoom) : 17,
      })
      .select("id,name,aliases,address,category,lat,lng,zoom,created_at,updated_at")
      .single();

    if (error) {
      return NextResponse.json(
        {
          error: "Could not save custom place.",
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      source: "Supabase custom_places",
      place: toApiPlace(data as CustomPlaceRow),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Custom places save route failed.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
