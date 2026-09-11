"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

const nav = [
  { href: "/atlas", label: "Atlas" },
  { href: "/joints", label: "Joints" },
  { href: "/templates", label: "Templates" },
  { href: "/design", label: "Design Lab" },
  { href: "/studio", label: "Studio" },
  { href: "/calculator", label: "Calculator" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

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
        <div className="hidden items-center gap-2 md:flex">
          <nav className="flex items-center gap-1 text-sm">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={`rounded-md px-3 py-2 font-medium transition hover:bg-bamboo-100 hover:text-leaf-700 ${
                  isActive(item.href)
                    ? "bg-bamboo-100 text-leaf-800"
                    : "text-bamboo-800"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2 border-l border-bamboo-200 pl-2 text-sm">
            {!loading &&
              (user ? (
                <>
                  <Link
                    href="/account"
                    aria-current={isActive("/account") ? "page" : undefined}
                    className={`rounded-md px-3 py-2 font-medium transition hover:bg-bamboo-100 hover:text-leaf-700 ${
                      isActive("/account") ? "bg-bamboo-100 text-leaf-800" : "text-bamboo-800"
                    }`}
                  >
                    My designs
                  </Link>
                  <button
                    onClick={logout}
                    title={`Signed in as ${user.email}`}
                    className="rounded-md border border-bamboo-300 bg-white px-3 py-2 font-medium text-bamboo-800 transition hover:bg-bamboo-100"
                  >
                    Log out
                  </button>
                </>
              ) : (
                <Link
                  href="/account"
                  className="rounded-md bg-leaf-600 px-3 py-2 font-semibold text-white transition hover:bg-leaf-700"
                >
                  Log in
                </Link>
              ))}
          </div>
        </div>

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
              aria-current={isActive(item.href) ? "page" : undefined}
              className={`block rounded-md px-3 py-2.5 font-medium transition hover:bg-bamboo-100 hover:text-leaf-700 ${
                isActive(item.href) ? "bg-bamboo-100 text-leaf-800" : "text-bamboo-800"
              }`}
            >
              {item.label}
            </Link>
          ))}
          <div className="mt-1 border-t border-bamboo-200 pt-1">
            {!loading &&
              (user ? (
                <>
                  <Link
                    href="/account"
                    onClick={() => setOpen(false)}
                    className="block rounded-md px-3 py-2.5 font-medium text-bamboo-800 hover:bg-bamboo-100 hover:text-leaf-700"
                  >
                    My designs
                  </Link>
                  <button
                    onClick={() => {
                      logout();
                      setOpen(false);
                    }}
                    className="block w-full rounded-md px-3 py-2.5 text-left font-medium text-bamboo-800 hover:bg-bamboo-100"
                  >
                    Log out ({user.email})
                  </button>
                </>
              ) : (
                <Link
                  href="/account"
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-3 py-2.5 font-medium text-leaf-700 hover:bg-bamboo-100"
                >
                  Log in
                </Link>
              ))}
          </div>
        </nav>
      )}
    </header>
  );
}
