import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SnowPulse",
  description: "Avalanche L1 Activity Intelligence",
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
