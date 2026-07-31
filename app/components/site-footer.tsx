import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mx-auto mt-6 w-full max-w-6xl px-6 pb-10 md:px-8">
      <div className="flex items-center justify-between border-t border-black/10 pt-5 text-xs text-neutral-500">
        <p>Outlaw Hockey League</p>
        <Link href="/admin" className="transition hover:text-neutral-800">
          Admin
        </Link>
      </div>
    </footer>
  );
}
