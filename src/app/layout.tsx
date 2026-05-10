import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "linkqt.me prototype",
  description: "AI-edited link pages rendered from validated config."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
