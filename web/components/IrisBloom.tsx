/**
 * The fill success moment: an iris flower that blooms open with a spectral
 * ripple. Rendered when a trade fills. Violet petals + golden "beard" center.
 */
export function IrisBloom() {
  const petals = [0, 60, 120, 180, 240, 300];
  return (
    <div className="iris-bloom" aria-hidden="true">
      <svg viewBox="0 0 100 100">
        <circle className="ripple" cx="50" cy="50" r="22" fill="none" stroke="var(--color-accent)" strokeWidth="2" />
        {petals.map((deg) => (
          <ellipse
            key={deg}
            cx="50"
            cy="28"
            rx="9"
            ry="20"
            fill="var(--color-accent)"
            opacity="0.9"
            transform={`rotate(${deg} 50 50)`}
          />
        ))}
        {petals.map((deg) => (
          <ellipse
            key={`i-${deg}`}
            cx="50"
            cy="36"
            rx="4.5"
            ry="11"
            fill="var(--color-spec-magenta)"
            transform={`rotate(${deg + 30} 50 50)`}
          />
        ))}
        <circle cx="50" cy="50" r="7" fill="var(--color-gold)" />
      </svg>
    </div>
  );
}
