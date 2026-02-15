import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://until.gg";

export const metadata: Metadata = {
  title: {
    default: "UNTIL — Skill-based quiz. Pay per question. Stop when it's optimal.",
    template: "%s | UNTIL",
  },
  description:
    "Skill-based quiz on Stacks. Pay per question in STX, earn by answering correctly and quickly, and win by stopping at the right moment. Not gambling — optimal stopping.",
  keywords: [
    "UNTIL",
    "quiz",
    "Stacks",
    "STX",
    "skill-based",
    "optimal stopping",
    "pay per question",
    "blockchain",
    "x402",
  ],
  authors: [{ name: "UNTIL" }],
  creator: "UNTIL",
  metadataBase: new URL(siteUrl),
  openGraph: {
    type: "website",
    locale: "en",
    url: siteUrl,
    siteName: "UNTIL",
    title: "UNTIL — Skill-based quiz. Pay per question. Stop when it's optimal.",
    description:
      "Skill-based quiz on Stacks. Pay per question in STX, earn by answering correctly and quickly, and win by stopping at the right moment.",
    images: [{ url: "/logo.png", width: 512, height: 512, alt: "UNTIL" }],
  },
  twitter: {
    card: "summary",
    title: "UNTIL — Skill-based quiz. Pay per question. Stop when it's optimal.",
    description:
      "Skill-based quiz on Stacks. Pay per question in STX. Win by stopping at the right moment.",
    images: ["/logo.png"],
  },
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={montserrat.variable}>
      <body className={`${montserrat.className} h-screen overflow-hidden`}>
        {children}
      </body>
    </html>
  );
}
