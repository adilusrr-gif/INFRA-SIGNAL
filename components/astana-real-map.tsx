"use client";

import { useEffect, useRef, useState } from "react";
import type { Feature, FeatureCollection, LineString, Point, Polygon } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";
import { astanaFaultSegment, astanaNetworkRoutes } from "@/data/astana-network";

type Locale = "ru" | "kz";
type UtilityFilter = "all" | "electricity" | "water" | "gas";
type MapLevel = "city" | "surface" | "underground" | "sensors" | "risk";
type MapLoadStage = "probe" | "download" | "render";
type MapFailure = "webgl" | "archive" | "render" | null;
type MapTransport = "range" | "memory" | null;
type OverlayKey = "buildings" | "networks" | "flow" | "objects" | "labels";
type OverlayVisibility = Record<OverlayKey, boolean>;

type RealAstanaMapProps = {
  active: boolean;
  selectedAssetId: string;
  onSelectAsset: (assetId: string) => void;
  utilityFilter: UtilityFilter;
  locale?: Locale;
};

const ASTANA_CENTER: [number, number] = [71.447, 51.143];
const ASTANA_BOUNDS = { west: 71.23, south: 51.02, east: 71.68, north: 51.30 } as const;
const FALLBACK_VIEWBOX = { width: 1600, height: 1000 } as const;
const DEFAULT_OVERLAYS: OverlayVisibility = { buildings: true, networks: true, flow: true, objects: true, labels: true };
const ASTANA_VECTOR_SOURCE = "astana-vector";
const ASTANA_FIRST_LABEL_LAYER = "astana-water-label";
const ASTANA_LABEL_LAYER_IDS = ["astana-water-label", "astana-waterway-label", "astana-road-label-major", "astana-road-label-minor", "astana-place-label", "astana-neighbourhood-label", "astana-poi-label", "astana-address-label"] as const;

function astanaNameExpression(locale: Locale) {
  return locale === "kz"
    ? ["coalesce", ["get", "name:kk"], ["get", "name:ru"], ["get", "name"], ["get", "name:en"]]
    : ["coalesce", ["get", "name:ru"], ["get", "name:kk"], ["get", "name"], ["get", "name:en"]];
}

function projectToFallback([lng, lat]: [number, number]): [number, number] {
  return [
    ((lng - ASTANA_BOUNDS.west) / (ASTANA_BOUNDS.east - ASTANA_BOUNDS.west)) * FALLBACK_VIEWBOX.width,
    ((ASTANA_BOUNDS.north - lat) / (ASTANA_BOUNDS.north - ASTANA_BOUNDS.south)) * FALLBACK_VIEWBOX.height,
  ];
}

function fallbackPath(coordinates: [number, number][]) {
  return coordinates.map((coordinate, index) => {
    const [x, y] = projectToFallback(coordinate);
    return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

const mapAssets = [
  { id: "WM-042", utility: "water", label: "Магистральный водопровод №4", state: "critical", coordinates: [71.4924, 51.1218] as [number, number] },
  { id: "EL-016", utility: "electricity", label: "Распределительная подстанция №16", state: "warning", coordinates: [71.4321, 51.1696] as [number, number] },
  { id: "PS-104", utility: "water", label: "Насосная станция №12", state: "warning", coordinates: [71.4048, 51.1814] as [number, number] },
  { id: "VM-207", utility: "water", label: "Камера задвижек №7", state: "normal", coordinates: [71.4451, 51.1572] as [number, number] },
  { id: "GS-009", utility: "gas", label: "Газорегуляторный пункт №9", state: "normal", coordinates: [71.4712, 51.1138] as [number, number] },
  { id: "HS-011", utility: "heat", label: "Тепловой пункт №11", state: "normal", coordinates: [71.4236, 51.1129] as [number, number] },
] as const;

const routes = astanaNetworkRoutes;

const routeCollection: FeatureCollection<LineString> = {
  type: "FeatureCollection",
  features: routes.map((route) => ({
    type: "Feature",
    properties: {
      id: route.id,
      utility: route.utility,
      label: route.label,
      spec: route.spec,
      flow: route.flow,
      state: route.state,
      lengthKm: route.lengthKm,
    },
    geometry: { type: "LineString", coordinates: route.coordinates },
  })),
};

const faultCollection: FeatureCollection<LineString> = {
  type: "FeatureCollection",
  features: [{
    type: "Feature",
    properties: { id: "WM-042-FAULT", utility: "water", label: "Участок утечки · −31%" },
    geometry: { type: "LineString", coordinates: astanaFaultSegment },
  }],
};

function circlePolygon(center: [number, number], radiusKm: number, steps = 72): Feature<Polygon> {
  const [lng, lat] = center;
  const latRadius = radiusKm / 111.32;
  const lngRadius = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  const ring = Array.from({ length: steps + 1 }, (_, index) => {
    const angle = (index / steps) * Math.PI * 2;
    return [lng + Math.cos(angle) * lngRadius, lat + Math.sin(angle) * latRadius];
  });
  return { type: "Feature", properties: { id: "WM-042-impact" }, geometry: { type: "Polygon", coordinates: [ring] } };
}

function pointAlong(coordinates: [number, number][], progress: number): [number, number] {
  const normalized = ((progress % 1) + 1) % 1;
  const segmentLengths = coordinates.slice(1).map((coordinate, index) => {
    const previous = coordinates[index];
    const latitude = (previous[1] + coordinate[1]) / 2;
    const deltaLongitude = (coordinate[0] - previous[0]) * Math.cos((latitude * Math.PI) / 180);
    return Math.hypot(deltaLongitude, coordinate[1] - previous[1]);
  });
  const totalLength = segmentLengths.reduce((sum, length) => sum + length, 0);
  let remaining = normalized * totalLength;
  for (let index = 0; index < segmentLengths.length; index += 1) {
    const length = segmentLengths[index];
    if (remaining <= length || index === segmentLengths.length - 1) {
      const local = length === 0 ? 0 : remaining / length;
      const start = coordinates[index];
      const end = coordinates[index + 1];
      return [start[0] + (end[0] - start[0]) * local, start[1] + (end[1] - start[1]) * local];
    }
    remaining -= length;
  }
  return coordinates[coordinates.length - 1];
}

function haversineDistanceKm(start: [number, number], end: [number, number]) {
  const earthRadiusKm = 6371.0088;
  const latitudeDelta = ((end[1] - start[1]) * Math.PI) / 180;
  const longitudeDelta = ((end[0] - start[0]) * Math.PI) / 180;
  const startLatitude = (start[1] * Math.PI) / 180;
  const endLatitude = (end[1] * Math.PI) / 180;
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function measurementCollection(points: [number, number][]): FeatureCollection<Point | LineString> {
  const features: Array<Feature<Point | LineString>> = points.map((coordinates, index) => ({
    type: "Feature",
    properties: { index: index + 1 },
    geometry: { type: "Point", coordinates },
  }));
  if (points.length === 2) {
    features.unshift({
      type: "Feature",
      properties: { kind: "measurement" },
      geometry: { type: "LineString", coordinates: points },
    });
  }
  return { type: "FeatureCollection", features };
}

export function RealAstanaMap({ active, selectedAssetId, onSelectAsset, utilityFilter, locale = "ru" }: RealAstanaMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const markerRefs = useRef<Array<{ asset: (typeof mapAssets)[number]; marker: import("maplibre-gl").Marker; element: HTMLButtonElement }>>([]);
  const onSelectRef = useRef(onSelectAsset);
  const localeRef = useRef(locale);
  const frameRef = useRef<number | null>(null);
  const isMeasuringRef = useRef(false);
  const measurementPointsRef = useRef<Array<[number, number]>>([]);
  const previousSelectionRef = useRef<string | null>(null);
  const [level, setLevel] = useState<MapLevel>("underground");
  const [mapReady, setMapReady] = useState(false);
  const [mapState, setMapState] = useState<"loading" | "online" | "local">("loading");
  const [mapLoadStage, setMapLoadStage] = useState<MapLoadStage>("probe");
  const [mapFailure, setMapFailure] = useState<MapFailure>(null);
  const [mapTransport, setMapTransport] = useState<MapTransport>(null);
  const [mapTileCount, setMapTileCount] = useState<number | null>(null);
  const [bootRevision, setBootRevision] = useState(0);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [measuredDistanceKm, setMeasuredDistanceKm] = useState<number | null>(null);
  const [overlays, setOverlays] = useState<OverlayVisibility>(DEFAULT_OVERLAYS);
  const [localZoom, setLocalZoom] = useState(1);
  const [viewZoom, setViewZoom] = useState(11.8);
  const [viewBearing, setViewBearing] = useState(-11);
  const [viewPitch, setViewPitch] = useState(54);
  const [viewCenter, setViewCenter] = useState<[number, number]>(ASTANA_CENTER);
  const [visibleBuildingCount, setVisibleBuildingCount] = useState(0);
  const [isThreeD, setIsThreeD] = useState(true);

  useEffect(() => { onSelectRef.current = onSelectAsset; }, [onSelectAsset]);
  useEffect(() => { localeRef.current = locale; }, [locale]);
  useEffect(() => { isMeasuringRef.current = isMeasuring; }, [isMeasuring]);

  useEffect(() => {
    let disposed = false;
    let localMap: import("maplibre-gl").Map | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let resizeFrame: number | null = null;
    let canvasElement: HTMLCanvasElement | null = null;
    let hasRendered = false;
    let archiveReady = false;
    let routePopup: import("maplibre-gl").Popup | null = null;
    let unregisterPmtilesProtocol: (() => void) | null = null;

    const syncMapSize = () => {
      if (disposed || !localMap) return;
      if (resizeFrame !== null) window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(() => {
        resizeFrame = null;
        const container = containerRef.current;
        if (disposed || !localMap || !container || container.clientWidth < 2 || container.clientHeight < 2) return;
        localMap.resize();
        localMap.triggerRepaint();
      });
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) syncMapSize();
    };

    const handleContextLost = (event: Event) => {
      event.preventDefault();
      hasRendered = false;
      setMapReady(false);
      setMapState("local");
      setMapFailure("render");
    };

    const handleContextRestored = () => syncMapSize();

    void (async () => {
      const capabilityProbe = document.createElement("canvas");
      const hasWebGL = Boolean(capabilityProbe.getContext("webgl2") || capabilityProbe.getContext("webgl"));
      if (!hasWebGL) {
        setMapReady(false);
        setMapState("local");
        setMapFailure("webgl");
        return;
      }
      setMapState("loading");
      const [maplibregl, pmtiles, { createAstanaVectorLayers }] = await Promise.all([import("maplibre-gl"), import("pmtiles"), import("@/data/astana-vector-style")]);
      if (disposed || !containerRef.current) return;
      const archiveUrl = new URL("/astana.pmtiles", window.location.href).href;
      let archive = new pmtiles.PMTiles(archiveUrl);
      let protocolSourceUrl = `pmtiles://${archiveUrl}`;
      let header: Awaited<ReturnType<typeof archive.getHeader>>;

      try {
        header = await archive.getHeader();
        setMapTransport("range");
      } catch {
        // Some static hosts and embedded browsers do not return HTTP 206 for
        // byte-range requests. Load the compact city archive once and let
        // PMTiles read byte slices from the local Blob instead.
        const fullArchiveUrl = new URL(archiveUrl);
        fullArchiveUrl.searchParams.set("download", "full");
        setMapLoadStage("download");
        const response = await fetch(fullArchiveUrl, { cache: "default", credentials: "same-origin" });
        if (!response.ok) throw new Error(`Astana PMTiles download failed: ${response.status}`);
        const archiveBlob = await response.blob();
        if (archiveBlob.size < 1_000_000) throw new Error(`Astana PMTiles download is incomplete: ${archiveBlob.size} bytes`);
        const archiveFile = new File([archiveBlob], "astana-local.pmtiles", { type: "application/vnd.pmtiles" });
        archive = new pmtiles.PMTiles(new pmtiles.FileSource(archiveFile));
        protocolSourceUrl = `pmtiles://${archiveFile.name}`;
        header = await archive.getHeader();
        setMapTransport("memory");
      }
      archiveReady = true;
      setMapTileCount(header.numAddressedTiles);
      setMapLoadStage("render");

      const protocol = new pmtiles.Protocol();
      protocol.add(archive);
      maplibregl.addProtocol("pmtiles", protocol.tile);
      unregisterPmtilesProtocol = () => maplibregl.removeProtocol("pmtiles");
      if (disposed || !containerRef.current) return;
      localMap = new maplibregl.Map({
        container: containerRef.current,
        center: ASTANA_CENTER,
        zoom: 11.8,
        pitch: 54,
        bearing: -11,
        minZoom: 9.5,
        maxZoom: 19,
        maxBounds: [[ASTANA_BOUNDS.west, ASTANA_BOUNDS.south], [ASTANA_BOUNDS.east, ASTANA_BOUNDS.north]],
        renderWorldCopies: false,
        refreshExpiredTiles: false,
        fadeDuration: 0,
        maxTileCacheSize: 80,
        crossSourceCollisions: false,
        canvasContextAttributes: { antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: false },
        attributionControl: false,
        cooperativeGestures: false,
        scrollZoom: true,
        dragPan: true,
        dragRotate: true,
        touchZoomRotate: true,
        touchPitch: true,
        doubleClickZoom: true,
        keyboard: true,
        boxZoom: true,
        style: {
          version: 8,
          glyphs: `${window.location.origin}/fonts/{fontstack}/{range}.pbf`,
          sources: {
            [ASTANA_VECTOR_SOURCE]: {
              type: "vector",
              url: protocolSourceUrl,
              attribution: '<a href="https://protomaps.com" target="_blank" rel="noreferrer">Protomaps</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a>',
            },
          },
          layers: createAstanaVectorLayers(localeRef.current),
        },
      });
      mapRef.current = localMap;
      canvasElement = localMap.getCanvas();
      canvasElement.addEventListener("webglcontextlost", handleContextLost);
      canvasElement.addEventListener("webglcontextrestored", handleContextRestored);
      if (containerRef.current) {
        resizeObserver = new ResizeObserver(syncMapSize);
        resizeObserver.observe(containerRef.current);
      }
      window.addEventListener("resize", syncMapSize, { passive: true });
      window.addEventListener("orientationchange", syncMapSize, { passive: true });
      window.visualViewport?.addEventListener("resize", syncMapSize, { passive: true });
      document.addEventListener("fullscreenchange", syncMapSize);
      document.addEventListener("webkitfullscreenchange", syncMapSize);
      document.addEventListener("visibilitychange", handleVisibilityChange);
      localMap.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true, visualizePitch: true }), "bottom-left");
      localMap.addControl(new maplibregl.ScaleControl({ maxWidth: 110, unit: "metric" }), "bottom-left");
      localMap.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a>' }), "bottom-right");
      localMap.scrollZoom.enable();
      localMap.dragPan.enable();
      localMap.dragRotate.enable();
      localMap.touchZoomRotate.enable();
      localMap.touchPitch.enable();
      localMap.doubleClickZoom.enable();
      localMap.keyboard.enable();

      const syncViewState = () => {
        if (!localMap || disposed) return;
        const zoom = localMap.getZoom();
        const center = localMap.getCenter();
        setViewZoom(zoom);
        setViewBearing(localMap.getBearing());
        setViewPitch(localMap.getPitch());
        setViewCenter([center.lng, center.lat]);
        const renderedBuildings = localMap.getLayer("astana-buildings-3d")
          ? localMap.queryRenderedFeatures({ layers: ["astana-buildings-3d"] }).length
          : 0;
        setVisibleBuildingCount(renderedBuildings);
        const markerScale = Math.max(0.72, Math.min(1.16, 0.72 + (zoom - 10) * 0.075));
        markerRefs.current.forEach(({ element }) => {
          element.dataset.zoomDetail = zoom >= 12.8 ? "true" : "false";
          element.style.setProperty("--marker-scale", markerScale.toFixed(2));
        });
      };
      localMap.on("moveend", syncViewState);

      localMap.on("load", () => {
        if (!localMap || disposed) return;
        localMap.addSource("infra-routes", { type: "geojson", data: routeCollection, lineMetrics: true });
        localMap.addSource("flow-particles", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        localMap.addSource("impact-zone", { type: "geojson", data: { type: "FeatureCollection", features: [circlePolygon([71.4924, 51.1218], 0.64)] } });
        localMap.addSource("fault-segment", { type: "geojson", data: faultCollection });
        localMap.addSource("measurement", { type: "geojson", data: measurementCollection([]) });

        const utilityColor = ["match", ["get", "utility"], "electricity", "#ffc659", "water", "#5bc7ff", "gas", "#52dca0", "#7ff4e6"] as never;
        const buildingHeight = ["max", 4, ["coalesce", ["get", "height"], ["match", ["get", "kind_detail"], "commercial", 18, "industrial", 14, "apartments", 24, 11]]] as never;
        localMap.addLayer({
          id: "astana-buildings-3d",
          type: "fill-extrusion",
          source: ASTANA_VECTOR_SOURCE,
          "source-layer": "buildings",
          minzoom: 11.4,
          filter: ["in", "kind", "building", "building_part"],
          paint: {
            "fill-extrusion-color": ["interpolate", ["linear"], buildingHeight, 4, "#102c33", 18, "#1d4d56", 55, "#397d83", 130, "#72b9b3"],
            "fill-extrusion-height": buildingHeight,
            "fill-extrusion-base": ["coalesce", ["get", "min_height"], 0],
            "fill-extrusion-opacity": 0.78,
            "fill-extrusion-vertical-gradient": true,
          },
        }, ASTANA_FIRST_LABEL_LAYER);
        localMap.addLayer({ id: "infra-route-glow", type: "line", source: "infra-routes", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": utilityColor, "line-width": ["interpolate", ["linear"], ["zoom"], 9.5, 4.5, 13, 7.5, 16, 13, 19, 18], "line-opacity": 0.18, "line-blur": ["interpolate", ["linear"], ["zoom"], 10, 2.4, 16, 4.8] } });
        localMap.addLayer({ id: "infra-route-casing", type: "line", source: "infra-routes", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#031116", "line-width": ["interpolate", ["linear"], ["zoom"], 9.5, 3, 13, 5.2, 16, 8.8, 19, 12], "line-opacity": 0.94 } });
        localMap.addLayer({ id: "infra-routes", type: "line", source: "infra-routes", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": utilityColor, "line-width": ["interpolate", ["linear"], ["zoom"], 9.5, 1.45, 13, 2.7, 16, 4.9, 19, 7], "line-opacity": 0.96 } });
        localMap.addLayer({ id: "infra-route-core", type: "line", source: "infra-routes", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#eaffff", "line-width": ["interpolate", ["linear"], ["zoom"], 9.5, 0.18, 14, 0.48, 19, 1.1], "line-opacity": 0.5 } });
        localMap.addLayer({ id: "fault-segment-glow", type: "line", source: "fault-segment", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ff4f61", "line-width": ["interpolate", ["linear"], ["zoom"], 9.5, 7, 14, 13, 19, 22], "line-opacity": 0.3, "line-blur": ["interpolate", ["linear"], ["zoom"], 10, 4, 18, 8] } });
        localMap.addLayer({ id: "fault-segment", type: "line", source: "fault-segment", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ff5c68", "line-width": ["interpolate", ["linear"], ["zoom"], 9.5, 2.2, 14, 4.6, 19, 7.8], "line-opacity": 0.98, "line-dasharray": [1.4, 0.9] } });
        localMap.addLayer({ id: "flow-particles", type: "circle", source: "flow-particles", paint: { "circle-color": utilityColor, "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, ["match", ["get", "utility"], "electricity", 2.7, "water", 2.25, "gas", 2, 2.4], 18, ["match", ["get", "utility"], "electricity", 4.4, "water", 3.7, "gas", 3.2, 3.8]], "circle-stroke-color": "#eaffff", "circle-stroke-width": 0.7, "circle-opacity": 0.96, "circle-blur": 0.04 } });
        localMap.addLayer({ id: "impact-fill", type: "fill", source: "impact-zone", paint: { "fill-color": "#ff5c68", "fill-opacity": 0.14 } });
        localMap.addLayer({ id: "impact-outline", type: "line", source: "impact-zone", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ff7580", "line-width": 2, "line-opacity": 0.86, "line-dasharray": [2, 2] } });
        localMap.addLayer({ id: "measurement-line", type: "line", source: "measurement", filter: ["==", ["geometry-type"], "LineString"], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#efffff", "line-width": 2.2, "line-dasharray": [2, 1.4], "line-opacity": 0.95 } });
        localMap.addLayer({ id: "measurement-points", type: "circle", source: "measurement", filter: ["==", ["geometry-type"], "Point"], paint: { "circle-color": "#07191e", "circle-radius": 5.5, "circle-stroke-color": "#8ffff3", "circle-stroke-width": 2.2, "circle-opacity": 0.96 } });

        localMap.on("mouseenter", "infra-routes", () => { if (localMap && !isMeasuringRef.current) localMap.getCanvas().style.cursor = "pointer"; });
        localMap.on("mouseleave", "infra-routes", () => { if (localMap && !isMeasuringRef.current) localMap.getCanvas().style.cursor = ""; });
        localMap.on("mouseenter", "astana-buildings-3d", () => { if (localMap && !isMeasuringRef.current) localMap.getCanvas().style.cursor = "pointer"; });
        localMap.on("mouseleave", "astana-buildings-3d", () => { if (localMap && !isMeasuringRef.current) localMap.getCanvas().style.cursor = ""; });
        localMap.on("click", "astana-buildings-3d", (event) => {
          if (!localMap || isMeasuringRef.current || localMap.queryRenderedFeatures(event.point, { layers: ["infra-routes"] }).length > 0) return;
          const properties = event.features?.[0]?.properties;
          if (!properties) return;
          const content = document.createElement("div");
          content.className = "real-building-popup";
          const eyebrow = document.createElement("small");
          eyebrow.textContent = localeRef.current === "ru" ? "3D-ОБЪЕКТ · OSM" : "3D-НЫСАН · OSM";
          const heading = document.createElement("b");
          heading.textContent = properties.addr_housenumber
            ? `${localeRef.current === "ru" ? "Здание" : "Ғимарат"} №${properties.addr_housenumber}`
            : (localeRef.current === "ru" ? "Здание без адреса" : "Мекенжайсыз ғимарат");
          const specification = document.createElement("span");
          const height = Number(properties.height ?? 11);
          specification.textContent = `${localeRef.current === "ru" ? "Высота" : "Биіктігі"}: ${Number.isFinite(height) ? Math.round(height) : 11} м · ${properties.kind_detail ?? properties.kind ?? "building"}`;
          const coordinates = document.createElement("em");
          coordinates.textContent = `${event.lngLat.lat.toFixed(5)}° N · ${event.lngLat.lng.toFixed(5)}° E`;
          content.append(eyebrow, heading, specification, coordinates);
          routePopup?.remove();
          routePopup = new maplibregl.Popup({ closeButton: true, closeOnClick: true, offset: 10, maxWidth: "260px" }).setLngLat(event.lngLat).setDOMContent(content).addTo(localMap);
        });
        localMap.on("click", "infra-routes", (event) => {
          if (!localMap || isMeasuringRef.current) return;
          const properties = event.features?.[0]?.properties;
          if (!properties) return;
          const content = document.createElement("div");
          content.className = "real-route-popup";
          const heading = document.createElement("b");
          heading.textContent = `${properties.id} · ${properties.label}`;
          const specification = document.createElement("span");
          specification.textContent = `${properties.spec} · ${properties.lengthKm} км`;
          const flow = document.createElement("small");
          flow.textContent = properties.flow;
          content.append(heading, specification, flow);
          routePopup?.remove();
          routePopup = new maplibregl.Popup({ closeButton: true, closeOnClick: true, offset: 10, maxWidth: "280px" }).setLngLat(event.lngLat).setDOMContent(content).addTo(localMap);
        });
        localMap.on("click", (event) => {
          if (!localMap || !isMeasuringRef.current) return;
          const coordinate: [number, number] = [event.lngLat.lng, event.lngLat.lat];
          const points = measurementPointsRef.current.length >= 2
            ? [coordinate]
            : [...measurementPointsRef.current, coordinate];
          measurementPointsRef.current = points;
          const source = localMap.getSource("measurement") as import("maplibre-gl").GeoJSONSource | undefined;
          source?.setData(measurementCollection(points));
          if (points.length === 2) {
            setMeasuredDistanceKm(haversineDistanceKm(points[0], points[1]));
            setIsMeasuring(false);
            isMeasuringRef.current = false;
            localMap.getCanvas().style.cursor = "";
          }
        });

        markerRefs.current = mapAssets.map((asset) => {
          const element = document.createElement("button");
          element.type = "button";
          element.className = `real-asset-marker state-${asset.state} utility-${asset.utility}`;
          element.setAttribute("aria-label", `${asset.id}: ${asset.label}`);
          const dot = document.createElement("span");
          dot.className = "real-marker-dot";
          dot.textContent = asset.utility === "electricity" ? "ϟ" : asset.utility === "gas" ? "◌" : asset.utility === "water" ? "≈" : "⌁";
          const card = document.createElement("span");
          card.className = "real-marker-card";
          const id = document.createElement("b");
          id.textContent = asset.id;
          const label = document.createElement("small");
          label.textContent = asset.label;
          card.append(id, label);
          element.append(dot, card);
          element.addEventListener("click", (event) => { event.stopPropagation(); onSelectRef.current(asset.id); });
          const marker = new maplibregl.Marker({ element, anchor: "center" }).setLngLat(asset.coordinates).addTo(localMap!);
          return { asset, marker, element };
        });

        const renderParticles = (time: number) => {
          if (!localMap || disposed) return;
          const seconds = time / 1000;
          const particles: Feature<Point>[] = [];
          routes.forEach((route) => {
            const count = route.utility === "electricity" ? 7 : route.utility === "water" ? 5 : 10;
            const speed = route.utility === "electricity" ? 0.34 : route.utility === "water" ? 0.026 : 0.09;
            for (let index = 0; index < count; index += 1) {
              const progress = seconds * speed + index / count;
              if (route.id === "WT-M04" && progress % 1 > 0.72 && progress % 1 < 0.79 && index % 2 === 0) continue;
              particles.push({ type: "Feature", properties: { utility: route.utility }, geometry: { type: "Point", coordinates: pointAlong(route.coordinates, progress) } });
            }
          });
          const source = localMap.getSource("flow-particles") as import("maplibre-gl").GeoJSONSource | undefined;
          source?.setData({ type: "FeatureCollection", features: particles });
        };
        let lastParticleUpdate = -Infinity;
        const animateParticles = (time: number) => {
          if (!localMap || disposed) return;
          if (!document.hidden && time - lastParticleUpdate >= 66) {
            renderParticles(time);
            lastParticleUpdate = time;
          }
          frameRef.current = window.requestAnimationFrame(animateParticles);
        };
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) renderParticles(0);
        else frameRef.current = window.requestAnimationFrame(animateParticles);
        localMap.once("render", () => {
          if (disposed) return;
          hasRendered = true;
          setMapReady(true);
          setMapState("online");
          setMapFailure(null);
        });
        syncMapSize();
        syncViewState();
      });
      localMap.on("error", () => {
        if (!hasRendered) {
          setMapReady(false);
          setMapState("local");
          setMapFailure("render");
        } else {
          syncMapSize();
        }
      });
    })().catch((error: unknown) => {
      console.warn("WebGL map unavailable; using local Astana basemap.", error);
      setMapReady(false);
      setMapState("local");
      setMapFailure(archiveReady ? "render" : "archive");
    });

    return () => {
      disposed = true;
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      if (resizeFrame !== null) window.cancelAnimationFrame(resizeFrame);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", syncMapSize);
      window.removeEventListener("orientationchange", syncMapSize);
      window.visualViewport?.removeEventListener("resize", syncMapSize);
      document.removeEventListener("fullscreenchange", syncMapSize);
      document.removeEventListener("webkitfullscreenchange", syncMapSize);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      canvasElement?.removeEventListener("webglcontextlost", handleContextLost);
      canvasElement?.removeEventListener("webglcontextrestored", handleContextRestored);
      routePopup?.remove();
      markerRefs.current.forEach(({ marker }) => marker.remove());
      markerRefs.current = [];
      localMap?.remove();
      unregisterPmtilesProtocol?.();
      mapRef.current = null;
    };
  }, [bootRevision]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const utilityFilterExpression = utilityFilter === "all" ? null : ["==", ["get", "utility"], utilityFilter];
    ["infra-route-glow", "infra-route-casing", "infra-routes", "infra-route-core", "flow-particles"].forEach((layerId) => map.setFilter(layerId, utilityFilterExpression as never));
    const showFaultForFilter = utilityFilter === "all" || utilityFilter === "water";
    ["fault-segment-glow", "fault-segment"].forEach((layerId) => map.setLayoutProperty(layerId, "visibility", showFaultForFilter ? "visible" : "none"));
    markerRefs.current.forEach(({ asset, element }) => {
      const visibleByUtility = utilityFilter === "all" || asset.utility === utilityFilter;
      element.dataset.utilityVisible = visibleByUtility ? "true" : "false";
    });
  }, [mapReady, utilityFilter]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const showRoutes = overlays.networks && (level === "surface" || level === "underground" || level === "sensors" || level === "risk");
    const showFlow = overlays.flow && (level === "surface" || level === "underground");
    const showRisk = level === "risk";
    ["infra-route-glow", "infra-route-casing", "infra-routes", "infra-route-core"].forEach((layerId) => map.setLayoutProperty(layerId, "visibility", showRoutes ? "visible" : "none"));
    const showFault = showRoutes && (utilityFilter === "all" || utilityFilter === "water");
    ["fault-segment-glow", "fault-segment"].forEach((layerId) => map.setLayoutProperty(layerId, "visibility", showFault ? "visible" : "none"));
    map.setLayoutProperty("flow-particles", "visibility", showFlow ? "visible" : "none");
    ["impact-fill", "impact-outline"].forEach((layerId) => map.setLayoutProperty(layerId, "visibility", showRisk ? "visible" : "none"));
    map.setLayoutProperty("astana-buildings-3d", "visibility", isThreeD && overlays.buildings ? "visible" : "none");
    map.setPaintProperty("infra-routes", "line-opacity", level === "sensors" ? 0.28 : level === "risk" ? 0.42 : 0.92);
    map.setPaintProperty("astana-buildings-3d", "fill-extrusion-opacity", level === "city" ? 0.78 : level === "surface" ? 0.66 : level === "underground" ? 0.36 : 0.5);
    map.setPaintProperty("background", "background-color", level === "city" ? "#06171c" : "#041217");
    map.setPaintProperty("earth", "fill-color", level === "city" ? "#0a2228" : level === "surface" ? "#081d22" : "#07191e");
    map.setPaintProperty("buildings", "fill-opacity", level === "city" ? 0.64 : level === "surface" ? 0.5 : 0.28);
    markerRefs.current.forEach(({ element }) => {
      element.dataset.levelVisible = level === "city" ? "false" : "true";
      element.dataset.overlayVisible = overlays.objects ? "true" : "false";
    });
  }, [level, mapReady, isThreeD, utilityFilter, overlays]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const pitch = !isThreeD ? 0 : level === "city" ? 54 : level === "surface" ? 46 : level === "underground" ? 58 : 50;
    map.easeTo({ pitch, bearing: isThreeD ? -11 : 0, duration: 650 });
  }, [level, mapReady, isThreeD]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const expression = astanaNameExpression(locale);
    ASTANA_LABEL_LAYER_IDS.forEach((layerId) => {
      if (!map.getLayer(layerId)) return;
      if (layerId !== "astana-address-label") map.setLayoutProperty(layerId, "text-field", expression as never);
      map.setLayoutProperty(layerId, "visibility", overlays.labels ? "visible" : "none");
    });
  }, [locale, mapReady, overlays.labels]);

  useEffect(() => {
    markerRefs.current.forEach(({ asset, element }) => element.classList.toggle("selected", asset.id === selectedAssetId));
  }, [mapReady, selectedAssetId]);

  useEffect(() => {
    const map = mapRef.current;
    const asset = mapAssets.find((candidate) => candidate.id === selectedAssetId);
    if (!map || !mapReady || !asset || previousSelectionRef.current === selectedAssetId) return;
    previousSelectionRef.current = selectedAssetId;
    map.flyTo({ center: asset.coordinates, zoom: Math.max(map.getZoom(), 14.2), pitch: isThreeD ? Math.max(map.getPitch(), 48) : 0, duration: 780, essential: true });
  }, [mapReady, selectedAssetId, isThreeD]);

  const levels: Array<[MapLevel, string, string, string]> = locale === "ru"
    ? [["city", "L0", "Город", "OSM"], ["surface", "+1", "Наземный", "объекты"], ["underground", "−1", "Подземный", "сети"], ["sensors", "S", "Датчики", "SCADA"], ["risk", "R", "Риск", "640 м"]]
    : [["city", "L0", "Қала", "OSM"], ["surface", "+1", "Жер үсті", "нысандар"], ["underground", "−1", "Жер асты", "желілер"], ["sensors", "S", "Датчиктер", "SCADA"], ["risk", "R", "Тәуекел", "640 м"]];
  const overlayOptions: Array<[OverlayKey, string, string]> = locale === "ru"
    ? [["buildings", "▥", "3D"], ["networks", "⌁", "Сети"], ["flow", "→", "Поток"], ["objects", "⌖", "Объекты"], ["labels", "Aa", "Подписи"]]
    : [["buildings", "▥", "3D"], ["networks", "⌁", "Желілер"], ["flow", "→", "Ағын"], ["objects", "⌖", "Нысандар"], ["labels", "Aa", "Атаулар"]];
  const selectedMapAsset = mapAssets.find((asset) => asset.id === selectedAssetId) ?? mapAssets[0];

  const showFallbackAssets = level !== "city";
  const fallbackStatus = mapFailure === "webgl"
    ? (locale === "ru" ? "РЕЗЕРВ · WEBGL НЕДОСТУПЕН" : "РЕЗЕРВ · WEBGL ҚОЛЖЕТІМСІЗ")
    : mapFailure === "archive"
      ? (locale === "ru" ? "РЕЗЕРВ · PMTILES НЕ ЗАГРУЖЕН" : "РЕЗЕРВ · PMTILES ЖҮКТЕЛМЕДІ")
      : mapFailure === "render"
        ? (locale === "ru" ? "РЕЗЕРВ · СБОЙ WEBGL" : "РЕЗЕРВ · WEBGL АҚАУЫ")
        : (locale === "ru" ? "РЕЗЕРВНАЯ КАРТА · LOCAL" : "РЕЗЕРВ КАРТА · LOCAL");
  const loadingStatus = mapLoadStage === "download"
    ? (locale === "ru" ? "ЗАГРУЗКА КАРТЫ · 7,2 MB" : "КАРТА ЖҮКТЕЛУДЕ · 7,2 MB")
    : mapLoadStage === "render"
      ? (locale === "ru" ? "ПОСТРОЕНИЕ ВЕКТОРНЫХ СЛОЁВ" : "ВЕКТОРЛЫҚ ҚАБАТТАР ҚҰРЫЛУДА")
      : (locale === "ru" ? "ПРОВЕРКА WEBGL" : "WEBGL ТЕКСЕРІЛУДЕ");
  const onlineStatus = `LOCAL VECTOR · ${(mapTransport ?? "PMTILES").toUpperCase()} · ${isThreeD ? "3D" : "2D"}`;
  const mapStatusText = mapState === "online" ? onlineStatus : mapState === "loading" ? loadingStatus : fallbackStatus;
  const adjustZoom = (delta: number) => {
    const map = mapRef.current;
    if (map && mapReady) {
      const nextZoom = Math.max(9.5, Math.min(18, map.getZoom() + delta));
      map.easeTo({ zoom: nextZoom, duration: 280 });
      setViewZoom(nextZoom);
      return;
    }
    setLocalZoom((zoom) => Math.max(1, Math.min(2.4, Number((zoom + delta * 0.2).toFixed(1)))));
  };
  const resetView = () => {
    setLocalZoom(1);
    setViewZoom(11.8);
    mapRef.current?.flyTo({ center: ASTANA_CENTER, zoom: 11.8, bearing: isThreeD ? -11 : 0, pitch: isThreeD ? (level === "underground" ? 58 : 50) : 0, duration: 900 });
  };
  const rotateView = (delta: number) => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    map.easeTo({ bearing: map.getBearing() + delta, duration: 420 });
  };
  const focusSelectedAsset = () => {
    const map = mapRef.current;
    if (map && mapReady) {
      map.flyTo({ center: selectedMapAsset.coordinates, zoom: Math.max(map.getZoom(), 15), pitch: isThreeD ? Math.max(map.getPitch(), 50) : 0, duration: 820, essential: true });
      return;
    }
    setLocalZoom(1.45);
  };
  const toggleOverlay = (key: OverlayKey) => {
    setOverlays((current) => ({ ...current, [key]: !current[key] }));
  };
  const startMeasurement = () => {
    const map = mapRef.current;
    measurementPointsRef.current = [];
    setMeasuredDistanceKm(null);
    const source = map?.getSource("measurement") as import("maplibre-gl").GeoJSONSource | undefined;
    source?.setData(measurementCollection([]));
    if (!map || !mapReady) return;
    setIsMeasuring(true);
    isMeasuringRef.current = true;
    map.getCanvas().style.cursor = "crosshair";
  };
  const clearMeasurement = () => {
    const map = mapRef.current;
    measurementPointsRef.current = [];
    setMeasuredDistanceKm(null);
    setIsMeasuring(false);
    isMeasuringRef.current = false;
    const source = map?.getSource("measurement") as import("maplibre-gl").GeoJSONSource | undefined;
    source?.setData(measurementCollection([]));
    if (map) map.getCanvas().style.cursor = "";
  };
  const retryMap = () => {
    setMapReady(false);
    setMapState("loading");
    setMapLoadStage("probe");
    setMapFailure(null);
    setMapTransport(null);
    setMapTileCount(null);
    setIsMeasuring(false);
    setMeasuredDistanceKm(null);
    isMeasuringRef.current = false;
    measurementPointsRef.current = [];
    previousSelectionRef.current = null;
    setBootRevision((revision) => revision + 1);
  };
  const measuredDistanceLabel = measuredDistanceKm === null
    ? null
    : measuredDistanceKm < 1
      ? `${Math.round(measuredDistanceKm * 1000)} м`
      : `${measuredDistanceKm.toFixed(2)} км`;

  return <div className={`real-astana-map level-${level} ${active ? "incident-active" : ""} ${mapReady ? "map-webgl-online" : "map-local-fallback"}`}>
    <div className="real-map-fallback" aria-label={locale === "ru" ? "Резервная локальная карта Астаны" : "Астананың резервтік жергілікті картасы"}>
      <div className="real-map-fallback-world" style={{ transform: isThreeD ? `perspective(1200px) rotateX(10deg) scale(${localZoom * 1.05})` : `scale(${localZoom})` }}>
        {/* A plain image is intentional here: this local fallback must work even when the framework image proxy is unavailable. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/astana-osm.webp" alt="" draggable={false} loading="eager" decoding="sync" fetchPriority="high" />
        <svg className="real-map-fallback-overlay" viewBox={`0 0 ${FALLBACK_VIEWBOX.width} ${FALLBACK_VIEWBOX.height}`} preserveAspectRatio="xMidYMid slice" role="img" aria-label={locale === "ru" ? "Инженерные сети и объекты на карте Астаны" : "Астана картасындағы инженерлік желілер мен нысандар"}>
          <defs>
            <filter id="fallback-route-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="7" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            <radialGradient id="fallback-risk-fill"><stop stopColor="#ff5c68" stopOpacity=".38"/><stop offset=".55" stopColor="#ff5c68" stopOpacity=".13"/><stop offset="1" stopColor="#ff5c68" stopOpacity="0"/></radialGradient>
          </defs>
          {level === "risk" && (() => { const [x, y] = projectToFallback([71.4924, 51.1218]); return <g className="fallback-risk-zone"><circle cx={x} cy={y} r="72" fill="url(#fallback-risk-fill)"/><circle cx={x} cy={y} r="39"/><circle cx={x} cy={y} r="25"/></g>; })()}
          {overlays.networks && (level === "surface" || level === "underground" || level === "sensors" || level === "risk") && routes.filter((route) => utilityFilter === "all" || route.utility === utilityFilter).map((route) => <g key={route.id} className={`fallback-network utility-${route.utility}`}>
            <path className="fallback-route-glow" d={fallbackPath(route.coordinates)} />
            <path className="fallback-route-casing" d={fallbackPath(route.coordinates)} />
            <path className="fallback-route-line" d={fallbackPath(route.coordinates)} />
            {overlays.flow && (level === "surface" || level === "underground") && <path className={`fallback-flow fallback-flow-${route.utility}`} pathLength="100" d={fallbackPath(route.coordinates)} />}
          </g>)}
          {overlays.networks && (utilityFilter === "all" || utilityFilter === "water") && level !== "city" && <><path className="fallback-fault-glow" d={fallbackPath(astanaFaultSegment)} /><path className="fallback-fault-line" d={fallbackPath(astanaFaultSegment)} /></>}
          {overlays.objects && showFallbackAssets && mapAssets.filter((asset) => utilityFilter === "all" || asset.utility === utilityFilter).map((asset) => { const [x, y] = projectToFallback(asset.coordinates); const glyph = asset.utility === "electricity" ? "ϟ" : asset.utility === "gas" ? "◌" : asset.utility === "water" ? "≈" : "⌁"; return <g key={asset.id} role="button" tabIndex={0} aria-label={`${asset.id}: ${asset.label}`} className={`fallback-asset state-${asset.state} utility-${asset.utility} ${selectedAssetId === asset.id ? "selected" : ""}`} transform={`translate(${x} ${y})`} onClick={() => onSelectAsset(asset.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelectAsset(asset.id); } }}>
            <circle className="fallback-asset-halo" r="21"/><circle className="fallback-asset-dot" r="12"/><text className="fallback-asset-glyph" textAnchor="middle" y="4">{glyph}</text><g className="fallback-asset-label" transform="translate(18 -15)"><rect width="118" height="31" rx="7"/><text x="8" y="13">{asset.id}</text><text className="fallback-asset-name" x="8" y="24">{asset.label.slice(0, 24)}</text></g>
          </g>; })}
        </svg>
      </div>
    </div>
    <div ref={containerRef} className="real-map-canvas" aria-label={locale === "ru" ? "Интерактивная карта Астаны OpenStreetMap" : "Астананың интерактивті OpenStreetMap картасы"} />
    <div className={`real-map-status status-${mapState}`}><i /><span>{mapStatusText}</span>{mapState === "local" && <button type="button" onClick={retryMap} aria-label={locale === "ru" ? "Повторно запустить векторную карту" : "Векторлық картаны қайта іске қосу"}>↻</button>}</div>
    {!isMeasuring && !measuredDistanceLabel && <button type="button" className={`real-map-focus-chip state-${selectedMapAsset.state}`} onClick={focusSelectedAsset} aria-label={locale === "ru" ? `Сфокусировать карту на ${selectedMapAsset.id}` : `Картаны ${selectedMapAsset.id} нысанына бағыттау`}><span>⌖</span><p><small>{locale === "ru" ? "В ФОКУСЕ" : "НАЗАРДА"}</small><b>{selectedMapAsset.id}</b></p><em>{selectedMapAsset.label}</em></button>}
    <a className="real-map-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a>
    <div className="real-map-levels" role="group" aria-label={locale === "ru" ? "Уровни карты" : "Карта деңгейлері"}><small>{locale === "ru" ? "УРОВНИ" : "ДЕҢГЕЙЛЕР"}</small>{levels.map(([value, code, label, detail]) => <button type="button" key={value} className={level === value ? "selected" : ""} onClick={() => setLevel(value)} aria-pressed={level === value}><span>{code}</span><p><b>{label}</b><em>{detail}</em></p></button>)}</div>
    <aside className="real-map-adapters"><div><span><i /> ADAPTER HUB</span><b>4/4</b></div><button type="button" onClick={() => setLevel("sensors")}><span>⌁ SCADA</span><b>24 сек</b><i /></button><button type="button" onClick={() => setLevel("risk")}><span>◉ 109</span><b>1 мин</b><i /></button><button type="button" onClick={() => setLevel("risk")}><span>▣ e‑Өтініш</span><b>3 мин</b><i /></button><button type="button" onClick={() => setLevel("surface")}><span>⌖ GIS</span><b>18 мин</b><i /></button><small>{locale === "ru" ? `OSM 22.08.2026 · z9–z15${mapTileCount ? ` · ${mapTileCount.toLocaleString("ru-RU")} тайлов` : ""}${isThreeD && overlays.buildings && visibleBuildingCount ? ` · ${visibleBuildingCount.toLocaleString("ru-RU")} зданий в кадре` : ""}` : `OSM 22.08.2026 · z9–z15${mapTileCount ? ` · ${mapTileCount.toLocaleString("kk-KZ")} тайл` : ""}${isThreeD && overlays.buildings && visibleBuildingCount ? ` · кадрда ${visibleBuildingCount.toLocaleString("kk-KZ")} ғимарат` : ""}`}</small></aside>
    <aside className="real-map-legend" aria-label={locale === "ru" ? "Легенда потоков и слоёв" : "Ағындар мен қабаттар түсіндірмесі"}><small>{locale === "ru" ? "СИГНАТУРЫ ПОТОКА" : "АҒЫН СИГНАТУРАЛАРЫ"}</small><span className="utility-electricity"><i />ϟ <b>{locale === "ru" ? "Электро" : "Электр"}</b><em>{locale === "ru" ? "импульс" : "импульс"}</em></span><span className="utility-water"><i />≈ <b>{locale === "ru" ? "Вода" : "Су"}</b><em>{locale === "ru" ? "медленно" : "баяу"}</em></span><span className="utility-gas"><i />◌ <b>{locale === "ru" ? "Газ" : "Газ"}</b><em>{locale === "ru" ? "непрерывно" : "үздіксіз"}</em></span><div className="real-map-overlay-switches" role="group" aria-label={locale === "ru" ? "Видимость слоёв карты" : "Карта қабаттарының көрінуі"}>{overlayOptions.map(([key, icon, label]) => <button type="button" key={key} className={overlays[key] ? "selected" : ""} onClick={() => toggleOverlay(key)} aria-pressed={overlays[key]}><span>{icon}</span>{label}</button>)}</div></aside>
    {(isMeasuring || measuredDistanceLabel) && <div className={`real-map-measure-result ${isMeasuring ? "is-active" : ""}`}><span>↔ {isMeasuring ? (locale === "ru" ? "Выберите две точки" : "Екі нүктені таңдаңыз") : <><small>{locale === "ru" ? "РАССТОЯНИЕ" : "ҚАШЫҚТЫҚ"}</small><b>{measuredDistanceLabel}</b></>}</span>{measuredDistanceLabel && <button type="button" onClick={clearMeasurement} aria-label={locale === "ru" ? "Очистить измерение" : "Өлшеуді тазарту"}>×</button>}</div>}
    <div className="real-map-view-controls" role="group" aria-label={locale === "ru" ? "Управление видом карты" : "Карта көрінісін басқару"}>
      <button type="button" onClick={() => adjustZoom(-1)} aria-label={locale === "ru" ? "Уменьшить масштаб" : "Масштабты кішірейту"}>−</button>
      <output aria-label={locale === "ru" ? "Текущий масштаб" : "Ағымдағы масштаб"}>{mapReady ? `Z ${viewZoom.toFixed(1)}` : `${Math.round(localZoom * 100)}%`}</output>
      <button type="button" onClick={() => adjustZoom(1)} aria-label={locale === "ru" ? "Увеличить масштаб" : "Масштабты үлкейту"}>+</button>
      <button type="button" onClick={() => rotateView(-15)} disabled={!mapReady} aria-label={locale === "ru" ? "Повернуть карту влево" : "Картаны солға бұру"}>↶</button>
      <button type="button" className={`real-map-3d-toggle ${isThreeD ? "selected" : ""}`} onClick={() => setIsThreeD((enabled) => !enabled)} aria-pressed={isThreeD}>{isThreeD ? `3D ${Math.round(viewPitch)}°` : "2D"}</button>
      <button type="button" onClick={() => rotateView(15)} disabled={!mapReady} aria-label={locale === "ru" ? "Повернуть карту вправо" : "Картаны оңға бұру"}>↷</button>
      <button type="button" className={`real-map-measure-toggle ${isMeasuring ? "selected" : ""}`} onClick={startMeasurement} disabled={!mapReady} aria-pressed={isMeasuring} aria-label={locale === "ru" ? "Измерить расстояние" : "Қашықтықты өлшеу"}>↔</button>
    </div>
    <div className="real-map-camera-readout" aria-label={locale === "ru" ? "Положение камеры карты" : "Карта камерасының күйі"}><span>N {Math.round(((viewBearing % 360) + 360) % 360)}°</span><b>{viewCenter[1].toFixed(4)} · {viewCenter[0].toFixed(4)}</b><em>Z{viewZoom.toFixed(1)}</em></div>
    <button type="button" className="real-map-home" onClick={resetView}>⌖ <span>{locale === "ru" ? "Вся Астана" : "Бүкіл Астана"}</span></button>
  </div>;
}
