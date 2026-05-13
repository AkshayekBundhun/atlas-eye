import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AtlasShip = {
  id: string;
  mmsi?: string;
  imo?: string;
  name: string;
  type: "Cargo" | "Tanker" | "Fishing" | "Passenger" | "Patrol" | "Unknown";
  location: string;
  status: "Underway" | "Anchored" | "Deviating" | "Docked" | "Unknown";
  speed: string;
  heading: string;
  destination: string;
  eta: string;
  lng: number;
  lat: number;
  source: string;
  updatedAt: string;
  route: Array<[number, number]>;
  history: Array<{
    time: string;
    event: string;
    location: string;
    note: string;
    lng: number;
    lat: number;
  }>;
};

type VesselAccumulator = Partial<AtlasShip> & {
  id: string;
  mmsi?: string;
  lng?: number;
  lat?: number;
  route: Array<[number, number]>;
  history: AtlasShip["history"];
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

function toNumber(value: unknown): number | undefined {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function cleanText(value: unknown, fallback = "Unknown") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function formatEta(eta: any) {
  if (!eta || typeof eta !== "object") return "Unknown";

  const month = eta.Month ?? eta.month;
  const day = eta.Day ?? eta.day;
  const hour = eta.Hour ?? eta.hour;
  const minute = eta.Minute ?? eta.minute;

  if ([month, day, hour, minute].some((part) => part === undefined || part === null)) {
    return "Unknown";
  }

  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function mapNavigationStatus(status: unknown): AtlasShip["status"] {
  const value = Number(status);

  if (value === 0) return "Underway";
  if (value === 1 || value === 5 || value === 6) return "Anchored";
  if (value === 2 || value === 3 || value === 4) return "Deviating";
  if (value === 7 || value === 8) return "Docked";

  return "Unknown";
}

function mapShipType(shipType: unknown): AtlasShip["type"] {
  const value = Number(shipType);

  if (value >= 70 && value <= 79) return "Cargo";
  if (value >= 80 && value <= 89) return "Tanker";
  if (value === 30) return "Fishing";
  if (value >= 60 && value <= 69) return "Passenger";
  if (value >= 50 && value <= 59) return "Patrol";

  return "Unknown";
}

function getLocationLabel(lat?: number, lon?: number) {
  if (lat === undefined || lon === undefined) return "Unknown AIS position";
  return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
}

function normalizeMessage(message: any, vessels: Map<string, VesselAccumulator>) {
  const meta = message?.MetaData || message?.Metadata || {};
  const payload = message?.Message || {};

  const position =
    payload.PositionReport ||
    payload.StandardClassBPositionReport ||
    payload.ExtendedClassBPositionReport ||
    payload.LongRangeAisBroadcastMessage;

  const staticData = payload.ShipStaticData;
  const messageType = message?.MessageType || "AIS Message";

  const mmsi = String(
    meta.MMSI_String || meta.MMSI || position?.UserID || staticData?.UserID || ""
  ).trim();

  if (!mmsi) return;

  const lat =
    toNumber(meta.latitude) ??
    toNumber(meta.Latitude) ??
    toNumber(position?.Latitude);

  const lon =
    toNumber(meta.longitude) ??
    toNumber(meta.Longitude) ??
    toNumber(position?.Longitude);

  const existing = vessels.get(mmsi) || {
    id: `ais-${mmsi}`,
    mmsi,
    route: [],
    history: [],
  };

  const shipName = cleanText(meta.ShipName, existing.name || `MMSI ${mmsi}`);
  const updatedAt = cleanText(meta.time_utc, new Date().toISOString());

  if (lat !== undefined && lon !== undefined) {
    const lastPoint = existing.route[existing.route.length - 1];
    const point: [number, number] = [lon, lat];

    if (
      !lastPoint ||
      Math.abs(lastPoint[0] - lon) > 0.00001 ||
      Math.abs(lastPoint[1] - lat) > 0.00001
    ) {
      existing.route = [...existing.route.slice(-99), point];
    }

    existing.history = [
      ...existing.history.slice(-25),
      {
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        event: messageType,
        location: getLocationLabel(lat, lon),
        note: "Live AIS update from AISstream.io",
        lng: lon,
        lat,
      },
    ];

    existing.lng = lon;
    existing.lat = lat;
    existing.location = getLocationLabel(lat, lon);
  }

  existing.name = shipName;
  existing.status = mapNavigationStatus(position?.NavigationalStatus ?? existing.status);
  existing.speed =
    position?.Sog !== undefined
      ? `${Number(position.Sog).toFixed(1)} kn`
      : existing.speed || "Unknown";
  existing.heading =
    position?.TrueHeading !== undefined
      ? `${position.TrueHeading}°`
      : position?.Cog !== undefined
      ? `${position.Cog}° COG`
      : existing.heading || "Unknown";
  existing.destination = cleanText(staticData?.Destination, existing.destination || "Unknown");
  existing.eta =
    formatEta(staticData?.Eta) !== "Unknown"
      ? formatEta(staticData?.Eta)
      : existing.eta || "Unknown";
  existing.imo = staticData?.ImoNumber ? String(staticData.ImoNumber) : existing.imo;
  existing.type = mapShipType(staticData?.Type ?? existing.type);
  existing.source = "AISstream.io";
  existing.updatedAt = updatedAt;

  vessels.set(mmsi, existing);
}

async function collectAIS({
  apiKey,
  lamin,
  lomin,
  lamax,
  lomax,
  durationMs,
  debug,
}: {
  apiKey: string;
  lamin: number;
  lomin: number;
  lamax: number;
  lomax: number;
  durationMs: number;
  debug: boolean;
}) {
  return new Promise<{
    ships: AtlasShip[];
    framesReceived: number;
    firstMessageTypes: string[];
    firstRawMessages: any[];
    socketClosed: boolean;
  }>((resolve, reject) => {
    const vessels = new Map<string, VesselAccumulator>();
    const socket = new WebSocket("wss://stream.aisstream.io/v0/stream", {
      handshakeTimeout: 15000,
      perMessageDeflate: false,
    });

    let finished = false;
    let framesReceived = 0;
    let socketClosed = false;
    const firstMessageTypes: string[] = [];
    const firstRawMessages: any[] = [];

    const finish = () => {
      if (finished) return;
      finished = true;

      try {
        socket.close();
      } catch {
        // Ignore close errors.
      }

      const ships = Array.from(vessels.values())
        .filter((ship) => typeof ship.lat === "number" && typeof ship.lng === "number")
        .map((ship) => ({
          id: ship.id,
          mmsi: ship.mmsi,
          imo: ship.imo,
          name: ship.name || `MMSI ${ship.mmsi}`,
          type: ship.type || "Unknown",
          location: ship.location || getLocationLabel(ship.lat, ship.lng),
          status: ship.status || "Unknown",
          speed: ship.speed || "Unknown",
          heading: ship.heading || "Unknown",
          destination: ship.destination || "Unknown",
          eta: ship.eta || "Unknown",
          lng: ship.lng!,
          lat: ship.lat!,
          source: "AISstream.io",
          updatedAt: ship.updatedAt || new Date().toISOString(),
          route: ship.route.length > 0 ? ship.route : [[ship.lng!, ship.lat!]],
          history: ship.history,
        })) as AtlasShip[];

      resolve({
        ships,
        framesReceived,
        firstMessageTypes,
        firstRawMessages,
        socketClosed,
      });
    };

    const timer = setTimeout(finish, durationMs);

    socket.on("open", () => {
      const subscription = {
        Apikey: apiKey,
        BoundingBoxes: [
          [
            [lamin, lomin],
            [lamax, lomax],
          ],
        ],
      };

      socket.send(JSON.stringify(subscription));
    });

    socket.on("message", (data) => {
      try {
        framesReceived += 1;
        const raw = typeof data === "string" ? data : data.toString("utf8");
        const message = JSON.parse(raw);

        if (firstMessageTypes.length < 10) {
          firstMessageTypes.push(message?.MessageType || "Unknown");
        }

        if (debug && firstRawMessages.length < 3) {
          firstRawMessages.push(message);
        }

        if (message?.error) {
          clearTimeout(timer);
          if (!finished) {
            finished = true;
            reject(new Error(String(message.error)));
          }
          return;
        }

        normalizeMessage(message, vessels);
      } catch {
        // Ignore malformed frames and keep collecting.
      }
    });

    socket.on("error", (error) => {
      clearTimeout(timer);
      if (!finished) {
        finished = true;
        reject(error);
      }
    });

    socket.on("close", () => {
      socketClosed = true;
      clearTimeout(timer);
      finish();
    });
  });
}

async function saveShipsToSupabase(ships: AtlasShip[], debugMessage: string) {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  if (ships.length === 0) {
    await supabase.from("collector_logs").insert({
      provider: "AISstream.io",
      status: "success",
      message: debugMessage || "Collector ran but received no ships.",
      records_collected: 0,
    });

    return;
  }

  const latestRows = ships.map((ship) => ({
    mmsi: ship.mmsi || ship.id.replace("ais-", ""),
    imo: ship.imo || null,
    name: ship.name,
    type: ship.type,
    status: ship.status,
    speed: ship.speed,
    heading: ship.heading,
    destination: ship.destination,
    eta: ship.eta,
    lat: ship.lat,
    lng: ship.lng,
    source: ship.source,
    last_seen: ship.updatedAt || now,
    updated_at: now,
  }));

  const { error: vesselsError } = await supabase
    .from("vessels")
    .upsert(latestRows, { onConflict: "mmsi" });

  if (vesselsError) throw vesselsError;

  const positionRows = ships.map((ship) => ({
    mmsi: ship.mmsi || ship.id.replace("ais-", ""),
    vessel_name: ship.name,
    lat: ship.lat,
    lng: ship.lng,
    speed: ship.speed,
    heading: ship.heading,
    status: ship.status,
    destination: ship.destination,
    source: ship.source,
    timestamp: ship.updatedAt || now,
  }));

  const { error: positionsError } = await supabase
    .from("vessel_positions")
    .insert(positionRows);

  if (positionsError) throw positionsError;

  await supabase.from("collector_logs").insert({
    provider: "AISstream.io",
    status: "success",
    message: `Collected and stored ${ships.length} vessel(s).`,
    records_collected: ships.length,
  });
}

export async function GET(request: Request) {
  const apiKey = process.env.AISSTREAM_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        error: "AISSTREAM_API_KEY is missing from .env.local",
        source: "AISstream.io",
        count: 0,
        ships: [],
      },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);

  const lamin = Number(searchParams.get("lamin") || "-90");
  const lomin = Number(searchParams.get("lomin") || "-180");
  const lamax = Number(searchParams.get("lamax") || "90");
  const lomax = Number(searchParams.get("lomax") || "180");
  const debug = searchParams.get("debug") === "1";

  const durationMs = Math.min(
    Math.max(Number(searchParams.get("durationMs") || "30000"), 3000),
    60000
  );

  try {
    const result = await collectAIS({
      apiKey,
      lamin,
      lomin,
      lamax,
      lomax,
      durationMs,
      debug,
    });

    const debugMessage = `Collector completed. Frames: ${result.framesReceived}. Message types: ${
      result.firstMessageTypes.join(", ") || "none"
    }. Socket closed: ${result.socketClosed ? "yes" : "no"}.`;

    await saveShipsToSupabase(result.ships, debugMessage);

    return NextResponse.json({
      source: "AISstream.io + Supabase",
      count: result.ships.length,
      framesReceived: result.framesReceived,
      firstMessageTypes: result.firstMessageTypes,
      bounds: { lamin, lomin, lamax, lomax },
      collectionMs: durationMs,
      updatedAt: new Date().toISOString(),
      ships: result.ships,
      debug: debug
        ? {
            firstRawMessages: result.firstRawMessages,
            note:
              "If framesReceived is 0 in busy regions/full-world after 30-60 seconds, AISstream is not delivering frames to this key/session.",
          }
        : undefined,
    });
  } catch (error) {
    try {
      const supabase = getSupabaseAdmin();
      await supabase.from("collector_logs").insert({
        provider: "AISstream.io",
        status: "error",
        message: error instanceof Error ? error.message : "Could not collect AIS data",
        records_collected: 0,
      });
    } catch {
      // Ignore logging failure.
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not collect AIS data",
        source: "AISstream.io + Supabase",
        count: 0,
        ships: [],
      },
      { status: 502 }
    );
  }
}
