import Image from "next/image";
import Link from "next/link";

const leagueLinks = [
  { href: "/", label: "Home" },
  { href: "/schedule", label: "Schedule" },
  { href: "/stats", label: "Stats" },
  { href: "/players", label: "Players" },
  { href: "/teams", label: "Teams" },
  { href: "/playoffs", label: "Playoffs" },
  { href: "/draft", label: "Draft" },
  { href: "/payments", label: "Donate" },
];

export function SiteFooter() {
  return (
    <footer className="mx-auto mt-16 w-full max-w-6xl border-t border-black/10 px-6 py-10 md:px-8">
      <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-3">
          <Image
            src="/ohl_logo_letters.png"
            alt="Outlaw Hockey League"
            width={178}
            height={64}
            sizes="(min-width: 768px) 320px, 342px"
            className="h-8 w-auto object-contain"
          />
          <p className="max-w-xs text-sm text-neutral-500">
            Beer league hockey, taken exactly seriously enough.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-10 sm:gap-16">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">League</p>
            <ul className="mt-4 space-y-2.5">
              {leagueLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-neutral-600 transition hover:text-neutral-900">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">More</p>
            <ul className="mt-4 space-y-2.5">
              <li>
                <a
                  href="https://www.youtube.com/@outlawhockeyleague9642"
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-neutral-600 transition hover:text-neutral-900"
                >
                  Watch on YouTube
                </a>
              </li>
              <li>
                <Link href="/admin" className="text-sm text-neutral-600 transition hover:text-neutral-900">
                  Admin
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="mt-10 border-t border-black/10 pt-5 text-xs text-neutral-500">
        <p>Outlaw Hockey League · Est. 2022</p>
      </div>
    </footer>
  );
}
