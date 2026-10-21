import type { Metadata } from "next";
import { Manrope, Young_Serif } from "next/font/google";
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
import { siteConfig } from "@/lib/siteConfig";

// Texte : Manrope · Titres : Young Serif (voir app/globals.css)
const sans = Manrope({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const serif = Young_Serif({ subsets: ["latin"], weight: "400", variable: "--font-serif", display: "swap" });

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
              <div className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto">
                <Navbar />
                <div style={{ paddingTop: "28px", paddingBottom: "40px" }}>
                  <PageFade>{children}</PageFade>
                </div>
              </div>
            </div>
            <ChatDrawerWithContext />
          </ChatProvider>
          </NotificationProvider>
        </LangProvider>
      </body>
    </html>
  );
}
