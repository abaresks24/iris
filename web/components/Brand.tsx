"use client";

import { useState } from "react";
import Link from "next/link";

const LOGO = "/iris_turquoise_contour_decoupe.svg";

/** Iris wordmark: logo (with dot fallback) + name. Links home by default. */
export function Brand({
  href = "/",
  subtitle = "options, anywhere",
}: {
  href?: string;
  subtitle?: string;
}) {
  const [logoOk, setLogoOk] = useState(true);
  return (
    <Link href={href} className="brand" style={{ color: "inherit" }}>
      {logoOk ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={LOGO} alt="Iris" className="brand-logo" onError={() => setLogoOk(false)} />
      ) : (
        <span className="dot" />
      )}
      <span>
        Iris {subtitle && <span className="muted">· {subtitle}</span>}
      </span>
    </Link>
  );
}
