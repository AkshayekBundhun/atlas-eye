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
      const centerLat = (Number(lamin) + Number(lamax)) / 2;
      const centerLon = (Number(lomin) + Number(lomax)) / 2;
    
      const backupUrl = `https://api.airplanes.live/v2/point/${centerLat}/${centerLon}/250`;
    
      const backupResponse = await fetch(backupUrl, {
        headers: {
          Accept: "application/json",
        },
      });
    
      if (!backupResponse.ok) {
        return NextResponse.json(
          {
            error: "Flight requests failed",
            primarySource: "OpenSky Network",
            primaryStatus: response.status,
            backupSource: "Airplanes.live",
            backupStatus: backupResponse.status,
          },
          { status: backupResponse.status }
        );
      }
    
      const backupData = await backupResponse.json();
    
      const flights =
        backupData.ac?.slice(0, 500).map((aircraft: any) => ({
          icao24: aircraft.hex,
          callsign: aircraft.flight?.trim() || aircraft.r || "Unknown",
          originCountry: aircraft.country || "Unknown",
          longitude: aircraft.lon,
          latitude: aircraft.lat,
          altitude: aircraft.alt_baro === "ground" ? 0 : aircraft.alt_baro,
          onGround: aircraft.alt_baro === "ground",
          velocity: aircraft.gs ? aircraft.gs * 0.514444 : null,
          heading: aircraft.track,
          verticalRate: aircraft.baro_rate,
        })) || [];
    
      return NextResponse.json({
        source: "Airplanes.live",
        fallbackFrom: "OpenSky Network",
        count: flights.length,
        bounds: { lamin, lomin, lamax, lomax },
        updatedAt: new Date().toISOString(),
        flights,
      });
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