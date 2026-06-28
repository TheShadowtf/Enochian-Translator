import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Enochian Translator — Dee & Kelley Angelic Script",
  description:
    "Bidirectional English<->Enochian translator with traditional Dee-Kelley SVG glyphs, dictionary lookup, and phonetic fallback transliteration based on Donald Laycock's Complete Enochian Dictionary and the 48 Angelic Calls.",
  keywords: [
    "Enochian",
    "John Dee",
    "Edward Kelley",
    "Angelic Calls",
    "Laycock",
    "occult",
    "translator",
    "SVG glyphs",
  ],
  authors: [{ name: "Enochian Translator" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Cormorant Garamond for display headings; Enochian glyphs are
            rendered as inline SVG (no special font required). */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;700&family=Cormorant+Garamond:wght@400;500;600;700&display=swap"
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
