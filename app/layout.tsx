import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
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

export const metadata: Metadata = {
  title: "Font Stealer - Extract Fonts from Any Website",
  description: "Discover and download fonts from any website. Just enter a URL and get instant access to all the fonts used.",
  openGraph: {
    title: "Font Stealer",
    description: "Extract and download fonts from any website instantly.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Font Stealer OG Image",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Font Stealer",
    description: "Extract and download fonts from any website instantly.",
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
      <body className={`${inter.variable} ${manrope.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
