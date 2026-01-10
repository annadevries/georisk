import * as THREE from "three";

type GeoJSON = {
  type: string;
  features: { geometry: { type: string; coordinates: any } }[];
};

function projectLonLat(lon: number, lat: number) {
  const x = (lon / 180) * 1.6;
  const y = (lat / 90) * 0.9;
  return new THREE.Vector2(x, y);
}

function pushLine(points: THREE.Vector2[], out: number[]) {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    out.push(a.x, a.y, 0, b.x, b.y, 0);
  }
}

export async function loadWorldLines(): Promise<THREE.LineSegments> {
  const res = await fetch("./world.geojson", { cache: "force-cache" });
  if (!res.ok) throw new Error(`world.geojson load failed: ${res.status}`);
  const geo: GeoJSON = await res.json();

  const verts: number[] = [];

  for (const f of geo.features) {
    const g = f.geometry;
    if (!g) continue;

    if (g.type === "Polygon") {
      for (const ring of g.coordinates) {
        const pts = ring.map((c: number[]) => projectLonLat(c[0], c[1]));
        pushLine(pts, verts);
      }
    } else if (g.type === "MultiPolygon") {
      for (const poly of g.coordinates) {
        for (const ring of poly) {
          const pts = ring.map((c: number[]) => projectLonLat(c[0], c[1]));
          pushLine(pts, verts);
        }
      }
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));

  const mat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.45 });
  return new THREE.LineSegments(geom, mat);
}

export function lonLatToXY(lon: number, lat: number) {
  const v = projectLonLat(lon, lat);
  return { x: v.x, y: v.y };
}
