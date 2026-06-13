import Link from "next/link";

export default function Landing() {
  return (
    <main className="landing">
      <video className="hero-video" autoPlay muted loop playsInline preload="auto">
        <source src="/hero.mp4" type="video/mp4" />
      </video>
      <div className="hero-scrim" />

      <div className="landing-inner">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/iris_turquoise_contour_decoupe.svg"
          alt="Iris"
          className="landing-logo"
        />
        <h1 className="landing-title">
          <span className="grad">Iris</span>
        </h1>
        <p className="landing-tagline">
          Options, anywhere. Deposit any token from any chain and earn yield on
          Derive&apos;s permissionless orderbook — no margin maths, no
          liquidations.
        </p>
        <div className="landing-actions">
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
      </div>

      <div className="landing-foot">
        Built on Derive · ETHGlobal NYC · fully-collateralised single-leg options
      </div>
    </main>
  );
}
