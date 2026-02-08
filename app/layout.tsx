import type { Metadata } from "next";
import { Inter, Manrope, Geist } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Analyze Any Font - Extract Fonts from Any Website",
  description: "Discover and analyze fonts from any website. Just enter a URL and get instant access to all the fonts used.",
  openGraph: {
    title: "Analyze Any Font",
    description: "Extract and analyze fonts from any website instantly.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Analyze Any Font OG Image",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Analyze Any Font",
    description: "Extract and analyze fonts from any website instantly.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${manrope.variable} ${geist.variable} font-sans antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
