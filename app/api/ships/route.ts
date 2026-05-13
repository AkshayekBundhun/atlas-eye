import { NextResponse } from "next/server";
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

  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")} ${String(
    hour
  ).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
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
    payload.ExtendedClassBPositionReport;

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
      existing.route = [...existing.route.slice(-11), point];
    }

    existing.history = [
      ...existing.history.slice(-5),
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
    position?.Sog !== undefined ? `${Number(position.Sog).toFixed(1)} kn` : existing.speed || "Unknown";
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
}: {
  apiKey: string;
  lamin: number;
  lomin: number;
  lamax: number;
  lomax: number;
  durationMs: number;
}) {
  return new Promise<AtlasShip[]>((resolve, reject) => {
    const vessels = new Map<string, VesselAccumulator>();
    const socket = new WebSocket("wss://stream.aisstream.io/v0/stream");
    let finished = false;

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

      resolve(ships);
    };

    const timer = setTimeout(finish, durationMs);

    socket.on("open", () => {
      const subscription = {
        APIKey: apiKey,
        BoundingBoxes: [
          [
            [lamin, lomin],
            [lamax, lomax],
          ],
        ],
        FilterMessageTypes: [
          "PositionReport",
          "StandardClassBPositionReport",
          "ExtendedClassBPositionReport",
          "ShipStaticData",
        ],
      };

      socket.send(JSON.stringify(subscription));
    });

    socket.on("message", (data) => {
      try {
        const raw = typeof data === "string" ? data : data.toString("utf8");
        const message = JSON.parse(raw);

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
      clearTimeout(timer);
      finish();
    });
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

  const lamin = Number(searchParams.get("lamin") || "-21.2");
  const lomin = Number(searchParams.get("lomin") || "56.8");
  const lamax = Number(searchParams.get("lamax") || "-19.5");
  const lomax = Number(searchParams.get("lomax") || "58.2");

  const durationMs = Math.min(
    Math.max(Number(searchParams.get("durationMs") || "8000"), 3000),
    15000
  );

  try {
    const ships = await collectAIS({
      apiKey,
      lamin,
      lomin,
      lamax,
      lomax,
      durationMs,
    });

    return NextResponse.json({
      source: "AISstream.io",
      count: ships.length,
      bounds: { lamin, lomin, lamax, lomax },
      collectionMs: durationMs,
      updatedAt: new Date().toISOString(),
      ships,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not collect AIS data",
        source: "AISstream.io",
        count: 0,
        ships: [],
      },
      { status: 502 }
    );
  }
}