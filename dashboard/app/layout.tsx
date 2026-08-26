import type { Metadata } from "next";
import "./globals.css";
import { LoginGate } from "@/components/LoginGate";
import { Sora } from "next/font/google";
import { AuroraBackground } from "@/components/AuroraBackground";
import { CursorFollower } from "@/components/CursorFollower";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

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
    <html lang="en" className={sora.variable}>
      <body>
        <AuroraBackground />
        <CursorFollower />
        <LoginGate />
        {children}
      </body>
    </html>
  );
}
