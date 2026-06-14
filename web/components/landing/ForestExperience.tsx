"use client";

/* ════════════════════════════════════════════════════════════════════
   IRIS — landing 3D : on descend un VRAI chemin forestier au scroll.

   - La caméra suit la polyline réelle du chemin (centroïdes des meshes de
     route, tranche par tranche → suit les courbes), pas une ligne droite.
   - Scroll NATIF (canvas fixe + sections qui défilent) → les bulles
     éducatives et l'iris qui "pousse" se révèlent au scroll.
   - image.png en backdrop ; 10 bulles expliquent options + protocole.

   Réglage : /?debug (orbit + centerline + bbox) · /?preview=<0..1> (fige
   la caméra à une position de scroll). Constantes ci-dessous.
   ════════════════════════════════════════════════════════════════════ */

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  useGLTF,
  OrbitControls,
  AdaptiveDpr,
  Preload,
  useProgress,
  Line,
} from "@react-three/drei";
import * as THREE from "three";

const MODEL = "/iris-forest.glb";
if (typeof window !== "undefined") useGLTF.preload(MODEL, true);

/* Réglages de descente. */
const SCENE_SPAN = 120; // grande dimension du modèle ramenée à N unités monde
const EYE_HEIGHT = 2.2; // hauteur de l'œil au-dessus du chemin
const LOOK_DROP = 0.9; // la cible regarde légèrement vers le sol
const LOOK_DIST = 10; // distance regardée devant (le long de la tangente)
const START_INSET = 0.0; // retrait au départ (fraction du chemin)
const END_INSET = 0.0; // retrait à l'arrivée
const START_EXTEND = 1.6; // prolonge l'entrée (× longueur du 1er segment)
const END_EXTEND = 0.5; // prolonge la sortie (× longueur du dernier segment)
const FLIP_DIR = true; // ⚑ sens confirmé par l'utilisateur (départ → champs)
const ROAD_RE = /road/i; // meshes du chemin : Dirt_Road*, Road_Edge*

type Layout = {
  group: THREE.Group;
  curve: THREE.CatmullRomCurve3; // centerline du chemin (espace monde)
  samples: THREE.Vector3[]; // points de la centerline (debug)
  roadBox: THREE.Box3;
  fullBox: THREE.Box3;
};

/* Charge la scène, la recentre/échelonne, ET extrait la polyline réelle du
   chemin depuis la géométrie des meshes de route. Mémoïsé (cache useGLTF). */
function useForestLayout(): Layout {
  const { scene } = useGLTF(MODEL, true);
  return useMemo(() => {
    const root = scene.clone(true);
    const box = new THREE.Box3().setFromObject(root);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const s = SCENE_SPAN / Math.max(size.x, size.z);
    const offset = new THREE.Vector3(-center.x, -box.min.y, -center.z);

    const group = new THREE.Group();
    group.add(root);
    group.scale.setScalar(s);
    root.position.copy(offset);
    group.updateMatrixWorld(true);

    // ── Échantillonne les sommets des meshes de route (en espace monde) ──
    const roadPts: THREE.Vector3[] = [];
    const roadBox = new THREE.Box3().makeEmpty();
    const tmp = new THREE.Vector3();
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = m.receiveShadow = false;
      const mat = m.material as THREE.MeshStandardMaterial;
      if (mat && "envMapIntensity" in mat) mat.envMapIntensity = 0.6;
      const name = `${o.name} ${mat?.name ?? ""}`;
      if (!ROAD_RE.test(name)) return;
      roadBox.expandByObject(m);
      const pos = m.geometry.attributes.position;
      const step = Math.max(1, Math.floor(pos.count / 1200));
      for (let i = 0; i < pos.count; i += step) {
        tmp.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
        roadPts.push(tmp.clone());
      }
    });

    // ── PCA (x,z) : axe principal du chemin (gère un chemin en diagonale) ──
    let mx = 0,
      mz = 0;
    for (const p of roadPts) {
      mx += p.x;
      mz += p.z;
    }
    mx /= roadPts.length || 1;
    mz /= roadPts.length || 1;
    let sxx = 0,
      szz = 0,
      sxz = 0;
    for (const p of roadPts) {
      const dx = p.x - mx,
        dz = p.z - mz;
      sxx += dx * dx;
      szz += dz * dz;
      sxz += dx * dz;
    }
    const theta = 0.5 * Math.atan2(2 * sxz, sxx - szz);
    const ux = Math.cos(theta),
      uz = Math.sin(theta);
    const projOf = (p: THREE.Vector3) => (p.x - mx) * ux + (p.z - mz) * uz;

    // ── Extrémités du chemin (extrêmes le long de l'axe principal) ──
    let pmin = Infinity,
      pmax = -Infinity;
    for (const p of roadPts) {
      const pr = projOf(p);
      if (pr < pmin) pmin = pr;
      if (pr > pmax) pmax = pr;
    }
    // L'EXTRACTION part toujours de pmin (sens qui traverse le hairpin en
    // entier). Le sens de PARCOURS est géré ensuite en renversant les points
    // (FLIP_DIR) — découplé, pour garder une traversée complète du chemin.
    const startProj = pmin;
    const endProj = pmax;
    const band = (lo: number, hi: number) => {
      const c = new THREE.Vector3();
      let n = 0;
      for (const p of roadPts) {
        const pr = projOf(p);
        if (pr >= Math.min(lo, hi) && pr <= Math.max(lo, hi)) {
          c.add(p);
          n++;
        }
      }
      return n ? c.multiplyScalar(1 / n) : null;
    };
    const span = Math.abs(pmax - pmin) || 1;
    const seed = band(startProj, startProj + (endProj - startProj) * 0.05);
    const endPt = band(endProj - (endProj - startProj) * 0.05, endProj);

    // ── « Snake » : suit la route en prenant le centroïde des points DEVANT ──
    const samples: THREE.Vector3[] = [];
    if (seed && endPt) {
      const heading2 = new THREE.Vector2(
        endPt.x - seed.x,
        endPt.z - seed.z
      ).normalize();
      let cur = seed.clone();
      samples.push(cur.clone());
      const STEP = span * 0.04; // pas
      const R = span * 0.1; // rayon de visée
      const dirv = new THREE.Vector2();
      for (let it = 0; it < 60; it++) {
        // candidats : points dans [STEP/2 .. R] et dans un cône devant
        let cone = Math.cos(THREE.MathUtils.degToRad(75));
        let cx = 0,
          cy = 0,
          cz = 0,
          cn = 0;
        const gather = (coneCos: number) => {
          cx = cy = cz = cn = 0;
          for (const p of roadPts) {
            const dx = p.x - cur.x,
              dz = p.z - cur.z;
            const d = Math.hypot(dx, dz);
            if (d < STEP * 0.5 || d > R) continue;
            dirv.set(dx / d, dz / d);
            if (dirv.dot(heading2) < coneCos) continue;
            cx += p.x;
            cy += p.y;
            cz += p.z;
            cn++;
          }
        };
        gather(cone);
        if (cn === 0) {
          // élargit le cône dans les virages serrés
          cone = Math.cos(THREE.MathUtils.degToRad(115));
          gather(cone);
        }
        if (cn === 0) break; // bout du chemin
        const next = new THREE.Vector3(cx / cn, cy / cn, cz / cn);
        const nd = new THREE.Vector2(next.x - cur.x, next.z - cur.z);
        if (nd.length() < STEP * 0.3) break;
        nd.normalize();
        heading2.lerp(nd, 0.6).normalize();
        cur = next;
        samples.push(cur.clone());
        if (
          Math.hypot(cur.x - endPt.x, cur.z - endPt.z) <
          STEP * 0.8
        )
          break;
      }
      samples.push(endPt.clone());
    }
    // garde-fou
    if (samples.length < 2) {
      const c = roadBox.getCenter(new THREE.Vector3());
      samples.length = 0;
      samples.push(
        c.clone().add(new THREE.Vector3(-10, 0, 0)),
        c.clone().add(new THREE.Vector3(10, 0, 0))
      );
    }

    // sens de parcours (l'extraction part de pmin ; on renverse si besoin)
    if (FLIP_DIR) samples.reverse();

    // Prolonge un peu les deux bouts le long de la tangente terminale :
    // départ pile à l'entrée de la forêt, sortie un poil après et alignée.
    if (samples.length >= 2) {
      const a0 = samples[0],
        a1 = samples[1];
      const d0 = a0.clone().sub(a1);
      const l0 = d0.length() || 1;
      samples.unshift(a0.clone().addScaledVector(d0.multiplyScalar(1 / l0), l0 * START_EXTEND));
      const b0 = samples[samples.length - 1],
        b1 = samples[samples.length - 2];
      const db = b0.clone().sub(b1);
      const lb = db.length() || 1;
      samples.push(b0.clone().addScaledVector(db.multiplyScalar(1 / lb), lb * END_EXTEND));
    }

    const curve = new THREE.CatmullRomCurve3(
      samples,
      false,
      "catmullrom",
      0.5
    );

    const fullBox = new THREE.Box3(
      new THREE.Vector3(
        (box.min.x + offset.x) * s,
        (box.min.y + offset.y) * s,
        (box.min.z + offset.z) * s
      ),
      new THREE.Vector3(
        (box.max.x + offset.x) * s,
        (box.max.y + offset.y) * s,
        (box.max.z + offset.z) * s
      )
    );

    return { group, curve, samples, roadBox, fullBox };
  }, [scene]);
}

/* ── Modèle (+ rapport debug) ────────────────────────────────────────── */
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
      `centerline ${layout.samples.length} pts · start[${f(
        layout.samples[0]
      )}] end[${f(layout.samples[layout.samples.length - 1])}]`
    );
  }, [layout, onReport]);
  return <primitive object={layout.group} />;
}

/* ── Rig caméra : suit la centerline du chemin selon le scroll ───────── */
function CameraRig({
  layout,
  progress,
  previewT,
}: {
  layout: Layout;
  progress: React.MutableRefObject<number>;
  previewT: number | null;
}) {
  const pos = useRef(new THREE.Vector3());
  const base = useRef(new THREE.Vector3());
  const tan = useRef(new THREE.Vector3());
  const look = useRef(new THREE.Vector3());
  const first = useRef(true);

  useFrame((state, dt) => {
    const raw = previewT ?? progress.current;
    const p = THREE.MathUtils.clamp(raw, 0, 1);
    const t = THREE.MathUtils.lerp(START_INSET, 1 - END_INSET, p);
    layout.curve.getPoint(t, base.current);
    layout.curve.getTangent(t, tan.current); // direction de marche
    pos.current.copy(base.current);
    pos.current.y += EYE_HEIGHT;
    // vise DEVANT le long de la tangente (jamais dégénéré, même en fin de course)
    look.current.copy(base.current).addScaledVector(tan.current, LOOK_DIST);
    look.current.y += EYE_HEIGHT - LOOK_DROP;

    const bob = Math.sin(state.clock.elapsedTime * 0.6) * 0.1;
    const k = previewT != null || first.current ? 1 : 1 - Math.pow(0.001, dt);
    first.current = false;
    const desired = pos.current.clone();
    desired.y += bob;
    state.camera.position.lerp(desired, k);
    state.camera.lookAt(look.current);
  });

  return null;
}

/* ── Lumière & atmosphère ────────────────────────────────────────────── */
function Atmosphere({ debug }: { debug: boolean }) {
  return (
    <>
      {/* lumière de jour / golden hour, comme les réfs Départ/Arrivée */}
      <hemisphereLight args={["#dCEBFF", "#5a5036", debug ? 2.6 : 1.5]} />
      <ambientLight intensity={debug ? 1.5 : 0.5} />
      <directionalLight
        position={[30, 50, 18]}
        intensity={2.6}
        color="#ffe7bd"
      />
      <directionalLight position={[-20, 24, -24]} intensity={0.6} color="#bcd0ff" />
      {!debug && <fog attach="fog" args={["#b3bccb", 80, 300]} />}
    </>
  );
}

/* ── Lecture position caméra (debug) ─────────────────────────────────── */
function DebugReadout() {
  const { camera } = useThree();
  const [, force] = useState(0);
  useFrame(() => force((n) => (n + 1) % 1000));
  useEffect(() => {
    const el = document.getElementById("dbg");
    const p = camera.position;
    if (el)
      el.textContent = `eye [${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}]`;
  });
  return null;
}

/* ── Debug : surligne les meshes de route pour tracer le chemin ──────── */
function RoadHighlight({ group }: { group: THREE.Group }) {
  useEffect(() => {
    const touched: { m: THREE.MeshStandardMaterial; e: THREE.Color; i: number }[] = [];
    group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = m.material as THREE.MeshStandardMaterial;
      const name = `${o.name} ${mat?.name ?? ""}`;
      if (mat && ROAD_RE.test(name)) {
        touched.push({ m: mat, e: mat.emissive.clone(), i: mat.emissiveIntensity });
        mat.emissive = new THREE.Color("#00e5ff");
        mat.emissiveIntensity = 1.4;
      }
    });
    return () => {
      touched.forEach(({ m, e, i }) => {
        m.emissive = e;
        m.emissiveIntensity = i;
      });
    };
  }, [group]);
  return null;
}

/* ── Scène : layout + orchestration (prod / debug) ───────────────────── */
function Scene({
  debug,
  progress,
  previewT,
  onReport,
}: {
  debug: boolean;
  progress: React.MutableRefObject<number>;
  previewT: number | null;
  onReport?: (s: string) => void;
}) {
  const layout = useForestLayout();
  return (
    <>
      <Forest layout={layout} onReport={onReport} />
      {debug ? (
        <>
          <RoadHighlight group={layout.group} />
          <OrbitControls makeDefault target={[0, 0, 0]} />
          <axesHelper args={[80]} />
          <box3Helper args={[layout.fullBox, new THREE.Color("#9d5bff")]} />
          <box3Helper args={[layout.roadBox, new THREE.Color("#3ddc97")]} />
          <Line points={layout.samples} color="#5cf2a6" lineWidth={3} />
          {/* orientation : +X rouge, +Z bleu (pour transcrire le Chemin) */}
          <mesh position={[55, 30, 0]}>
            <sphereGeometry args={[5, 16, 16]} />
            <meshBasicMaterial color="#ff3b3b" depthTest={false} />
          </mesh>
          <mesh position={[0, 30, 55]}>
            <sphereGeometry args={[5, 16, 16]} />
            <meshBasicMaterial color="#3b6bff" depthTest={false} />
          </mesh>
          {layout.samples.map((p, i) => (
            <mesh key={i} position={p}>
              <sphereGeometry args={[i === 0 ? 3 : 1.6, 12, 12]} />
              <meshBasicMaterial
                color={i === 0 ? "#5cf2a6" : i === layout.samples.length - 1 ? "#ff6b6b" : "#9d5bff"}
                depthTest={false}
              />
            </mesh>
          ))}
        </>
      ) : (
        <CameraRig layout={layout} progress={progress} previewT={previewT} />
      )}
    </>
  );
}

/* ════════════════════════════════════════════════════════════════════
   OVERLAY ÉDUCATIF — 10 bulles : ce qu'est une option + comment marche Iris
   ════════════════════════════════════════════════════════════════════ */
type Step =
  | { kind: "intro" }
  | { kind: "cta" }
  | {
      kind: "bubble";
      n: string;
      title: string;
      body: string;
      star?: boolean;
    };

const STEPS: Step[] = [
  { kind: "intro" },
  {
    kind: "bubble",
    n: "01",
    title: "What's an option?",
    body: "A contract that gives you the right — not the obligation — to buy or sell an asset at a price fixed in advance, before a set date.",
  },
  {
    kind: "bubble",
    n: "02",
    title: "The premium",
    body: "Whoever sells that right gets paid upfront: the premium. It's like insurance — you collect today to cover someone tomorrow.",
  },
  {
    kind: "bubble",
    n: "03",
    title: "Call or Put",
    body: "A call is the right to buy (betting on the upside). A put is the right to sell (protecting against a drop). Two tools, one mechanic.",
  },
  {
    kind: "bubble",
    n: "04",
    title: "Why it feels scary",
    body: "On most platforms: leverage, margin calls, liquidations. An option can end up costing you far more than you put in.",
  },
  {
    kind: "bubble",
    n: "05",
    title: "The Iris approach",
    body: "A single leg, fully collateralised. Zero margin, zero liquidation. The worst case is known and capped from the very start.",
  },
  {
    kind: "bubble",
    n: "06",
    star: true,
    title: "Cash-Secured Put",
    body: "Deposit USDC and earn a steady yield. Worst case: you buy the asset cheaper than it is today. Our flagship product.",
  },
  {
    kind: "bubble",
    n: "07",
    title: "Covered Call",
    body: "Already hold an asset? Earn a bonus by agreeing to sell it a little higher. Think of it as rent on what you already own.",
  },
  {
    kind: "bubble",
    n: "08",
    title: "Buy Call",
    body: "Bet on the upside. Your risk is capped at the premium you pay — never a cent more, whatever happens.",
  },
  {
    kind: "bubble",
    n: "09",
    title: "Cross-chain, frictionless",
    body: "Deposit any token, from any chain. It lands as USDC on Derive, ready to work. You never touch the plumbing.",
  },
  {
    kind: "bubble",
    n: "10",
    title: "Under the hood",
    body: "Your orders are matched on Derive's permissionless orderbook, then settled on-chain. Fully transparent and verifiable.",
  },
  { kind: "cta" },
];

function Overlay() {
  return (
    <div className="fl-overlay">
      {STEPS.map((step, i) => {
        if (step.kind === "intro")
          return (
            <section key={i} className="fl-step fl-intro">
              <img src="/iris_turquoise_contour_decoupe.svg" alt="Iris" className="fl-intro-iris" />
              <h1 className="fl-title">
                <span className="grad">Iris</span>
              </h1>
              <p className="fl-lede">Options, explained simply.</p>
              <p className="fl-hint">scroll to walk the path ↓</p>
            </section>
          );
        if (step.kind === "cta")
          return (
            <section key={i} className="fl-step fl-cta">
              <img src="/iris_turquoise_contour_decoupe.svg" alt="" className="fl-cta-iris" />
              <h2 className="fl-cta-title">
                Ready to put your <span className="grad">capital to work</span>?
              </h2>
              <p className="fl-lede">
                Single-leg, fully collateralised. No margin, no liquidations.
              </p>
              <div className="fl-actions">
                <Link href="/docs" className="btn ghost lg">Docs</Link>
                <Link href="/learn" className="btn ghost lg">Learn</Link>
                <Link href="/app" className="btn lg">Launch app →</Link>
              </div>
              <p className="fl-foot">
                Built on Derive · ETHGlobal NYC · fully-collateralised single-leg options
              </p>
            </section>
          );
        return (
          <section
            key={i}
            className={`fl-bubble ${parseInt(step.n, 10) % 2 ? "right" : "left"}`}
          >
            <div className="fl-sticky">
              <div className="fl-card">
                <span className="fl-tag">
                  <span className="fl-num">{step.n}</span>
                  {step.star && <span className="fl-star">★ flagship</span>}
                </span>
                <h3 className="fl-card-title">{step.title}</h3>
                <p className="fl-card-body">{step.body}</p>
              </div>
            </div>
          </section>
        );
      })}
    </div>
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
      <img src="/iris_turquoise_contour_decoupe.svg" alt="Iris" className="fl-loader-iris" />
      <div className="fl-loader-bar">
        <span style={{ width: `${progress}%` }} />
      </div>
      <span className="fl-loader-pct">{Math.round(progress)}%</span>
    </div>
  );
}

/* ── Racine ──────────────────────────────────────────────────────────── */
export default function ForestExperience() {
  const [debug, setDebug] = useState(false);
  const [previewT, setPreviewT] = useState<number | null>(null);
  const [report, setReport] = useState("");
  const progress = useRef(0);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setDebug(q.has("debug"));
    const p = q.get("preview");
    setPreviewT(p != null ? Math.max(0, Math.min(1, parseFloat(p))) : null);

    const onScroll = () => {
      const max = document.body.scrollHeight - window.innerHeight;
      progress.current = max > 0 ? window.scrollY / max : 0;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    // debug : ?scroll=<0..1> scrolle réellement la page (vérifie bulles + caméra)
    const sc = q.get("scroll");
    if (sc != null) {
      const frac = Math.max(0, Math.min(1, parseFloat(sc)));
      setTimeout(() => {
        const max = document.body.scrollHeight - window.innerHeight;
        window.scrollTo(0, frac * max);
      }, 900);
    }
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const showReport = debug || previewT != null;

  return (
    <div className="fl-page" style={debug ? { height: "100vh", overflow: "hidden" } : undefined}>
      <div className="fl-bg" />
      <div className="fl-vignette" />
      <div className={`fl-canvas-wrap ${debug ? "interactive" : ""}`}>
        <Canvas
          dpr={[1, 1.6]}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          camera={{
            fov: 52,
            near: 0.1,
            far: 600,
            position: debug ? [0, 190, 0.1] : [0, 5, 30],
          }}
        >
          <Atmosphere debug={debug} />
          <Suspense fallback={null}>
            <Scene
              debug={debug}
              progress={progress}
              previewT={previewT}
              onReport={setReport}
            />
            <Preload all />
          </Suspense>
          {debug && <DebugReadout />}
          <AdaptiveDpr pixelated />
        </Canvas>
      </div>

      {!debug && <Overlay />}

      {debug && <div id="dbg" className="fl-dbg">eye …</div>}
      {showReport && report && (
        <div
          style={{
            position: "fixed",
            top: 8,
            left: 8,
            right: 8,
            zIndex: 30,
            fontFamily: "monospace",
            fontSize: 20,
            color: "#5cf2a6",
            background: "rgba(0,0,0,0.85)",
            padding: "6px 10px",
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
