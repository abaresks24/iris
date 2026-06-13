"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "./Brand";
import { ConnectButton } from "./ConnectButton";

const LINKS = [
  { href: "/app/trade", label: "Trade" },
  { href: "/app/portfolio", label: "Portfolio" },
  { href: "/app/history", label: "History" },
  { href: "/app/leaderboard", label: "Leaderboard" },
];

export function AppNav() {
  const pathname = usePathname();
  return (
    <nav className="appnav">
      <Brand subtitle="" />
      <div className="appnav-links">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`appnav-link ${pathname?.startsWith(l.href) ? "active" : ""}`}
          >
            {l.label}
          </Link>
        ))}
      </div>
      <ConnectButton />
    </nav>
  );
}
