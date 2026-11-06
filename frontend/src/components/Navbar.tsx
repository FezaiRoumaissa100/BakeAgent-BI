"use client";

import { usePathname } from "next/navigation";
import React, { useState, useEffect } from "react";
import { siteConfig } from "@/lib/siteConfig";
import { t } from "@/lib/texts";
import { tr } from "@/lib/i18n";
import { ThemeToggle } from "./ThemeToggle";
import { LangToggle } from "./LangToggle";
import { toggleSidebar } from "./Sidebar";
import { fetchDataPeriod } from "@/lib/api";
import { NotificationBell } from "./NotificationBell";
import { ExpertBadge } from "./Expert";
import { useChat } from "@/contexts/ChatContext";
import { useSelectedDay, useSelectedPeriod, MOIS_FR } from "@/lib/selectedDay";
import { trData } from "@/lib/i18n";

// Nom de la page affiché à gauche de la barre du haut (fil d'Ariane)
const pageName = (path: string) => {
  if (path.startsWith("/performance")) return tr("Performance", "Performance");
  if (path.startsWith("/produits")) return tr("Produits", "Products");
  if (path.startsWith("/previsions")) return tr("Prévisions", "Forecasts");
  if (path.startsWith("/alertes")) return tr("Alertes & Stock", "Alerts & Stock");
  if (path.startsWith("/stock")) return tr("Saisie du stock", "Stock entry");
  return tr("Vue du Jour", "Daily View");
};

export function Navbar() {
  const pathname = usePathname() || "/";
  // Assistant IA : ouvre le panneau de discussion (rendu une seule fois dans layout.tsx)
  const { openChat } = useChat();

  // Période réelle des données (sinon valeurs de secours de siteConfig)
  const [period, setPeriod] = useState<{ d1: string; d2: string; iso1?: string; iso2?: string }>({ d1: siteConfig.dataStartLabel, d2: siteConfig.dataEndLabel });
  const [years, setYears] = useState<number[]>([]);
  useEffect(() => {
    fetchDataPeriod()
      .then((p) => {
        if (p?.date_debut_fr && p?.date_fin_fr) setPeriod({ d1: p.date_debut_fr, d2: p.date_fin_fr, iso1: p.date_debut || undefined, iso2: p.date_fin || undefined });
        setYears((p?.annees || []).slice().sort((a, b) => b - a));
      })
      .catch(() => {});
  }, []);
  // Pages d'analyse : la barre du haut choisit une PÉRIODE (année, mois) ; ailleurs elle choisit un JOUR
  const isAnalysis = pathname.startsWith("/performance") || pathname.startsWith("/produits");
  const monthsToo = pathname.startsWith("/performance");
  const [per, setPer] = useSelectedPeriod();
  // Jour choisi (partagé par tous les onglets) ; vide = dernier jour des données
  const [day, setDay] = useSelectedDay();

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
        {isAnalysis ? (
          <div className={`chip period-pick${per.annee !== "Toutes" || (monthsToo && per.mois !== "Tous") ? " on" : ""}`}
            title={tr(`Période analysée (données du ${period.d1} au ${period.d2})`, `Period analysed (data from ${period.d1} to ${period.d2})`)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M8 14h8" />
            </svg>
            <span className="hidden lg:inline pp-k">{tr("Période", "Period")}</span>
            {monthsToo && (
              <MonthPick value={per.mois} onChange={(v) => setPer({ ...per, mois: v })} />
            )}
            {monthsToo ? (
              <YearMulti years={years} value={per.annee} onChange={(v) => setPer({ ...per, annee: v })} />
            ) : (
              <YearOne years={years} value={per.annee.includes(",") ? per.annee.split(",").sort().slice(-1)[0] : per.annee} onChange={(v) => setPer({ ...per, annee: v })} />
            )}
            {(per.annee !== "Toutes" || (monthsToo && per.mois !== "Tous")) && (
              <button type="button" className="day-pick-x" onClick={() => setPer({ annee: "Toutes", mois: "Tous" })}
                title={tr("Revenir à toute la période", "Back to the whole period")} aria-label={tr("Revenir à toute la période", "Back to the whole period")}>×</button>
            )}
          </div>
        ) : (
        /* Choisir un jour : la Vue du Jour et la Saisie du stock suivent ce jour (et la période des pages d'analyse prend son mois) */
        <label className={`chip day-pick${day ? " on" : ""}`}
          title={tr(`Choisir un jour à analyser (données du ${period.d1} au ${period.d2})`, `Pick a day to analyse (data from ${period.d1} to ${period.d2})`)}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
          <span className="hidden lg:inline">{day ? tr("Jour", "Day") : tr("Dernier jour", "Last day")}</span>
          <input type="date" value={day || period.iso2 || ""} min={period.iso1} max={period.iso2}
            onChange={(e) => setDay(e.target.value && e.target.value !== period.iso2 ? e.target.value : null)}
            aria-label={tr("Jour à analyser", "Day to analyse")} />
          {day && (
            <button type="button" className="day-pick-x" onClick={(e) => { e.preventDefault(); setDay(null); }}
              title={tr("Revenir au dernier jour des données", "Back to the last day of data")} aria-label={tr("Revenir au dernier jour", "Back to the last day")}>×</button>
          )}
        </label>
        )}
        <ExpertBadge />
        <button type="button" className="ask-btn" onClick={() => openChat("", {})}
           title={tr("Poser une question sur le tableau de bord à l'assistant IA", "Ask the AI assistant about the dashboard")}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
          </svg>
          <span className="hidden md:inline">{tr("Demander à l'assistant", "Ask the assistant")}</span>
        </button>
        <LangToggle />
        <ThemeToggle />
        {/* Cloche : liste des notifications (réponses de l'assistant, produits à risque, journée chargée…) */}
        <NotificationBell />
      </div>
    </nav>
  );
}

// Choix d'une ou plusieurs années (cases à cocher) ; « Toutes » = aucune année cochée
function YearMulti({ years, value, onChange }: { years: number[]; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = React.useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", h); document.addEventListener("keydown", k);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", k); };
  }, [open]);
  const sel = value === "Toutes" ? [] : value.split(",").filter(Boolean);
  const label = sel.length === 0 ? tr("Toutes les années", "All years") : sel.slice().sort().join(", ");
  const toggle = (y: string) => {
    const next = sel.includes(y) ? sel.filter((x) => x !== y) : [...sel, y];
    onChange(next.length === 0 || next.length === years.length ? "Toutes" : next.sort().join(","));
  };
  return (
    <div className="ym" ref={ref}>
      <button type="button" className="ym-btn" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {label}
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
        <div className="ym-pop" role="listbox" aria-multiselectable="true">
          <label className="ym-it">
            <input type="checkbox" checked={sel.length === 0} onChange={() => onChange("Toutes")} />
            {tr("Toutes les années", "All years")}
          </label>
          <div className="ym-sep" />
          {years.map((y) => (
            <label key={y} className="ym-it">
              <input type="checkbox" checked={sel.includes(String(y))} onChange={() => toggle(String(y))} />
              {y}
            </label>
          ))}
          <div className="ym-hint">{tr("Cochez une ou plusieurs années. La comparaison se fait sur la plus récente face à l'année d'avant.", "Tick one or more years. Comparisons use the most recent one vs the year before.")}</div>
        </div>
      )}
    </div>
  );
}

// Petite liste déroulante maison (même allure que le reste de la barre du haut)
function usePop() {
  const [open, setOpen] = useState(false);
  const ref = React.useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", h); document.addEventListener("keydown", k);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", k); };
  }, [open]);
  return { open, setOpen, ref };
}
const Chev = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>;

const MOIS_COURTS_FR = ["Janv.", "Févr.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."];
const MOIS_COURTS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function MonthPick({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { open, setOpen, ref } = usePop();
  const MOIS_COURTS = tr("fr", "en") === "fr" ? MOIS_COURTS_FR : MOIS_COURTS_EN;
  return (
    <div className="ym" ref={ref}>
      <button type="button" className="ym-btn" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {value === "Tous" ? tr("Tous les mois", "All months") : trData(value)}<Chev />
      </button>
      {open && (
        <div className="ym-pop mp" role="listbox">
          <button type="button" className={`mp-all${value === "Tous" ? " on" : ""}`} onClick={() => { onChange("Tous"); setOpen(false); }}>{tr("Tous les mois", "All months")}</button>
          <div className="mp-grid">
            {MOIS_FR.map((m) => (
              <button key={m} type="button" className={value === m ? "on" : ""} onClick={() => { onChange(m); setOpen(false); }}>{MOIS_COURTS[MOIS_FR.indexOf(m)]}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function YearOne({ years, value, onChange }: { years: number[]; value: string; onChange: (v: string) => void }) {
  const { open, setOpen, ref } = usePop();
  return (
    <div className="ym" ref={ref}>
      <button type="button" className="ym-btn" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {value === "Toutes" ? tr("Toutes les années", "All years") : value}<Chev />
      </button>
      {open && (
        <div className="ym-pop" role="listbox">
          {[["Toutes", tr("Toutes les années", "All years")], ...years.map((y) => [String(y), String(y)])].map(([v, l]) => (
            <button key={v} type="button" className={`ym-it ym-opt${value === v ? " on" : ""}`} onClick={() => { onChange(v); setOpen(false); }}>{l}</button>
          ))}
        </div>
      )}
    </div>
  );
}
