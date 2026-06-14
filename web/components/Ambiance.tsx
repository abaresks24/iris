"use client";

/**
 * Forest ambiance layer for the app: drifting canopy light (fog) + rising
 * fireflies/pollen + an understory vignette. Purely decorative, fixed behind
 * all content (z-index -1), never intercepts clicks. CSS-driven.
 */

// Deterministic spread (no random → stable across renders/SSR).
const FIREFLIES = Array.from({ length: 24 }, (_, i) => {
  const colors = ["var(--color-accent)", "var(--color-gold)", "var(--color-accent-2)"];
  return {
    left: (i * 41) % 100, // %
    size: 2 + (i % 3), // px
    dur: 15 + (i % 8) * 2, // s
    delay: -(i * 1.6), // s (negative → already mid-flight)
    color: colors[i % 3],
    x: ((i % 5) - 2) * 16, // px horizontal drift
    max: 0.45 + (i % 4) * 0.12, // peak opacity
  };
});

export function Ambiance() {
  return (
    <div className="ambiance" aria-hidden="true">
      <div className="fog" />
      {FIREFLIES.map((f, i) => (
        <span
          key={i}
          className="firefly"
          style={{
            left: `${f.left}%`,
            width: f.size,
            height: f.size,
            background: f.color,
            boxShadow: `0 0 ${f.size * 3}px ${f.color}`,
            animationDuration: `${f.dur}s`,
            animationDelay: `${f.delay}s`,
            // custom props consumed by the floatUp keyframes
            ["--ff-x" as string]: `${f.x}px`,
            ["--ff-max" as string]: f.max,
          } as React.CSSProperties}
        />
      ))}
      <div className="vignette" />
    </div>
  );
}
