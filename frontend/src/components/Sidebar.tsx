"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useEffect, useState } from "react";
import {
  IconSparkline, IconBarsGrouped, IconGrid, IconTrendUp, IconAlert, IconBox
} from "./Icons";
import { tr, locale } from "@/lib/i18n";
import { getNavMode, isNavOpen, setNavOpen, applyNavForWidth } from "@/lib/navMode";
import { siteConfig } from "@/lib/siteConfig";
import { useNotifications } from "@/contexts/NotificationContext";

// Fonction (et non constante) : les libellés sont traduits au moment du rendu.
// Les icônes prennent la couleur du texte (currentColor) pour changer de couleur au survol.
// Deux groupes : les pages de tous les jours, puis celles pour comprendre et anticiper.
// « sub » : description de secours, affichée tant que la phrase du moment n'est pas disponible.
type NavKey = "day" | "alerts" | "perf" | "prod" | "prev";
const getNavGroups = () => [
  {
    id: "daily", label: tr("Au quotidien", "Every day"), items: [
      { key: "day" as NavKey,    href: "/",            label: tr("Vue du Jour", "Daily View"),         sub: tr("Comment s'est passée la journée ?", "How did the day go?"),   icon: <IconSparkline size={19} color="currentColor" strokeWidth={2.1}/> },
      { key: "alerts" as NavKey, href: "/alertes",     label: tr("Alertes & Stock", "Alerts & Stock"), sub: tr("Que préparer ?", "What to prepare?"),                         icon: <IconAlert size={19} color="currentColor" strokeWidth={2.1}/> },
    ],
  },
  {
    id: "understand", label: tr("Pour comprendre", "To understand"), items: [
      { key: "perf" as NavKey,   href: "/performance", label: tr("Performance", "Performance"),        sub: tr("Quand vend-on ?", "When do we sell?"),                         icon: <IconBarsGrouped size={19} color="currentColor" strokeWidth={2.1}/> },
      { key: "prod" as NavKey,   href: "/produits",    label: tr("Produits", "Products"),              sub: tr("Quoi vend-on, que décider ?", "What sells, what to decide?"), icon: <IconGrid size={19} color="currentColor" strokeWidth={2.1}/> },
      { key: "prev" as NavKey,   href: "/previsions",  label: tr("Prévisions", "Forecasts"),           sub: tr("Combien vendra-t-on ?", "How much will we sell?"),            icon: <IconTrendUp size={19} color="currentColor" strokeWidth={2.1}/> },
    ],
  },
];

// Couleur du bouton « Stock du soir » : violet BakeAgent par défaut, ou la couleur de la boulangerie (voir lib/siteConfig.ts)
function stockColor(): string {
  const c = (siteConfig.stockButtonColor || "").trim();
  if (c === "brand") return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(siteConfig.brandColor) ? siteConfig.brandColor : "#5B45C2";
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c) ? c : "#5B45C2";
}

// Logo du produit : un épi de blé (le même pour toutes les boulangeries)
function WheatMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M12 22V8" />
      <ellipse cx="12" cy="6" rx="2.2" ry="3.4" />
      <ellipse cx="9" cy="11" rx="2" ry="3.2" transform="rotate(-35 9 11)" />
      <ellipse cx="15" cy="11" rx="2" ry="3.2" transform="rotate(35 15 11)" />
      <ellipse cx="9" cy="16" rx="2" ry="3.2" transform="rotate(-35 9 16)" />
      <ellipse cx="15" cy="16" rx="2" ry="3.2" transform="rotate(35 15 16)" />
    </svg>
  );
}

// Ouvre / ferme le menu. Utilisé par le logo du menu et par le logo de l'en-tête (mode « menu caché »).
export function toggleSidebar() {
  setNavOpen(!isNavOpen());
  window.dispatchEvent(new Event("nav-change"));
}

export function Sidebar() {
  const pathname = usePathname();
  const { nav } = useNotifications();
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
            {siteConfig.bakeryLogo
              ? <img src={siteConfig.bakeryLogo} alt={siteConfig.bakeryName || siteConfig.productName} className="side-logo-img" />
              : <WheatMark />}
          </button>
          <div className="side-brand-txt">
            <span className="side-title">{siteConfig.productName}</span>
            <span className="side-brand-sub">{siteConfig.bakeryName || tr("Tableau de bord", "Dashboard")}</span>
          </div>
          {/* Flèche : referme le menu (comme le logo) */}
          <button className="side-chevron" onClick={toggleSidebar} aria-label={toggleLabel} title={toggleLabel}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        </div>

        {/* Pages, en deux groupes. Sous chaque page : une phrase courte sur ce qu'on y trouve aujourd'hui. */}
        <nav className="side-nav">
          {getNavGroups().map((g, gi) => (
            <div key={g.id} className={`side-group${gi ? " side-group-next" : ""}`}>
              <div className="side-group-lbl" aria-hidden="true"><span>{g.label}</span></div>
              {g.items.map((item, ii) => {
                const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                const line = nav[item.key];
                const dot = item.key === "alerts" && nav.alertDot;
                const say = line ? tr(line.text[0], line.text[1]) : item.sub;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onPick}
                    className={`side-item${isActive ? " active" : ""}`}
                    aria-current={isActive ? "page" : undefined}
                    style={{ "--i": gi * 3 + ii } as React.CSSProperties}
                  >
                    <span className="side-ic">
                      {item.icon}
                      {dot && <span className="side-alert-dot" aria-label={tr("Quantités à ajuster", "Quantities to adjust")} />}
                    </span>
                    <span className="side-txt">
                      <span className="side-label">{item.label}</span>
                      {nav.ready
                        ? <span className="side-say"><i className={`side-tone ${line ? `t-${line.tone}` : "t-none"}`} aria-hidden="true" />{say}</span>
                        : <span className="side-say side-say-wait" aria-hidden="true"><i /></span>}
                    </span>
                    {/* Menu réduit aux icônes : nom de la page et phrase au survol */}
                    <span className="side-tip" aria-hidden="true">
                      <b>{item.label}</b>
                      {nav.ready && <small>{line && <i className={`side-tone t-${line.tone}`} />}{say}</small>}
                    </span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Saisie du stock du soir : un bouton d'action, qui se fait discret une fois la saisie faite */}
        {(() => {
          const done = !!nav.stock?.done;
          const onStock = pathname.startsWith("/stock");
          const wd = nav.stock ? new Date(nav.stock.day + "T12:00:00").toLocaleDateString(locale(), { weekday: "long" }) : "";
          const title = done ? tr("Stock du soir saisi", "Evening stock entered") : tr("Saisir le stock du soir", "Enter the evening stock");
          const sub = !nav.stock ? tr("Préparé et restant le soir", "Made and left at closing")
            : done ? tr(`Fait pour ${wd} · modifier`, `Done for ${wd} · edit`)
            : tr(`Pas encore fait pour ${wd}`, `Not done yet for ${wd}`);
          return (
            <Link href="/stock" onClick={onPick}
              className={`side-stock${done ? " done" : ""}${onStock ? " on" : ""}`}
              style={{ "--stock": stockColor() } as React.CSSProperties}
              aria-current={onStock ? "page" : undefined}>
              <span className="side-stock-ic" aria-hidden="true">
                {done
                  ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                  : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>}
                {!done && nav.stock && <span className="side-stock-dot" />}
              </span>
              <span className="side-stock-txt">
                <b>{title}</b>
                <small>{sub}</small>
              </span>
              <span className="side-tip" aria-hidden="true"><b>{title}</b><small>{sub}</small></span>
            </Link>
          );
        })()}

      </aside>
    </>
  );
}
