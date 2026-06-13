import type { Metadata } from "next";

export const metadata: Metadata = { title: "Iris — Style guide" };

function Swatch({ name, value, varName }: { name: string; value: string; varName: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div
        style={{
          height: 64,
          borderRadius: "var(--radius-sm)",
          background: value,
          border: "1px solid var(--color-hairline)",
        }}
      />
      <div style={{ fontSize: 13 }}>{name}</div>
      <div className="numeric" style={{ fontSize: 11, color: "var(--color-muted)" }}>{varName}</div>
    </div>
  );
}

export default function StyleGuide() {
  return (
    <main style={{ background: "var(--color-ink)", minHeight: "100vh", color: "var(--color-bone)" }}>
      <div style={{ maxWidth: 980, margin: "0 auto", padding: "48px 24px 120px" }}>
        <p className="numeric" style={{ color: "var(--color-muted)", fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase" }}>
          Iris design system
        </p>
        <h1 className="display text-spectrum" style={{ margin: "8px 0 8px" }}>Refraction, not decoration</h1>
        <p className="muted" style={{ maxWidth: 560 }}>
          An achromatic canvas of ink, bone and graphite. Colour appears only by
          refraction — one spectrum gradient, reserved for flow, focus and activity.
        </p>

        {/* ── Spectrum bar ── */}
        <section style={{ marginTop: 48 }}>
          <h2 className="h2">The spectrum</h2>
          <div style={{ height: 56, borderRadius: "var(--radius)", background: "var(--spectrum)", marginTop: 12 }} />
        </section>

        {/* ── Swatches ── */}
        <section style={{ marginTop: 48 }}>
          <h2 className="h2" style={{ marginBottom: 16 }}>Surfaces & text</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 16 }}>
            <Swatch name="Ink (base)" value="var(--color-ink)" varName="--color-ink" />
            <Swatch name="Surface" value="var(--color-surface)" varName="--color-surface" />
            <Swatch name="Surface 2" value="var(--color-surface-2)" varName="--color-surface-2" />
            <Swatch name="Bone (text)" value="var(--color-bone)" varName="--color-bone" />
            <Swatch name="Graphite" value="var(--color-graphite)" varName="--color-graphite" />
            <Swatch name="Muted" value="var(--color-muted)" varName="--color-muted" />
            <Swatch name="Hairline" value="var(--color-hairline)" varName="--color-hairline" />
            <Swatch name="Hairline strong" value="var(--color-hairline-strong)" varName="--color-hairline-strong" />
            <Swatch name="Accent (blue)" value="var(--color-accent)" varName="--color-accent" />
            <Swatch name="Accent 2 (yellow)" value="var(--color-accent-2)" varName="--color-accent-2" />
            <Swatch name="Positive (P&L)" value="var(--color-positive)" varName="--color-positive" />
            <Swatch name="Negative (P&L)" value="var(--color-negative)" varName="--color-negative" />
          </div>
        </section>

        {/* ── Typography ── */}
        <section style={{ marginTop: 48 }}>
          <h2 className="h2" style={{ marginBottom: 16 }}>Typography</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, borderTop: "1px solid var(--color-hairline)", paddingTop: 16 }}>
            <div className="display">Display — Geist Sans</div>
            <div className="h1">Heading 1</div>
            <div className="h2">Heading 2</div>
            <div className="h3">Heading 3</div>
            <div className="body-sm muted">Body small — graphite, aéré, pour le texte secondaire et les descriptions.</div>
          </div>
        </section>

        {/* ── Numeric specimen ── */}
        <section style={{ marginTop: 48 }}>
          <h2 className="h2" style={{ marginBottom: 16 }}>Numerics (mono · tabular)</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 }}>
            <div className="panel">
              <div className="numeric" style={{ fontSize: 26 }}>3 200,00</div>
              <div className="muted body-sm">Strike</div>
            </div>
            <div className="panel">
              <div className="numeric" style={{ fontSize: 26 }}>12,4 %</div>
              <div className="muted body-sm">APR</div>
            </div>
            <div className="panel">
              <div className="numeric" style={{ fontSize: 26, color: "var(--color-positive)" }}>+1 284,50</div>
              <div className="muted body-sm">P&amp;L (gain)</div>
            </div>
            <div className="panel">
              <div className="numeric" style={{ fontSize: 26, color: "var(--color-negative)" }}>−312,80</div>
              <div className="muted body-sm">P&amp;L (perte)</div>
            </div>
          </div>
        </section>

        {/* ── Buttons ── */}
        <section style={{ marginTop: 48 }}>
          <h2 className="h2" style={{ marginBottom: 16 }}>Buttons</h2>
          <div className="flex" style={{ gap: 14 }}>
            <button className="btn">Deposit — earn upfront</button>
            <button className="btn ghost">Connect wallet</button>
          </div>
          <p className="muted body-sm" style={{ marginTop: 10 }}>
            Primary = bone fill / ink text, spectral glow on hover. Ghost = hairline border → spectral edge on hover.
          </p>
        </section>

        {/* ── Cards ── */}
        <section style={{ marginTop: 48 }}>
          <h2 className="h2" style={{ marginBottom: 16 }}>Cards</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* static */}
            <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-hairline)", borderRadius: "var(--radius)", padding: 20 }}>
              <div className="h3">Static card</div>
              <p className="muted body-sm" style={{ margin: "6px 0 0" }}>Hairline border. No colour at rest.</p>
              <div className="numeric" style={{ fontSize: 30, marginTop: 14 }}>1 677,30</div>
            </div>
            {/* active */}
            <div className="border-spectrum glow-spectrum" style={{ borderRadius: "var(--radius)", padding: 20 }}>
              <div className="h3">Active card</div>
              <p className="muted body-sm" style={{ margin: "6px 0 0" }}>Spectral edge + subtle glow — flow / selected state.</p>
              <div className="numeric text-spectrum" style={{ fontSize: 30, marginTop: 14 }}>12,4 %</div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
