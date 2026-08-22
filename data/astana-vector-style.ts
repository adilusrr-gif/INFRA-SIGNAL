import { layers, namedFlavor, type Flavor } from "@protomaps/basemaps";
import type { ExpressionSpecification, LayerSpecification } from "maplibre-gl";

export type AstanaMapLocale = "ru" | "kz";

export const ASTANA_VECTOR_SOURCE = "astana-vector";
export const ASTANA_FIRST_LABEL_LAYER = "astana-water-label";
export const ASTANA_LABEL_LAYER_IDS = [
  "astana-water-label",
  "astana-waterway-label",
  "astana-road-label-major",
  "astana-road-label-minor",
  "astana-place-label",
  "astana-neighbourhood-label",
  "astana-poi-label",
  "astana-address-label",
] as const;

const LOCAL_FONT = ["Noto Sans Regular"];

export function astanaNameExpression(locale: AstanaMapLocale): ExpressionSpecification {
  return locale === "kz"
    ? ["coalesce", ["get", "name:kk"], ["get", "name:ru"], ["get", "name"], ["get", "name:en"]]
    : ["coalesce", ["get", "name:ru"], ["get", "name:kk"], ["get", "name"], ["get", "name:en"]];
}

function operationalFlavor(): Flavor {
  const dark = namedFlavor("dark");
  return {
    ...dark,
    background: "#041217",
    earth: "#071b20",
    park_a: "#0b2623",
    park_b: "#0d3028",
    hospital: "#242128",
    industrial: "#132126",
    school: "#1c2427",
    wood_a: "#0b2521",
    wood_b: "#103127",
    pedestrian: "#15262a",
    scrub_a: "#0c2421",
    scrub_b: "#102b24",
    water: "#073747",
    aerodrome: "#111f26",
    runway: "#2a343b",
    buildings: "#16333a",
    minor_service_casing: "#071419",
    minor_casing: "#061318",
    link_casing: "#071419",
    major_casing_late: "#071419",
    highway_casing_late: "#071419",
    other: "#19343a",
    minor_service: "#1b3338",
    minor_a: "#23434a",
    minor_b: "#294951",
    link: "#31515a",
    major_casing_early: "#071419",
    major: "#49646c",
    highway_casing_early: "#071419",
    highway: "#9c7432",
    railway: "#3d5259",
    boundaries: "#2f5961",
    bridges_other_casing: "#071419",
    bridges_minor_casing: "#071419",
    bridges_link_casing: "#071419",
    bridges_major_casing: "#071419",
    bridges_highway_casing: "#071419",
    bridges_other: "#223b41",
    bridges_minor: "#294951",
    bridges_link: "#31515a",
    bridges_major: "#536d74",
    bridges_highway: "#ad8138",
    regular: "Noto Sans Regular",
    bold: "Noto Sans Regular",
    italic: "Noto Sans Regular",
  };
}

export function createAstanaVectorLayers(locale: AstanaMapLocale): LayerSpecification[] {
  const baseLayers = layers(ASTANA_VECTOR_SOURCE, operationalFlavor()) as unknown as LayerSpecification[];
  const name = astanaNameExpression(locale);

  const labels: LayerSpecification[] = [
    {
      id: "astana-water-label",
      type: "symbol",
      source: ASTANA_VECTOR_SOURCE,
      "source-layer": "water",
      minzoom: 11,
      filter: ["any", ["has", "name"], ["has", "name:ru"], ["has", "name:kk"]],
      layout: {
        "symbol-placement": "point",
        "text-field": name,
        "text-font": LOCAL_FONT,
        "text-size": ["interpolate", ["linear"], ["zoom"], 11, 9, 16, 13],
        "text-letter-spacing": 0.08,
        "text-max-width": 9,
      },
      paint: { "text-color": "#5b9daf", "text-halo-color": "#06181e", "text-halo-width": 1.2 },
    },
    {
      id: "astana-waterway-label",
      type: "symbol",
      source: ASTANA_VECTOR_SOURCE,
      "source-layer": "water",
      minzoom: 12,
      filter: ["all", ["==", ["geometry-type"], "LineString"], ["any", ["has", "name"], ["has", "name:ru"], ["has", "name:kk"]]],
      layout: {
        "symbol-placement": "line",
        "symbol-spacing": 420,
        "text-field": name,
        "text-font": LOCAL_FONT,
        "text-size": ["interpolate", ["linear"], ["zoom"], 12, 8, 16, 12],
        "text-letter-spacing": 0.08,
      },
      paint: { "text-color": "#5b9daf", "text-halo-color": "#06181e", "text-halo-width": 1.2 },
    },
    {
      id: "astana-road-label-major",
      type: "symbol",
      source: ASTANA_VECTOR_SOURCE,
      "source-layer": "roads",
      minzoom: 10.5,
      filter: ["all", ["in", "kind", "highway", "major_road"], ["any", ["has", "name"], ["has", "name:ru"], ["has", "name:kk"]]],
      layout: {
        "symbol-placement": "line",
        "symbol-spacing": 380,
        "text-field": name,
        "text-font": LOCAL_FONT,
        "text-size": ["interpolate", ["linear"], ["zoom"], 10, 8.5, 15, 12.5, 18, 15],
        "text-letter-spacing": 0.035,
        "text-max-angle": 35,
        "text-padding": 4,
      },
      paint: { "text-color": "#8ca1a5", "text-halo-color": "#07171c", "text-halo-width": 1.4 },
    },
    {
      id: "astana-road-label-minor",
      type: "symbol",
      source: ASTANA_VECTOR_SOURCE,
      "source-layer": "roads",
      minzoom: 13,
      filter: ["all", ["==", "kind", "minor_road"], ["any", ["has", "name"], ["has", "name:ru"], ["has", "name:kk"]]],
      layout: {
        "symbol-placement": "line",
        "symbol-spacing": 520,
        "text-field": name,
        "text-font": LOCAL_FONT,
        "text-size": ["interpolate", ["linear"], ["zoom"], 13, 8, 17, 12],
        "text-max-angle": 35,
        "text-padding": 5,
      },
      paint: { "text-color": "#647b80", "text-halo-color": "#07171c", "text-halo-width": 1.2 },
    },
    {
      id: "astana-place-label",
      type: "symbol",
      source: ASTANA_VECTOR_SOURCE,
      "source-layer": "places",
      filter: ["==", "kind", "locality"],
      layout: {
        "text-field": name,
        "text-font": LOCAL_FONT,
        "text-size": ["interpolate", ["linear"], ["zoom"], 9, 12, 12, 18, 16, 22],
        "text-letter-spacing": 0.09,
        "text-transform": "uppercase",
        "text-padding": 12,
      },
      paint: { "text-color": "#a7bec1", "text-halo-color": "#07171c", "text-halo-width": 1.5 },
    },
    {
      id: "astana-neighbourhood-label",
      type: "symbol",
      source: ASTANA_VECTOR_SOURCE,
      "source-layer": "places",
      minzoom: 11.5,
      filter: ["in", "kind", "macrohood", "neighbourhood"],
      layout: {
        "text-field": name,
        "text-font": LOCAL_FONT,
        "text-size": ["interpolate", ["linear"], ["zoom"], 11, 8, 16, 12],
        "text-letter-spacing": 0.12,
        "text-transform": "uppercase",
        "text-max-width": 8,
        "text-padding": 10,
      },
      paint: { "text-color": "#66868b", "text-halo-color": "#07171c", "text-halo-width": 1.2 },
    },
    {
      id: "astana-poi-label",
      type: "symbol",
      source: ASTANA_VECTOR_SOURCE,
      "source-layer": "pois",
      minzoom: 14,
      filter: ["any", ["has", "name"], ["has", "name:ru"], ["has", "name:kk"]],
      layout: {
        "text-field": name,
        "text-font": LOCAL_FONT,
        "text-size": ["interpolate", ["linear"], ["zoom"], 14, 8, 18, 12],
        "text-max-width": 8,
        "text-padding": 8,
        "text-variable-anchor": ["top", "bottom", "left", "right"],
        "text-radial-offset": 0.35,
      },
      paint: { "text-color": "#789ba0", "text-halo-color": "#07171c", "text-halo-width": 1.15 },
    },
    {
      id: "astana-address-label",
      type: "symbol",
      source: ASTANA_VECTOR_SOURCE,
      "source-layer": "buildings",
      minzoom: 17,
      filter: ["==", "kind", "address"],
      layout: {
        "text-field": ["get", "addr_housenumber"],
        "text-font": LOCAL_FONT,
        "text-size": 10,
        "text-padding": 3,
      },
      paint: { "text-color": "#718b90", "text-halo-color": "#07171c", "text-halo-width": 1 },
    },
  ];

  return [...baseLayers, ...labels];
}
