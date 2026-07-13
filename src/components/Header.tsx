"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "לוח בקרה" },
  { href: "/listings", label: "מודעות" },
  { href: "/compare", label: "השוואה" },
  { href: "/profile", label: "פרופיל" },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link href="/" className="brand">
          <span className="brand__mark">⌂</span>
          HomeScout
        </Link>
        <nav className="site-nav">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              data-active={pathname === item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
