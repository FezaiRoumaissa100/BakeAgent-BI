"use client";

// Jour choisi dans la barre du haut (« Voir un jour »), partagé par tous les onglets.
// null = le dernier jour des données (comportement par défaut). Gardé pendant la session du navigateur.
import { useEffect, useState } from "react";

const KEY = "bakeagent.jour";
const EVT = "bakeagent-jour";

export function getSelectedDay(): string | null {
  try { return sessionStorage.getItem(KEY); } catch { return null; }
}

export function setSelectedDay(d: string | null) {
  try { if (d) sessionStorage.setItem(KEY, d); else sessionStorage.removeItem(KEY); } catch { /* stockage indisponible */ }
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(EVT, { detail: d }));
  // Le jour choisi règle aussi la période des pages d'analyse : son mois et son année (ou toute la période si on l'efface)
  setSelectedPeriod(d ? periodOfDay(d) : { annee: "Toutes", mois: "Tous" });
}

// ── Période des pages d'analyse (Performance, Produits) : même place dans la barre du haut que le jour ──
export type Period = { annee: string; mois: string };
export const MOIS_FR = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const PKEY = "bakeagent.periode";
const PEVT = "bakeagent-periode";
export function periodOfDay(d: string): Period {
  return { annee: d.slice(0, 4), mois: MOIS_FR[Number(d.slice(5, 7)) - 1] || "Tous" };
}
export function getSelectedPeriod(): Period {
  try {
    const raw = sessionStorage.getItem(PKEY);
    if (raw) { const p = JSON.parse(raw); if (p && p.annee && p.mois) return p; }
  } catch { /* stockage indisponible */ }
  const d = getSelectedDay();
  return d ? periodOfDay(d) : { annee: "Toutes", mois: "Tous" };
}
export function setSelectedPeriod(p: Period) {
  try { sessionStorage.setItem(PKEY, JSON.stringify(p)); } catch { /* stockage indisponible */ }
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(PEVT, { detail: p }));
}
export function useSelectedPeriod(): [Period, (p: Period) => void, boolean] {
  const [p, setP] = useState<Period>({ annee: "Toutes", mois: "Tous" });
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setP(getSelectedPeriod());
    setReady(true);
    const h = (e: Event) => setP(((e as CustomEvent).detail as Period) || { annee: "Toutes", mois: "Tous" });
    window.addEventListener(PEVT, h);
    return () => window.removeEventListener(PEVT, h);
  }, []);
  return [p, setSelectedPeriod, ready];
}

export function useSelectedDay(): [string | null, (d: string | null) => void, boolean] {
  const [d, setD] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setD(getSelectedDay());
    setReady(true);
    const h = (e: Event) => setD(((e as CustomEvent).detail as string | null) ?? null);
    window.addEventListener(EVT, h);
    return () => window.removeEventListener(EVT, h);
  }, []);
  return [d, setSelectedDay, ready];
}

// « jeudi 12 mars 2026 »
export function dayLong(ds: string, loc = "fr-FR") {
  const d = new Date(ds + "T12:00:00");
  return d.toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
