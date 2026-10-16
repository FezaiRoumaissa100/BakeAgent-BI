"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useEffect, useState } from "react";
import {
  IconSparkline, IconBarsGrouped, IconGrid, IconTrendUp, IconAlert
} from "./Icons";
import { tr } from "@/lib/i18n";
import { getNavMode, isNavOpen, setNavOpen, applyNavForWidth } from "@/lib/navMode";
import { siteConfig } from "@/lib/siteConfig";

// Fonction (et non constante) : les libellés sont traduits au moment du rendu.
// Les icônes prennent la couleur du texte (currentColor) pour changer de couleur au survol.
const getNavItems = () => [
  { href: "/",            label: tr("Vue du Jour", "Daily View"),          sub: tr("Comment s'est passée la journée ?", "How did the day go?"),   icon: <IconSparkline size={19} color="currentColor" strokeWidth={2.1}/> },
  { href: "/performance", label: tr("Performance", "Performance"),         sub: tr("Quand vend-on ?", "When do we sell?"),                         icon: <IconBarsGrouped size={19} color="currentColor" strokeWidth={2.1}/> },
  { href: "/produits",    label: tr("Produits", "Products"),               sub: tr("Quoi vend-on, que décider ?", "What sells, what to decide?"), icon: <IconGrid size={19} color="currentColor" strokeWidth={2.1}/> },
  { href: "/previsions",  label: tr("Prévisions", "Forecasts"),            sub: tr("Combien vendra-t-on ?", "How much will we sell?"),            icon: <IconTrendUp size={19} color="currentColor" strokeWidth={2.1}/> },
  { href: "/alertes",     label: tr("Alertes & Stock", "Alerts & Stock"),  sub: tr("Que préparer ?", "What to prepare?"),                         icon: <IconAlert size={19} color="currentColor" strokeWidth={2.1}/> },
];

// Initiales de la boutique pour le logo (ex. « Boulangerie Le Croisic » → « LC »)
const initials = (name: string) => {
  const words = name.replace(/^(boulangerie|pâtisserie|patisserie)\s+/i, "").split(/\s+/).filter(Boolean);
  return (words.length >= 2 ? words[0][0] + words[words.length - 1][0] : (words[0] || "BI").slice(0, 2)).toUpperCase();
};
const shortName = (name: string) => name.replace(/^(boulangerie|pâtisserie|patisserie)\s+/i, "");

// Ouvre / ferme le menu. Utilisé par le logo du menu et par le logo de l'en-tête (mode « menu caché »).
export function toggleSidebar() {
  setNavOpen(!isNavOpen());
  window.dispatchEvent(new Event("nav-change"));
}

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Suit l'état posé sur <html> (mémorisé, ou changé par le logo de l'en-tête / le sélecteur).
  useEffect(() => {
    const sync = () => setOpen(isNavOpen());
    sync();
    window.addEventListener("nav-change", sync);
    // Touche Échap : referme le menu caché.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && getNavMode() === "hidden" && isNavOpen()) toggleSidebar();
    };
    window.addEventListener("keydown", onKey);
    // Fenêtre agrandie / réduite : menu fixe sur grand écran, menu caché sur petit écran.
    const onResize = () => { if (applyNavForWidth()) sync(); };
    onResize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("nav-change", sync);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // En mode « menu caché », choisir une page referme le menu.
  const onPick = () => {
    if (getNavMode() === "hidden" && isNavOpen()) toggleSidebar();
  };

  const toggleLabel = open ? tr("Fermer le menu", "Close menu") : tr("Ouvrir le menu", "Open menu");

  return (
    <>
      {/* Voile gris derrière le menu caché quand il est ouvert : un clic le referme */}
      <div className="side-veil" onClick={toggleSidebar} aria-hidden="true" />

      <aside className="side">
        {/* Logo : replie / déplie le menu */}
        <div className="side-brand">
          <button className="side-logo" onClick={toggleSidebar} aria-expanded={open} aria-label={toggleLabel} title={toggleLabel}>
            {initials(siteConfig.bakeryName)}
          </button>
          <div className="side-brand-txt">
            <span className="side-title">{shortName(siteConfig.bakeryName)}</span>
            <span className="side-brand-sub">{tr("Boulangerie · Tableau de bord", "Bakery · Dashboard")}</span>
          </div>
          {/* Flèche : referme le menu (comme le logo) */}
          <button className="side-chevron" onClick={toggleSidebar} aria-label={toggleLabel} title={toggleLabel}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        </div>

        {/* Pages */}
        <nav className="side-nav">
          {getNavItems().map((item) => {
            const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onPick}
                className={`side-item${isActive ? " active" : ""}`}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="side-ic">{item.icon}</span>
                <span className="side-txt">
                  <span className="side-label">{item.label}</span>
                  <span className="side-sub">{item.sub}</span>
                </span>
                {/* Nom de la page au survol, quand le menu est réduit aux icônes */}
                <span className="side-tip" aria-hidden="true">{item.label}</span>
              </Link>
            );
          })}
        </nav>

      </aside>
    </>
  );
}
