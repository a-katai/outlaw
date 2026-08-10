import Image from "next/image";
import Link from "next/link";

const columns = [
  {
    label: "League",
    links: [
      { href: "/schedule", label: "Schedule" },
      { href: "/teams", label: "Teams" },
      { href: "/stats", label: "Stats" },
      { href: "/players", label: "Players" },
      { href: "/playoffs", label: "Playoffs" },
    ],
  },
  {
    label: "Watch",
    links: [
      { href: "/videos", label: "Video" },
      { href: "https://www.youtube.com/@outlawhockeyleague9642", label: "YouTube", external: true },
    ],
  },
  {
    label: "League office",
    links: [
      { href: "/draft", label: "Draft" },
      { href: "/payments", label: "Dues" },
      { href: "/admin", label: "Admin" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mx-auto mt-20 w-full max-w-6xl px-6 pb-10 md:px-8">
      <div className="border-t border-black/10 pt-10">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="max-w-xs">
            <Image
              src="/ohl_logo_letters.png"
              alt="Outlaw Hockey League"
              width={178}
              height={64}
              sizes="120px"
              className="h-7 w-auto object-contain"
            />
            <p className="mt-3 text-sm leading-relaxed text-neutral-500">
              Beer league hockey, taken exactly seriously enough.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-8 sm:gap-14">
            {columns.map((col) => (
              <div key={col.label}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">{col.label}</p>
                <ul className="mt-3.5 space-y-2">
                  {col.links.map((link) =>
                    "external" in link && link.external ? (
                      <li key={link.href}>
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-neutral-600 transition hover:text-neutral-900"
                        >
                          {link.label}
                        </a>
                      </li>
                    ) : (
                      <li key={link.href}>
                        <Link href={link.href} className="text-sm text-neutral-600 transition hover:text-neutral-900">
                          {link.label}
                        </Link>
                      </li>
                    ),
                  )}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex items-center justify-between border-t border-black/[0.07] pt-5 text-xs text-neutral-400">
          <p>Outlaw Hockey League · Est. 2022</p>
          <p>Wednesdays at DSC</p>
        </div>
      </div>
    </footer>
  );
}
