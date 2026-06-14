"use client";

/* ════════════════════════════════════════════════════════════════════
   IRIS — landing 3D : descente d'un chemin forestier piloté au scroll.
   La caméra avance le long de la route à mesure que l'on scrolle ; l'iris
   (SVG) "pousse" à côté et explique les options ; au bout, les CTA.

   Debug : ouvrir /?debug pour activer OrbitControls + lecture caméra,
   afin de caler les WAYPOINTS sur le vrai modèle.
   ════════════════════════════════════════════════════════════════════ */

import { Suspense, useMemo, useRef, useState, useEffect } from "react";
import Link from "next/link";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  useGLTF,
  ScrollControls,
  Scroll,
  useScroll,
  OrbitControls,
  AdaptiveDpr,
  Preload,
  useProgress,
} from "@react-three/drei";
import * as THREE from "three";

const MODEL = "/iris-forest.glb";
if (typeof window !== "undefined") useGLTF.preload(MODEL, true);

/* Nombre de "pages" de scroll → aligné sur les 5 sections de l'overlay
   (intro + 3 bulles + CTA) pour que la CTA arrive en fin de course caméra. */
const PAGES = 5;

/* Réglages de descente (calés une fois la route détectée). */
const SCENE_SPAN = 120; // grande dimension du modèle ramenée à N unités monde
const EYE_HEIGHT = 1.8; // hauteur de l'œil au-dessus du sol (raycasté)
const LOOK_AHEAD = 16; // distance regardée devant
const LOOK_DROP = 0.6; // la cible regarde légèrement vers le sol
const FLIP_DIR = false; // inverse le sens de parcours si on entre "par l'arrière"
const START_INSET = 0.06; // retrait au départ (fraction de la route)
const END_INSET = 0.24; // retrait à l'arrivée (reste dans les arbres pour la CTA)
const ROAD_RE = /road|cobble/i; // strict : Dirt_Road*, Road_Edge*, Cobblestone

type Layout = {
  group: THREE.Group;
  eye: THREE.Vector3[];
  target: THREE.Vector3[];
  roadBox: THREE.Box3; // bbox route en espace monde (debug)
  fullBox: THREE.Box3; // bbox modèle entier en espace monde (debug)
};

/* Charge la scène, la recentre/échelonne, ET détecte automatiquement la
   route pour en déduire le trajet caméra. Mémoïsé sur la scène (cache useGLTF). */
function useForestLayout(): Layout {
  const { scene } = useGLTF(MODEL, true);
  return useMemo(() => {
    const root = scene.clone(true);
    const box = new THREE.Box3().setFromObject(root);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const s = SCENE_SPAN / Math.max(size.x, size.z);
    const offset = new THREE.Vector3(-center.x, -box.min.y, -center.z);

    // espace original → monde (mêmes transforms que le <group> ci-dessous)
    const toWorld = (p: THREE.Vector3) =>
      new THREE.Vector3(
        (p.x + offset.x) * s,
        (p.y + offset.y) * s,
        (p.z + offset.z) * s
      );

    // bbox de la route SEULE (matériaux Dirt_Road* / Cobblestone) — strict,
    // pour obtenir une vraie centerline et pas tout le diorama.
    const roadBox = new THREE.Box3().makeEmpty();
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = m.receiveShadow = false;
      const mat = m.material as THREE.MeshStandardMaterial;
      if (mat && "envMapIntensity" in mat) mat.envMapIntensity = 0.6;
      const name = `${o.name} ${mat?.name ?? ""}`;
      if (ROAD_RE.test(name)) roadBox.expandByObject(m);
    });
    if (roadBox.isEmpty()) roadBox.copy(box); // fallback : tout le modèle

    // Construit le groupe MAINTENANT pour pouvoir raycaster en espace monde.
    const group = new THREE.Group();
    group.add(root);
    group.scale.setScalar(s);
    root.position.copy(offset);
    group.updateMatrixWorld(true);

    const wMin = toWorld(roadBox.min);
    const wMax = toWorld(roadBox.max);
    const span = new THREE.Vector3().subVectors(wMax, wMin);
    const alongZ = Math.abs(span.z) >= Math.abs(span.x);

    // axe de parcours = grande dimension de la route ; centre transversal fixe
    const cross = alongZ ? (wMin.x + wMax.x) / 2 : (wMin.z + wMax.z) / 2;
    let a = alongZ ? wMax.z : wMax.x; // entrée
    let b = alongZ ? wMin.z : wMin.x; // sortie
    if (FLIP_DIR) [a, b] = [b, a];
    const dir = Math.sign(b - a) || 1;
    // on reste à l'intérieur du diorama : retrait au départ, et surtout à
    // l'arrivée pour que la CTA finale ne regarde pas par-dessus le bord.
    const len = Math.abs(b - a);
    a += dir * len * START_INSET;
    b -= dir * len * END_INSET;

    // Hauteur réelle du sol par raycast vertical descendant (on "marche" dessus).
    const ray = new THREE.Raycaster();
    const down = new THREE.Vector3(0, -1, 0);
    const topY = wMax.y + 50;
    const surfaceY = (x: number, z: number, fallback: number) => {
      ray.set(new THREE.Vector3(x, topY, z), down);
      const hits = ray.intersectObject(group, true);
      return hits.length ? hits[0].point.y : fallback;
    };

    const at = (along: number, wob: number): THREE.Vector3 =>
      alongZ
        ? new THREE.Vector3(cross + wob, 0, along)
        : new THREE.Vector3(along, 0, cross + wob);

    const N = 8;
    const eye: THREE.Vector3[] = [];
    const target: THREE.Vector3[] = [];
    let lastY = (wMin.y + wMax.y) / 2;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const along = THREE.MathUtils.lerp(a, b, t);
      const wob = Math.sin(t * Math.PI * 1.5) * 4; // léger serpentin
      const p = at(along, wob);
      const gy = surfaceY(p.x, p.z, lastY);
      lastY = gy;
      eye.push(new THREE.Vector3(p.x, gy + EYE_HEIGHT, p.z));

      // cible : point devant sur la route, à sa hauteur de sol
      const ahead = along + dir * LOOK_AHEAD;
      const pa = at(ahead, 0);
      const ay = surfaceY(pa.x, pa.z, gy);
      target.push(
        new THREE.Vector3(pa.x, ay + EYE_HEIGHT - LOOK_DROP, pa.z)
      );
    }

    const roadBoxW = new THREE.Box3(wMin.clone(), wMax.clone());
    const fullBoxW = new THREE.Box3(toWorld(box.min), toWorld(box.max));

    return { group, eye, target, roadBox: roadBoxW, fullBox: fullBoxW };
  }, [scene]);
}

/* ── Modèle ──────────────────────────────────────────────────────────── */
function Forest({
  layout,
  onReport,
}: {
  layout: Layout;
  onReport?: (s: string) => void;
}) {
  useEffect(() => {
    if (!onReport) return;
    const f = (v: THREE.Vector3) =>
      `${v.x.toFixed(1)},${v.y.toFixed(1)},${v.z.toFixed(1)}`;
    onReport(
      `eye0[${f(layout.eye[0])}] tgt0[${f(layout.target[0])}] ` +
        `eyeN[${f(layout.eye[layout.eye.length - 1])}] ` +
        `road[${f(layout.roadBox.min)} → ${f(layout.roadBox.max)}] ` +
        `full[${f(layout.fullBox.min)} → ${f(layout.fullBox.max)}]`
    );
  }, [layout, onReport]);
  return <primitive object={layout.group} />;
}

/* ── Rig caméra : suit le scroll le long des courbes ─────────────────── */
function CameraRig({
  layout,
  previewT,
}: {
  layout: Layout;
  previewT: number | null;
}) {
  const scroll = useScroll();
  const eyeCurve = useMemo(
    () => new THREE.CatmullRomCurve3(layout.eye, false, "catmullrom", 0.5),
    [layout]
  );
  const tgtCurve = useMemo(
    () => new THREE.CatmullRomCurve3(layout.target, false, "catmullrom", 0.5),
    [layout]
  );
  const pos = useRef(layout.eye[0].clone());
  const look = useRef(layout.target[0].clone());
  const first = useRef(true);

  useFrame((state, dt) => {
    const t = THREE.MathUtils.clamp(
      previewT ?? scroll.offset,
      0,
      1
    );
    eyeCurve.getPoint(t, pos.current);
    tgtCurve.getPoint(t, look.current);
    // léger flottement organique
    const bob = Math.sin(state.clock.elapsedTime * 0.6) * 0.12;
    // snap immédiat à la 1re frame (et en preview) pour éviter le flash d'entrée
    const k = previewT != null || first.current ? 1 : 1 - Math.pow(0.001, dt);
    first.current = false;
    state.camera.position.lerp(
      pos.current.clone().setY(pos.current.y + bob),
      k
    );
    state.camera.lookAt(look.current);
  });

  return null;
}

/* ── Lecture position caméra en debug (cale les WAYPOINTS) ───────────── */
function DebugReadout() {
  const { camera } = useThree();
  const [, force] = useState(0);
  useFrame(() => force((n) => (n + 1) % 1000));
  const p = camera.position;
  return (
    <group>
      {/* rien dans la scène ; l'overlay HTML lit window via cet effet */}
      <DebugHud x={p.x} y={p.y} z={p.z} />
    </group>
  );
}
function DebugHud({ x, y, z }: { x: number; y: number; z: number }) {
  useEffect(() => {
    const el = document.getElementById("dbg");
    if (el)
      el.textContent = `eye [${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(
        1
      )}]`;
  }, [x, y, z]);
  return null;
}

/* ── Lumière & atmosphère ────────────────────────────────────────────── */
function Atmosphere({ debug }: { debug: boolean }) {
  return (
    <>
      <hemisphereLight args={["#cfe3ff", "#1a1726", debug ? 2.5 : 0.9]} />
      {debug && <ambientLight intensity={1.5} />}
      <directionalLight
        position={[20, 40, 10]}
        intensity={1.6}
        color="#ffe9c7"
      />
      <directionalLight
        position={[-15, 20, -20]}
        intensity={0.5}
        color="#9d5bff"
      />
      {!debug && <fog attach="fog" args={["#0b0a12", 30, 150]} />}
    </>
  );
}

/* ── Overlay HTML synchronisé au scroll (iris + bulles + CTA) ─────────── */
function Overlay() {
  return (
    <Scroll html>
      <div className="fl-overlay">
        {/* Intro */}
        <section className="fl-step fl-intro">
          <img
            src="/iris_turquoise_contour_decoupe.svg"
            alt="Iris"
            className="fl-iris"
          />
          <h1 className="fl-title">
            <span className="grad">Iris</span>
          </h1>
          <p className="fl-lede">Options, anywhere.</p>
          <p className="fl-hint">scroll ↓ pour suivre le chemin</p>
        </section>

        {/* Bulles : une option par palier */}
        <Bubble
          side="left"
          tag="01 · Cash-Secured Put"
          star
          title="Tu déposes, tu gagnes."
          body="Tu mets de l'USDC de côté et tu touches un rendement. Pire cas : tu rachètes l'actif moins cher qu'aujourd'hui."
        />
        <Bubble
          side="right"
          tag="02 · Covered Call"
          title="Tu as déjà un actif ?"
          body="Gagne un petit bonus dessus, tranquillement, pendant que tu le gardes."
        />
        <Bubble
          side="left"
          tag="03 · Buy Call"
          title="Tu paries sur la hausse."
          body="Si ça monte, tu gagnes. Si ça baisse, tu ne perds que ton ticket d'entrée. Rien de plus."
        />

        {/* Fin du chemin : CTA */}
        <section className="fl-step fl-cta">
          <img
            src="/iris_turquoise_contour_decoupe.svg"
            alt=""
            className="fl-iris fl-iris-big"
          />
          <h2 className="fl-cta-title">
            Une seule brique. <span className="grad">Zéro maths.</span>
          </h2>
          <p className="fl-lede">
            Single-leg, entièrement collatéralisé. Pas de marge, pas de
            liquidation.
          </p>
          <div className="fl-actions">
            <Link href="/docs" className="btn ghost lg">
              Docs
            </Link>
            <Link href="/learn" className="btn ghost lg">
              Learn
            </Link>
            <Link href="/app" className="btn lg">
              Launch app →
            </Link>
          </div>
          <p className="fl-foot">
            Built on Derive · ETHGlobal NYC · fully-collateralised single-leg
            options
          </p>
        </section>
      </div>
    </Scroll>
  );
}

function Bubble({
  side,
  tag,
  title,
  body,
  star,
}: {
  side: "left" | "right";
  tag: string;
  title: string;
  body: string;
  star?: boolean;
}) {
  return (
    <section className={`fl-step fl-bubble ${side}`}>
      <div className="fl-card">
        <span className="fl-tag">
          {tag} {star && <span className="fl-star">★</span>}
        </span>
        <h3 className="fl-card-title">{title}</h3>
        <p className="fl-card-body">{body}</p>
      </div>
    </section>
  );
}

/* ── Écran de chargement brandé (couvre le téléchargement du GLB) ─────── */
function LoadingScreen() {
  const { active, progress } = useProgress();
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (!active && progress >= 100) {
      const t = setTimeout(() => setGone(true), 600);
      return () => clearTimeout(t);
    }
  }, [active, progress]);
  if (gone) return null;
  return (
    <div className={`fl-loader ${!active && progress >= 100 ? "done" : ""}`}>
      <img
        src="/iris_turquoise_contour_decoupe.svg"
        alt="Iris"
        className="fl-loader-iris"
      />
      <div className="fl-loader-bar">
        <span style={{ width: `${progress}%` }} />
      </div>
      <span className="fl-loader-pct">{Math.round(progress)}%</span>
    </div>
  );
}

/* ── Scène : calcule le layout (route auto) et orchestre tout ────────── */
function Scene({
  debug,
  previewT,
  onReport,
}: {
  debug: boolean;
  previewT: number | null;
  onReport?: (s: string) => void;
}) {
  const layout = useForestLayout();
  return (
    <>
      {debug ? (
        <>
          <Forest layout={layout} onReport={onReport} />
          <OrbitControls makeDefault target={[0, 0, 0]} />
          <axesHelper args={[80]} />
          <box3Helper args={[layout.fullBox, new THREE.Color("#9d5bff")]} />
          <box3Helper args={[layout.roadBox, new THREE.Color("#3ddc97")]} />
          {/* marqueurs entrée (cyan) / sortie (rouge) du trajet */}
          {layout.eye.map((p, i) => (
            <mesh key={i} position={p}>
              <sphereGeometry args={[i === 0 ? 5 : 3, 16, 16]} />
              <meshBasicMaterial
                color={i === 0 ? "#5cf2a6" : i === layout.eye.length - 1 ? "#ff6b6b" : "#9d5bff"}
                depthTest={false}
              />
            </mesh>
          ))}
        </>
      ) : (
        <ScrollControls pages={PAGES} damping={0.28}>
          <Forest layout={layout} onReport={onReport} />
          <CameraRig layout={layout} previewT={previewT} />
          <Overlay />
        </ScrollControls>
      )}
    </>
  );
}

/* ── Racine ──────────────────────────────────────────────────────────── */
export default function ForestExperience() {
  const [debug, setDebug] = useState(false);
  const [previewT, setPreviewT] = useState<number | null>(null);
  const [report, setReport] = useState("");
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setDebug(q.has("debug"));
    const p = q.get("preview");
    setPreviewT(p != null ? Math.max(0, Math.min(1, parseFloat(p))) : null);
  }, []);
  const showReport = debug || previewT != null;

  return (
    <div className="fl-root">
      <div className="fl-bg" />
      <div className="fl-vignette" />
      <Canvas
        className="fl-canvas"
        dpr={[1, 1.6]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        camera={{
          fov: 52,
          near: 0.1,
          far: 600,
          position: debug ? [0, 190, 0.1] : [0, 5, 55],
        }}
      >
        <Atmosphere debug={debug} />
        <Suspense fallback={null}>
          <Scene debug={debug} previewT={previewT} onReport={setReport} />
          <Preload all />
        </Suspense>
        {debug && <DebugReadout />}
        <AdaptiveDpr pixelated />
      </Canvas>
      {debug && <div id="dbg" className="fl-dbg">eye …</div>}
      {showReport && report && (
        <div
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            right: 8,
            zIndex: 30,
            fontFamily: "monospace",
            fontSize: 22,
            lineHeight: 1.5,
            color: "#5cf2a6",
            background: "rgba(0,0,0,0.85)",
            padding: "8px 12px",
            whiteSpace: "normal",
            wordBreak: "break-all",
          }}
        >
          {report}
        </div>
      )}
      <LoadingScreen />
    </div>
  );
}
