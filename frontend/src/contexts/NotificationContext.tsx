"use client";

// Notifications de la cloche (barre du haut).
// Deux sources :
//  1. l'assistant IA : quand il répond alors que le panneau de discussion est fermé (voir ChatDrawer) ;
//  2. les données : produits qui risquent de manquer ou de rester invendus, journée chargée à venir,
//     jours à fort risque de la saison, nouvelle prévision calculée. Recalculées à chaque chargement,
//     à partir des mêmes API que les pages (rien de nouveau côté backend).
// « Lu / non lu » est mémorisé dans le navigateur (localStorage) ; les réponses de l'assistant restent
// pour la session (sessionStorage), comme l'historique de la discussion.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { fetchAlerts, fetchForecast, fetchProductAlerts, fetchProductionSummary } from "@/lib/api";

export type NotifKind = "assistant" | "assistant_error" | "risk" | "unsold" | "busy" | "season" | "forecast" | "stock";

export interface Notif {
  id: string;
  kind: NotifKind;
  title: [string, string];       // [français, anglais] : traduit à l'affichage
  body?: [string, string];
  href?: string;                 // page à ouvrir au clic
  openChat?: boolean;            // ouvre le panneau de l'assistant au clic
  time?: string;                 // ISO : affiché « il y a 5 min » (notifications de l'assistant)
}

interface NotificationContextType {
  items: Notif[];
  unread: number;
  isRead: (id: string) => boolean;
  markRead: (id: string) => void;
  markAllRead: () => void;
  notify: (n: Notif) => void;
}

const Ctx = createContext<NotificationContextType | undefined>(undefined);

const READ_KEY = "bake-notif-read";
const CHAT_KEY = "bake-notif-assistant";

function load<T>(storage: "local" | "session", key: string, fallback: T): T {
  try {
    const s = (storage === "local" ? window.localStorage : window.sessionStorage).getItem(key);
    return s ? (JSON.parse(s) as T) : fallback;
  } catch { return fallback; }
}
function save(storage: "local" | "session", key: string, value: unknown) {
  try { (storage === "local" ? window.localStorage : window.sessionStorage).setItem(key, JSON.stringify(value)); } catch { /* navigateur sans stockage */ }
}

const nf = (n: number, lang: "fr" | "en") => Math.round(n).toLocaleString(lang === "fr" ? "fr-FR" : "en-GB");
function dayName(ds: string, lang: "fr" | "en") {
  const t = new Date(ds + "T12:00:00").toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { weekday: "long", day: "numeric", month: "long" });
  return t.charAt(0).toUpperCase() + t.slice(1);
}
const both = (f: (l: "fr" | "en") => string): [string, string] => [f("fr"), f("en")];

// Construit les notifications « données » à partir des réponses des API
async function buildDataNotifs(): Promise<Notif[]> {
  const out: Notif[] = [];
  const [prod, fc, season, stock] = await Promise.allSettled([
    fetchProductAlerts(7),
    fetchForecast({ horizon: 7, forecast_type: "articles", history_period: "all" }),
    fetchAlerts("Tout"),
    fetchProductionSummary(7),
  ]);

  // 0. Saisie du stock : rappel si le dernier jour de ventes n'est pas saisi, sinon bilan du dernier jour saisi
  if (stock.status === "fulfilled" && stock.value?.available) {
    const st = stock.value;
    const last = (st.days || [])[st.days?.length - 1];
    if (!st.last_sales_day_saisi && st.last_sales_day) out.push({
      id: `stock-missing-${st.last_sales_day}`, kind: "stock", href: "/stock",
      title: both((l) => l === "fr" ? `Production du ${dayName(st.last_sales_day, l).toLowerCase()} pas encore saisie` : `Production for ${dayName(st.last_sales_day, l)} not entered yet`),
      body: both((l) => l === "fr" ? "Indiquez ce qui a été préparé et ce qui reste : 2 minutes, et les invendus réels apparaissent." : "Enter what was made and what is left: 2 minutes, and real unsold items appear."),
    });
    else if (last && last.produced > 0) out.push({
      id: `stock-day-${last.date}-${last.leftover}`, kind: "stock", href: "/stock",
      title: both((l) => l === "fr"
        ? `${dayName(last.date, l)} : ${nf((last.part_vendue || 0) * 100, l)} % de la production vendue`
        : `${dayName(last.date, l)}: ${nf((last.part_vendue || 0) * 100, l)}% of production sold`),
      body: both((l) => l === "fr"
        ? `${nf(last.leftover, l)} article(s) restant(s), ≈ ${nf(last.euros_invendus, l)} € d'invendus${last.epuises.length ? ` ; épuisé(s) : ${last.epuises.slice(0, 3).join(", ")}` : ""}.`
        : `${nf(last.leftover, l)} item(s) left, ≈ €${nf(last.euros_invendus, l)} unsold${last.epuises.length ? `; sold out: ${last.epuises.slice(0, 3).join(", ")}` : ""}.`),
    });
  }

  // 1-2. Produits : risque de manque / d'invendus sur le prochain jour ouvert
  if (prod.status === "fulfilled" && prod.value?.available) {
    const p = prod.value;
    const items: any[] = p.items || [];
    const dates: string[] = p.dates || [];
    const openDay = dates.find((ds) => items.some((i) => (i.days || []).some((d: any) => d.ds === ds && d.statut !== "FERMÉ"))) || dates[0];
    if (openDay) {
      const dayOf = (i: any) => (i.days || []).find((d: any) => d.ds === openDay);
      const short = items.filter((i) => dayOf(i)?.statut === "RUPTURE")
        .sort((a, b) => (dayOf(b).yhat - dayOf(b).usual) - (dayOf(a).yhat - dayOf(a).usual));
      const unsold = items.filter((i) => dayOf(i)?.statut === "SURSTOCK")
        .sort((a, b) => (dayOf(b).usual - dayOf(b).yhat) - (dayOf(a).usual - dayOf(a).yhat));
      const list = (arr: any[], l: "fr" | "en") => arr.slice(0, 3).map((i) => {
        const d = dayOf(i);
        return `${i.article} (${l === "fr" ? "prévu" : "forecast"} ${nf(d.yhat, l)}, ${l === "fr" ? "habituel" : "usual"} ${nf(d.usual, l)})`;
      }).join(", ") + (arr.length > 3 ? (l === "fr" ? ` et ${arr.length - 3} autre(s)` : ` and ${arr.length - 3} more`) : "");
      if (short.length) out.push({
        id: `risk-${openDay}-${short.length}`, kind: "risk", href: "/alertes",
        title: both((l) => l === "fr" ? `${dayName(openDay, l)} : ${short.length} produit(s) risquent de manquer` : `${dayName(openDay, l)}: ${short.length} product(s) may run short`),
        body: both((l) => (l === "fr" ? "Prévoir plus : " : "Prepare more: ") + list(short, l)),
      });
      if (unsold.length) out.push({
        id: `unsold-${openDay}-${unsold.length}`, kind: "unsold", href: "/alertes",
        title: both((l) => l === "fr" ? `${dayName(openDay, l)} : ${unsold.length} produit(s) risquent de rester invendus` : `${dayName(openDay, l)}: ${unsold.length} product(s) may stay unsold`),
        body: both((l) => (l === "fr" ? "Prévoir moins : " : "Prepare less: ") + list(unsold, l)),
      });
    }
    // 5. Nouvelle prévision calculée
    const run = p.run || {};
    if (run.run_at) out.push({
      id: `forecast-${run.run_at}`, kind: "forecast", href: "/previsions",
      title: both((l) => l === "fr" ? "Prévision mise à jour" : "Forecast updated"),
      body: both((l) => l === "fr"
        ? `Calculée le ${run.run_at.replace("T", " ")}, à partir des ventes jusqu'au ${run.data_end}.`
        : `Computed on ${run.run_at.replace("T", " ")}, from sales up to ${run.data_end}.`),
    });
  }

  // 3. Journée chargée dans les 7 prochains jours
  if (fc.status === "fulfilled") {
    const days: any[] = (fc.value?.forecast || []).filter((d: any) => !d.is_ferme && d.yhat > 0);
    if (days.length >= 3) {
      const avg = days.reduce((s, d) => s + d.yhat, 0) / days.length;
      const peak = days.reduce((a, b) => (b.yhat > a.yhat ? b : a));
      const pct = avg > 0 ? (peak.yhat / avg - 1) * 100 : 0;
      if (pct >= 15) out.push({
        id: `busy-${peak.ds}`, kind: "busy", href: "/previsions",
        title: both((l) => l === "fr" ? `${dayName(peak.ds, l)} : journée chargée prévue` : `${dayName(peak.ds, l)}: busy day ahead`),
        body: both((l) => l === "fr"
          ? `${nf(peak.yhat, l)} articles prévus, ${nf(pct, l)} % de plus qu'un jour moyen de la semaine. Prévoir le personnel et la production.`
          : `${nf(peak.yhat, l)} items forecast, ${nf(pct, l)}% more than an average day this week. Plan staff and production.`),
      });
    }
  }

  // 4. Saison à venir : jours à fort risque de manque (toute la boutique)
  if (season.status === "fulfilled") {
    const n = Number(season.value?.kpis?.statuts?.RUPTURE || 0);
    if (n > 0) out.push({
      id: `season-${n}`, kind: "season", href: "/alertes",
      title: both((l) => l === "fr" ? `Saison à venir : ${n} jour(s) très chargé(s)` : `Coming season: ${n} very busy day(s)`),
      body: both((l) => l === "fr" ? "Au moins 20 % de plus qu'un jour habituel du même mois : prévoir le personnel et les commandes. Calendrier dans Alertes & Stock." : "At least 20% more than a usual day of the same month: plan staff and orders. Calendar in Alerts & Stock."),
    });
  }
  // Ordre d'affichage : le plus urgent d'abord
  const order: NotifKind[] = ["stock", "risk", "unsold", "busy", "season", "forecast"];
  return out.sort((x, y) => order.indexOf(x.kind) - order.indexOf(y.kind));
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [dataItems, setDataItems] = useState<Notif[]>([]);
  const [chatItems, setChatItems] = useState<Notif[]>([]);
  const [readIds, setReadIds] = useState<string[]>([]);

  useEffect(() => {
    setReadIds(load("local", READ_KEY, [] as string[]));
    setChatItems(load("session", CHAT_KEY, [] as Notif[]));
    buildDataNotifs().then(setDataItems).catch(() => setDataItems([]));
  }, []);

  const isRead = useCallback((id: string) => readIds.includes(id), [readIds]);
  const markRead = useCallback((id: string) => {
    setReadIds((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id].slice(-300);
      save("local", READ_KEY, next);
      return next;
    });
  }, []);
  const items = useMemo(() => [...chatItems, ...dataItems], [chatItems, dataItems]);
  const markAllRead = useCallback(() => {
    setReadIds((prev) => {
      const next = Array.from(new Set([...prev, ...items.map((i) => i.id)])).slice(-300);
      save("local", READ_KEY, next);
      return next;
    });
  }, [items]);
  const notify = useCallback((n: Notif) => {
    setChatItems((prev) => {
      const next = [n, ...prev.filter((p) => p.id !== n.id)].slice(0, 20);
      save("session", CHAT_KEY, next);
      return next;
    });
  }, []);

  const unread = items.filter((i) => !readIds.includes(i.id)).length;

  // Onglet du navigateur : « (1) BakeAgent… » quand l'assistant a répondu et que ce n'est pas encore lu
  useEffect(() => {
    const unreadChat = chatItems.filter((i) => !readIds.includes(i.id)).length;
    const base = document.title.replace(/^\(\d+\)\s*/, "");
    document.title = unreadChat ? `(${unreadChat}) ${base}` : base;
  }, [chatItems, readIds]);

  return <Ctx.Provider value={{ items, unread, isRead, markRead, markAllRead, notify }}>{children}</Ctx.Provider>;
}

export function useNotifications() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useNotifications must be used within a NotificationProvider");
  return c;
}
