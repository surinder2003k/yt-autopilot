import type { Metadata } from "next";
import "./globals.css";
import { LoginGate } from "@/components/LoginGate";

export const metadata: Metadata = {
  metadataBase: new URL("https://ytautopilot.vercel.app"),
  title: "YT Auto-Pilot — Monitor",
  description: "Read-only monitor for the automated YouTube Shorts pipeline",
  openGraph: {
    title: "YT Auto-Pilot — Monitor",
    description: "Read-only monitor for the automated YouTube Shorts pipeline",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <LoginGate />
        {children}
      </body>
    </html>
  );
}
