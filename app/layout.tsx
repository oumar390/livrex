import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Header from "@/components/Header";
import { StoreProvider } from "@/lib/store";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "LIVREX · Voyager et envoyer simplement",
    template: "%s · LIVREX",
  },
  description:
    "Voyages, livraison et fret au Sénégal. Réservez vos places et suivez vos envois avec Lifekhalifa.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" data-scroll-behavior="smooth">
      <body>
        <Header />
        <StoreProvider>
          <main id="contenu">{children}</main>
        </StoreProvider>
      </body>
    </html>
  );
}
