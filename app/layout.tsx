import type { Metadata } from "next";
import { Barlow_Condensed, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteFooter } from "./components/site-footer";
import { SiteNav } from "./components/site-nav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-nameplate",
  subsets: ["latin"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  title: "Outlaw Hockey League",
  description: "Stats, schedule, payments, and videos for the Outlaw Hockey League.",
  metadataBase: new URL("https://outlawhl.com"),
  openGraph: {
    title: "Outlaw Hockey League",
    description: "Stats, schedule, payments, and videos for the Outlaw Hockey League.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Outlaw Hockey League",
    description: "Stats, schedule, payments, and videos for the Outlaw Hockey League.",
  },
  icons: {
    icon: "/ohl_logo_letters.png",
    apple: "/ohl_logo_2.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${barlowCondensed.variable} h-full antialiased`}
    >
      <body className="min-h-full text-neutral-900">
        <SiteNav />
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12 md:px-8">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
