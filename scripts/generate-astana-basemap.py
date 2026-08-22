#!/usr/bin/env python3
"""Build a compact, local SVG basemap from an OpenStreetMap Overpass extract.

Usage:
  python3 scripts/generate-astana-basemap.py ROADS.json WATER.json LAND.json public/astana-osm.svg

The generated SVG keeps the dashboard usable when WebGL or third-party tiles are
unavailable. Source data remains attributed to OpenStreetMap contributors.
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path
from xml.sax.saxutils import escape


WEST, SOUTH, EAST, NORTH = 71.23, 51.02, 71.68, 51.30
WIDTH, HEIGHT = 1600.0, 1000.0


def project(lon: float, lat: float) -> tuple[float, float]:
    x = (lon - WEST) / (EAST - WEST) * WIDTH
    y = (NORTH - lat) / (NORTH - SOUTH) * HEIGHT
    return x, y


def geometry_points(element: dict) -> list[tuple[float, float]]:
    geometry = element.get("geometry") or []
    points = []
    for point in geometry:
        lon, lat = point.get("lon"), point.get("lat")
        if lon is None or lat is None:
            continue
        points.append(project(float(lon), float(lat)))
    return points


def simplify(points: list[tuple[float, float]], min_distance: float = 0.42) -> list[tuple[float, float]]:
    if len(points) < 3:
        return points
    result = [points[0]]
    for point in points[1:-1]:
        previous = result[-1]
        if math.hypot(point[0] - previous[0], point[1] - previous[1]) >= min_distance:
            result.append(point)
    result.append(points[-1])
    return result


def svg_path(points: list[tuple[float, float]], closed: bool = False) -> str:
    points = simplify(points)
    if len(points) < 2:
        return ""
    chunks = [f"M{points[0][0]:.1f},{points[0][1]:.1f}"]
    chunks.extend(f"L{x:.1f},{y:.1f}" for x, y in points[1:])
    if closed:
        chunks.append("Z")
    return "".join(chunks)


def load_elements(path: str) -> list[dict]:
    return json.loads(Path(path).read_text(encoding="utf-8")).get("elements", [])


def display_name(tags: dict) -> str:
    return str(tags.get("name:ru") or tags.get("name") or "").strip()


def main() -> None:
    if len(sys.argv) != 5:
        raise SystemExit("Expected ROADS.json WATER.json LAND.json OUTPUT.svg")

    road_elements = load_elements(sys.argv[1])
    water_elements = load_elements(sys.argv[2])
    land_elements = load_elements(sys.argv[3])
    output = Path(sys.argv[4])

    land_paths: list[str] = []
    water_areas: list[str] = []
    river_lines: list[str] = []
    rail_paths: list[str] = []
    road_defs: dict[str, list[str]] = {key: [] for key in ("motorway", "trunk", "primary", "secondary", "tertiary")}
    road_labels: list[tuple[float, float, str, str]] = []
    seen_road_names: set[str] = set()
    place_labels: list[tuple[float, float, str, str]] = []

    for element in land_elements:
        points = geometry_points(element)
        if len(points) < 3:
            continue
        tags = element.get("tags") or {}
        kind = tags.get("landuse") or tags.get("leisure") or tags.get("amenity") or "land"
        path = svg_path(points, closed=True)
        if path:
            land_paths.append(f'<path class="land land-{escape(str(kind))}" d="{path}"/>')

    for element in water_elements:
        tags = element.get("tags") or {}
        points = geometry_points(element)
        if element.get("type") == "node":
            lon, lat = element.get("lon"), element.get("lat")
            name = display_name(tags)
            if lon is not None and lat is not None and name:
                x, y = project(float(lon), float(lat))
                place_kind = "landmark" if tags.get("tourism") or tags.get("historic") else "district"
                place_labels.append((x, y, name, place_kind))
            continue
        if len(points) < 2:
            continue
        path = svg_path(points, closed=tags.get("natural") == "water" or tags.get("waterway") == "riverbank")
        if not path:
            continue
        if tags.get("natural") == "water" or tags.get("waterway") == "riverbank":
            water_areas.append(f'<path class="water-area" d="{path}"/>')

    for element in road_elements:
        tags = element.get("tags") or {}
        points = geometry_points(element)
        if len(points) < 2:
            continue
        path = svg_path(points)
        if not path:
            continue
        if tags.get("waterway") == "river":
            river_lines.append(f'<path class="river-line" d="{path}"/>')
            continue
        if tags.get("railway") == "rail":
            rail_paths.append(f'<path class="rail" d="{path}"/>')
            continue
        highway = str(tags.get("highway") or "")
        if highway == "motorway_link":
            highway = "motorway"
        elif highway == "trunk_link":
            highway = "trunk"
        elif highway == "primary_link":
            highway = "primary"
        elif highway == "secondary_link":
            highway = "secondary"
        elif highway == "tertiary_link":
            highway = "tertiary"
        if highway not in road_defs:
            continue
        road_id = f"road-{element.get('id')}"
        road_defs[highway].append(f'<path id="{road_id}" d="{path}"/>')
        name = display_name(tags)
        if name and name not in seen_road_names and highway in {"motorway", "trunk", "primary", "secondary"}:
            seen_road_names.add(name)
            midpoint = points[len(points) // 2]
            road_labels.append((midpoint[0], midpoint[1], name, highway))

    defs = []
    road_uses = []
    for highway, paths in road_defs.items():
        defs.extend(paths)
        for path_def in paths:
            road_id = path_def.split('id="', 1)[1].split('"', 1)[0]
            road_uses.append(f'<use href="#{road_id}" class="road-casing road-{highway}"/>')
            road_uses.append(f'<use href="#{road_id}" class="road road-{highway}"/>')

    label_markup = []
    label_cells: set[tuple[int, int]] = set()
    road_priority = {"motorway": 0, "trunk": 1, "primary": 2, "secondary": 3}
    road_label_count = 0
    for x, y, name, kind in sorted(road_labels, key=lambda label: road_priority[label[3]]):
        cell = (int(x // 205), int(y // 118))
        if cell in label_cells or road_label_count >= 28:
            continue
        label_cells.add(cell)
        road_label_count += 1
        safe_name = escape(name[:34])
        label_markup.append(f'<text class="road-label label-{kind}" x="{x:.1f}" y="{y:.1f}">{safe_name}</text>')

    place_count = {"district": 0, "landmark": 0}
    for x, y, name, kind in place_labels:
        cell = (int(x // 180), int(y // 108))
        limit = 13 if kind == "district" else 9
        if cell in label_cells or place_count[kind] >= limit:
            continue
        label_cells.add(cell)
        place_count[kind] += 1
        safe_name = escape(name[:36])
        label_markup.append(f'<g class="place place-{kind}" transform="translate({x:.1f} {y:.1f})"><circle r="3"/><text x="9" y="3">{safe_name}</text></g>')

    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {int(WIDTH)} {int(HEIGHT)}" role="img" aria-labelledby="title desc">
<title id="title">Карта улиц Астаны</title>
<desc id="desc">Локальная векторная карта на основе данных OpenStreetMap</desc>
<metadata>© OpenStreetMap contributors, ODbL 1.0. Generated from Overpass API for INFRA-SIGNAL.</metadata>
<defs>
  <linearGradient id="land-bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#0b2027"/><stop offset=".5" stop-color="#07171d"/><stop offset="1" stop-color="#0a1d22"/></linearGradient>
  <pattern id="grid" width="80" height="80" patternUnits="userSpaceOnUse"><path d="M80 0H0V80" fill="none" stroke="#6bd9d5" stroke-opacity=".035" stroke-width="1"/></pattern>
  <filter id="river-glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  {''.join(defs)}
</defs>
<style>
  .land{{stroke:#163139;stroke-width:.7}} .land-residential{{fill:#122a31}} .land-industrial{{fill:#23291f}} .land-commercial,.land-retail{{fill:#1d2730}} .land-forest,.land-park,.land-garden,.land-recreation_ground{{fill:#123429}} .land-stadium,.land-sports_centre{{fill:#19363a}} .land-university,.land-school{{fill:#1b2f39}} .land-hospital{{fill:#382128}}
  .water-area{{fill:#0d4054;stroke:#28718a;stroke-width:1.2}} .river-line{{fill:none;stroke:#1f657f;stroke-width:17;stroke-linecap:round;stroke-linejoin:round;filter:url(#river-glow)}}
  .rail{{fill:none;stroke:#66757b;stroke-width:2;stroke-dasharray:8 6;stroke-opacity:.52}}
  .road-casing{{fill:none;stroke:#02090c;stroke-linecap:round;stroke-linejoin:round;opacity:.82}} .road{{fill:none;stroke-linecap:round;stroke-linejoin:round}}
  .road-casing.road-motorway{{stroke-width:13}} .road.road-motorway{{stroke:#b4904d;stroke-width:8}}
  .road-casing.road-trunk{{stroke-width:11}} .road.road-trunk{{stroke:#a98145;stroke-width:6.5}}
  .road-casing.road-primary{{stroke-width:9}} .road.road-primary{{stroke:#63787f;stroke-width:5}}
  .road-casing.road-secondary{{stroke-width:6.3}} .road.road-secondary{{stroke:#3f5961;stroke-width:3.3}}
  .road-casing.road-tertiary{{stroke-width:4.4}} .road.road-tertiary{{stroke:#29434b;stroke-width:2.1}}
  .road-label{{fill:#8aa1a6;font:15px ui-monospace,monospace;paint-order:stroke;stroke:#07171d;stroke-width:5;stroke-linejoin:round;letter-spacing:.03em}} .label-motorway,.label-trunk{{fill:#dab975}}
  .place text{{fill:#8aa7ac;font:17px system-ui,sans-serif;font-weight:600;paint-order:stroke;stroke:#07171d;stroke-width:5;stroke-linejoin:round}} .place circle{{fill:#50d9cf;stroke:#082026;stroke-width:2}} .place-landmark text{{fill:#c5ddd9;font-size:15px}} .place-landmark circle{{fill:#ffc65b}}
</style>
<rect width="1600" height="1000" fill="url(#land-bg)"/>
<rect width="1600" height="1000" fill="url(#grid)"/>
<g id="landuse">{''.join(land_paths)}</g>
<g id="water">{''.join(water_areas)}{''.join(river_lines)}</g>
<g id="railways">{''.join(rail_paths)}</g>
<g id="roads">{''.join(road_uses)}</g>
<g id="labels">{''.join(label_markup)}</g>
<text x="800" y="535" text-anchor="middle" fill="#7ff4e6" fill-opacity=".045" font-family="system-ui,sans-serif" font-size="138" font-weight="800" letter-spacing=".16em">ASTANA</text>
</svg>'''

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(svg, encoding="utf-8")
    print(f"generated {output} ({output.stat().st_size} bytes)")
    print(f"roads={sum(len(paths) for paths in road_defs.values())}, land={len(land_paths)}, water={len(water_areas)}, rail={len(rail_paths)}, labels={len(label_markup)}")


if __name__ == "__main__":
    main()
