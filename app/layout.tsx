import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SnowPulse — Avalanche L1 Activity Intelligence",
  description: "Discover where activity is heating up across Avalanche.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
