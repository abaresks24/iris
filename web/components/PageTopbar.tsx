import Link from "next/link";
import { Brand } from "./Brand";

/** Simple topbar for the static content pages (docs, learn). */
export function PageTopbar({ active }: { active?: "docs" | "learn" }) {
  return (
    <div className="doc-topbar">
      <Brand />
      <div className="flex">
        <Link
          href="/docs"
          className="appnav-link"
          style={active === "docs" ? { color: "var(--text)" } : undefined}
        >
          Docs
        </Link>
        <Link
          href="/learn"
          className="appnav-link"
          style={active === "learn" ? { color: "var(--text)" } : undefined}
        >
          Learn
        </Link>
        <Link href="/app" className="btn">
          Launch app →
        </Link>
      </div>
    </div>
  );
}
