"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const LOGO = "/ohl_logo_letters.png";

const menuLinks = [
  { href: "/schedule", label: "Schedule" },
  { href: "/stats", label: "Stats" },
  { href: "/players", label: "Players" },
  { href: "/playoffs", label: "Playoffs" },
  { href: "/draft", label: "Draft" },
  { href: "/videos", label: "Videos" },
  { href: "/payments", label: "Donate" },
];

function AdminPortalButton() {
  return (
    <Link
      href="/admin"
      aria-label="League admin sign in"
      title="League admin"
      className="flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white/80 text-neutral-700 shadow-sm transition hover:bg-white hover:text-neutral-900"
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
        <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
      </svg>
    </Link>
  );
}

export function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onPointer = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
    };
  }, [open, close]);

  return (
    <header className="sticky top-0 z-50 border-b border-black/5 bg-[#f5f5f7]/75 backdrop-blur-2xl">
      <div className="relative mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-8">
        <Link href="/" className="flex shrink-0 items-center py-1" aria-label="Outlaw Hockey League home">
          <Image
            src={LOGO}
            alt="Outlaw Hockey League"
            width={178}
            height={64}
            sizes="(min-width: 768px) 111px, 89px"
            className="h-8 w-auto object-contain md:h-10"
            priority
          />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-7 md:flex">
          {menuLinks.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`text-sm font-medium transition ${
                  active ? "text-neutral-900" : "text-neutral-600 hover:text-neutral-900"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          <AdminPortalButton />
        </nav>

        <div className="relative flex items-center gap-2 md:hidden">
          <AdminPortalButton />
          <button
            ref={buttonRef}
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white/80 text-neutral-900 shadow-sm transition hover:bg-white"
            aria-expanded={open}
            aria-controls="site-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="sr-only">Menu</span>
            <span className="relative block h-5 w-5 shrink-0" aria-hidden>
              <span
                className={`absolute left-0 top-2 h-0.5 w-5 rounded-full bg-neutral-900 transition duration-200 ${
                  open ? "rotate-45" : "-translate-y-2"
                }`}
              />
              <span
                className={`absolute left-0 top-2 h-0.5 w-5 rounded-full bg-neutral-900 transition duration-200 ${
                  open ? "opacity-0" : ""
                }`}
              />
              <span
                className={`absolute left-0 top-2 h-0.5 w-5 rounded-full bg-neutral-900 transition duration-200 ${
                  open ? "-rotate-45" : "translate-y-2"
                }`}
              />
            </span>
          </button>

          {open ? (
            <div
              ref={menuRef}
              id="site-menu"
              role="menu"
              className="absolute right-0 top-[calc(100%+0.5rem)] min-w-[220px] overflow-hidden rounded-2xl border border-black/10 bg-white/95 py-2 shadow-lg backdrop-blur-xl"
            >
              {menuLinks.map((link) => {
                const active = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    role="menuitem"
                    onClick={close}
                    className={`block px-4 py-3 text-sm font-medium transition ${
                      active ? "bg-neutral-100 text-neutral-900" : "text-neutral-700 hover:bg-neutral-50"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
