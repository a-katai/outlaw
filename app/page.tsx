import Image from "next/image";

const LOGO = "/ohl_logo_2.png";

export default function Home() {
  return (
    <section className="space-y-6 px-4 py-8">
      <div className="flex min-h-[calc(100vh-24rem)] w-full flex-col items-center justify-center px-6 py-10 md:min-h-[calc(100vh-18rem)] md:px-12 md:py-16">
        <Image src={LOGO} alt="Outlaw Hockey League" width={560} height={280} className="h-auto w-full max-w-md object-contain" priority />
      </div>
    </section>
  );
}
