"use client";

import { useState } from "react";
import Link from "next/link";

const nav = [
  { href: "/atlas", label: "Atlas" },
  { href: "/joints", label: "Joints" },
  { href: "/templates", label: "Templates" },
  { href: "/studio", label: "Design Studio" },
  { href: "/calculator", label: "Calculator" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-bamboo-200 bg-bamboo-50/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
        <Link href="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
          <span className="text-2xl" aria-hidden>🎋</span>
          <span className="font-display text-xl font-semibold text-leaf-800">
            Kawayan Atlas
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 text-sm md:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 font-medium text-bamboo-800 transition hover:bg-bamboo-100 hover:text-leaf-700"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Mobile toggle */}
        <button
          type="button"
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="rounded-md p-2 text-bamboo-800 hover:bg-bamboo-100 md:hidden"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {open ? (
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <nav className="border-t border-bamboo-200 bg-bamboo-50 px-5 py-2 md:hidden">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-2.5 font-medium text-bamboo-800 transition hover:bg-bamboo-100 hover:text-leaf-700"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
