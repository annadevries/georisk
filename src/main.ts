import * as THREE from "three";
import "./style.css";
import { loadSnapshot, renderMarkets, renderTicker, type Snapshot } from "./snapshot";
import { loadWorldLines, lonLatToXY } from "./geo";
import { getGeoIP } from "./geoip";

const canvas = document.getElementById("c") as HTMLCanvasElement;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setClearColor(0x000000, 1);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1.8, 1.8, 1.1, -1.1, -10, 10);
camera.position.z = 2;

function resize(){
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  renderer.setSize(w, h, false);

  const aspect = w / h;
  const viewH = 2.2;
  const viewW = viewH * aspect;

  camera.left = -viewW / 2;
  camera.right = viewW / 2;
  camera.top = viewH / 2;
  camera.bottom = -viewH / 2;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();

// grid
{
  const grid = new THREE.GridHelper(8, 60, 0x66ffee, 0x66ffee);
  (grid.material as THREE.Material).transparent = true;
  (grid.material as any).opacity = 0.06;
  grid.rotation.x = Math.PI / 2;
  scene.add(grid);
}

// world outlines
let worldLines: THREE.LineSegments | null = null;
loadWorldLines().then(lines => {
  worldLines = lines;
  (lines.material as THREE.LineBasicMaterial).color = new THREE.Color(0x66ffee);
  (lines.material as THREE.LineBasicMaterial).opacity = 0.55;
  scene.add(lines);

  const glow = lines.clone();
  const glowMat = (glow.material as THREE.LineBasicMaterial).clone();
  glowMat.opacity = 0.22;
  glowMat.color = new THREE.Color(0x66ffee);
  glow.material = glowMat;
  glow.scale.setScalar(1.002);
  scene.add(glow);
});

// pulses by kind
const MAX_POINTS = 400;
const circle = new THREE.CircleGeometry(0.02, 24);

function makeInst(colorHex: number){
  const m = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9, color: colorHex });
  const mesh = new THREE.InstancedMesh(circle, m, MAX_POINTS);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(mesh);
  return mesh;
}

const instNews = makeInst(0x66ffee);
const instFlight = makeInst(0xff46be);
const instShip = makeInst(0xff4646);

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpP = new THREE.Vector3();
const tmpS = new THREE.Vector3();

type P = { x: number; y: number; kind: "news"|"flight"|"ship"; phase: number };
let points: P[] = [];

function hideAll(mesh: THREE.InstancedMesh){
  for (let i = 0; i < MAX_POINTS; i++){
    tmpM.makeScale(0,0,0);
    mesh.setMatrixAt(i, tmpM);
  }
  mesh.instanceMatrix.needsUpdate = true;
}

function rebuildPoints(s: Snapshot){
  points = (s.map_points ?? []).slice(0, MAX_POINTS).map(p => {
    const { x, y } = lonLatToXY(p.lon, p.lat);
    return { x, y, kind: p.kind, phase: Math.random() * Math.PI * 2 };
  });

  hideAll(instNews);
  hideAll(instFlight);
  hideAll(instShip);

  let ni = 0, fi = 0, si = 0;
  for (const d of points){
    const mesh =
      d.kind === "flight" ? instFlight :
      d.kind === "ship" ? instShip :
      instNews;

    const idx =
      d.kind === "flight" ? fi++ :
      d.kind === "ship" ? si++ :
      ni++;

    if (idx >= MAX_POINTS) continue;
    tmpM.makeTranslation(d.x, d.y, 0);
    mesh.setMatrixAt(idx, tmpM);
    mesh.instanceMatrix.needsUpdate = true;
  }
}

// snapshot + geo label
let snapshot: Snapshot | null = null;
let geoLabel = "";

async function refresh(){
  try{
    if(!geoLabel){
      const g = await getGeoIP();
      const bits = [g.ip, g.city, g.country_name].filter(Boolean);
      geoLabel = bits.length ? (" , " + bits.join(" , ")) : "";
    }
    snapshot = await loadSnapshot();
    renderTicker(snapshot);
    renderMarkets(snapshot);
    rebuildPoints(snapshot);
  }catch(e){
    console.error(e);
  }
}
await refresh();
setInterval(refresh, 60 * 1000);

const t0 = performance.now();
function animate(){
  const t = (performance.now() - t0) / 1000;

  if (worldLines) {
    const m = worldLines.material as THREE.LineBasicMaterial;
    m.opacity = 0.50 + 0.15 * (0.5 + 0.5 * Math.sin(t * 0.35));
  }

  let ni = 0, fi = 0, si = 0;
  for (const d of points){
    const s = 0.5 + 0.9 * (0.5 + 0.5 * Math.sin(t * 2.2 + d.phase));
    tmpP.set(d.x, d.y, 0);
    tmpS.set(0.02 * s, 0.02 * s, 1);
    tmpM.compose(tmpP, tmpQ, tmpS);

    if (d.kind === "flight") instFlight.setMatrixAt(fi++, tmpM);
    else if (d.kind === "ship") instShip.setMatrixAt(si++, tmpM);
    else instNews.setMatrixAt(ni++, tmpM);
  }

  instNews.instanceMatrix.needsUpdate = true;
  instFlight.instanceMatrix.needsUpdate = true;
  instShip.instanceMatrix.needsUpdate = true;

  const timeEl = document.getElementById("tickerTime");
  if (timeEl) timeEl.textContent = new Date().toLocaleString() + geoLabel;

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();
