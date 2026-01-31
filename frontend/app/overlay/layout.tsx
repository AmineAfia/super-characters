import type { Metadata } from "next";
import "../globals.css";

import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

export const metadata: Metadata = {
  title: "Super Characters Overlay",
  description: "3D Character Overlay",
};

export default function OverlayLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body
        className={`antialiased ${GeistSans.variable} ${GeistMono.variable}`}
        style={{
          background: "transparent",
          margin: 0,
          padding: 0,
          overflow: "hidden",
          textRendering: "optimizeLegibility",
          border: "none",
          outline: "none",
          boxShadow: "none",
        }}
      >
        {children}
      </body>
    </html>
  );
}
