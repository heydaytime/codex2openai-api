import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Codex Chat",
  description: "Local ChatGPT-style frontend for the Codex OpenAPI wrapper.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
