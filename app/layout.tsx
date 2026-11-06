import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import Header from "@/components/Header";
import ErrorBoundary from "@/components/ErrorBoundary";
import JudgeModeOverlay from "@/components/JudgeModeOverlay";
import OfflineBannerClient from "@/components/OfflineBannerClient";

export const metadata: Metadata = {
  title: "QuickKaam — skilled help, a few streets away",
  description:
    "Book nearby plumbers, electricians, cleaners and more in about 30 minutes. Name your budget; workers accept or counter.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1f2e86",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <ErrorBoundary>
          <OfflineBannerClient />
          <Suspense fallback={<div className="h-14 bg-neel" />}>
            <Header />
          </Suspense>
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
            {children}
          </main>
          <JudgeModeOverlay />
        </ErrorBoundary>
      </body>
    </html>
  );
}
