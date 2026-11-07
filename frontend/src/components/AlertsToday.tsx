"use client";

// Page Alertes & Stock, version simple :
//  - « Demain » : une grande carte. À gauche, le jour et ce qu'il faut retenir en une phrase ; à droite, seulement
//    les produits qui changent (« Préparer plus » / « Préparer moins »), avec l'habitude → la quantité conseillée.
//    Les produits qui ne changent pas ne sont pas listés : il n'y a rien à faire pour eux. La liste complète
//    s'imprime d'un clic (et reste consultable dans « Voir le détail »).
//  - « À surveiller » : au plus quatre produits sur les 14 prochains jours, chacun en une phrase,
//    avec une petite rangée de points (un point par jour) au lieu de la grande grille colorée.
// Données : /api/alerts/products (les mêmes que la liste à préparer et la grille, rien de nouveau côté backend).

import React, { useEffect, useMemo, useState } from "react";
import { fetchProductAlerts } from "@/lib/api";
import { tr, trData, locale } from "@/lib/i18n";
import { ChartAssistantButton } from "@/components/ChartAssistantButton";
import { useChat } from "@/contexts/ChatContext";
import { prepRows, prepOpenDays, usePrepPrint, PrepSheet, raisonText } from "@/components/PrepList";

const fmt = (n: number, d = 0) => Number(n || 0).toLocaleString(locale(), { minimumFractionDigits: d, maximumFractionDigits: d });
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
// « BAGUETTE TRADITION » → « Baguette tradition »
const nice = (a: string) => cap(String(a || "").toLowerCase());
const dateOf = (ds: string) => new Date(ds + "T12:00:00");

// ── Demain ────────────────────────────────────────────────────────────────────
export function AlertsToday() {
  const { openChat } = useChat();
  const [data, setData] = useState<any>(null);
  const [day, setDay] = useState<string | null>(null);
  const { printing, print } = usePrepPrint();

  useEffect(() => { fetchProductAlerts(7).then(setData).catch(() => setData({ available: false })); }, []);
  const openDays = useMemo(() => prepOpenDays(data), [data]);
  const ds = day && openDays.includes(day) ? day : openDays[0];
  const rows = useMemo(() => prepRows(data?.items || [], ds), [data, ds]);

  if (!data) return <div className="sw"><div className="al-today al-wait" aria-hidden="true" /></div>;
  if (!data.available || !ds) {
    return (
      <div className="sw"><div className="cc">
        <div className="ct">{tr("Demain", "Tomorrow")}</div>
        <div className="cs" style={{ marginBottom: 0 }}>{tr("La prévision par produit n'a pas encore été calculée (python forecasting\\pipeline.py).", "The per-product forecast has not been computed yet (python forecasting\\pipeline.py).")}</div>
      </div></div>
    );
  }

  const more = rows.filter((r: any) => r.statut === "RUPTURE" || r.statut === "VIGILANCE").sort((a: any, b: any) => (b.euros || 0) - (a.euros || 0));
  const less = rows.filter((r: any) => r.statut === "SURSTOCK").sort((a: any, b: any) => (b.euros || 0) - (a.euros || 0));
  const eurMore = more.reduce((s: number, r: any) => s + (r.euros || 0), 0);
  const eurLess = less.reduce((s: number, r: any) => s + (r.euros || 0), 0);

  // La phrase du jour : la raison la plus fréquente des écarts (jour férié, veille…), sinon le sens des écarts
  const d0 = dateOf(ds);
  const wd = cap(d0.toLocaleDateString(locale(), { weekday: "long" }));
  const dm = d0.toLocaleDateString(locale(), { day: "numeric", month: "long" });
  const reasons = [...more, ...less].map((r: any) => r.raison).filter((r: any) => r && (r.code === "ferie" || r.code === "veille"));
  const special = reasons[0];
  const specialText = special ? raisonText(special) : "";
  const headline = (() => {
    const sens = less.length > more.length * 2 ? tr("prévoir moins que d'habitude", "prepare less than usual")
      : more.length > less.length * 2 ? tr("prévoir plus que d'habitude", "prepare more than usual")
      : tr("quelques quantités à ajuster", "a few quantities to adjust");
    if (special) return `${raisonText(special)} : ${sens}.`;
    if (!more.length && !less.length) return tr("Une journée comme d'habitude : rien à changer.", "A day like usual: nothing to change.");
    return cap(sens) + ".";
  })();

  const row = (r: any, up: boolean) => {
    const usual = Math.round(r.usual || 0), prep = r.prep;
    const delta = prep - usual;
    return (
      <li key={r.product_id} className="al-row">
        <div className="al-row-name">
          <b title={r.article}>{nice(r.article)}</b>
          {/* La raison seulement si elle n'est pas déjà dans la phrase du jour (ex. le jour férié) */}
          <small>{(r.raison && raisonText(r.raison) !== specialText && raisonText(r.raison)) || trData(r.category)}</small>
        </div>
        <div className="al-row-q">
          <span className="al-row-from num">{fmt(usual)}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          <span className="al-row-to num">{fmt(prep)}</span>
          <span className={`al-delta num ${up ? "up" : "down"}`}>{delta > 0 ? "+" : ""}{fmt(delta)}</span>
        </div>
      </li>
    );
  };

  const column = (list: any[], up: boolean) => (
    <div className={`al-col ${up ? "up" : "down"}`}>
      <div className="al-col-h">
        <span className="al-col-ic" aria-hidden="true">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">{up ? <path d="M12 19V5M5 12l7-7 7 7" /> : <path d="M12 5v14M5 12l7 7 7-7" />}</svg>
        </span>
        <b>{up ? tr("Préparer plus", "Make more") : tr("Préparer moins", "Make less")}</b>
        <span className="al-col-n num">{fmt(list.length)}</span>
      </div>
      {list.length ? (
        <ul>{list.slice(0, 5).map((r) => row(r, up))}</ul>
      ) : (
        <div className="al-empty">{up ? tr("Aucun produit à préparer en plus.", "No product to make more of.") : tr("Aucun produit à préparer en moins.", "No product to make less of.")}</div>
      )}
      {list.length > 5 && <div className="al-col-more">{tr(`et ${list.length - 5} autre(s) dans la liste complète`, `and ${list.length - 5} more in the full list`)}</div>}
    </div>
  );

  return (
    <div className="sw">
      <div className="al-today">
        {/* Le jour, en grand */}
        <div className="al-day">
          <span className="al-day-num num" aria-hidden="true">{d0.getDate()}</span>
          <div className="al-day-days" role="group" aria-label={tr("Jour", "Day")}>
            {openDays.map((x, k) => (
              <button key={x} type="button" className={x === ds ? "on" : ""} onClick={() => setDay(x)}>
                {k === 0 ? tr("Demain", "Next day") : cap(dateOf(x).toLocaleDateString(locale(), { weekday: "short" }).replace(".", ""))}
              </button>
            ))}
          </div>
          <div className="al-day-k">{wd}</div>
          <div className="al-day-t">{dm}</div>
          <p className="al-day-h">{headline}</p>
          <div className="al-day-stats">
            <div><b className="num">{fmt(rows.length)}</b><span>{tr("produits à préparer", "products to prepare")}</span></div>
            {eurMore > 0 && <div><b className="num">≈ {fmt(eurMore)} €</b><span>{tr("de ventes à ne pas manquer", "of sales not to miss")}</span></div>}
            {eurLess > 0 && <div><b className="num">≈ {fmt(eurLess)} €</b><span>{tr("d'invendus évitables", "of avoidable unsold")}</span></div>}
          </div>
          <button type="button" className="al-print" onClick={print} disabled={printing}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
            {tr("Imprimer la liste", "Print the list")}
          </button>
        </div>

        {/* Seulement ce qui change */}
        <div className="al-change">
          <ChartAssistantButton chartType="prep_list" chartData={{
            jour: ds, phrase: headline,
            preparer_plus: more.slice(0, 15).map((r: any) => ({ produit: r.article, habituel: r.usual, conseille: r.prep, raison: raisonText(r.raison), euros: r.euros })),
            preparer_moins: less.slice(0, 15).map((r: any) => ({ produit: r.article, habituel: r.usual, conseille: r.prep, raison: raisonText(r.raison), euros: r.euros })),
          }} chartName="PrepList" userQuestion="Explique ce qu'il faut préparer en plus ou en moins ce jour-là" position="top-right" onOpenChat={openChat} />
          <div className="al-change-h">{tr("Ce qui change par rapport à d'habitude", "What changes compared with usual")}</div>
          <div className="al-cols">
            {column(more, true)}
            {column(less, false)}
          </div>
        </div>
      </div>
      {printing && <PrepSheet rows={rows} ds={ds} />}
    </div>
  );
}

// ── À surveiller (14 jours) ──────────────────────────────────────────────────
export function AlertsWatch() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { fetchProductAlerts(14).then(setData).catch(() => setData({ available: false })); }, []);
  if (!data?.available) return null;
  const dates: string[] = data.dates || [];
  const items: any[] = data.items || [];
  const flagged = (i: any) => (i.days || []).filter((d: any) => d.statut === "RUPTURE" || d.statut === "VIGILANCE" || d.statut === "SURSTOCK");
  const watch = items.map((i) => ({ i, f: flagged(i) })).filter(({ f }) => f.length >= 2)
    .sort((a, b) => b.f.length - a.f.length || (b.i.euros_manque + b.i.euros_invendus) - (a.i.euros_manque + a.i.euros_invendus))
    .slice(0, 4);
  if (!watch.length) return null;

  const sentence = (i: any, f: any[]) => {
    const short = f.filter((d) => d.statut !== "SURSTOCK");
    const unsold = f.filter((d) => d.statut === "SURSTOCK");
    const open = (i.days || []).filter((d: any) => d.statut !== "FERMÉ").length;
    if (short.length >= unsold.length) {
      const perDay = short.reduce((s: number, d: any) => s + Math.max(0, d.yhat - d.usual), 0) / Math.max(1, short.length);
      return tr(`Risque de manquer ${short.length} jour${short.length > 1 ? "s" : ""} sur ${open} · prévoir environ ${fmt(Math.max(1, perDay))} de plus ces jours-là`,
                `May run short ${short.length} day${short.length > 1 ? "s" : ""} out of ${open} · plan about ${fmt(Math.max(1, perDay))} more on those days`);
    }
    const perDay = unsold.reduce((s: number, d: any) => s + Math.max(0, d.usual - d.yhat), 0) / Math.max(1, unsold.length);
    return tr(`Risque d'invendus ${unsold.length} jour${unsold.length > 1 ? "s" : ""} sur ${open} · prévoir environ ${fmt(Math.max(1, perDay))} de moins ces jours-là`,
              `May stay unsold ${unsold.length} day${unsold.length > 1 ? "s" : ""} out of ${open} · plan about ${fmt(Math.max(1, perDay))} less on those days`);
  };
  const first = dates[0], last = dates[dates.length - 1];
  const short = (ds: string) => dateOf(ds).toLocaleDateString(locale(), { day: "numeric", month: "short" });

  return (
    <div className="sw">
      <div className="al-h">
        <h2>{tr("À surveiller", "To watch")}</h2>
        {first && <span>{tr(`du ${short(first)} au ${short(last)}`, `${short(first)} – ${short(last)}`)}</span>}
      </div>
      <div className="al-watch">
        {watch.map(({ i, f }) => {
          const up = f.filter((d: any) => d.statut !== "SURSTOCK").length >= f.filter((d: any) => d.statut === "SURSTOCK").length;
          return (
            <a key={i.product_id} className={`al-w ${up ? "up" : "down"}`} href={`/previsions?produit=${encodeURIComponent(i.article)}#par-produit`}>
              <div className="al-w-top">
                <b>{nice(i.article)}</b>
                <small>{trData(i.category)}</small>
              </div>
              {/* Un point par jour : rouge = risque de manquer, jaune = à surveiller, bleu = risque d'invendus, creux = fermé */}
              <div className="al-dots" aria-hidden="true">
                {(i.days || []).map((d: any) => <i key={d.ds} className={`st-${d.statut === "FERMÉ" ? "FERME" : d.statut}`} title={`${d.ds}`} />)}
              </div>
              <p>{sentence(i, f)}</p>
              <span className="al-w-go">{tr("Voir sa prévision", "See its forecast")} →</span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
