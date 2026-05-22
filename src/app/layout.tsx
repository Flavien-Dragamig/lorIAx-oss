import type { Metadata, Viewport } from "next";
import {
  Plus_Jakarta_Sans,
  Source_Serif_4,
  JetBrains_Mono,
  EB_Garamond,
} from "next/font/google";
import { Toaster } from "sonner";
import { SerwistProvider } from "./serwist";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const ebGaramond = EB_Garamond({
  variable: "--font-eb-garamond",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

export const viewport: Viewport = {
  themeColor: "#FFFFFF",
  viewportFit: "cover",
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "LorIAx — Gestion de connaissances",
  description:
    "Plateforme de gestion de connaissances auto-hebergee pour organismes multi-services",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/app-icon-192.png", sizes: "192x192" }],
  },
  manifest: "/manifest.json",
  openGraph: {
    title: "LorIAx — Gestion de connaissances",
    description:
      "Plateforme de gestion de connaissances auto-hebergee pour organismes multi-services",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${plusJakarta.variable} ${sourceSerif.variable} ${jetbrainsMono.variable} ${ebGaramond.variable}`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            // ARCH-07 — Script inline de détection du thème pour éviter le flash.
            // Le catch vide est intentionnel : localStorage lance en navigation privée
            // ou quand le stockage est désactivé. Pas de fallback nécessaire (thème clair par défaut).
            __html: `(function(){try{var t=localStorage.getItem("loriax-theme");if(t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme:dark)").matches)){document.documentElement.classList.add("dark")}}catch(e){/* localStorage indisponible, thème clair par défaut */}})()`,
          }}
        />
      </head>
      <body className="antialiased">
        <SerwistProvider swUrl="/serwist/sw.js">
          {children}
        </SerwistProvider>
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
