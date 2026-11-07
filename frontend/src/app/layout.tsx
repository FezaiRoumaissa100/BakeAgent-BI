import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { Navbar } from "@/components/Navbar";
import { themeInitScript } from "@/lib/themeMode";
import { navInitScript } from "@/lib/navMode";
import { PageFade } from "@/components/PageFade";
import { LangProvider } from "@/components/LangProvider";
import { ChatProvider } from "@/contexts/ChatContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { ChatDrawerWithContext } from "@/components/ChatDrawerWithContext";
import { ScrollMotion } from "@/components/ScrollMotion";
import { ChartTools } from "@/components/ChartTools";
import { siteConfig } from "@/lib/siteConfig";

// Thème « Pastel » : texte et titres en Plus Jakarta Sans (voir app/globals.css).
// La variable --font-serif est gardée (les styles des titres la lisent) mais pointe aussi vers Plus Jakarta Sans.
const sans = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const serif = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-serif", display: "swap" });

export const metadata: Metadata = {
  title: `${siteConfig.productName} · ${siteConfig.bakeryName || siteConfig.appName}`,
  description: "Plateforme décisionnelle BI & Intelligence Retail",
};

// Réglages de marque (lib/siteConfig.ts) : couleur, motif, grain. Lus par app/globals.css via les attributs de <html>.
const brandColor = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(siteConfig.brandColor) ? siteConfig.brandColor : "";
const motif = siteConfig.motif || "wheat";
const motifMode = motif === "none" ? "none" : motif === "wheat" ? undefined : "custom";
const htmlStyle: Record<string, string> = {};
if (brandColor) htmlStyle["--brand"] = brandColor;
if (motifMode === "custom") htmlStyle["--dk-motif-img"] = `url("${motif.replace(/"/g, "")}")`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning : les attributs data-theme et data-nav sont posés par le script ci-dessous avant l'affichage.
    <html lang="fr" className={`${sans.variable} ${serif.variable}`} suppressHydrationWarning
      data-brand={brandColor ? "" : undefined} data-motif={motifMode} data-grain={siteConfig.grain ? undefined : "none"}
      style={htmlStyle as React.CSSProperties}>
      <head>
        {/* Applique le mode clair / sombre mémorisé avant l'affichage (évite un flash blanc). */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {/* Applique l'affichage du menu mémorisé (barre d'icônes ou menu caché). */}
        <script dangerouslySetInnerHTML={{ __html: navInitScript }} />
      </head>
      <body className={`${sans.className} antialiased`}>
        {/* Langue FR / EN (bouton dans l'en-tête) */}
        <LangProvider>
          <NotificationProvider>
          <ChatProvider>
            <div className="app-shell flex min-h-screen">
              <Sidebar />
              {/* overflow-x-clip (et non hidden) : la barre du haut et la barre d'onglets restent collées en haut quand on descend */}
              <div className="flex-1 min-w-0 overflow-x-clip">
                <Navbar />
                <div data-rv-root style={{ paddingTop: "18px", paddingBottom: "32px" }}>
                  <PageFade>{children}</PageFade>
                </div>
              </div>
            </div>
            <ChatDrawerWithContext />
            {/* Animations au défilement, barre d'onglets collée en haut, bouton « Haut de page » */}
            <ScrollMotion />
            {/* Zoom et enregistrement (PNG / PDF) des graphiques, au survol des cartes */}
            <ChartTools />
          </ChatProvider>
          </NotificationProvider>
        </LangProvider>
      </body>
    </html>
  );
}
