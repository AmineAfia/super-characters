import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import LiquidGlassFilters from "@/components/LiquidGlassFilters";

import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { Inter } from "next/font/google";

// Inter as a close web alternative to SF Pro
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sf-pro",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Super Characters",
  description: "Super Characters App - AI Companions with Liquid Glass UI",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F2F2F7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`antialiased ${inter.variable} ${GeistSans.variable} ${GeistMono.variable} font-sans`}
        style={{ 
          textRendering: "optimizeLegibility",
          WebkitFontSmoothing: "antialiased",
          MozOsxFontSmoothing: "grayscale",
        }}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem={true}
          disableTransitionOnChange
        >
          <LiquidGlassFilters />
          <div className="main-layout flex flex-col h-screen overflow-hidden bg-transparent border-0 outline-none ring-0">
            <main className="flex-1 relative overflow-hidden">
              {children}
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
