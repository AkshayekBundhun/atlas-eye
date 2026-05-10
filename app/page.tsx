"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
const cameras = [
  {
    name: "Caudan North",
    location: "Port Louis Center",
    status: "Live",
    density: "High",
    vehicles: "~25",
    speed: "18 km/h",
    source: "my.t Traffic Watch",
    url: "https://www.myt.mu/sinformer/trafficwatch/",
    lng: 57.4989,
    lat: -20.1609,
  },
  {
    name: "Caudan South",
    location: "Port Louis Center",
    status: "Live",
    density: "High",
    vehicles: "~22",
    speed: "20 km/h",
    source: "my.t Traffic Watch",
    url: "https://www.myt.mu/sinformer/trafficwatch/",
    lng: 57.4996,
    lat: -20.1622,
  },
  {
    name: "Place D'Armes",
    location: "Port Louis Center",
    status: "Live",
    density: "Moderate",
    vehicles: "~18",
    speed: "25 km/h",
    source: "my.t Traffic Watch",
    url: "https://www.myt.mu/sinformer/trafficwatch/",
    lng: 57.5012,
    lat: -20.1613,
  },
  {
    name: "Casernes Police Station",
    location: "Port Louis Center",
    status: "Live",
    density: "Moderate",
    vehicles: "~15",
    speed: "28 km/h",
    source: "my.t Traffic Watch",
    url: "https://www.myt.mu/sinformer/trafficwatch/",
    lng: 57.5027,
    lat: -20.1643,
  },
  {
    name: "Ebene Motorway",
    location: "Reduit & Ebene",
    status: "Live",
    density: "Moderate",
    vehicles: "~18",
    speed: "32 km/h",
    source: "my.t Traffic Watch",
    url: "https://www.myt.mu/sinformer/trafficwatch/",
    lng: 57.4955,
    lat: -20.2439,
  },
  {
    name: "Phoenix",
    location: "Phoenix & St-Jean",
    status: "Live",
    density: "Low",
    vehicles: "~9",
    speed: "41 km/h",
    source: "my.t Traffic Watch",
    url: "https://www.myt.mu/sinformer/trafficwatch/",
    lng: 57.4939,
    lat: -20.2864,
  },
  {
    name: "Quatre Bornes",
    location: "Quatre Bornes & Belle Rose",
    status: "Live",
    density: "Moderate",
    vehicles: "~14",
    speed: "30 km/h",
    source: "my.t Traffic Watch",
    url: "https://www.myt.mu/sinformer/trafficwatch/",
    lng: 57.4774,
    lat: -20.2647,
  },
  {
    name: "Curepipe Junction",
    location: "Curepipe",
    status: "Live",
    density: "Moderate",
    vehicles: "~12",
    speed: "26 km/h",
    source: "my.t Traffic Watch",
    url: "https://www.myt.mu/sinformer/trafficwatch/",
    lng: 57.5263,
    lat: -20.3162,
  },
];
const alerts = [
  {
    icon: "🚨",
    title: "High Traffic Density",
    location: "Port Louis South",
    status: "Critical",
  },
  {
    icon: "⚠️",
    title: "Camera Offline",
    location: "Ebene Motorway",
    status: "Warning",
  },
  {
    icon: "🌧️",
    title: "Heavy Rain Alert",
    location: "North Region",
    status: "Info",
  },
  {
    icon: "🚢",
    title: "Vessel Deviation",
    location: "South East Coast",
    status: "Warning",
  },
];
function MauritiusMap({
  onSelectCamera,
  onFlightCountChange,
}: {
  onSelectCamera: (camera: any) => void;
  onFlightCountChange: (count: number) => void;
}) {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const flightMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const [layers, setLayers] = useState({
    cameras: true,
    traffic: true,
    weather: false,
    ships: false,
    flights: false,
  });
  const [flightStatus, setFlightStatus] = useState({
    count: 0,
    lastUpdated: "Not loaded",
    source: "OpenSky Network",
  });

  const [flightRefreshKey, setFlightRefreshKey] = useState(0);
  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null);
  
  
  const toggleLayer = (layer: keyof typeof layers) => {
    setLayers((prev) => ({
      ...prev,
      [layer]: !prev[layer],
    }));
  };
  const zoomToPortLouis = () => {
    if (!mapRef.current) return;

    mapRef.current.flyTo({
      center: [57.5012, -20.1613],
      zoom: 13.5,
      pitch: 50,
      bearing: -20,
      duration: 1500,
    });
  };

  const showAllCameras = () => {
    if (!mapRef.current) return;

    mapRef.current.flyTo({
      center: [57.5522, -20.3484],
      zoom: 9.1,
      pitch: 45,
      bearing: -15,
      duration: 1500,
    });
  };
  const rotateLeft = () => {
    if (!mapRef.current) return;

    mapRef.current.easeTo({
      bearing: mapRef.current.getBearing() - 30,
      duration: 800,
    });
  };

  const rotateRight = () => {
    if (!mapRef.current) return;

    mapRef.current.easeTo({
      bearing: mapRef.current.getBearing() + 30,
      duration: 800,
    });
  };

  const increaseAngle = () => {
    if (!mapRef.current) return;

    mapRef.current.easeTo({
      pitch: Math.min(mapRef.current.getPitch() + 10, 70),
      duration: 800,
    });
  };

  const decreaseAngle = () => {
    if (!mapRef.current) return;

    mapRef.current.easeTo({
      pitch: Math.max(mapRef.current.getPitch() - 10, 0),
      duration: 800,
    });
  };

  const resetView = () => {
    if (!mapRef.current) return;

    mapRef.current.easeTo({
      bearing: 0,
      pitch: 45,
      zoom: 9.1,
      center: [57.5522, -20.3484],
      duration: 1000,
    });
  };

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [57.5522, -20.3484],
      zoom: 9.1,
      pitch: 45,
      bearing: -15,
    });

    mapRef.current = map;

    map.addControl(new mapboxgl.NavigationControl(), "bottom-right");

    cameras.forEach((camera) => {
      const markerElement = document.createElement("button");
      markerElement.className =
        "h-5 w-5 rounded-full bg-cyan-400 border-2 border-white shadow-[0_0_18px_rgba(0,229,255,0.9)] cursor-pointer";

      markerElement.onclick = () => onSelectCamera(camera);
      const marker = new mapboxgl.Marker(markerElement)
  .setLngLat([camera.lng, camera.lat])
  .addTo(map);

markersRef.current.push(marker);
    });

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [onSelectCamera]);

  useEffect(() => {
    markersRef.current.forEach((marker) => {
      const element = marker.getElement();
      element.style.display = layers.cameras ? "block" : "none";
    });
  }, [layers.cameras]);
  
    useEffect(() => {
      if (!mapRef.current) return;
    
      const clearFlightMarkers = () => {
        flightMarkersRef.current.forEach((marker) => marker.remove());
        flightMarkersRef.current = [];
      };
    
      const loadFlightsInView = async () => {
        if (!mapRef.current) return;
    
        clearFlightMarkers();
    
        if (!layers.flights) return;
    
        try {
          const bounds = mapRef.current.getBounds();
          if (!bounds) return;
    
          const south = bounds.getSouth();
          const west = bounds.getWest();
          const north = bounds.getNorth();
          const east = bounds.getEast();
    
          const response = await fetch(
            `/api/flights?lamin=${south}&lomin=${west}&lamax=${north}&lomax=${east}`
          );
          
          const data = await response.json();
          
          if (!response.ok) {
            console.warn("OpenSky request failed", data);
          
            onFlightCountChange(0);
          
            setFlightStatus({
              count: 0,
              lastUpdated: "Rate limited",
              source: data.status === 429 ? "OpenSky rate limit" : "OpenSky Network",
            });
          
            return;
          }
          onFlightCountChange(data.flights?.length || 0);
    
          setFlightStatus({
            count: data.flights?.length || 0,
            lastUpdated: new Date().toLocaleTimeString(),
            source: data.source || "OpenSky Network",
          });
          
          if (!data.flights || data.flights.length === 0) {
            console.log("No live aircraft detected in this visible map area.");
            return;
          }
    
          data.flights.forEach((flight: any) => {
            if (!flight.longitude || !flight.latitude) return;
    
            const planeElement = document.createElement("button");

            const isSelected = selectedFlightId === flight.icao24;
            
            planeElement.className =
              "relative h-10 w-10 cursor-pointer border-0 bg-transparent";
            
            planeElement.innerHTML = `
              <div style="
                width: ${isSelected ? "42px" : "34px"};
                height: ${isSelected ? "42px" : "34px"};
                display: flex;
                align-items: center;
                justify-content: center;
                filter: drop-shadow(0 0 ${isSelected ? "16px" : "8px"} ${
                  isSelected ? "rgba(255,200,87,0.95)" : "rgba(0,229,255,0.95)"
                });
                transition: all 0.2s ease;
              ">
                <svg width="${isSelected ? "38" : "30"}" height="${isSelected ? "38" : "30"}" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 2L14.2 9.2L22 12L14.2 14.8L12 22L9.8 14.8L2 12L9.8 9.2L12 2Z"
                    fill="${isSelected ? "#FFC857" : "#7DEBFF"}"
                    stroke="${isSelected ? "#FFF3C4" : "#D8FBFF"}"
                    stroke-width="1.2"
                    stroke-linejoin="round"
                  />
                  <path
                    d="M12 4.5V19.5"
                    stroke="${isSelected ? "#7A4C00" : "#0B4F66"}"
                    stroke-width="0.8"
                    opacity="0.45"
                  />
                </svg>
</div>            `;
            
            planeElement.onclick = () => {
              setSelectedFlightId(flight.icao24);
            };
            
            planeElement.style.transform = `rotate(${flight.heading || 0}deg)`;
    
            const marker = new mapboxgl.Marker(planeElement)
  .setLngLat([flight.longitude, flight.latitude])
  .setPopup(
    new mapboxgl.Popup({ offset: 25 }).setHTML(`
      <div style="color:#07111F; font-family:Arial, sans-serif; font-size:13px; line-height:1.5; min-width:180px;">
        <strong style="font-size:15px;">${flight.callsign || "Unknown Flight"}</strong><br/>
        <span>Country: ${flight.originCountry || "Unknown"}</span><br/>
        <span>Altitude: ${
          flight.altitude ? Math.round(flight.altitude) + " m" : "Unknown"
        }</span><br/>
        <span>Speed: ${
          flight.velocity
            ? Math.round(flight.velocity * 3.6) + " km/h"
            : "Unknown"
        }</span><br/>
        <span>Source: OpenSky Network</span>
      </div>
    `)
              )
              .addTo(mapRef.current!);
    
            flightMarkersRef.current.push(marker);
          });
        } catch (error) {
          console.error("Could not load flights in visible map area", error);
        }
      };
    
      loadFlightsInView();

      mapRef.current.on("moveend", loadFlightsInView);
    
      let flightLoadTimer: ReturnType<typeof setTimeout> | null = null;

const scheduleFlightLoad = () => {
  if (flightLoadTimer) {
    clearTimeout(flightLoadTimer);
  }

  flightLoadTimer = setTimeout(() => {
    loadFlightsInView();
  }, 2500);
};

// Load once when Flights layer is turned on
scheduleFlightLoad();

// Then load again only after user stops moving the map
mapRef.current.on("moveend", scheduleFlightLoad);

return () => {
  if (flightLoadTimer) {
    clearTimeout(flightLoadTimer);
  }

  mapRef.current?.off("moveend", scheduleFlightLoad);
  clearFlightMarkers();
};
}, [layers.flights, flightRefreshKey]);
  return (
    <div className="relative h-full w-full rounded-2xl overflow-hidden">
      <div ref={mapContainer} className="h-full w-full rounded-2xl" />
  
      {/* Map movement controls */}
      <div className="absolute top-5 left-[520px] right-[360px] z-10 flex flex-wrap gap-2">
        <button
          onClick={zoomToPortLouis}
          className="rounded-lg border border-cyan-400 bg-[#07111F]/90 px-3 py-2 text-xs font-semibold text-cyan-300"
        >
          Zoom Port Louis
        </button>
  
        <button
          onClick={showAllCameras}
          className="rounded-lg border border-cyan-400 bg-[#07111F]/90 px-3 py-2 text-xs font-semibold text-cyan-300"
        >
          Show All
        </button>
  
        <button
          onClick={rotateLeft}
          className="rounded-lg border border-cyan-400 bg-[#07111F]/90 px-3 py-2 text-xs font-semibold text-cyan-300"
        >
          Rotate Left
        </button>
  
        <button
          onClick={rotateRight}
          className="rounded-lg border border-cyan-400 bg-[#07111F]/90 px-3 py-2 text-xs font-semibold text-cyan-300"
        >
          Rotate Right
        </button>
  
        <button
          onClick={increaseAngle}
          className="rounded-lg border border-cyan-400 bg-[#07111F]/90 px-3 py-2 text-xs font-semibold text-cyan-300"
        >
          Angle +
        </button>
  
        <button
          onClick={decreaseAngle}
          className="rounded-lg border border-cyan-400 bg-[#07111F]/90 px-3 py-2 text-xs font-semibold text-cyan-300"
        >
          Angle -
        </button>
  
        <button
          onClick={resetView}
          className="rounded-lg border border-cyan-400 bg-[#07111F]/90 px-3 py-2 text-xs font-semibold text-cyan-300"
        >
          Reset
        </button>
        <button
  onClick={() => {
    if (layers.flights) {
      setFlightRefreshKey((prev) => prev + 1);
    }
  }}
  className="rounded-lg border border-cyan-400 bg-[#07111F]/90 px-4 py-2 text-xs font-semibold text-cyan-300"
>
  Refresh Flights
</button>
      </div>
  
      {/* Map layers panel */}
      {/* Country Selector */}
<div className="absolute top-5 left-5 z-10 w-64 rounded-2xl border border-cyan-500/30 bg-[#07111F]/90 p-4 shadow-[0_0_25px_rgba(0,229,255,0.15)] backdrop-blur">
  <p className="text-[10px] uppercase tracking-widest text-cyan-300">
    Country Selector
  </p>

  <p className="mt-1 text-xs text-gray-400">
    Select a region to monitor
  </p>

  <div className="mt-4 space-y-2">
    {[
      ["🇲🇺", "Mauritius", "Indian Ocean"],
      ["🇺🇸", "United States", "North America"],
      ["🇮🇳", "India", "South Asia"],
      ["🇫🇷", "France", "Europe"],
      ["🇯🇵", "Japan", "East Asia"],
    ].map(([flag, country, region]) => (
      <button
        key={country}
        className="flex w-full items-center justify-between rounded-xl border border-cyan-500/10 bg-white/5 px-3 py-2 text-left hover:border-cyan-400/50 hover:bg-cyan-400/10"
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">{flag}</span>
          <div>
            <p className="text-sm font-semibold text-white">{country}</p>
            <p className="text-[10px] text-gray-400">{region}</p>
          </div>
        </div>

        <span className="text-cyan-300">›</span>
      </button>
    ))}
  </div>
</div>
      <div className="absolute top-5 right-5 z-10 rounded-2xl border border-cyan-500/30 bg-[#07111F]/90 p-3 shadow-[0_0_20px_rgba(0,229,255,0.15)]">
        <p className="mb-2 text-[10px] uppercase tracking-widest text-cyan-300">
          Map Layers
        </p>
  
        <div className="space-y-2">
          {[
            ["cameras", "📹 Cameras"],
            ["traffic", "🚦 Traffic"],
            ["weather", "🌧️ Weather"],
            ["ships", "🚢 Ships"],
            ["flights", "✈️ Flights"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => toggleLayer(key as keyof typeof layers)}
              className={`block w-full rounded-lg border px-3 py-2 text-left text-xs font-semibold ${
                layers[key as keyof typeof layers]
                  ? "border-cyan-400 bg-cyan-400/15 text-cyan-300"
                  : "border-gray-600 bg-black/30 text-gray-400"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
  
      {/* Active layer indicators */}
      {/* Live Flight Status */}
<div className="absolute bottom-20 right-5 z-10 w-56 rounded-2xl border border-cyan-500/30 bg-[#07111F]/90 p-4 text-left shadow-[0_0_20px_rgba(0,229,255,0.2)] backdrop-blur">
  <p className="text-[10px] uppercase tracking-widest text-cyan-300">
    Live Flight Status
  </p>

  <div className="mt-3 space-y-2 text-xs text-gray-300">
    <p>
      Layer:{" "}
      <span className={layers.flights ? "text-green-300" : "text-gray-500"}>
        {layers.flights ? "ON" : "OFF"}
      </span>
    </p>

    <p>
      Flights loaded:{" "}
      <span className="text-cyan-300">{flightStatus.count}</span>
    </p>

    <p>
      Updated:{" "}
      <span className="text-cyan-300">{flightStatus.lastUpdated}</span>
    </p>

    <p>
      Source:{" "}
      <span className="text-cyan-300">{flightStatus.source}</span>
    </p>
  </div>
</div>
      <div className="absolute bottom-5 left-5 z-10 flex flex-wrap gap-2">
        {layers.traffic && (
          <div className="rounded-full border border-yellow-400/50 bg-yellow-400/10 px-3 py-2 text-xs font-semibold text-yellow-300">
            🚦 Traffic layer active
          </div>
        )}
  
        {layers.weather && (
          <div className="rounded-full border border-blue-400/50 bg-blue-400/10 px-3 py-2 text-xs font-semibold text-blue-300">
            🌧️ Weather layer active
          </div>
        )}
  
        {layers.ships && (
          <div className="rounded-full border border-cyan-400/50 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-300">
            🚢 Ships layer active
          </div>
        )}
  
        {layers.flights && (
          <div className="rounded-full border border-purple-400/50 bg-purple-400/10 px-3 py-2 text-xs font-semibold text-purple-300">
            ✈️ Flights layer active
          </div>
        )}
      </div>
    </div>
  );
}
export default function Home() {
  const [selectedCamera, setSelectedCamera] = useState<any>(null);
  const [liveFlightCount, setLiveFlightCount] = useState(0);
  return (
    <main className="min-h-screen bg-[#050B14] text-white">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 h-16 border-b border-cyan-500/20 bg-[#07111F]/95 backdrop-blur flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full border border-cyan-400 flex items-center justify-center text-cyan-300 shadow-[0_0_18px_rgba(0,229,255,0.25)]">
            ◈
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-widest text-cyan-100">
              ATLASEYE
            </h1>
            <p className="text-[10px] text-cyan-300 tracking-[0.25em]">
              MAURITIUS COMMAND CENTER
            </p>
          </div>
        </div>

        <div className="flex gap-4 flex-1 max-w-4xl mx-8">
          <input
            className="w-1/2 rounded-xl bg-[#0B1728] border border-cyan-500/20 px-4 py-2 text-sm outline-none focus:border-cyan-400"
            placeholder="Search location, camera, vessel, flight..."
          />
          <input
            className="w-1/2 rounded-xl bg-[#0B1728] border border-cyan-400 px-4 py-2 text-sm outline-none shadow-[0_0_18px_rgba(0,229,255,0.25)]"
            placeholder="Ask Atlas AI..."
          />
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <span className="text-xl">🔔</span>
            <span className="absolute -top-2 -right-2 bg-red-500 text-[10px] px-1.5 rounded-full">
              12
            </span>
          </div>
          <div className="h-9 w-9 rounded-full bg-cyan-500/20 border border-cyan-400 flex items-center justify-center">
            A
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="sticky top-16 h-[calc(100vh-64px)] w-24 bg-[#07111F] border-r border-cyan-500/20 p-4 space-y-5">
          {[
            ["Dashboard", "#dashboard"],
            ["Cameras", "#cameras"],
            ["World", "#world-view"],
            ["Alerts", "#alerts"],
            ["Reports", "#reports"],
            ["Settings", "#settings"],
          ].map(([item, link]) => (
            <a
              key={item}
              href={link}
              className="text-xs text-gray-300 hover:text-cyan-300 cursor-pointer flex flex-col items-center gap-2"
            >
              <div className="h-10 w-10 rounded-xl bg-[#0B1728] border border-cyan-500/20 flex items-center justify-center hover:border-cyan-400">
                ●
              </div>
              {item}
            </a>
          ))}
        </aside>

        {/* Main Content */}
        <section className="flex-1 p-5 space-y-6">
          {/* Dashboard */}
          <section id="dashboard" className="grid grid-cols-[1fr_330px] gap-5">
            <div className="space-y-5">
              <div className="h-[560px] rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-[#06101F] via-[#08233B] to-[#020711] relative overflow-hidden shadow-[0_0_30px_rgba(0,229,255,0.12)]">
                <div className="absolute top-5 left-5">
                  <p className="text-cyan-300 text-sm uppercase tracking-widest">
                    Main Dashboard
                  </p>
                  <h2 className="text-3xl font-bold mt-2">
                    Mauritius Intelligence Map
                  </h2>
                  <p className="text-gray-400 mt-2">
                    Cameras, traffic, ships, flights, weather and alerts.
                  </p>
                </div>

                <div className="absolute top-5 right-5 flex gap-2">
                  {["2D", "3D", "Layers"].map((item) => (
                    <button
                      key={item}
                      className="rounded-lg border border-cyan-500/30 bg-[#07111F]/80 px-3 py-2 text-xs text-cyan-300"
                    >
                      {item}
                    </button>
                  ))}
                </div>

                <div className="absolute inset-0">
                <MauritiusMap
  onSelectCamera={setSelectedCamera}
  onFlightCountChange={setLiveFlightCount}
/>
</div>

                <div className="absolute bottom-5 left-5 right-5 h-16 rounded-xl bg-[#07111F]/90 border border-cyan-500/20 flex items-center px-5 gap-4">
                  <button className="h-10 w-10 rounded-lg bg-cyan-500 text-black">
                    ▶️
                  </button>
                  <div className="flex-1 h-1 bg-gray-700 rounded-full">
                    <div className="h-1 w-1/2 bg-cyan-400 rounded-full" />
                  </div>
                  <span className="text-xs text-cyan-300">12:45:32</span>
                </div>
              </div>

              <div className="grid grid-cols-5 gap-4">
                {[
                  ["Cameras Online", "248", "Live sources"],
                  ["Active Alerts", "12", "Security alerts"],
                  ["Weather", "24°C", "Partly cloudy"],
                  ["Ships", "36", "Tracked vessels"],
                  ["Flights", String(liveFlightCount), "Visible aircraft"],
                  
                ].map(([title, number, desc]) => (
                  <div
                    key={title}
                    className="rounded-2xl bg-[#07111F] border border-cyan-500/20 p-4"
                  >
                    <p className="text-xs text-gray-400">{title}</p>
                    <h3 className="text-2xl font-bold text-cyan-300 mt-2">
                      {number}
                    </h3>
                    <p className="text-[11px] text-gray-500 mt-1">{desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <aside className="space-y-5">
              <div className="rounded-2xl bg-[#07111F] border border-cyan-500/20 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">AI Insights</h3>
                  <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-1 rounded-full">
                    BETA
                  </span>
                </div>

                <p className="text-sm text-gray-300 leading-6">
                  Traffic congestion detected in{" "}
                  <span className="text-white font-semibold">Port Louis</span>.
                  Three cameras are showing high traffic density. Weather is
                  clear.
                </p>

                <div className="space-y-3 mt-5">
                  <a
                    href="#cameras"
                    className="block w-full rounded-lg border border-cyan-400 text-cyan-300 py-2 text-sm text-center"
                  >
                    View Cameras
                  </a>
                  <button className="w-full rounded-lg border border-cyan-400 text-cyan-300 py-2 text-sm">
                    Generate Report
                  </button>
                </div>
              </div>

              <div id="alerts" className="rounded-2xl bg-[#07111F] border border-cyan-500/20 p-5">
                <h3 className="font-semibold mb-4">Live Alerts</h3>

                {alerts.map((alert) => (
                  <div
                    key={alert.title}
                    className="border-b border-cyan-500/10 py-3 last:border-0"
                  >
                    <div className="flex justify-between gap-3">
                      <p className="text-sm">
                        {alert.icon} {alert.title}
                      </p>
                      <span className="text-[10px] text-cyan-300">
                        {alert.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{alert.location}</p>
                  </div>
                ))}
              </div>
            </aside>
          </section>

          {/* Camera Management */}
          <section
            id="cameras"
            className="rounded-2xl bg-[#07111F] border border-cyan-500/20 p-6 shadow-[0_0_30px_rgba(0,229,255,0.08)]"
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-cyan-300 text-sm uppercase tracking-widest">
                  Camera Management
                </p>
                <h2 className="text-2xl font-bold mt-1">
                  Authorized Camera Sources
                </h2>
                <p className="text-xs text-gray-500 mt-2">
                  Public or authorized sources only. No private camera scanning.
                </p>
              </div>

              <button className="rounded-lg bg-cyan-500 text-black px-4 py-2 text-sm font-semibold">
                + Add Camera
              </button>
            </div>

            <div className="grid grid-cols-2 gap-5">
              {cameras.map((camera) => (
                <div
                  key={camera.name}
                  className="rounded-2xl bg-[#050B14] border border-cyan-500/20 p-5 hover:border-cyan-400 transition shadow-[0_0_20px_rgba(0,229,255,0.06)]"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-cyan-300 flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full bg-cyan-400" />
                        {camera.name}
                      </h3>
                      <p className="text-sm text-gray-400 mt-1">
                        {camera.location}
                      </p>
                      <p className="text-xs text-cyan-300 mt-2">
                        Source: {camera.source}
                      </p>
                    </div>

                    <span className="text-xs px-3 py-1 rounded-full border text-green-300 border-green-400/40 bg-green-400/10">
                      {camera.status}
                    </span>
                  </div>

                  <button
                    onClick={() => setSelectedCamera(camera)}
                    className="mt-5 rounded-lg bg-cyan-500 text-black px-4 py-2 text-sm font-semibold"
                  >
                    View
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* World View */}
          <section
            id="world-view"
            className="rounded-2xl bg-[#07111F] border border-cyan-500/20 p-6"
          >
            <p className="text-cyan-300 text-sm uppercase tracking-widest">
              World View
            </p>
            <h2 className="text-3xl font-bold mt-2">World View</h2>
            <p className="text-gray-400 mt-2">Select a country to monitor</p>

            <div className="mt-6 grid grid-cols-[1fr_380px] gap-6">
              <div className="h-[420px] rounded-2xl bg-[#050B14] border border-cyan-500/20 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-7xl mb-3">🌐</div>
                  <p className="text-cyan-300 text-xl font-bold">Globe View</p>
                  <p className="text-sm text-gray-500">
                    Interactive world map coming soon
                  </p>
                </div>
              </div>

              <div className="rounded-2xl bg-[#050B14] border border-cyan-500/20 p-5">
                <input
                  className="w-full rounded-xl bg-[#0B1728] border border-cyan-500/20 px-4 py-3 text-sm outline-none"
                  placeholder="Search country..."
                />

                <p className="text-sm font-semibold text-gray-300 mt-5 mb-3">
                  Recently Viewed
                </p>

                <div className="flex flex-wrap gap-2">
                  {["Mauritius", "United States", "India", "France", "Japan"].map(
                    (country) => (
                      <button
                        key={country}
                        className="rounded-lg border border-cyan-500/30 px-3 py-2 text-xs text-cyan-300"
                      >
                        {country}
                      </button>
                    )
                  )}
                </div>

                <div className="rounded-xl bg-[#07111F] border border-cyan-500/20 p-5 mt-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-cyan-300">Mauritius</h3>
                    <span className="text-[10px] rounded-full bg-green-500/10 border border-green-400/40 text-green-300 px-2 py-1">
                      Live
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-5 text-sm">
                    <p>Cameras: 248</p>
                    <p>Alerts: 12</p>
                    <p>Traffic: Moderate</p>
                    <p>Weather: 24°C</p>
                  </div>

                  <a
                    href="#dashboard"
                    className="block mt-5 w-full rounded-lg bg-cyan-500 py-2 text-sm font-semibold text-black text-center"
                  >
                    Open Mauritius Dashboard
                  </a>
                </div>
              </div>
            </div>
          </section>

          {/* Reports / Settings placeholders */}
          <section id="reports" className="rounded-2xl bg-[#07111F] border border-cyan-500/20 p-6">
            <p className="text-cyan-300 text-sm uppercase tracking-widest">
              Reports
            </p>
            <h2 className="text-2xl font-bold mt-1">Intelligence Reports</h2>
            <p className="text-gray-400 mt-2">
              Report generator will be added next.
            </p>
          </section>

          <section id="settings" className="rounded-2xl bg-[#07111F] border border-cyan-500/20 p-6">
            <p className="text-cyan-300 text-sm uppercase tracking-widest">
              Settings
            </p>
            <h2 className="text-2xl font-bold mt-1">Admin & Security</h2>
            <p className="text-gray-400 mt-2">
              User roles, permissions, and audit logs will be added later.
            </p>
          </section>
        </section>
      </div>

      {/* Camera Modal */}
      {selectedCamera && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <div className="w-full max-w-5xl rounded-2xl bg-[#07111F] border border-cyan-500/30 shadow-[0_0_60px_rgba(0,229,255,0.18)] overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-cyan-500/20">
              <div>
                <h2 className="text-2xl font-bold text-cyan-300">
                  {selectedCamera.name}
                </h2>
                <p className="text-sm text-gray-400">
                  {selectedCamera.location} • {selectedCamera.status}
                </p>
              </div>

              <button
                onClick={() => setSelectedCamera(null)}
                className="rounded-lg border border-cyan-400 text-cyan-300 px-4 py-2"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-[1fr_280px] gap-5 p-5">
              <div className="h-[420px] rounded-xl bg-gradient-to-br from-gray-900 to-black border border-cyan-500/20 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-6xl mb-3">🎥</div>
                  <p className="text-cyan-300 font-semibold">
                    Live Camera Preview
                  </p>
                  <p className="text-xs text-gray-500">
                    Real CCTV stream will connect later
                  </p>
                </div>
              </div>

              <div className="rounded-xl bg-[#050B14] border border-cyan-500/20 p-5">
                <h3 className="font-semibold mb-5">AI Analysis</h3>

                <p className="text-xs text-gray-500">Traffic Density</p>
                <p className="text-lg font-bold text-red-400 mb-3">
                  {selectedCamera.density}
                </p>

                <p className="text-xs text-gray-500">Vehicle Count</p>
                <p className="text-lg font-bold text-cyan-300 mb-3">
                  {selectedCamera.vehicles}
                </p>

                <p className="text-xs text-gray-500">Average Speed</p>
                <p className="text-lg font-bold text-cyan-300 mb-5">
                  {selectedCamera.speed}
                </p>

                <a
                  href={selectedCamera.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full rounded-lg bg-cyan-500 text-black py-2 text-sm font-semibold text-center"
                >
                  Open Official my.t Feed
                </a>

                <div className="space-y-3 mt-4">
                  <button className="w-full rounded-lg border border-cyan-400 text-cyan-300 py-2 text-sm">
                    Screenshot
                  </button>
                  <button className="w-full rounded-lg border border-red-400 text-red-300 py-2 text-sm">
                    Record
                  </button>
                  <button className="w-full rounded-lg border border-cyan-400 text-cyan-300 py-2 text-sm">
                    Full Screen
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
