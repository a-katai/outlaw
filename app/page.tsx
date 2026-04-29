import Image from "next/image";
import Link from "next/link";

const LOGO = "/ohl_logo_2.png";

export default function Home() {
  return (
    <section className="space-y-6 px-4 py-8">
      <div className="glass-card flex min-h-[calc(100vh-24rem)] w-full flex-col items-center justify-center rounded-3xl px-6 py-10 md:min-h-[calc(100vh-18rem)] md:px-12 md:py-16">
        <Image src={LOGO} alt="Outlaw Hockey League" width={560} height={280} className="h-auto w-full max-w-md object-contain" priority />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        <Link href="/stats" className="glass-card lift rounded-2xl p-4 text-center text-sm font-semibold text-neutral-900">
          Stats
        </Link>
        <Link href="/schedule" className="glass-card lift rounded-2xl p-4 text-center text-sm font-semibold text-neutral-900">
          Schedule
        </Link>
        <Link href="/payments" className="glass-card lift rounded-2xl p-4 text-center text-sm font-semibold text-neutral-900">
          Payments
        </Link>
        <Link href="/videos" className="glass-card lift rounded-2xl p-4 text-center text-sm font-semibold text-neutral-900">
          Videos
        </Link>
      </div>
    </section>
  );
}
