"use client";

import { usePathname } from "next/navigation";
import React, { useState, useEffect } from "react";
import { siteConfig } from "@/lib/siteConfig";
import { t } from "@/lib/texts";
import { tr } from "@/lib/i18n";
import { ThemeToggle } from "./ThemeToggle";
import { LangToggle } from "./LangToggle";
import { toggleSidebar } from "./Sidebar";
import { fetchAlerts, fetchDataPeriod } from "@/lib/api";
import { ExpertBadge } from "./Expert";

// Nom de la page affiché à gauche de la barre du haut (fil d'Ariane)
const pageName = (path: string) => {
  if (path.startsWith("/performance")) return tr("Performance", "Performance");
  if (path.startsWith("/produits")) return tr("Produits", "Products");
  if (path.startsWith("/previsions")) return tr("Prévisions", "Forecasts");
  if (path.startsWith("/alertes")) return tr("Alertes & Stock", "Alerts & Stock");
  return tr("Vue du Jour", "Daily View");
};

export function Navbar() {
  const pathname = usePathname() || "/";

  // Compteur de la cloche : nombre réel de jours en « risque de manque » (page Alertes & Stock)
  const [alertCount, setAlertCount] = useState<number | null>(null);
  useEffect(() => {
    fetchAlerts("Tout")
      .then((d) => setAlertCount(Number(d?.kpis?.statuts?.RUPTURE || 0)))
      .catch(() => setAlertCount(null));
  }, []);

  // Période réelle des données (sinon valeurs de secours de siteConfig)
  const [period, setPeriod] = useState<{ d1: string; d2: string }>({ d1: siteConfig.dataStartLabel, d2: siteConfig.dataEndLabel });
  useEffect(() => {
    fetchDataPeriod()
      .then((p) => { if (p?.date_debut_fr && p?.date_fin_fr) setPeriod({ d1: p.date_debut_fr, d2: p.date_fin_fr }); })
      .catch(() => {});
  }, []);

  return (
    <nav className="topbar">
      {/* Gauche : bouton du menu (mode « menu caché ») + fil d'Ariane */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
        <button className="nav-float-logo" onClick={toggleSidebar} aria-label={tr("Ouvrir le menu", "Open menu")} title={tr("Ouvrir le menu", "Open menu")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h10" /></svg>
        </button>
        <div className="crumb">
          <span className="hidden md:inline">{siteConfig.bakeryName}</span>
          <span className="hidden md:inline" aria-hidden="true">/</span>
          <b>{pageName(pathname)}</b>
        </div>
      </div>

      {/* Droite : période des données, assistant, langue, thème, alertes */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span className="chip hidden lg:inline-flex" title={tr("Période couverte par les ventes", "Period covered by the sales data")}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
          {tr("Données", "Data")} {t.header.from} <b>{period.d1}</b> {t.header.to} <b>{period.d2}</b>
        </span>
        <ExpertBadge />
        <a className="ask-btn" href={siteConfig.agentUrl} target="_blank" rel="noreferrer"
           title={tr("Poser une question sur le tableau de bord à l'assistant IA", "Ask the AI assistant about the dashboard")}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
          </svg>
          <span className="hidden md:inline">{tr("Demander à l'assistant", "Ask the assistant")}</span>
        </a>
        <LangToggle />
        <ThemeToggle />
        <a className="icon-chip" href="/alertes"
           title={alertCount ? tr(`${alertCount} jours en risque de manque`, `${alertCount} days at risk of shortage`) : tr("Alertes & Stock", "Alerts & Stock")}
           aria-label={tr("Alertes & Stock", "Alerts & Stock")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
          {alertCount ? (
            <span style={{
              position: "absolute", top: -5, right: -5, minWidth: 18, height: 18, padding: "0 5px",
              borderRadius: 99, background: "var(--dk-alert)", color: "#fff", fontSize: ".62rem", fontWeight: 800,
              display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none",
              border: "2px solid var(--dk-page)"
            }}>{alertCount}</span>
          ) : null}
        </a>
      </div>
    </nav>
  );
}
