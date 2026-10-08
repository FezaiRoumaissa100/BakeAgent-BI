"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useEffect, useState } from "react";
import {
  IconSparkline, IconBarsGrouped, IconGrid, IconTrendUp, IconAlert
} from "./Icons";
import { tr } from "@/lib/i18n";
import { getNavMode, isNavOpen, setNavOpen } from "@/lib/navMode";

// Fonction (et non constante) : les libellés sont traduits au moment du rendu.
// Les icônes prennent la couleur du texte (currentColor) pour changer de couleur au survol.
const getNavItems = () => [
  { href: "/",           label: tr("Vue du Jour", "Daily view"),          icon: <IconSparkline size={20} color="currentColor" strokeWidth={2.1}/> },
  { href: "/performance", label: tr("Performance", "Performance"),        icon: <IconBarsGrouped size={20} color="currentColor" strokeWidth={2.1}/> },
  { href: "/produits",   label: tr("Produits", "Products"),               icon: <IconGrid size={20} color="currentColor" strokeWidth={2.1}/> },
  { href: "/previsions", label: tr("Prévisions", "Forecasts"),            icon: <IconTrendUp size={20} color="currentColor" strokeWidth={2.1}/> },
  { href: "/alertes",    label: tr("Alertes & Stock", "Alerts & Stock"),  icon: <IconAlert size={20} color="currentColor" strokeWidth={2.1}/> },
];

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
    return () => {
      window.removeEventListener("nav-change", sync);
      window.removeEventListener("keydown", onKey);
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
        {/* Logo : ouvre / ferme le menu */}
        <div className="side-brand">
          <button className="side-logo" onClick={toggleSidebar} aria-expanded={open} aria-label={toggleLabel} title={toggleLabel}>
            <IconSparkline size={22} color="#fff" strokeWidth={2.4} />
          </button>
          <span className="side-label side-title">{tr("Tableau de Bord", "Dashboard")}</span>
          <svg className="side-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
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
                <span className="side-label">{item.label}</span>
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
