"use client";

// src/components/SiteNav.tsx
// Global top navigation, rendered on every page from the root layout. Logo
// (links home) on the left; primary links on the right. On narrow screens the
// links collapse behind a hamburger toggle. Active route is marked with
// aria-current and a sky underline. Palette matches SiteFooter (sky on white).
//
// The Admin link is shown to everyone: /admin and /api/admin/* are gated by
// middleware, so a non-admin who taps it is redirected to /signin.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/Logo";

const NAV_LINKS: { href: string; label: string }[] = [
  { href: "/coach", label: "Coach" },
  { href: "/guide", label: "Guide" },
  { href: "/sources", label: "Sources" },
  { href: "/walkthrough", label: "Walkthrough" },
  { href: "/admin", label: "Admin" },
];

const linkBase =
  "inline-flex items-center min-h-9 px-2 rounded text-gray-600 hover:text-sky-700 hover:underline transition-colors focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600";

/** True when `href` matches the current path (exact, or a section prefix). */
function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function SiteNav() {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur">
      <nav
        aria-label="Primary"
        className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-6 py-2"
      >
        <Logo className="h-8 w-auto" />

        {/* Desktop links */}
        <ul className="hidden items-center gap-1 text-sm sm:flex">
          {NAV_LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={isActive(pathname, l.href) ? "page" : undefined}
                className={
                  linkBase +
                  (isActive(pathname, l.href)
                    ? " text-sky-700 underline underline-offset-4"
                    : "")
                }
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Mobile toggle */}
        <button
          type="button"
          aria-label="Toggle navigation menu"
          aria-expanded={open}
          aria-controls="site-nav-mobile"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-9 w-9 items-center justify-center rounded border border-gray-300 text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 sm:hidden"
        >
          <span aria-hidden="true" className="text-lg leading-none">
            {open ? "✕" : "☰"}
          </span>
        </button>
      </nav>

      {/* Mobile panel */}
      {open && (
        <ul
          id="site-nav-mobile"
          className="border-t border-gray-100 bg-white px-6 py-2 text-sm sm:hidden"
        >
          {NAV_LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                onClick={() => setOpen(false)}
                aria-current={isActive(pathname, l.href) ? "page" : undefined}
                className={
                  "block py-2 " +
                  (isActive(pathname, l.href)
                    ? "font-medium text-sky-700"
                    : "text-gray-700 hover:text-sky-700")
                }
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </header>
  );
}
