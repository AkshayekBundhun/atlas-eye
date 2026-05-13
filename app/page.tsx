"use client";

import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

type Camera = {
  id: string;
  name: string;
  location: string;
  status: "Live" | "Offline" | "Warning";
  density: "Low" | "Moderate" | "High";
  vehicles: string;
  speed: string;
  source: string;
  url: string;
  lng: number;
  lat: number;
  preview: string;
};

type AlertStatus = "Critical" | "Warning" | "Info";

type Alert = {
  type: string;
  icon: string;
  location: string;
  description: string;
  time: string;
  status: AlertStatus;
};

type UserRow = {
  name: string;
  role: string;
  status: "Active" | "Inactive";
  lastLogin: string;
};

type LayersState = {
  cameras: boolean;
  traffic: boolean;
  ships: boolean;
  flights: boolean;
  weather: boolean;
  ports: boolean;
  alerts: boolean;
};

type FlightHistoryEvent = {
  time: string;
  event: string;
  location: string;
  note: string;
  lng: number;
  lat: number;
};

type Flight = {
  icao24: string;
  callsign?: string;
  originCountry?: string;
  longitude?: number;
  latitude?: number;
  altitude?: number;
  velocity?: number;
  heading?: number;
  verticalRate?: number | null;
  onGround?: boolean;
  source?: string;
  origin?: string;
  destination?: string;
  departureTime?: string;
  eta?: string;
  status?: "En Route" | "Landed" | "Delayed" | "Holding" | "Unknown";
  route?: Array<[number, number]>;
  expectedRoute?: Array<[number, number]>;
  actualTrack?: Array<[number, number]>;
  plannedRoute?: Array<[number, number]>;
  stopovers?: string[];
  routeQuality?: "Provider" | "Partial" | "Unavailable";
  history?: FlightHistoryEvent[];
};

type FlightFeedStatus = {
  source: string;
  updatedAt: string;
  status: "Idle" | "Loading" | "Live" | "No Aircraft" | "Error" | "Layer Off";
  message: string;
};

type ShipHistoryEvent = {
  time: string;
  event: string;
  location: string;
  note: string;
  lng: number;
  lat: number;
};

type Ship = {
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
  source?: string;
  updatedAt?: string;
  route: Array<[number, number]>;
  expectedRoute?: Array<[number, number]>;
  deviationRadiusKm?: number;
  history?: ShipHistoryEvent[];
};

type ShipFeedStatus = {
  source: string;
  updatedAt: string;
  status: "Idle" | "Loading" | "Live" | "No Vessels" | "Error" | "Demo";
  message: string;
};

const ships: Ship[] = [
  {
    id: "ship-001",
    name: "MV Port Louis Trader",
    type: "Cargo",
    location: "NW of Port Louis",
    status: "Underway",
    speed: "14 kn",
    heading: "122° SE",
    destination: "Port Louis Harbour",
    eta: "2h 20m",
    lng: 57.4012,
    lat: -20.0804,
    route: [
      [57.2201, -19.9741],
      [57.2944, -20.0156],
      [57.3518, -20.0492],
      [57.4012, -20.0804],
    ],
  },
  {
    id: "ship-002",
    name: "Indian Ocean Star",
    type: "Tanker",
    location: "West Coast Approach",
    status: "Anchored",
    speed: "0 kn",
    heading: "Holding",
    destination: "Port Louis Anchorage",
    eta: "Awaiting clearance",
    lng: 57.3125,
    lat: -20.1964,
    route: [
      [57.1884, -20.2022],
      [57.2386, -20.1988],
      [57.2839, -20.1971],
      [57.3125, -20.1964],
    ],
  },
  {
    id: "ship-003",
    name: "Blue Marlin 07",
    type: "Fishing",
    location: "South West Fishing Zone",
    status: "Deviating",
    speed: "9 kn",
    heading: "211° SW",
    destination: "Unknown route variance",
    eta: "Monitoring",
    lng: 57.1857,
    lat: -20.5852,
    route: [
      [57.4204, -20.3824],
      [57.3331, -20.4387],
      [57.2512, -20.5119],
      [57.1857, -20.5852],
    ],
    expectedRoute: [
      [57.4204, -20.3824],
      [57.3501, -20.4102],
      [57.3024, -20.4451],
      [57.2688, -20.4812],
    ],
    deviationRadiusKm: 12,
  },
  {
    id: "ship-004",
    name: "Coastal Express",
    type: "Passenger",
    location: "East Lagoon Transit",
    status: "Underway",
    speed: "18 kn",
    heading: "046° NE",
    destination: "Ile aux Cerfs",
    eta: "48 min",
    lng: 57.7821,
    lat: -20.2649,
    route: [
      [57.7073, -20.3018],
      [57.7306, -20.2864],
      [57.7562, -20.2731],
      [57.7821, -20.2649],
    ],
  },
  {
    id: "ship-005",
    name: "NM Patrol Unit 3",
    type: "Patrol",
    location: "North Coast Patrol Sector",
    status: "Underway",
    speed: "22 kn",
    heading: "083° E",
    destination: "Coastal patrol loop",
    eta: "Active patrol",
    lng: 57.6403,
    lat: -19.9488,
    route: [
      [57.4874, -19.9344],
      [57.5412, -19.9256],
      [57.5923, -19.9341],
      [57.6403, -19.9488],
    ],
  },
];

const cameras: Camera[] = [
  {
    id: "cam-001",
    name: "Caudan North Junction",
    location: "Port Louis",
    status: "Live",
    density: "High",
    vehicles: "~25",
    speed: "18 km/h",
    source: "my.t Traffic Watch",
    url: "https://www.myt.mu/sinformer/trafficwatch/",
    lng: 57.4989,
    lat: -20.1609,
    preview:
      "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?q=80&w=1200&auto=format&fit=crop",
  },
  {
    id: "cam-002",
    name: "Caudan South Junction",
    location: "Port Louis",
    status: "Live",
    density: "High",
    vehicles: "~22",
    speed: "20 km/h",
    source: "my.t Traffic Watch",
    url: "https://www.myt.mu/sinformer/trafficwatch/",
    lng: 57.4996,
    lat: -20.1622,
    preview:
      "https://images.unsplash.com/photo-1494522855154-9297ac14b55f?q=80&w=1200&auto=format&fit=crop",
  },
  {
    id: "cam-003",
    name: "Place D'Armes",
    location: "Port Louis",
    status: "Live",
    density: "Moderate",
    vehicles: "~18",
    speed: "25 km/h",
    source: "my.t Traffic Watch",
    url: "https://www.myt.mu/sinformer/trafficwatch/",
    lng: 57.5012,
    lat: -20.1613,
    preview:
      "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1f?q=80&w=1200&auto=format&fit=crop",
  },
  {
    id: "cam-004",
    name: "Ebene Motorway",
    location: "Ebene",
    status: "Live",
    density: "Moderate",
    vehicles: "~18",
    speed: "32 km/h",
    source: "my.t Traffic Watch",
    url: "https://www.myt.mu/sinformer/trafficwatch/",
    lng: 57.4955,
    lat: -20.2439,
    preview:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1200&auto=format&fit=crop",
  },
  {
    id: "cam-005",
    name: "Phoenix Traffic Light",
    location: "Phoenix",
    status: "Live",
    density: "Low",
    vehicles: "~9",
    speed: "41 km/h",
    source: "my.t Traffic Watch",
    url: "https://www.myt.mu/sinformer/trafficwatch/",
    lng: 57.4939,
    lat: -20.2864,
    preview:
      "https://images.unsplash.com/photo-1465447142348-e9952c393450?q=80&w=1200&auto=format&fit=crop",
  },
  {
    id: "cam-006",
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
    preview:
      "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?q=80&w=1200&auto=format&fit=crop",
  },
];

const alerts: Alert[] = [
  {
    type: "High Traffic Density",
    icon: "🚨",
    location: "Caudan South, Port Louis",
    description: "Traffic density is higher than normal",
    time: "2 min ago",
    status: "Critical",
  },
  {
    type: "Camera Offline",
    icon: "⚠️",
    location: "Ebene Motorway",
    description: "Camera is not responding",
    time: "5 min ago",
    status: "Warning",
  },
  {
    type: "Heavy Rain Alert",
    icon: "🌧️",
    location: "North Region",
    description: "Expected heavy rainfall in the next 2 hours",
    time: "15 min ago",
    status: "Info",
  },
  {
    type: "Flight Delay",
    icon: "✈️",
    location: "SSR Airport",
    description: "Air Mauritius MK123 delayed",
    time: "20 min ago",
    status: "Info",
  },
];

const maritimeAlerts: Alert[] = ships
  .filter((ship) => ship.status === "Deviating")
  .map((ship) => ({
    type: "Vessel Deviating",
    icon: "🚢",
    location: ship.location,
    description: `${ship.name} is deviating from the expected route`,
    time: "Live",
    status: "Warning",
  }));

const activeAlerts: Alert[] = [...maritimeAlerts, ...alerts];

const users: UserRow[] = [
  {
    name: "John Doe",
    role: "Administrator",
    status: "Active",
    lastLogin: "25 May 2024 12:30",
  },
  {
    name: "Sarah Martin",
    role: "Operator",
    status: "Active",
    lastLogin: "25 May 2024 11:15",
  },
  {
    name: "Kevin Ramdhani",
    role: "Analyst",
    status: "Active",
    lastLogin: "25 May 2024 09:45",
  },
  {
    name: "Aisha Baccus",
    role: "Viewer",
    status: "Active",
    lastLogin: "24 May 2024 16:20",
  },
  {
    name: "Mooneesh Seebaluck",
    role: "Operator",
    status: "Inactive",
    lastLogin: "23 May 2024 14:10",
  },
];

const sidebarItems = [
  ["▣", "Dashboard"],
  ["◉", "Cameras"],
  ["▤", "Traffic"],
  ["♜", "Ships"],
  ["✈", "Flights"],
  ["☁", "Weather"],
  ["🔔", "Alerts"],
  ["▣", "Reports"],
  ["▥", "Analytics"],
  ["⚙", "Settings"],
];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function SectionLabel({ number, title }: { number: string; title: string }) {
  return (
    <div className="absolute left-3 top-3 z-20 rounded-md bg-blue-600 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-[0_0_18px_rgba(37,99,235,0.45)]">
      {number}. {title}
    </div>
  );
}

function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-cyan-500/20 bg-[#06111D]/95 shadow-[0_0_22px_rgba(0,180,255,0.08)]",
        className
      )}
    >
      {children}
    </div>
  );
}

function MiniButton({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-md border px-3 py-1.5 text-[11px] transition",
        active
          ? "border-cyan-300 bg-cyan-400/15 text-cyan-100"
          : "border-cyan-500/20 bg-[#0A1726] text-slate-300 hover:border-cyan-400/50"
      )}
    >
      {children}
    </button>
  );
}

function StatusBadge({
  status,
}: {
  status: AlertStatus | "Completed" | "Pending" | "Active" | "Inactive";
}) {
  const style =
    status === "Critical"
      ? "border-red-400/40 bg-red-500/15 text-red-300"
      : status === "Warning"
      ? "border-yellow-400/40 bg-yellow-500/15 text-yellow-300"
      : status === "Info"
      ? "border-blue-400/40 bg-blue-500/15 text-blue-300"
      : status === "Completed" || status === "Active"
      ? "border-green-400/40 bg-green-500/15 text-green-300"
      : status === "Pending"
      ? "border-yellow-400/40 bg-yellow-500/15 text-yellow-300"
      : "border-red-400/40 bg-red-500/15 text-red-300";

  return (
    <span className={cn("rounded-md border px-2 py-1 text-[10px] font-semibold", style)}>
      {status}
    </span>
  );
}

function AtlasLogo() {
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cyan-400/50 bg-cyan-400/10 shadow-[0_0_24px_rgba(0,200,255,0.22)]">
        <div className="absolute inset-1 rounded-full border border-cyan-300/20" />
        <span className="text-lg text-cyan-300">✧</span>
      </div>
      <div className="min-w-0">
        <div className="text-base font-black tracking-[0.24em] text-white">ATLAS</div>
        <div className="text-[8px] font-bold uppercase tracking-[0.18em] text-slate-400">
          Command Center
        </div>
      </div>
    </div>
  );
}


function buildCirclePolygon(
  center: [number, number],
  radiusKm: number,
  points = 72
) {
  const [centerLng, centerLat] = center;
  const coordinates: Array<[number, number]> = [];
  const earthRadiusKm = 6371;
  const latRadians = (centerLat * Math.PI) / 180;

  for (let i = 0; i <= points; i += 1) {
    const bearing = (i / points) * 2 * Math.PI;
    const latOffset = (radiusKm / earthRadiusKm) * Math.cos(bearing);
    const lngOffset =
      (radiusKm / earthRadiusKm) * Math.sin(bearing) / Math.cos(latRadians);

    coordinates.push([
      centerLng + (lngOffset * 180) / Math.PI,
      centerLat + (latOffset * 180) / Math.PI,
    ]);
  }

  return {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [coordinates],
    },
    properties: {},
  } as any;
}

function lineFeature(coordinates: Array<[number, number]>) {
  return {
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates,
    },
    properties: {},
  } as any;
}

function formatFlightTime(offsetMinutes = 0) {
  const date = new Date(Date.now() + offsetMinutes * 60 * 1000);

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function hasRealRouteData(flight: Flight) {
  return Boolean(
    flight.origin ||
      flight.destination ||
      flight.stopovers?.length ||
      flight.actualTrack?.length ||
      flight.plannedRoute?.length ||
      flight.route?.length ||
      flight.expectedRoute?.length ||
      flight.history?.length
  );
}

function buildFlightIntelligence(flight: Flight): Flight {
  const hasRouteData = hasRealRouteData(flight);

  return {
    ...flight,
    status: flight.status || (flight.onGround ? "Landed" : "En Route"),
    routeQuality: flight.routeQuality || (hasRouteData ? "Partial" : "Unavailable"),
    origin: flight.origin || undefined,
    destination: flight.destination || undefined,
    stopovers: flight.stopovers || [],
    actualTrack: flight.actualTrack || flight.route || [],
    plannedRoute: flight.plannedRoute || flight.expectedRoute || [],
    history: flight.history || [],
  };
}

function CommandMap({
  setSelectedCamera,
  shipsData,
  selectedShip,
  setSelectedShip,
  selectedFlight,
  setSelectedFlight,
  savedFlights,
  layers,
  setLiveShips,
  setLiveFlightCount,
  flightFeedStatus,
  setFlightFeedStatus,
  setShipFeedStatus,
}: {
  setSelectedCamera: (camera: Camera) => void;
  shipsData: Ship[];
  selectedShip: Ship | null;
  setSelectedShip: Dispatch<SetStateAction<Ship | null>>;
  selectedFlight: Flight | null;
  setSelectedFlight: (flight: Flight) => void;
  savedFlights: Flight[];
  layers: LayersState;
  setLiveShips: (ships: Ship[]) => void;
  setLiveFlightCount: (count: number) => void;
  flightFeedStatus: FlightFeedStatus;
  setFlightFeedStatus: (status: FlightFeedStatus) => void;
  setShipFeedStatus: (status: ShipFeedStatus) => void;
}) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const cameraMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const flightMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const shipMarkersRef = useRef<mapboxgl.Marker[]>([]);

  const [liveTime, setLiveTime] = useState("");
  const shipRouteLayerIds = useMemo(() => [
    "selected-ship-route",
    "selected-ship-expected-route",
    "selected-ship-deviation-zone-outline",
    "selected-ship-deviation-zone-fill",
  ], []);
  const shipRouteSourceIds = useMemo(() => [
    "selected-ship-route-source",
    "selected-ship-expected-route-source",
    "selected-ship-deviation-zone-source",
  ], []);
  const flightRouteLayerIds = useMemo(() => [
    "selected-flight-actual-route",
    "selected-flight-planned-route",
    "selected-flight-history-points",
  ], []);
  const flightRouteSourceIds = useMemo(() => [
    "selected-flight-actual-route-source",
    "selected-flight-planned-route-source",
    "selected-flight-history-source",
  ], []);
  const loadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shipLoadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: [57.2, -19.4],
      zoom: 5.1,
      pitch: 45,
      bearing: -28,
      antialias: true,
    });

    mapRef.current = map;

    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    cameras.forEach((camera) => {
      const el = document.createElement("button");
      el.className =
        "flex h-6 w-6 items-center justify-center rounded-md border border-green-300 bg-green-500/90 text-[12px] shadow-[0_0_15px_rgba(34,197,94,0.75)]";
      el.innerHTML = "▣";
      el.onclick = () => setSelectedCamera(camera);

      const marker = new mapboxgl.Marker(el)
        .setLngLat([camera.lng, camera.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 18 }).setHTML(`
            <div style="font-family:Arial;color:#06111D;font-size:13px;line-height:1.5;">
              <strong>${camera.name}</strong><br/>
              ${camera.location}<br/>
              Density: ${camera.density}<br/>
              Speed: ${camera.speed}
            </div>
          `)
        )
        .addTo(map);

      cameraMarkersRef.current.push(marker);
    });

    return () => {
      cameraMarkersRef.current.forEach((marker) => marker.remove());
      flightMarkersRef.current.forEach((marker) => marker.remove());
      shipMarkersRef.current.forEach((marker) => marker.remove());

      if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
      if (shipLoadTimerRef.current) clearTimeout(shipLoadTimerRef.current);

      cameraMarkersRef.current = [];
      flightMarkersRef.current = [];
      shipMarkersRef.current = [];

      map.remove();
      mapRef.current = null;
    };
  }, [setSelectedCamera]);

  useEffect(() => {
    cameraMarkersRef.current.forEach((marker) => {
      marker.getElement().style.display = layers.cameras ? "flex" : "none";
    });
  }, [layers.cameras]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const clearShipTrackingLayers = () => {
      shipRouteLayerIds.forEach((layerId) => {
        if (map.getLayer(layerId)) map.removeLayer(layerId);
      });

      shipRouteSourceIds.forEach((sourceId) => {
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      });
    };

    const addOrUpdateGeoJsonSource = (sourceId: string, data: any) => {
      const source = map.getSource(sourceId) as mapboxgl.GeoJSONSource | undefined;

      if (source) {
        source.setData(data);
        return;
      }

      map.addSource(sourceId, {
        type: "geojson",
        data,
      });
    };

    const renderSelectedShipTracking = () => {
      clearShipTrackingLayers();

      if (!selectedShip || !layers.ships) return;

      const routeCoordinates = selectedShip.route?.length
        ? selectedShip.route
        : [[selectedShip.lng, selectedShip.lat] as [number, number]];

      addOrUpdateGeoJsonSource(
        "selected-ship-route-source",
        lineFeature(routeCoordinates)
      );

      map.addLayer({
        id: "selected-ship-route",
        type: "line",
        source: "selected-ship-route-source",
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": selectedShip.status === "Deviating" ? "#facc15" : "#22d3ee",
          "line-width": 4,
          "line-opacity": 0.95,
          "line-blur": 0.4,
        },
      });

      if (selectedShip.expectedRoute?.length) {
        addOrUpdateGeoJsonSource(
          "selected-ship-expected-route-source",
          lineFeature(selectedShip.expectedRoute)
        );

        map.addLayer({
          id: "selected-ship-expected-route",
          type: "line",
          source: "selected-ship-expected-route-source",
          layout: {
            "line-cap": "round",
            "line-join": "round",
          },
          paint: {
            "line-color": "#94a3b8",
            "line-width": 2,
            "line-opacity": 0.85,
            "line-dasharray": [2, 2],
          },
        });
      }

      if (selectedShip.status === "Deviating") {
        addOrUpdateGeoJsonSource(
          "selected-ship-deviation-zone-source",
          buildCirclePolygon(
            [selectedShip.lng, selectedShip.lat],
            selectedShip.deviationRadiusKm || 8
          )
        );

        map.addLayer({
          id: "selected-ship-deviation-zone-fill",
          type: "fill",
          source: "selected-ship-deviation-zone-source",
          paint: {
            "fill-color": "#ef4444",
            "fill-opacity": 0.16,
          },
        });

        map.addLayer({
          id: "selected-ship-deviation-zone-outline",
          type: "line",
          source: "selected-ship-deviation-zone-source",
          paint: {
            "line-color": "#f87171",
            "line-width": 2,
            "line-opacity": 0.9,
            "line-dasharray": [1.5, 1.5],
          },
        });
      }
    };

    shipMarkersRef.current.forEach((marker) => marker.remove());
    shipMarkersRef.current = [];

    if (!layers.ships) {
      clearShipTrackingLayers();
      return;
    }

    if (selectedShip) {
      map.flyTo({
        center: [selectedShip.lng, selectedShip.lat],
        zoom: 10.4,
        pitch: 50,
        bearing: -18,
        duration: 1300,
        essential: true,
      });
    }

    if (map.isStyleLoaded()) {
      renderSelectedShipTracking();
    } else {
      map.once("load", renderSelectedShipTracking);
    }

    shipsData.forEach((ship) => {
      const isSelected = selectedShip?.id === ship.id;

      const el = document.createElement("button");
      el.className = [
        "flex h-8 w-8 items-center justify-center rounded-md border text-lg transition",
        "shadow-[0_0_18px_rgba(0,220,255,0.75)]",
        isSelected
          ? "border-yellow-300 bg-yellow-300/25 text-yellow-100"
          : ship.status === "Deviating"
          ? "border-red-300 bg-red-500/25 text-red-100"
          : "border-cyan-300/50 bg-cyan-400/15 text-cyan-200",
      ].join(" ");
      el.innerHTML = "🚢";
      el.title = `${ship.name} — ${ship.status}`;
      el.onclick = () => setSelectedShip(ship);

      const popup = new mapboxgl.Popup({ offset: 22 }).setHTML(`
        <div style="font-family:Arial;color:#06111D;font-size:13px;line-height:1.5;min-width:190px;">
          <strong style="font-size:15px;">${ship.name}</strong><br/>
          Type: ${ship.type}<br/>
          Location: ${ship.location}<br/>
          Status: ${ship.status}<br/>
          Speed: ${ship.speed}<br/>
          Heading: ${ship.heading}<br/>
          Destination: ${ship.destination}<br/>
          ETA: ${ship.eta}
        </div>
      `);

      const marker = new mapboxgl.Marker(el)
        .setLngLat([ship.lng, ship.lat])
        .setPopup(popup)
        .addTo(map);

      shipMarkersRef.current.push(marker);
    });

    return () => {
      map.off("load", renderSelectedShipTracking);
      shipMarkersRef.current.forEach((marker) => marker.remove());
      shipMarkersRef.current = [];
    };
  }, [layers.ships, selectedShip, setSelectedShip, shipRouteLayerIds, shipRouteSourceIds, shipsData]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const formatNow = () =>
      new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

    const loadShipsForVisibleBounds = async () => {
      const currentMap = mapRef.current;
      if (!currentMap) return;

      if (!layers.ships) {
        setLiveShips([]);
        setShipFeedStatus({
          source: "AIS layer off",
          updatedAt: formatNow(),
          status: "Idle",
          message: "Turn on the Ships layer to load AIS vessels.",
        });
        return;
      }

      const bounds = currentMap.getBounds();
      if (!bounds) return;

      const south = bounds.getSouth();
      const west = bounds.getWest();
      const north = bounds.getNorth();
      const east = bounds.getEast();

      setShipFeedStatus({
        source: "AISstream.io",
        updatedAt: "Loading",
        status: "Loading",
        message: "Collecting live AIS vessels in the current visible map area...",
      });

      try {
        const response = await fetch(
          `/api/ships?lamin=${south}&lomin=${west}&lamax=${north}&lomax=${east}&durationMs=9000`,
          { cache: "no-store" }
        );

        const data = await response.json();

        if (!response.ok) {
          setLiveShips([]);
          setShipFeedStatus({
            source: data.source || "AISstream.io",
            updatedAt: formatNow(),
            status: "Error",
            message: data.error || "Could not load live AIS vessels for this map area. Demo ships are active.",
          });
          return;
        }

        const nextShips: Ship[] = data.ships || [];

        if (nextShips.length > 0) {
          setLiveShips(nextShips);
        }

        setShipFeedStatus({
          source: data.source || "AISstream.io",
          updatedAt: data.updatedAt
            ? new Date(data.updatedAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })
            : formatNow(),
          status: nextShips.length > 0 ? "Live" : "No Vessels",
          message:
            nextShips.length > 0
              ? `${nextShips.length} live AIS vessel(s) loaded in the current map area.`
              : "No live AIS vessels received in this visible map area. Keeping saved Supabase/demo vessels visible.",
        });

        if (nextShips.length > 0) {
          setSelectedShip((current) =>
            current && nextShips.some((ship) => ship.id === current.id) ? current : nextShips[0]
          );
        }
      } catch {
        setLiveShips([]);
        setShipFeedStatus({
          source: "AISstream.io",
          updatedAt: formatNow(),
          status: "Error",
          message: "AIS request failed. Check app/api/ships/route.ts, ws installation, and AISSTREAM_API_KEY.",
        });
      }
    };

    const scheduleShipLoad = () => {
      if (shipLoadTimerRef.current) clearTimeout(shipLoadTimerRef.current);
      shipLoadTimerRef.current = setTimeout(loadShipsForVisibleBounds, 1500);
    };

    loadShipsForVisibleBounds();
    const refreshTimer = setInterval(loadShipsForVisibleBounds, 60000);
    map.on("moveend", scheduleShipLoad);

    return () => {
      if (shipLoadTimerRef.current) clearTimeout(shipLoadTimerRef.current);
      clearInterval(refreshTimer);
      map.off("moveend", scheduleShipLoad);
    };
  }, [layers.ships, setLiveShips, setSelectedShip, setShipFeedStatus]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const clearFlightTrackingLayers = () => {
      flightRouteLayerIds.forEach((layerId) => {
        if (map.getLayer(layerId)) map.removeLayer(layerId);
      });

      flightRouteSourceIds.forEach((sourceId) => {
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      });
    };

    const renderSelectedFlightTracking = () => {
      clearFlightTrackingLayers();

      if (!selectedFlight || !layers.flights) return;

      const actualRoute =
        selectedFlight.actualTrack?.length
          ? selectedFlight.actualTrack
          : selectedFlight.history?.length
          ? selectedFlight.history.map((event) => [event.lng, event.lat] as [number, number])
          : [];

      const plannedRoute =
        selectedFlight.plannedRoute?.length
          ? selectedFlight.plannedRoute
          : selectedFlight.expectedRoute?.length
          ? selectedFlight.expectedRoute
          : [];

      if (actualRoute.length >= 2) {
        map.addSource("selected-flight-actual-route-source", {
          type: "geojson",
          data: lineFeature(actualRoute),
        });

        map.addLayer({
          id: "selected-flight-actual-route",
          type: "line",
          source: "selected-flight-actual-route-source",
          layout: {
            "line-cap": "round",
            "line-join": "round",
          },
          paint: {
            "line-color": "#38bdf8",
            "line-width": 4,
            "line-opacity": 0.95,
            "line-blur": 0.35,
          },
        });
      }

      if (plannedRoute.length >= 2) {
        map.addSource("selected-flight-planned-route-source", {
          type: "geojson",
          data: lineFeature(plannedRoute),
        });

        map.addLayer({
          id: "selected-flight-planned-route",
          type: "line",
          source: "selected-flight-planned-route-source",
          layout: {
            "line-cap": "round",
            "line-join": "round",
          },
          paint: {
            "line-color": "#facc15",
            "line-width": 3,
            "line-opacity": 0.9,
            "line-dasharray": [2, 2],
          },
        });
      }

      if (selectedFlight.history?.length) {
        map.addSource("selected-flight-history-source", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: selectedFlight.history.map((event, index) => ({
              type: "Feature",
              geometry: {
                type: "Point",
                coordinates: [event.lng, event.lat],
              },
              properties: {
                label: String(index + 1),
                title: event.event,
              },
            })),
          },
        });

        map.addLayer({
          id: "selected-flight-history-points",
          type: "circle",
          source: "selected-flight-history-source",
          paint: {
            "circle-radius": 6,
            "circle-color": "#facc15",
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 1.5,
            "circle-opacity": 0.95,
          },
        });
      }

      if (selectedFlight.longitude && selectedFlight.latitude) {
        map.flyTo({
          center: [selectedFlight.longitude, selectedFlight.latitude],
          zoom: 8.6,
          pitch: 48,
          bearing: -20,
          duration: 1200,
          essential: true,
        });
      }
    };

    if (map.isStyleLoaded()) {
      renderSelectedFlightTracking();
    } else {
      map.once("load", renderSelectedFlightTracking);
    }

    return () => {
      map.off("load", renderSelectedFlightTracking);
      clearFlightTrackingLayers();
    };
  }, [selectedFlight, layers.flights, flightRouteLayerIds, flightRouteSourceIds]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const clearFlights = () => {
      flightMarkersRef.current.forEach((marker) => marker.remove());
      flightMarkersRef.current = [];
    };

    const loadFlights = async () => {
      const currentMap = mapRef.current;
      if (!currentMap) return;

      clearFlights();

      if (!layers.flights) {
        setLiveFlightCount(0);
        setFlightFeedStatus({
          source: "Flight layer off",
          updatedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          status: "Layer Off",
          message: "Turn on the Flights layer to load aircraft.",
        });
        return;
      }

      setFlightFeedStatus({
        source: "Loading",
        updatedAt: liveTime || "Loading",
        status: "Loading",
        message: "Loading live aircraft in the visible map area...",
      });

      try {
        const bounds = currentMap.getBounds();
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
          setLiveFlightCount(0);
          setFlightFeedStatus({
            source: data.source || "Flight API",
            updatedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
            status: "Error",
            message: data.error || "Flight API request failed.",
          });
          return;
        }

        const liveFlights: Flight[] = (data.flights || []).map((flight: Flight) =>
          buildFlightIntelligence({
            ...flight,
            source: data.source || flight.source || "Live Flight Feed",
          })
        );

        const flights = liveFlights.length > 0 ? liveFlights : savedFlights;
        setLiveFlightCount(flights.length);
        setFlightFeedStatus({
          source:
            liveFlights.length > 0
              ? data.source || "Live Flight Feed"
              : savedFlights.length > 0
              ? "Supabase aircraft cache"
              : data.source || "Live Flight Feed",
          updatedAt: data.updatedAt
            ? new Date(data.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
            : new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          status: flights.length > 0 ? "Live" : "No Aircraft",
          message:
            liveFlights.length > 0
              ? `${liveFlights.length} live aircraft loaded from ${data.source || "flight provider"}.`
              : savedFlights.length > 0
              ? `No live aircraft found in the visible map area. Showing ${savedFlights.length} saved aircraft from Supabase.`
              : "No aircraft found in live feed or Supabase cache. Try zooming out or run the flight collector.",
        });

        flights.forEach((flight) => {
          if (!flight.longitude || !flight.latitude) return;

          const isSelected = selectedFlight?.icao24 === flight.icao24;
          const el = document.createElement("button");
          el.className = cn(
            "flex h-8 w-8 items-center justify-center rounded-full border text-xs text-black transition",
            isSelected
              ? "border-yellow-200 bg-yellow-300 shadow-[0_0_22px_rgba(250,204,21,0.95)]"
              : "border-white/40 bg-cyan-400/90 shadow-[0_0_18px_rgba(0,229,255,0.8)]"
          );
          el.innerHTML = "✈";
          el.style.transform = `rotate(${flight.heading || 0}deg)`;
          el.onclick = () => setSelectedFlight(flight);

          const marker = new mapboxgl.Marker(el)
            .setLngLat([flight.longitude, flight.latitude])
            .setPopup(
              new mapboxgl.Popup({ offset: 20 }).setHTML(`
                <div style="font-family:Arial;color:#06111D;font-size:13px;line-height:1.5;min-width:200px;">
                  <strong>${flight.callsign || "Unknown Flight"}</strong><br/>
                  Route: ${flight.origin || "Unknown"} → ${flight.destination || "Unknown"}<br/>
                  Source: ${flight.source || "Live flight feed"}<br/>
                  Country/Operator: ${flight.originCountry || "Unknown"}<br/>
                  Altitude: ${
                    flight.altitude ? Math.round(flight.altitude) + " m" : "Unknown"
                  }<br/>
                  Speed: ${
                    flight.velocity ? Math.round(flight.velocity * 3.6) + " km/h" : "Unknown"
                  }<br/>
                  ETA: ${flight.eta || "Unknown"}<br/>
                  Source: ${flight.source || data.source || "Live Flight Feed"}
                </div>
              `)
            )
            .addTo(currentMap);

          flightMarkersRef.current.push(marker);
        });
      } catch {
        setLiveFlightCount(0);
        setFlightFeedStatus({
          source: "Flight API",
          updatedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          status: "Error",
          message: "Could not load flights. Check the API route and provider limits.",
        });
      }
    };

    const schedule = () => {
      if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
      loadTimerRef.current = setTimeout(loadFlights, 1200);
    };

    loadFlights();
    map.on("moveend", schedule);

    return () => {
      if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
      map.off("moveend", schedule);
      clearFlights();
    };
  }, [layers.flights, setLiveFlightCount, setFlightFeedStatus, setSelectedFlight, selectedFlight, savedFlights]);

  useEffect(() => {
    const updateClock = () => {
      setLiveTime(
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };

    updateClock();

    const timer = setInterval(updateClock, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative h-full w-full">
      <div ref={mapContainer} className="h-full w-full" />

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_35%,rgba(2,8,23,0.45)_70%,rgba(2,8,23,0.85))]" />

      {/* Ship markers are rendered as real Mapbox markers using vessel lng/lat. */}

      {layers.alerts && (
        <>
          <div className="absolute left-[48%] top-[48%] rounded-md bg-red-500 px-2 py-1 text-xs shadow-[0_0_20px_rgba(239,68,68,0.9)]">
            ⚠
          </div>
          <div className="absolute left-[25%] top-[64%] rounded-md bg-red-500 px-2 py-1 text-xs shadow-[0_0_20px_rgba(239,68,68,0.9)]">
            ⚠
          </div>
        </>
      )}

      <div className="absolute bottom-4 left-4 right-4 rounded-lg border border-cyan-400/20 bg-[#050B14]/88 p-3 backdrop-blur">
        <div className="flex items-center gap-4">
          <button className="flex h-9 w-9 items-center justify-center rounded-md bg-cyan-400 text-black">
            ▶
          </button>
          <button className="rounded-md border border-cyan-400/20 bg-[#0B1728] px-3 py-2 text-xs text-slate-300">
            1x
          </button>
          <div className="relative h-1 flex-1 rounded-full bg-slate-700">
            <div className="absolute left-0 top-0 h-1 w-[52%] rounded-full bg-cyan-400" />
            <div className="absolute left-[52%] top-1/2 -translate-y-1/2 rounded bg-cyan-400 px-2 py-1 text-[10px] text-black">
              {liveTime}
            </div>
          </div>
          <button className="rounded-md border border-cyan-400/20 bg-[#0B1728] px-4 py-2 text-xs text-cyan-300">
            LIVE
          </button>
          <button className="rounded-md border border-cyan-400/20 bg-[#0B1728] px-3 py-2 text-xs">
            ⛶
          </button>
        </div>

        <div className="mt-2 flex justify-between px-[115px] text-[10px] text-slate-400">
          <span>00:00</span>
          <span>06:00</span>
          <span>12:00</span>
          <span>18:00</span>
          <span>24:00</span>
        </div>
      </div>

    </div>
  );
}


function WeatherOverviewCard() {
  return (
    <Card className="h-[150px] p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300">
        Weather Overview
      </p>

      <div className="mt-3 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs text-slate-400">Port Louis, MU</p>
          <div className="mt-1 flex items-center gap-3">
            <span className="text-5xl font-light text-white">24°</span>
            <span className="text-4xl">⛅</span>
          </div>
          <p className="text-xs text-slate-400">Partly Cloudy</p>
        </div>

        <div className="grid grid-cols-3 gap-4 text-[10px] text-slate-400">
          <div>
            <p>Humidity</p>
            <p className="mt-1 text-sm font-bold text-white">78%</p>
          </div>
          <div>
            <p>Wind</p>
            <p className="mt-1 text-sm font-bold text-white">18 km/h</p>
          </div>
          <div>
            <p>Rain</p>
            <p className="mt-1 text-sm font-bold text-white">0 mm</p>
          </div>
        </div>
      </div>
    </Card>
  );
}

function FlightFeedStatusCard({
  flightFeedStatus,
}: {
  flightFeedStatus: FlightFeedStatus;
}) {
  return (
    <Card className="h-[150px] p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300">
        Live Flight Feed
      </p>

      <div className="mt-3 grid grid-cols-4 gap-3 text-[10px] text-slate-400">
        <div>
          <p>Status</p>
          <p
            className={cn(
              "mt-1 text-sm font-bold",
              flightFeedStatus.status === "Live"
                ? "text-green-300"
                : flightFeedStatus.status === "Error"
                ? "text-red-300"
                : "text-yellow-300"
            )}
          >
            {flightFeedStatus.status}
          </p>
        </div>

        <div>
          <p>Updated</p>
          <p className="mt-1 text-sm font-bold text-white">{flightFeedStatus.updatedAt}</p>
        </div>

        <div className="col-span-2">
          <p>Source</p>
          <p className="mt-1 truncate text-sm font-bold text-cyan-300">
            {flightFeedStatus.source}
          </p>
        </div>

        <div className="col-span-4">
          <p>Message</p>
          <p className="mt-1 line-clamp-2 font-bold text-white">
            {flightFeedStatus.message}
          </p>
        </div>
      </div>
    </Card>
  );
}


function LayersPanel({
  layers,
  toggleLayer,
}: {
  layers: LayersState;
  toggleLayer: (layer: keyof LayersState) => void;
}) {
  const items: Array<[keyof LayersState, string, string]> = [
    ["cameras", "Cameras", "☷"],
    ["traffic", "Traffic", "▤"],
    ["ships", "Ships", "♜"],
    ["flights", "Flights", "✈"],
    ["weather", "Weather", "☁"],
    ["ports", "Ports", "◉"],
    ["alerts", "Alerts", "⚠"],
  ];

  return (
    <div className="absolute left-4 top-16 z-20 w-44 rounded-lg border border-cyan-500/20 bg-[#07111F]/90 p-3 backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-widest text-white">Layers</p>
        <span className="text-slate-400">›</span>
      </div>

      <div className="space-y-2">
        {items.map(([key, label, icon]) => (
          <button
            key={key}
            onClick={() => toggleLayer(key)}
            className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs text-slate-300 hover:bg-cyan-400/5"
          >
            <span className="flex items-center gap-2">
              <span className="text-slate-400">{icon}</span>
              {label}
            </span>

            <span
              className={cn(
                "relative h-4 w-8 rounded-full transition",
                layers[key] ? "bg-green-500" : "bg-slate-700"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-3 w-3 rounded-full bg-white transition",
                  layers[key] ? "left-4" : "left-0.5"
                )}
              />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function CameraManagement({
  selectedCamera,
  setSelectedCamera,
}: {
  selectedCamera: Camera;
  setSelectedCamera: (camera: Camera) => void;
}) {
  return (
    <Card className="h-[360px]">
      <SectionLabel number="2" title="Camera Management" />

      <div className="grid h-full grid-cols-[240px_1fr] pt-10">
        <div className="border-r border-cyan-500/20 p-3">
          <input
            className="w-full rounded-md border border-cyan-500/20 bg-[#07111F] px-3 py-2 text-xs outline-none placeholder:text-slate-500 focus:border-cyan-400"
            placeholder="Search cameras..."
          />

          <div className="mt-3 grid grid-cols-2 gap-2">
            <select className="rounded-md border border-cyan-500/20 bg-[#07111F] px-2 py-2 text-[11px] text-slate-300 outline-none">
              <option>All Status</option>
            </select>
            <select className="rounded-md border border-cyan-500/20 bg-[#07111F] px-2 py-2 text-[11px] text-slate-300 outline-none">
              <option>All Types</option>
            </select>
          </div>

          <button className="mt-3 w-full rounded-md bg-cyan-500 px-3 py-2 text-xs font-bold text-black hover:bg-cyan-400">
            + Add Camera
          </button>

          <div className="mt-3 max-h-[220px] space-y-2 overflow-y-auto pr-1">
            {cameras.map((camera) => (
              <button
                key={camera.id}
                onClick={() => setSelectedCamera(camera)}
                className={cn(
                  "grid w-full grid-cols-[64px_1fr] gap-2 rounded-md border p-1.5 text-left transition",
                  selectedCamera.id === camera.id
                    ? "border-cyan-400 bg-cyan-400/10"
                    : "border-cyan-500/10 bg-[#081625] hover:border-cyan-400/40"
                )}
              >
                <div
                  className="h-12 rounded bg-cover bg-center"
                  style={{ backgroundImage: `url(${camera.preview})` }}
                />
                <div>
                  <p className="line-clamp-1 text-[11px] font-semibold text-white">
                    {camera.name}
                  </p>
                  <p className="text-[10px] text-slate-400">{camera.location}</p>
                  <p className="mt-1 flex items-center gap-1 text-[10px] text-green-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                    {camera.status}
                  </p>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
            <span>Showing 1 to {cameras.length} of 120 cameras</span>
            <span>‹ 1 2 3 ... 6 ›</span>
          </div>
        </div>

        <div className="relative bg-[#020814]">
          <div className="absolute right-4 top-3 z-10 flex overflow-hidden rounded-md border border-cyan-500/20">
            <button className="bg-[#07111F] px-4 py-2 text-[11px] text-white">Map</button>
            <button className="bg-[#0B1728] px-4 py-2 text-[11px] text-slate-400">
              Satellite
            </button>
          </div>

          <div className="absolute left-5 top-5 z-10 flex h-9 w-9 items-center justify-center rounded-md border border-slate-400/30 bg-slate-800/70 text-xl text-slate-200">
            +
          </div>

          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,197,94,0.08),transparent_58%),linear-gradient(135deg,#06101F,#08233B,#01050B)]" />

          <div className="absolute inset-8 rounded-[45%] border border-green-500/20 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.18),rgba(34,197,94,0.12)_35%,rgba(0,0,0,0)_65%)] shadow-[0_0_80px_rgba(34,197,94,0.14)]" />

          {cameras.map((camera, index) => {
            const points = [
              ["61%", "33%"],
              ["48%", "39%"],
              ["55%", "45%"],
              ["45%", "55%"],
              ["59%", "60%"],
              ["70%", "68%"],
            ][index] || ["50%", "50%"];

            return (
              <button
                key={camera.id}
                onClick={() => setSelectedCamera(camera)}
                className={cn(
                  "absolute flex h-7 w-7 items-center justify-center rounded-md border text-xs shadow-[0_0_18px_rgba(34,197,94,0.7)]",
                  selectedCamera.id === camera.id
                    ? "border-cyan-200 bg-cyan-400 text-black"
                    : "border-green-200 bg-green-500 text-white"
                )}
                style={{ left: points[0], top: points[1] }}
              >
                ▣
              </button>
            );
          })}

          <div className="absolute left-[42%] top-[36%] text-xs text-slate-300">Port Louis</div>
          <div className="absolute left-[52%] top-[43%] text-xs text-slate-400">Phoenix</div>
          <div className="absolute left-[62%] top-[52%] text-xs text-slate-400">Curepipe</div>

          <div className="absolute bottom-4 right-4 overflow-hidden rounded-md border border-cyan-500/20">
            <button className="block bg-[#07111F] px-3 py-2 text-white">+</button>
            <button className="block border-t border-cyan-500/20 bg-[#07111F] px-3 py-2 text-white">
              −
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function LiveCameraView({ camera }: { camera: Camera }) {
  return (
    <Card className="h-[300px]">
      <SectionLabel number="3" title="Live Camera View" />

      <div className="grid h-full grid-cols-[1fr_160px] gap-3 p-3 pt-10">
        <div
          className="relative overflow-hidden rounded-lg border border-cyan-500/20 bg-cover bg-center"
          style={{ backgroundImage: `url(${camera.preview})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />
          <div className="absolute left-3 top-3">
            <p className="text-xs font-bold text-white">{camera.name}</p>
            <p className="text-[10px] text-slate-300">{camera.location}</p>
          </div>
          <div className="absolute right-3 top-3 flex items-center gap-2 rounded-md bg-black/60 px-3 py-1 text-[10px] text-green-300">
            <span className="h-2 w-2 rounded-full bg-green-400" />
            LIVE
          </div>
          <div className="absolute bottom-3 left-3 right-3 flex gap-2">
            {["Screenshot", "Record", "Share", "Full Screen"].map((item) => (
              <button
                key={item}
                className="rounded-md border border-cyan-500/20 bg-black/50 px-3 py-2 text-[10px] text-slate-200 backdrop-blur"
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-cyan-500/20 bg-[#07111F] p-3">
          <div className="mb-3 flex gap-2 border-b border-cyan-500/20 pb-2 text-[11px]">
            <span className="text-slate-400">Details</span>
            <span className="text-cyan-300">AI Insights</span>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-[10px] text-slate-500">Traffic Density</p>
              <p className="text-sm font-bold text-white">{camera.density}</p>
              <div className="mt-2 h-1 rounded-full bg-slate-700">
                <div
                  className={cn(
                    "h-1 rounded-full",
                    camera.density === "High"
                      ? "w-[86%] bg-red-400"
                      : camera.density === "Moderate"
                      ? "w-[58%] bg-yellow-400"
                      : "w-[30%] bg-green-400"
                  )}
                />
              </div>
            </div>

            <div>
              <p className="text-[10px] text-slate-500">Vehicles Count</p>
              <p className="text-sm font-bold text-white">{camera.vehicles}</p>
            </div>

            <div>
              <p className="text-[10px] text-slate-500">Average Speed</p>
              <p className="text-sm font-bold text-white">{camera.speed}</p>
            </div>

            <div>
              <p className="text-[10px] text-slate-500">Status</p>
              <p className="text-sm font-bold text-green-400">Normal</p>
            </div>

            <div className="rounded-md border border-cyan-500/20 bg-black/20 p-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-300">
                Live View Settings
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-slate-400">
                <span>Quality: HD</span>
                <span>Refresh: Live</span>
                <span>AI Overlay: On</span>
                <span>Recording: Off</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function AlertsDashboard() {
  return (
    <Card className="h-[290px]">
      <SectionLabel number="4" title="Alerts Dashboard" />

      <div className="p-3 pt-10">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <MiniButton active>All Alerts ({activeAlerts.length})</MiniButton>
            <MiniButton>Critical ({activeAlerts.filter((alert) => alert.status === "Critical").length})</MiniButton>
            <MiniButton>Warning ({activeAlerts.filter((alert) => alert.status === "Warning").length})</MiniButton>
            <MiniButton>Info ({activeAlerts.filter((alert) => alert.status === "Info").length})</MiniButton>
          </div>

          <select className="rounded-md border border-cyan-500/20 bg-[#07111F] px-3 py-2 text-[11px] text-slate-300 outline-none">
            <option>All Types</option>
          </select>
        </div>

        <div className="overflow-x-auto rounded-lg border border-cyan-500/15">
          <table className="w-full min-w-[620px] text-left text-[11px]">
            <thead className="bg-[#07111F] text-slate-400">
              <tr>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Location</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {activeAlerts.map((alert) => (
                <tr key={alert.type} className="border-t border-cyan-500/10">
                  <td className="px-3 py-2 text-white">
                    {alert.icon} {alert.type}
                  </td>
                  <td className="px-3 py-2 text-slate-300">{alert.location}</td>
                  <td className="px-3 py-2 text-slate-400">{alert.description}</td>
                  <td className="px-3 py-2 text-slate-400">{alert.time}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={alert.status} />
                  </td>
                  <td className="px-3 py-2 text-slate-500">⋮</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button className="mt-3 w-full rounded-md border border-cyan-500/20 bg-[#07111F] py-2 text-xs text-cyan-300">
          View All Alerts →
        </button>
      </div>
    </Card>
  );
}

function AICommandCenter({
  liveFlightCount,
  shipsData,
  setSelectedCamera,
}: {
  liveFlightCount: number;
  shipsData: Ship[];
  setSelectedCamera: (camera: Camera) => void;
}) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<
    Array<{
      role: "user" | "atlas";
      text: string;
      time: string;
      matchedCameraIds?: string[];
    }>
  >([
    {
      role: "user",
      text: "Show me all traffic cameras in Ebene with high traffic",
      time: "12:45 PM",
    },
    {
      role: "atlas",
      text: "I found the Ebene Motorway camera. Current density is Moderate, with about ~18 vehicles and an average speed of 32 km/h. No high-density camera is currently listed in Ebene.",
      time: "12:45 PM",
      matchedCameraIds: ["cam-004"],
    },
  ]);

  const newLine = String.fromCharCode(10);

  const getTime = () =>
    new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

  const buildAtlasReply = (question: string) => {
    const normalized = question.toLowerCase();

    const wantsTraffic =
      normalized.includes("traffic") ||
      normalized.includes("congestion") ||
      normalized.includes("density");

    const wantsHigh =
      normalized.includes("high") ||
      normalized.includes("critical") ||
      normalized.includes("busy");

    const wantsAlerts =
      normalized.includes("alert") ||
      normalized.includes("incident") ||
      normalized.includes("warning");

    const wantsFlights =
      normalized.includes("flight") ||
      normalized.includes("aircraft") ||
      normalized.includes("plane");

    const wantsReport =
      normalized.includes("report") ||
      normalized.includes("summary") ||
      normalized.includes("brief");

    const matchedCameras = cameras.filter((camera) => {
      const cameraText = `${camera.name} ${camera.location}`.toLowerCase();
      const locationMatch = cameraText
        .split(" ")
        .some((word) => word.length > 3 && normalized.includes(word));

      if (wantsHigh && camera.density !== "High") return false;
      if (wantsTraffic) return locationMatch || wantsHigh;

      return locationMatch;
    });

    if (wantsReport) {
      const highTraffic = cameras.filter((camera) => camera.density === "High");
      const criticalAlerts = activeAlerts.filter((alert) => alert.status === "Critical");

      return {
        text: [
          "Atlas Situation Brief",
          "",
          "Region: Mauritius",
          `Traffic: ${highTraffic.length} high-density camera(s) detected. ${highTraffic
            .map((camera) => camera.name)
            .join(", ")}.`,
          `Alerts: ${activeAlerts.length} active alert(s), including ${criticalAlerts.length} critical alert(s).`,
          `Flights: ${liveFlightCount} aircraft visible in the current map area.`,
          "Recommendation: Monitor Port Louis congestion and keep Caudan cameras under observation.",
        ].join(newLine),
        matchedCameraIds: highTraffic.map((camera) => camera.id),
      };
    }

    if (wantsAlerts) {
      return {
        text: [
          `There are ${activeAlerts.length} active alerts. The latest alerts are:`,
          "",
          ...activeAlerts.slice(0, 4).map(
            (alert) =>
              `• ${alert.type} — ${alert.location} — ${alert.status} — ${alert.time}`
          ),
        ].join(newLine),
      };
    }

    if (wantsFlights) {
      return {
        text: `The flight layer currently shows ${liveFlightCount} visible aircraft in the active map area. Move or zoom the map to refresh aircraft in another region.`,
      };
    }

    if (
      normalized.includes("ship") ||
      normalized.includes("boat") ||
      normalized.includes("vessel") ||
      normalized.includes("maritime") ||
      normalized.includes("port")
    ) {
      const deviatingShips = shipsData.filter((ship) => ship.status === "Deviating");

      return {
        text: [
          `I am tracking ${shipsData.length} maritime vessel(s) in the current AIS/demo layer.`,
          "",
          ...shipsData.map(
            (ship) =>
              `• ${ship.name} — ${ship.type} — ${ship.location} — ${ship.status} — ${ship.speed}`
          ),
          "",
          `Attention required: ${deviatingShips.length} vessel(s) deviating or under watch.`,
        ].join(newLine),
      };
    }

    if (matchedCameras.length > 0) {
      return {
        text: [
          `I found ${matchedCameras.length} matching camera(s):`,
          "",
          ...matchedCameras.map(
            (camera) =>
              `• ${camera.name} — ${camera.location} — ${camera.density} density — ${camera.vehicles} vehicles — ${camera.speed}`
          ),
        ].join(newLine),
        matchedCameraIds: matchedCameras.map((camera) => camera.id),
      };
    }

    if (wantsTraffic || wantsHigh) {
      const highTraffic = cameras.filter((camera) => camera.density === "High");

      return {
        text: [
          `I found ${highTraffic.length} high-traffic camera(s):`,
          "",
          ...highTraffic.map(
            (camera) =>
              `• ${camera.name} — ${camera.location} — ${camera.vehicles} vehicles — ${camera.speed}`
          ),
        ].join(newLine),
        matchedCameraIds: highTraffic.map((camera) => camera.id),
      };
    }

    return {
      text:
        "I can help with cameras, traffic density, alerts, flights, and situation reports. Try: ‘show high traffic cameras’, ‘summarize alerts’, or ‘generate situation report’.",
    };
  };

  const submitCommand = () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    const reply = buildAtlasReply(trimmed);
    const time = getTime();

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        text: trimmed,
        time,
      },
      {
        role: "atlas",
        text: reply.text,
        time,
        matchedCameraIds: reply.matchedCameraIds,
      },
    ]);

    setInput("");
  };

  const showFirstMatchedCamera = (cameraIds?: string[]) => {
    if (!cameraIds || cameraIds.length === 0) return;

    const camera = cameras.find((item) => item.id === cameraIds[0]);
    if (camera) setSelectedCamera(camera);
  };

  return (
    <Card className="h-[290px]">
      <SectionLabel number="5" title="AI Command Center" />

      <div className="flex h-full flex-col p-3 pt-12">
        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          {messages.map((message, index) =>
            message.role === "user" ? (
              <div
                key={`${message.role}-${index}`}
                className="ml-auto max-w-[78%] rounded-lg bg-cyan-500/20 p-3 text-xs text-cyan-50"
              >
                {message.text}
                <div className="mt-1 text-right text-[9px] text-slate-400">
                  {message.time}
                </div>
              </div>
            ) : (
              <div key={`${message.role}-${index}`} className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-cyan-400/40 bg-cyan-400/10 text-cyan-300">
                  AI
                </div>
                <div className="min-w-0 flex-1 rounded-lg bg-[#0B1728] p-3 text-xs leading-5 text-slate-200">
                  <div className="whitespace-pre-line">{message.text}</div>
                  <div className="mt-2 text-[9px] text-slate-400">{message.time}</div>

                  {message.matchedCameraIds && message.matchedCameraIds.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <MiniButton onClick={() => showFirstMatchedCamera(message.matchedCameraIds)}>
                        Show on Camera Panel
                      </MiniButton>
                      <MiniButton>Generate Report</MiniButton>
                      <MiniButton>Add Alert</MiniButton>
                    </div>
                  )}
                </div>
              </div>
            )
          )}
        </div>

        <div className="mt-3 flex rounded-lg border border-cyan-500/20 bg-[#07111F] p-2">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submitCommand();
            }}
            className="flex-1 bg-transparent px-2 text-xs outline-none placeholder:text-slate-500"
            placeholder="Ask anything..."
          />
          <button onClick={submitCommand} className="rounded-md bg-cyan-500 px-3 py-2 text-black">
            ▶
          </button>
        </div>

        <p className="mt-2 text-[9px] text-slate-500">
          Local Atlas command logic active. Connect to AI API later for deeper reasoning.
        </p>
      </div>
    </Card>
  );
}

function FlightIntelligencePanel({
  selectedFlight,
  flightFeedStatus,
  setSelectedFlight,
  savedFlights,
}: {
  selectedFlight: Flight | null;
  flightFeedStatus: FlightFeedStatus;
  setSelectedFlight: (flight: Flight) => void;
  savedFlights: Flight[];
}) {
  const [flightSearch, setFlightSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | NonNullable<Flight["status"]>>("All");

  const filteredFlights = useMemo(() => {
    const query = flightSearch.trim().toLowerCase();

    return savedFlights.filter((flight) => {
      const searchableText = `${flight.callsign || ""} ${flight.icao24} ${flight.originCountry || ""} ${flight.source || ""} ${flight.status || ""} ${flight.origin || ""} ${flight.destination || ""}`.toLowerCase();

      const matchesSearch = !query || searchableText.includes(query);
      const matchesStatus = statusFilter === "All" || flight.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [flightSearch, savedFlights, statusFilter]);

  const activeFlight = selectedFlight || filteredFlights[0] || savedFlights[0] || null;

  const summary = useMemo(
    () => ({
      total: savedFlights.length,
      enRoute: savedFlights.filter((flight) => flight.status === "En Route").length,
      landed: savedFlights.filter((flight) => flight.status === "Landed" || flight.onGround).length,
      routeReady: savedFlights.filter(
        (flight) =>
          (flight.actualTrack?.length || 0) >= 2 ||
          (flight.history?.length || 0) >= 2 ||
          (flight.route?.length || 0) >= 2
      ).length,
    }),
    [savedFlights]
  );

  const altitudeText =
    activeFlight?.altitude !== undefined && activeFlight?.altitude !== null
      ? `${Math.round(activeFlight.altitude)} m`
      : "Unknown";

  const speedText =
    activeFlight?.velocity !== undefined && activeFlight?.velocity !== null
      ? `${Math.round(activeFlight.velocity * 3.6)} km/h`
      : "Unknown";

  const routePointCount =
    (activeFlight?.actualTrack?.length || 0) ||
    (activeFlight?.route?.length || 0) ||
    (activeFlight?.history?.length || 0);

  return (
    <Card className="h-[390px]">
      <SectionLabel number="7" title="Flight Intelligence" />

      <div className="grid h-full grid-cols-[minmax(0,1fr)_230px] gap-3 p-3 pt-12">
        <div className="flex min-h-0 flex-col gap-2">
          <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-2">
            <input
              value={flightSearch}
              onChange={(event) => setFlightSearch(event.target.value)}
              className="rounded-md border border-cyan-500/20 bg-[#07111F] px-2 py-2 text-[10px] text-slate-300 outline-none placeholder:text-slate-500 focus:border-cyan-400"
              placeholder="Search aircraft, callsign, country..."
            />

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as "All" | NonNullable<Flight["status"]>)
              }
              className="rounded-md border border-cyan-500/20 bg-[#07111F] px-2 py-2 text-[10px] text-slate-300 outline-none"
            >
              <option value="All">All Status</option>
              <option value="En Route">En Route</option>
              <option value="Landed">Landed</option>
              <option value="Delayed">Delayed</option>
              <option value="Holding">Holding</option>
              <option value="Unknown">Unknown</option>
            </select>
          </div>

          <div className="rounded-md border border-cyan-500/20 bg-black/20 p-2 text-[10px] text-slate-400">
            <span className="font-semibold text-cyan-300">{flightFeedStatus.status}</span>
            <span> • {flightFeedStatus.message}</span>
            <div className="mt-1 text-[9px] text-slate-500">
              Source: {flightFeedStatus.source} • Updated: {flightFeedStatus.updatedAt}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 text-[10px]">
            <div className="rounded-md border border-cyan-500/15 bg-[#081625] p-2">
              <p className="text-slate-500">Tracked</p>
              <p className="font-bold text-cyan-300">{summary.total}</p>
            </div>
            <div className="rounded-md border border-cyan-500/15 bg-[#081625] p-2">
              <p className="text-slate-500">En Route</p>
              <p className="font-bold text-green-300">{summary.enRoute}</p>
            </div>
            <div className="rounded-md border border-cyan-500/15 bg-[#081625] p-2">
              <p className="text-slate-500">Landed</p>
              <p className="font-bold text-yellow-300">{summary.landed}</p>
            </div>
            <div className="rounded-md border border-cyan-500/15 bg-[#081625] p-2">
              <p className="text-slate-500">Routes</p>
              <p className="font-bold text-cyan-200">{summary.routeReady}</p>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {filteredFlights.length > 0 ? (
              filteredFlights.map((flight) => (
                <button
                  key={flight.icao24}
                  onClick={() => setSelectedFlight(flight)}
                  className={cn(
                    "w-full rounded-lg border p-3 text-left transition",
                    activeFlight?.icao24 === flight.icao24
                      ? "border-cyan-300 bg-cyan-400/10"
                      : "border-cyan-500/15 bg-[#081625] hover:border-cyan-400/40"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-white">
                        ✈ {flight.callsign || flight.icao24}
                      </p>
                      <p className="mt-1 text-[10px] text-slate-400">
                        {flight.originCountry || "Unknown country"} • {flight.source || "Unknown source"}
                      </p>
                    </div>

                    <StatusBadge status={flight.onGround ? "Info" : "Active"} />
                  </div>

                  <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] text-slate-400">
                    <span>
                      {flight.altitude !== undefined && flight.altitude !== null
                        ? `${Math.round(flight.altitude)}m`
                        : "Alt N/A"}
                    </span>
                    <span>
                      {flight.velocity !== undefined && flight.velocity !== null
                        ? `${Math.round(flight.velocity * 3.6)}km/h`
                        : "Speed N/A"}
                    </span>
                    <span>{flight.status || "Unknown"}</span>
                  </div>
                </button>
              ))
            ) : (
              <div className="rounded-lg border border-cyan-500/20 bg-[#081625] p-4 text-center text-xs text-slate-400">
                No aircraft match your filters. Run the flight collector or insert demo data if this list is empty.
              </div>
            )}
          </div>
        </div>

        <div className="flex min-h-0 flex-col rounded-lg border border-cyan-500/20 bg-[#07111F] p-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-300">
            Selected Aircraft
          </p>

          {activeFlight ? (
            <>
              <h3 className="mt-3 text-sm font-bold text-white">
                {activeFlight.callsign || activeFlight.icao24}
              </h3>
              <p className="mt-1 text-[11px] text-slate-400">
                {activeFlight.source || activeFlight.originCountry || "Flight feed"}
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                <div className="rounded-md border border-cyan-500/15 bg-black/20 p-2">
                  <p className="text-slate-500">ICAO24</p>
                  <p className="truncate font-bold text-cyan-200">{activeFlight.icao24}</p>
                </div>
                <div className="rounded-md border border-cyan-500/15 bg-black/20 p-2">
                  <p className="text-slate-500">Route Points</p>
                  <p className="font-bold text-cyan-200">{routePointCount}</p>
                </div>
              </div>

              <div className="mt-4 space-y-3 text-[11px]">
                <div>
                  <p className="text-slate-500">Takeoff</p>
                  <p className="font-bold text-white">
                    {activeFlight.origin || "Unknown from current source"}
                  </p>
                </div>

                <div>
                  <p className="text-slate-500">Destination</p>
                  <p className="font-bold text-white">
                    {activeFlight.destination || "Unknown from current source"}
                  </p>
                </div>

                <div>
                  <p className="text-slate-500">Escales / Stopovers</p>
                  <p className="font-bold text-white">
                    {activeFlight.stopovers?.length
                      ? activeFlight.stopovers.join(" → ")
                      : "None shown / unavailable"}
                  </p>
                </div>

                <div>
                  <p className="text-slate-500">Route Data</p>
                  <p
                    className={cn(
                      "font-bold",
                      activeFlight.routeQuality === "Unavailable" || routePointCount < 2
                        ? "text-yellow-300"
                        : "text-cyan-300"
                    )}
                  >
                    {routePointCount >= 2
                      ? `Playback-ready route available (${routePointCount} point(s))`
                      : "Position only — route/history needs better provider or collector history"}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-slate-500">Altitude</p>
                    <p className="text-white">{altitudeText}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Speed</p>
                    <p className="text-white">{speedText}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-slate-500">Heading</p>
                    <p className="text-white">
                      {activeFlight.heading !== undefined && activeFlight.heading !== null
                        ? `${Math.round(activeFlight.heading)}°`
                        : "Unknown"}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">ETA</p>
                    <p className="text-white">{activeFlight.eta || "Unknown"}</p>
                  </div>
                </div>
              </div>

              {activeFlight.history?.length ? (
                <div className="mt-3 min-h-0 flex-1 space-y-1 overflow-y-auto rounded-md border border-cyan-500/20 bg-black/20 p-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-300">
                    Flight Timeline
                  </p>
                  {activeFlight.history.map((event, index) => (
                    <button
                      key={`${event.time}-${event.event}-${index}`}
                      onClick={() => setSelectedFlight({ ...activeFlight })}
                      className="w-full rounded border border-cyan-500/10 bg-[#081625] p-1 text-left hover:border-cyan-400/40"
                    >
                      <p className="text-[9px] text-cyan-300">
                        {index + 1}. {event.time} — {event.event}
                      </p>
                      <p className="text-[9px] text-slate-400">{event.location}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mt-3 rounded-md border border-cyan-500/20 bg-black/20 p-2 text-[10px] text-slate-400">
                  Flight timeline is not available yet. It will populate from stored aircraft positions once the collector has repeated points.
                </div>
              )}

              <button
                onClick={() => setSelectedFlight({ ...activeFlight })}
                className="mt-3 w-full rounded-md border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-[10px] font-semibold text-cyan-200 hover:bg-cyan-400/20"
              >
                Focus Aircraft on Map
              </button>
            </>
          ) : (
            <p className="mt-3 text-xs text-slate-400">
              No aircraft selected yet. Saved aircraft will appear after the flight collector stores data.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}


function ShipsMaritimePanel({
  shipsData,
  selectedShip,
  setSelectedShip,
  shipFeedStatus,
}: {
  shipsData: Ship[];
  selectedShip: Ship | null;
  setSelectedShip: (ship: Ship) => void;
  shipFeedStatus: ShipFeedStatus;
}) {
  const [shipSearch, setShipSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | Ship["status"]>("All");
  const [typeFilter, setTypeFilter] = useState<"All" | Ship["type"]>("All");
  const [showMaritimeReport, setShowMaritimeReport] = useState(false);

  const filteredShips = useMemo(() => {
    const query = shipSearch.trim().toLowerCase();

    return shipsData.filter((ship) => {
      const searchableText = `${ship.name} ${ship.location} ${ship.destination} ${ship.type} ${ship.status} ${ship.mmsi || ""} ${ship.imo || ""}`.toLowerCase();

      const matchesSearch = !query || searchableText.includes(query);
      const matchesStatus = statusFilter === "All" || ship.status === statusFilter;
      const matchesType = typeFilter === "All" || ship.type === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [shipSearch, statusFilter, typeFilter, shipsData]);

  const activeShip = selectedShip || filteredShips[0] || shipsData[0] || null;

  const summary = useMemo(
    () => ({
      total: shipsData.length,
      underway: shipsData.filter((ship) => ship.status === "Underway").length,
      anchored: shipsData.filter((ship) => ship.status === "Anchored").length,
      deviating: shipsData.filter((ship) => ship.status === "Deviating").length,
      docked: shipsData.filter((ship) => ship.status === "Docked").length,
      unknown: shipsData.filter((ship) => ship.status === "Unknown").length,
    }),
    [shipsData]
  );

  const maritimeReport = useMemo(() => {
    if (!activeShip) {
      return [
        "ATLAS MARITIME SITUATION REPORT",
        "",
        `Generated: ${new Date().toLocaleString()}`,
        `AIS Source: ${shipFeedStatus.source}`,
        `AIS Status: ${shipFeedStatus.status}`,
        `Updated: ${shipFeedStatus.updatedAt}`,
        "",
        "No selected vessel available.",
      ].join("\n");
    }

    const historyLines = activeShip.history?.length
      ? activeShip.history.map(
          (event, index) =>
            `${index + 1}. ${event.time} — ${event.event} — ${event.location} — ${event.note}`
        )
      : ["No historical voyage events available from the current AIS/demo feed."];

    return [
      "ATLAS MARITIME SITUATION REPORT",
      "",
      `Generated: ${new Date().toLocaleString()}`,
      `AIS Source: ${shipFeedStatus.source}`,
      `AIS Status: ${shipFeedStatus.status}`,
      `Updated: ${shipFeedStatus.updatedAt}`,
      "",
      "Fleet Summary",
      `Total vessels tracked: ${summary.total}`,
      `Underway: ${summary.underway}`,
      `Anchored: ${summary.anchored}`,
      `Docked: ${summary.docked}`,
      `Unknown status: ${summary.unknown}`,
      `Deviating / under watch: ${summary.deviating}`,
      "",
      "Selected Vessel",
      `Name: ${activeShip.name}`,
      `MMSI: ${activeShip.mmsi || "Unknown"}`,
      `IMO: ${activeShip.imo || "Unknown"}`,
      `Type: ${activeShip.type}`,
      `Location: ${activeShip.location}`,
      `Status: ${activeShip.status}`,
      `Speed: ${activeShip.speed}`,
      `Heading: ${activeShip.heading}`,
      `Destination: ${activeShip.destination}`,
      `ETA: ${activeShip.eta}`,
      `Source: ${activeShip.source || shipFeedStatus.source}`,
      `Last AIS Update: ${activeShip.updatedAt || shipFeedStatus.updatedAt}`,
      "",
      "Voyage History",
      ...historyLines,
      "",
      "Route / Risk Notes",
      activeShip.status === "Deviating"
        ? `Deviation zone active: ${activeShip.deviationRadiusKm || 8} km radius.`
        : "No deviation zone active.",
      activeShip.expectedRoute?.length
        ? "Expected route available for comparison."
        : "Expected route unavailable from current AIS feed.",
      "",
      "Recommended Action",
      activeShip.status === "Deviating"
        ? "Continue monitoring vessel movement and verify route variance against destination and heading."
        : "Continue standard maritime monitoring.",
    ].join("\n");
  }, [activeShip, shipFeedStatus, summary]);

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(maritimeReport);
    } catch (error) {
      console.error("Could not copy maritime report", error);
    }
  };

  return (
    <>
      <Card className="h-[390px]">
        <SectionLabel number="6" title="Ships / Maritime" />

        <div className="grid h-full grid-cols-[minmax(0,1fr)_230px] gap-3 p-3 pt-12">
          <div className="flex min-h-0 flex-col gap-2">
            <div className="grid grid-cols-[minmax(0,1fr)_110px_110px] gap-2">
              <input
                value={shipSearch}
                onChange={(event) => setShipSearch(event.target.value)}
                className="rounded-md border border-cyan-500/20 bg-[#07111F] px-2 py-2 text-[10px] text-slate-300 outline-none placeholder:text-slate-500 focus:border-cyan-400"
                placeholder="Search vessel..."
              />

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as "All" | Ship["status"])
                }
                className="rounded-md border border-cyan-500/20 bg-[#07111F] px-2 py-2 text-[10px] text-slate-300 outline-none"
              >
                <option value="All">All</option>
                <option value="Underway">Underway</option>
                <option value="Anchored">Anchored</option>
                <option value="Deviating">Deviating</option>
                <option value="Docked">Docked</option>
                <option value="Unknown">Unknown</option>
              </select>

              <select
                value={typeFilter}
                onChange={(event) =>
                  setTypeFilter(event.target.value as "All" | Ship["type"])
                }
                className="rounded-md border border-cyan-500/20 bg-[#07111F] px-2 py-2 text-[10px] text-slate-300 outline-none"
              >
                <option value="All">All Types</option>
                <option value="Cargo">Cargo</option>
                <option value="Tanker">Tanker</option>
                <option value="Fishing">Fishing</option>
                <option value="Passenger">Passenger</option>
                <option value="Patrol">Patrol</option>
                <option value="Unknown">Unknown</option>
              </select>
            </div>

            <div className="rounded-md border border-cyan-500/20 bg-black/20 p-2 text-[10px] text-slate-400">
              <span className="font-semibold text-cyan-300">{shipFeedStatus.status}</span>
              <span> • {shipFeedStatus.message}</span>
              <div className="mt-1 text-[9px] text-slate-500">
                Source: {shipFeedStatus.source} • Updated: {shipFeedStatus.updatedAt}
              </div>
            </div>

            <div className="grid grid-cols-5 gap-2 text-[10px]">
              <div className="rounded-md border border-cyan-500/15 bg-[#081625] p-2">
                <p className="text-slate-500">Tracked</p>
                <p className="font-bold text-cyan-300">{summary.total}</p>
              </div>
              <div className="rounded-md border border-cyan-500/15 bg-[#081625] p-2">
                <p className="text-slate-500">Underway</p>
                <p className="font-bold text-green-300">{summary.underway}</p>
              </div>
              <div className="rounded-md border border-cyan-500/15 bg-[#081625] p-2">
                <p className="text-slate-500">Anchored</p>
                <p className="font-bold text-yellow-300">{summary.anchored}</p>
              </div>
              <div className="rounded-md border border-cyan-500/15 bg-[#081625] p-2">
                <p className="text-slate-500">Watch</p>
                <p className="font-bold text-red-300">{summary.deviating}</p>
              </div>
              <div className="rounded-md border border-cyan-500/15 bg-[#081625] p-2">
                <p className="text-slate-500">Unknown</p>
                <p className="font-bold text-slate-300">{summary.unknown}</p>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {filteredShips.length > 0 ? (
                filteredShips.map((ship) => (
                  <button
                    key={ship.id}
                    onClick={() => setSelectedShip(ship)}
                    className={cn(
                      "w-full rounded-lg border p-3 text-left transition",
                      activeShip?.id === ship.id
                        ? "border-cyan-300 bg-cyan-400/10"
                        : ship.status === "Deviating"
                        ? "border-red-400/30 bg-red-500/10 hover:border-red-300"
                        : "border-cyan-500/15 bg-[#081625] hover:border-cyan-400/40"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold text-white">🚢 {ship.name}</p>
                        <p className="mt-1 text-[10px] text-slate-400">{ship.location}</p>
                      </div>

                      <StatusBadge
                        status={ship.status === "Deviating" ? "Warning" : "Info"}
                      />
                    </div>

                    <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] text-slate-400">
                      <span>{ship.type}</span>
                      <span>{ship.speed}</span>
                      <span>{ship.heading}</span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="rounded-lg border border-cyan-500/20 bg-[#081625] p-4 text-center text-xs text-slate-400">
                  No vessels match your filters.
                </div>
              )}
            </div>
          </div>

          <div className="flex min-h-0 flex-col rounded-lg border border-cyan-500/20 bg-[#07111F] p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-300">
              Selected Vessel
            </p>

            {activeShip ? (
              <>
                <h3 className="mt-3 text-sm font-bold text-white">{activeShip.name}</h3>
                <p className="mt-1 text-[11px] text-slate-400">{activeShip.location}</p>

                <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                  <div className="rounded-md border border-cyan-500/15 bg-black/20 p-2">
                    <p className="text-slate-500">MMSI</p>
                    <p className="truncate font-bold text-cyan-200">{activeShip.mmsi || "Unknown"}</p>
                  </div>
                  <div className="rounded-md border border-cyan-500/15 bg-black/20 p-2">
                    <p className="text-slate-500">Source</p>
                    <p className="truncate font-bold text-cyan-200">{activeShip.source || shipFeedStatus.source}</p>
                  </div>
                </div>

                <div className="mt-4 space-y-3 text-[11px]">
                  <div>
                    <p className="text-slate-500">Status</p>
                    <p
                      className={cn(
                        "font-bold",
                        activeShip.status === "Deviating"
                          ? "text-red-300"
                          : "text-cyan-300"
                      )}
                    >
                      {activeShip.status}
                    </p>
                  </div>

                  <div>
                    <p className="text-slate-500">Destination</p>
                    <p className="text-white">{activeShip.destination}</p>
                  </div>

                  <div>
                    <p className="text-slate-500">Route Display</p>
                    <p className="text-white">
                      {activeShip.status === "Deviating"
                        ? "Actual route + expected route + watch zone"
                        : activeShip.route?.length
                        ? `Actual route active • ${activeShip.route.length} point(s)`
                        : "Route unavailable from live AIS feed"}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-slate-500">Speed</p>
                      <p className="text-white">{activeShip.speed}</p>
                    </div>

                    <div>
                      <p className="text-slate-500">ETA</p>
                      <p className="text-white">{activeShip.eta}</p>
                    </div>
                  </div>
                </div>

                {activeShip.history?.length ? (
                  <div className="mt-3 min-h-0 flex-1 space-y-1 overflow-y-auto rounded-md border border-cyan-500/20 bg-black/20 p-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-300">
                      Voyage Timeline
                    </p>
                    {activeShip.history.map((event, index) => (
                      <button
                        key={`${event.time}-${event.event}-${index}`}
                        onClick={() =>
                          setSelectedShip({
                            ...activeShip,
                            lng: event.lng,
                            lat: event.lat,
                            location: event.location,
                          })
                        }
                        className="w-full rounded border border-cyan-500/10 bg-[#081625] p-1 text-left hover:border-cyan-400/40"
                      >
                        <p className="text-[9px] text-cyan-300">
                          {index + 1}. {event.time} — {event.event}
                        </p>
                        <p className="text-[9px] text-slate-400">{event.location}</p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 rounded-md border border-cyan-500/20 bg-black/20 p-2 text-[10px] text-slate-400">
                    Voyage timeline not available from the current live AIS feed.
                  </div>
                )}

                <button
                  onClick={() => setSelectedShip({ ...activeShip })}
                  className="mt-3 w-full rounded-md border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-[10px] font-semibold text-cyan-200 hover:bg-cyan-400/20"
                >
                  Focus Vessel on Map
                </button>

                <button
                  onClick={() => setShowMaritimeReport(true)}
                  className="mt-2 w-full rounded-md bg-cyan-500 px-3 py-2 text-[10px] font-bold text-black hover:bg-cyan-400"
                >
                  Generate Maritime Report
                </button>

                <div className="mt-3 rounded-md border border-yellow-400/20 bg-yellow-400/10 p-2 text-[10px] text-yellow-100">
                  Maritime watch: {summary.deviating} vessel requires attention.
                  {activeShip.status === "Deviating" && (
                    <span className="mt-1 block text-red-200">
                      Deviation zone: {activeShip.deviationRadiusKm || 8} km radius active.
                    </span>
                  )}
                </div>
              </>
            ) : (
              <p className="mt-3 text-xs text-slate-400">No vessel selected.</p>
            )}
          </div>
        </div>
      </Card>

      {showMaritimeReport && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-xl border border-cyan-500/30 bg-[#06111D] p-5 shadow-[0_0_40px_rgba(0,200,255,0.18)]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-300">
                  Maritime Report
                </p>
                <h2 className="mt-1 text-xl font-bold text-white">
                  {activeShip?.name || "Fleet Summary"}
                </h2>
              </div>

              <button
                onClick={() => setShowMaritimeReport(false)}
                className="rounded-md border border-cyan-500/30 px-3 py-2 text-xs text-cyan-200 hover:bg-cyan-400/10"
              >
                Close
              </button>
            </div>

            <pre className="max-h-[420px] overflow-y-auto whitespace-pre-wrap rounded-lg border border-cyan-500/20 bg-black/30 p-4 text-xs leading-6 text-slate-200">
              {maritimeReport}
            </pre>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={copyReport}
                className="rounded-md border border-cyan-500/30 px-4 py-2 text-xs text-cyan-200 hover:bg-cyan-400/10"
              >
                Copy Report
              </button>

              <button
                onClick={() => setShowMaritimeReport(false)}
                className="rounded-md bg-cyan-500 px-4 py-2 text-xs font-bold text-black hover:bg-cyan-400"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SettingsAdmin() {
  return (
    <Card className="h-[290px]">
      <SectionLabel number="7" title="Settings / Admin" />

      <div className="grid h-full grid-cols-[150px_1fr] pt-10">
        <div className="border-r border-cyan-500/20 p-3">
          {[
            "Users",
            "Roles",
            "Integrations",
            "Camera Sources",
            "API Keys",
            "Security",
            "Audit Logs",
            "System Settings",
          ].map((item, index) => (
            <button
              key={item}
              className={cn(
                "mb-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[11px]",
                index === 0
                  ? "bg-cyan-400/10 text-cyan-300"
                  : "text-slate-400 hover:bg-cyan-400/5"
              )}
            >
              <span>☷</span>
              {item}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto p-3">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-bold text-white">Users</h3>
            <button className="rounded-md bg-cyan-500 px-3 py-2 text-xs font-bold text-black">
              + Add User
            </button>
          </div>

          <table className="w-full min-w-[470px] text-left text-[11px]">
            <thead className="text-slate-400">
              <tr>
                <th className="py-2">Name</th>
                <th className="py-2">Role</th>
                <th className="py-2">Status</th>
                <th className="py-2">Last Login</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.name} className="border-t border-cyan-500/10">
                  <td className="py-2 text-white">{user.name}</td>
                  <td className="py-2 text-slate-400">{user.role}</td>
                  <td className="py-2">
                    <StatusBadge status={user.status} />
                  </td>
                  <td className="py-2 text-slate-400">{user.lastLogin}</td>
                  <td className="py-2 text-slate-500">⋮</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-3 flex items-center justify-between text-[10px] text-slate-500">
            <span>Showing 1 to 5 of 25 users</span>
            <span>‹ 1 2 3 4 5 ›</span>
          </div>
        </div>
      </div>
    </Card>
  );
}


function CollectorHealthPanel({
  shipFeedStatus,
  flightFeedStatus,
  shipCount,
  flightCount,
}: {
  shipFeedStatus: ShipFeedStatus;
  flightFeedStatus: FlightFeedStatus;
  shipCount: number;
  flightCount: number;
}) {
  const collectorRows = [
    {
      name: "Ship Collector",
      icon: "🚢",
      source: shipFeedStatus.source,
      status: shipFeedStatus.status,
      updatedAt: shipFeedStatus.updatedAt,
      message: shipFeedStatus.message,
      records: shipCount,
      warning:
        shipFeedStatus.status === "No Vessels" ||
        shipFeedStatus.status === "Error" ||
        shipCount === 0,
    },
    {
      name: "Flight Collector",
      icon: "✈️",
      source: flightFeedStatus.source,
      status: flightFeedStatus.status,
      updatedAt: flightFeedStatus.updatedAt,
      message: flightFeedStatus.message,
      records: flightCount,
      warning:
        flightFeedStatus.status === "No Aircraft" ||
        flightFeedStatus.status === "Error" ||
        flightCount === 0,
    },
  ];

  return (
    <Card className="h-[230px]">
      <div className="flex h-full flex-col p-3">
        <div className="mb-3 flex items-center justify-between border-b border-cyan-500/15 pb-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-white">
              Collector Health
            </p>
            <p className="mt-1 text-[10px] text-slate-500">
              Supabase cache + provider status
            </p>
          </div>

          <div className="rounded-md border border-cyan-500/20 bg-[#07111F] px-3 py-1.5 text-[10px] text-cyan-300">
            Storage Active
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-2 gap-3">
          {collectorRows.map((row) => (
            <div
              key={row.name}
              className={cn(
                "grid min-w-0 grid-cols-[minmax(0,1fr)_120px] gap-3 rounded-lg border p-3",
                row.warning
                  ? "border-yellow-400/25 bg-yellow-500/10"
                  : "border-cyan-500/20 bg-[#07111F]"
              )}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-base">{row.icon}</span>
                  <p className="truncate text-xs font-bold text-white">{row.name}</p>
                  <span
                    className={cn(
                      "rounded-md border px-2 py-0.5 text-[9px] font-semibold",
                      row.status === "Live"
                        ? "border-green-400/40 bg-green-500/15 text-green-300"
                        : row.status === "Error"
                        ? "border-red-400/40 bg-red-500/15 text-red-300"
                        : "border-yellow-400/40 bg-yellow-500/15 text-yellow-300"
                    )}
                  >
                    {row.status}
                  </span>
                </div>

                <p className="mt-2 truncate text-[10px] text-cyan-300">
                  {row.source}
                </p>

                <p className="mt-2 line-clamp-2 text-[10px] leading-4 text-slate-300">
                  {row.message}
                </p>

                {row.warning && (
                  <p className="mt-2 line-clamp-1 text-[10px] text-yellow-200">
                    Provider warning: low/no live data. Saved/demo data remains usable.
                  </p>
                )}
              </div>

              <div className="grid grid-rows-2 gap-2 text-[10px]">
                <div className="rounded-md border border-cyan-500/15 bg-black/20 p-2">
                  <p className="text-slate-500">Saved Records</p>
                  <p className="mt-1 text-sm font-bold text-cyan-300">{row.records}</p>
                </div>
                <div className="rounded-md border border-cyan-500/15 bg-black/20 p-2">
                  <p className="text-slate-500">Last Update</p>
                  <p className="mt-1 truncate font-bold text-white">{row.updatedAt}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}


function FeatureStrip() {
  const features = [
    ["◎", "Real-Time Monitoring", "Live tracking of cameras, traffic, ships, flights & weather."],
    ["◌", "AI Powered Insights", "AI summarizes data and provides actionable intelligence."],
    ["▣", "Secure & Scalable", "Role-based access, audit logs & enterprise-grade security."],
    ["▤", "Customizable Dashboards", "Build your own dashboards and reports."],
    ["⚙", "Integrations", "Connect with cameras, APIs, sensors & third-party systems."],
  ];

  return (
    <Card className="h-[95px]">
      <div className="grid h-full grid-cols-5">
        {features.map(([icon, title, desc], index) => (
          <div
            key={title}
            className={cn(
              "flex items-center gap-4 px-6",
              index !== 0 && "border-l border-cyan-500/20"
            )}
          >
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-cyan-400/50 bg-cyan-400/10 text-2xl text-cyan-300 shadow-[0_0_22px_rgba(0,200,255,0.22)]">
              {icon}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-white">{title}</p>
              <p className="mt-1 text-[11px] leading-4 text-slate-400">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function Home() {
  const [selectedCamera, setSelectedCamera] = useState<Camera>(cameras[0]);
  const [liveFlightCount, setLiveFlightCount] = useState(0);
  const [selectedFlight, setSelectedFlight] = useState<Flight | null>(null);
  const [flightFeedStatus, setFlightFeedStatus] = useState<FlightFeedStatus>({
    source: "Not loaded",
    updatedAt: "Not loaded",
    status: "Idle",
    message: "Flight feed has not loaded yet.",
  });
  const [savedFlights, setSavedFlights] = useState<Flight[]>([]);
  const [selectedShip, setSelectedShip] = useState<Ship | null>(ships[0]);
  const [liveShips, setLiveShips] = useState<Ship[]>([]);
  const [shipFeedStatus, setShipFeedStatus] = useState<ShipFeedStatus>({
    source: "Demo maritime data",
    updatedAt: "Not loaded",
    status: "Idle",
    message: "Live AIS feed has not loaded yet.",
  });

  const [layers, setLayers] = useState<LayersState>({
    cameras: true,
    traffic: true,
    ships: true,
    flights: true,
    weather: true,
    ports: true,
    alerts: true,
  });

  const shipsForDisplay = liveShips.length > 0 ? liveShips : ships;

  const runtimeMaritimeAlerts: Alert[] = shipsForDisplay
    .filter((ship) => ship.status === "Deviating")
    .map((ship) => ({
      type: "Vessel Deviating",
      icon: "🚢",
      location: ship.location,
      description: `${ship.name} is deviating from the expected route`,
      time: "Live",
      status: "Warning",
    }));

  const runtimeActiveAlerts: Alert[] = [...runtimeMaritimeAlerts, ...alerts];
  const activeAlertsCount = runtimeActiveAlerts.length;

  const toggleLayer = (layer: keyof LayersState) => {
    setLayers((prev) => ({
      ...prev,
      [layer]: !prev[layer],
    }));
  };

  // Load saved Supabase data first so Atlas opens quickly, even before live providers respond.
  useEffect(() => {
    let cancelled = false;

    const formatSavedTime = (value?: string) => {
      if (!value) return "Supabase cache";

      return new Date(value).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    };

    const loadSavedShips = async () => {
      try {
        const response = await fetch("/api/ships/latest?limit=1000&sinceHours=168", {
          cache: "no-store",
        });
        const data = await response.json();

        if (cancelled || !response.ok) return;

        const savedShips: Ship[] = data.ships || [];

        if (savedShips.length > 0) {
          setLiveShips(savedShips);
          setSelectedShip((current) =>
            current && savedShips.some((ship) => ship.id === current.id)
              ? current
              : savedShips[0]
          );
          setShipFeedStatus({
            source: data.source || "Supabase vessel cache",
            updatedAt: formatSavedTime(data.updatedAt),
            status: "Live",
            message: `${savedShips.length} saved vessel(s) loaded from Supabase. Live AIS will update when available.`,
          });
        } else {
          setShipFeedStatus({
            source: data.source || "Supabase vessel cache",
            updatedAt: formatSavedTime(data.updatedAt),
            status: "No Vessels",
            message: "No saved vessels found yet. Demo vessels remain active until collector data is available.",
          });
        }
      } catch {
        if (cancelled) return;

        setShipFeedStatus({
          source: "Supabase vessel cache",
          updatedAt: "Error",
          status: "Error",
          message: "Could not load saved vessels from Supabase.",
        });
      }
    };

    const loadSavedFlights = async () => {
      try {
        const response = await fetch("/api/flights/latest?limit=1000&sinceHours=168", {
          cache: "no-store",
        });
        const data = await response.json();

        if (cancelled || !response.ok) return;

        const flights: Flight[] = (data.flights || []).map((flight: Flight) =>
          buildFlightIntelligence({
            ...flight,
            source: data.source || flight.source || "Supabase aircraft cache",
          })
        );

        setSavedFlights(flights);

        if (flights.length > 0) {
          setLiveFlightCount(flights.length);
          setSelectedFlight((current) =>
            current && flights.some((flight) => flight.icao24 === current.icao24)
              ? current
              : flights[0]
          );
          setFlightFeedStatus({
            source: data.source || "Supabase aircraft cache",
            updatedAt: formatSavedTime(data.updatedAt),
            status: "Live",
            message: `${flights.length} saved aircraft loaded from Supabase. Live providers will update when available.`,
          });
        } else {
          setFlightFeedStatus({
            source: data.source || "Supabase aircraft cache",
            updatedAt: formatSavedTime(data.updatedAt),
            status: "No Aircraft",
            message: "No saved aircraft found yet. Run the flight collector or use demo data while testing.",
          });
        }
      } catch {
        if (cancelled) return;

        setFlightFeedStatus({
          source: "Supabase aircraft cache",
          updatedAt: "Error",
          status: "Error",
          message: "Could not load saved aircraft from Supabase.",
        });
      }
    };

    loadSavedShips();
    loadSavedFlights();

    return () => {
      cancelled = true;
    };
  }, []);

  // Live AIS ships are loaded from the current Mapbox visible bounds inside CommandMap.
  // This keeps Atlas global: pan/zoom anywhere and the Ships layer requests that area.

  const highTrafficCount = useMemo(
    () => cameras.filter((camera) => camera.density === "High").length,
    []
  );

  const maritimeSummary = useMemo(
    () => ({
      total: shipsForDisplay.length,
      deviating: shipsForDisplay.filter((ship) => ship.status === "Deviating").length,
      underway: shipsForDisplay.filter((ship) => ship.status === "Underway").length,
      anchored: shipsForDisplay.filter((ship) => ship.status === "Anchored").length,
    }),
    [shipsForDisplay]
  );

  return (
    <main className="min-h-screen bg-[#020711] text-white">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,200,255,0.12),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(0,87,255,0.08),transparent_35%)]" />

      <div className="relative min-h-screen overflow-x-auto">
        <div className="min-w-[1320px]">
          <aside className="fixed bottom-0 left-0 top-0 z-40 w-[132px] border-r border-cyan-500/20 bg-[#040B14]/95">
            <div className="flex h-16 items-center justify-center border-b border-cyan-500/20 px-2">
              <AtlasLogo />
            </div>

            <nav className="space-y-1 p-2">
              {sidebarItems.map(([icon, item], index) => (
                <button
                  key={item}
                  className={cn(
                    "group relative flex w-full items-center gap-2 rounded-md px-2 py-3 text-left text-[12px]",
                    index === 0
                      ? "border border-cyan-500/20 bg-cyan-400/10 text-cyan-300"
                      : "text-slate-300 hover:bg-cyan-400/5 hover:text-cyan-300"
                  )}
                >
                  <span className="w-5 text-center text-base">{icon}</span>
                  <span>{item}</span>

                  {item === "Alerts" && (
                    <span className="ml-auto rounded-full bg-red-500 px-1.5 text-[9px] text-white">
                      {activeAlertsCount}
                    </span>
                  )}
                </button>
              ))}
            </nav>

            <button className="absolute bottom-5 left-1/2 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full bg-slate-800 text-slate-400">
              «
            </button>
          </aside>

          <header className="fixed left-[132px] right-0 top-0 z-40 h-16 min-w-[1188px] border-b border-cyan-500/20 bg-[#040B14]/95 px-4 backdrop-blur">
            <div className="flex h-full items-center gap-4">
              <div className="relative w-[280px]">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">⌕</span>
                <input
                  className="w-full rounded-md border border-cyan-500/20 bg-[#07111F] py-3 pl-9 pr-3 text-xs outline-none placeholder:text-slate-500 focus:border-cyan-400"
                  placeholder="Search location, camera, vessel, flight..."
                />
              </div>

              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-300">✎</span>
                <input
                  className="w-full rounded-md border border-cyan-400/50 bg-[#07111F] py-3 pl-10 pr-10 text-xs outline-none placeholder:text-slate-500 shadow-[0_0_18px_rgba(0,200,255,0.18)] focus:border-cyan-300"
                  placeholder="Ask anything... e.g. Show me traffic cameras in Port Louis"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-cyan-300">▮▮</span>
              </div>

              <div className="flex items-center gap-4">
                <div className="relative text-lg">
                  🔔
                  <span className="absolute -right-2 -top-2 rounded-full bg-red-500 px-1 text-[9px]">
                    {activeAlertsCount}
                  </span>
                </div>
                <div className="text-lg">▣</div>
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-600 bg-slate-800">
                  👤
                </div>
                <div className="pr-2">
                  <p className="text-xs font-bold text-white">Admin</p>
                  <p className="text-[10px] text-slate-400">Super Admin</p>
                </div>
                <span className="text-slate-400">⌄</span>
              </div>
            </div>
          </header>

          <div className="ml-[132px] pt-16">
            <div className="grid grid-cols-12 gap-3 p-3">
              <div className="col-span-12 grid grid-cols-[minmax(0,1fr)_300px] gap-3">
                <div className="space-y-3">
                  <Card className="h-[690px]">
                <SectionLabel number="1" title="Main Dashboard" />

                <LayersPanel layers={layers} toggleLayer={toggleLayer} />

                <CommandMap
                  setSelectedCamera={setSelectedCamera}
                  shipsData={shipsForDisplay}
                  selectedShip={selectedShip}
                  setSelectedShip={setSelectedShip}
                  selectedFlight={selectedFlight}
                  setSelectedFlight={setSelectedFlight}
                  savedFlights={savedFlights}
                  layers={layers}
                  setLiveShips={setLiveShips}
                  setLiveFlightCount={setLiveFlightCount}
                  flightFeedStatus={flightFeedStatus}
                  setFlightFeedStatus={setFlightFeedStatus}
                  setShipFeedStatus={setShipFeedStatus}
                />

                  </Card>

                  <div className="grid grid-cols-2 gap-3">
                    <WeatherOverviewCard />
                    <FlightFeedStatusCard flightFeedStatus={flightFeedStatus} />
                  </div>
                </div>

              <div className="space-y-3">
                <Card className="h-[330px] p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase text-white">AI Insights</p>
                      <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-[9px] text-cyan-300">
                        BETA
                      </span>
                    </div>
                    <span className="text-slate-400">⌃</span>
                  </div>

                  <p className="text-xs leading-5 text-slate-300">
                    Traffic congestion detected in Port Louis South.
                    <br />
                    <br />
                    <span className="text-cyan-300">{highTrafficCount} cameras</span> show
                    high traffic density.
                    <br />
                    <br />
                    <span className="text-cyan-300">{liveFlightCount} flights</span> visible from {flightFeedStatus.source}.
                    <br />
                    <br />
                    Maritime: <span className="text-cyan-300">{maritimeSummary.total} vessels</span> tracked, <span className="text-yellow-300">{maritimeSummary.deviating} deviating</span>.
                    <br />
                    <br />
                    Weather is clear.
                  </p>

                  <div className="mt-4 space-y-2">
                    <button className="w-full rounded-md border border-cyan-400/30 bg-cyan-400/10 py-2 text-xs text-cyan-300">
                      View Cameras ({highTrafficCount})
                    </button>
                    <button className="w-full rounded-md border border-cyan-400/30 bg-cyan-400/10 py-2 text-xs text-cyan-300">
                      Generate Report
                    </button>
                    <button className="w-full rounded-md border border-cyan-400/30 bg-cyan-400/10 py-2 text-xs text-cyan-300">
                      Share Update
                    </button>
                  </div>
                </Card>

                <Card className="h-[345px] p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-bold uppercase text-white">
                      Live Alerts ({activeAlertsCount})
                    </p>
                    <span className="text-slate-400">⌃</span>
                  </div>

                  <div className="max-h-[245px] space-y-3 overflow-y-auto pr-1">
                    {activeAlerts.slice(0, 5).map((alert) => (
                      <div key={`${alert.type}-${alert.location}`} className="flex gap-2 rounded-md border border-cyan-500/10 bg-[#081625] p-2">
                        <span>{alert.icon}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] text-white">{alert.type}</p>
                          <p className="truncate text-[10px] text-slate-500">{alert.location}</p>
                        </div>
                        <span className="text-[9px] text-slate-500">{alert.time}</span>
                      </div>
                    ))}
                  </div>

                  <button className="mt-4 w-full rounded-md border border-cyan-400/30 bg-cyan-400/10 py-2 text-xs text-cyan-300">
                    View All Alerts
                  </button>
                </Card>
              </div>
              </div>

              <div className="col-span-3">
                <AICommandCenter liveFlightCount={liveFlightCount} shipsData={shipsForDisplay} setSelectedCamera={setSelectedCamera} />
              </div>

              <div className="col-span-3">
                <ShipsMaritimePanel
                  shipsData={shipsForDisplay}
                  selectedShip={selectedShip}
                  setSelectedShip={setSelectedShip}
                  shipFeedStatus={shipFeedStatus}
                />
              </div>

              <div className="col-span-3">
                <FlightIntelligencePanel
                  selectedFlight={selectedFlight}
                  flightFeedStatus={flightFeedStatus}
                  setSelectedFlight={setSelectedFlight}
                  savedFlights={savedFlights}
                />
              </div>

              <div className="col-span-12">
                <CollectorHealthPanel
                  shipFeedStatus={shipFeedStatus}
                  flightFeedStatus={flightFeedStatus}
                  shipCount={shipsForDisplay.length}
                  flightCount={savedFlights.length}
                />
              </div>

              <div className="col-span-12">
                <FeatureStrip />
              </div>

              <div className="col-span-6">
                <CameraManagement selectedCamera={selectedCamera} setSelectedCamera={setSelectedCamera} />
              </div>

              <div className="col-span-6">
                <LiveCameraView camera={selectedCamera} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
