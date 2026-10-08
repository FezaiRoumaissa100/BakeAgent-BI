import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { Navbar } from "@/components/Navbar";
import { themeInitScript } from "@/lib/themeMode";
import { navInitScript } from "@/lib/navMode";
import { NavModeSwitch } from "@/components/NavModeSwitch";
import { PageFade } from "@/components/PageFade";
import { LangProvider } from "@/components/LangProvider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Tableau de Bord BI",
  description: "Plateforme décisionnelle BI & Intelligence Retail",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning : les attributs data-theme et data-nav sont posés par le script ci-dessous avant l'affichage.
    <html lang="fr" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Applique le mode clair / sombre mémorisé avant l'affichage (évite un flash blanc). */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {/* Applique l'affichage du menu mémorisé (barre d'icônes ou menu caché). */}
        <script dangerouslySetInnerHTML={{ __html: navInitScript }} />
      </head>
      <body className={`${inter.className} antialiased`} style={{ background: "var(--dk-page, #f2ede6)" }}>
        {/* Langue FR / EN (bouton dans l'en-tête) */}
        <LangProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <div className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto">
              <Navbar />
              <div style={{ paddingTop: "40px", paddingBottom: "40px" }}>
                <PageFade>{children}</PageFade>
              </div>
            </div>
          </div>
          <NavModeSwitch />
        </LangProvider>
      </body>
    </html>
  );
}
