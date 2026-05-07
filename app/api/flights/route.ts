import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const lamin = searchParams.get("lamin") || "-21.2";
    const lomin = searchParams.get("lomin") || "56.8";
    const lamax = searchParams.get("lamax") || "-19.5";
    const lomax = searchParams.get("lomax") || "58.2";

    const url = `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "OpenSky request failed",
          status: response.status,
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    const flights =
      data.states?.slice(0, 500).map((state: any[]) => ({
        icao24: state[0],
        callsign: state[1]?.trim() || "Unknown",
        originCountry: state[2],
        longitude: state[5],
        latitude: state[6],
        altitude: state[7],
        onGround: state[8],
        velocity: state[9],
        heading: state[10],
        verticalRate: state[11],
      })) || [];

    return NextResponse.json({
      source: "OpenSky Network",
      count: flights.length,
      bounds: { lamin, lomin, lamax, lomax },
      updatedAt: new Date().toISOString(),
      flights,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Could not fetch live flights",
      },
      { status: 500 }
    );
  }
}