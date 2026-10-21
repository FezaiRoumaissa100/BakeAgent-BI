"use client";

// Carte « À préparer » (page Alertes & Stock) : la liste de production d'un jour, produit par produit,
// avec la quantité conseillée, l'écart avec l'habitude, sa raison et sa valeur en euros. Imprimable.
// Données : /api/alerts/products (mêmes chiffres que la grille « Les 14 prochains jours »).

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { fetchProductAlerts } from "@/lib/api";
import { tr, trData, locale } from "@/lib/i18n";
import { siteConfig } from "@/lib/siteConfig";
import { ExpertNote } from "@/components/Expert";

const fmt = (n: number, d = 0) => Number(n || 0).toLocaleString(locale(), { minimumFractionDigits: d, maximumFractionDigits: d });
const eur = (n: number) => `${fmt(n)} €`;

// Texte de la raison envoyée par le backend (code + valeurs)
export function raisonText(r: any): string {
  if (!r) return "";
  switch (r.code) {
    case "ferie": return tr(`Jour férié (${r.nom})`, `Public holiday (${r.nom})`);
    case "veille": return tr(`Veille de ${r.nom}`, `Day before ${r.nom}`);
    case "saison": return tr("Produit de saison qui reprend", "Seasonal product coming back");
    case "an_dernier": return tr(`L'an dernier ce jour-là : ${fmt(r.ly)} vendus`, `Same day last year: ${fmt(r.ly)} sold`);
    case "tendance": return r.sens === "hausse" ? tr("Ventes en hausse ces dernières semaines", "Sales rising in recent weeks") : tr("Ventes en baisse ces dernières semaines", "Sales falling in recent weeks");
    default: return "";
  }
}

const CHIP: Record<string, { fr: string; en: string; c: string; bg: string }> = {
  RUPTURE: { fr: "Prévoir plus", en: "Make more", c: "#fff", bg: "var(--dk-alert)" },
  VIGILANCE: { fr: "Un peu plus", en: "A bit more", c: "#1E2A22", bg: "#E9C46A" },
  SURSTOCK: { fr: "Prévoir moins", en: "Make less", c: "#fff", bg: "#7FA3C8" },
};

export function PrepListCard() {
  const [data, setData] = useState<any>(null);
  const [day, setDay] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const [printing, setPrinting] = useState(false);

  useEffect(() => { fetchProductAlerts(7).then(setData).catch(() => setData({ available: false })); }, []);

  const items: any[] = data?.items || [];
  // Jours ouverts proposés (les 4 premiers)
  const openDays: string[] = useMemo(() => (data?.dates || []).filter((ds: string) =>
    items.some((i) => (i.days || []).some((d: any) => d.ds === ds && d.statut !== "FERMÉ"))).slice(0, 4), [data, items]);
  const ds = day && openDays.includes(day) ? day : openDays[0];

  const rows = useMemo(() => {
    if (!ds) return [];
    return items.map((i) => ({ i, d: (i.days || []).find((x: any) => x.ds === ds) }))
      .filter(({ d }) => d && d.statut !== "FERMÉ" && (d.yhat >= 1 || d.usual >= 1))
      .map(({ i, d }) => ({ article: i.article, category: i.category, prix: i.prix, ...d, prep: Math.max(0, Math.ceil(d.conseille ?? d.yhat)) }))
      .sort((a, b) => (a.category || "").localeCompare(b.category || "") || b.prep - a.prep);
  }, [items, ds]);

  if (!data || !data.available || !ds) return null;

  const flagged = rows.filter((r) => CHIP[r.statut]);
  const manque = flagged.filter((r) => r.statut !== "SURSTOCK").reduce((s, r) => s + (r.euros || 0), 0);
  const invendus = flagged.filter((r) => r.statut === "SURSTOCK").reduce((s, r) => s + (r.euros || 0), 0);
  const ventes = rows.reduce((s, r) => s + (r.prix ? r.yhat * r.prix : 0), 0);
  // À l'écran : d'abord les produits qui changent, puis les plus gros volumes
  const screenRows = [...rows].sort((a, b) => (CHIP[b.statut] ? 1 : 0) - (CHIP[a.statut] ? 1 : 0) || (b.euros || 0) - (a.euros || 0) || b.prep - a.prep);
  const shown = all ? screenRows : screenRows.slice(0, 12);

  const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
  const dayLong = (x: string) => cap(new Date(x + "T12:00:00").toLocaleDateString(locale(), { weekday: "long", day: "numeric", month: "long" }));
  const dayShort = (x: string) => cap(new Date(x + "T12:00:00").toLocaleDateString(locale(), { weekday: "short", day: "numeric", month: "short" }));

  const print = () => {
    setPrinting(true);
    document.documentElement.classList.add("print-prep");
    setTimeout(() => {
      try { window.print(); } finally {
        document.documentElement.classList.remove("print-prep");
        setPrinting(false);
      }
    }, 50);
  };

  return (
    <>
      <div className="alert-part">
        <div className="alert-part-k">{tr("Liste de production", "Production list")}</div>
        <h2 className="alert-part-t">{tr("À ", "To ")}<span style={{ color: "var(--dk-accent)" }}>{tr("préparer", "prepare")}</span></h2>
        <p className="alert-part-d">{tr("Quantité conseillée par produit = prévision + une marge pour ne pas manquer 9 jours sur 10. À imprimer pour la production.", "Suggested quantity per product = forecast + a margin so you don't run out 9 days out of 10. Print it for production.")}</p>
      </div>
      <div className="sw">
        <div className="cc">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div className="prep-days">
              {openDays.map((x, k) => (
                <button key={x} className={x === ds ? "on" : ""} onClick={() => setDay(x)}>
                  {k === 0 ? tr("Prochain jour", "Next day") : dayShort(x)}
                </button>
              ))}
            </div>
            <button className="prep-print-btn" onClick={print} disabled={printing}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
              {tr("Imprimer la liste", "Print the list")}
            </button>
          </div>

          <div className="prep-sum">
            <div><span>{tr("Jour", "Day")}</span><b>{dayLong(ds)}</b></div>
            <div><span>{tr("Produits à préparer", "Products to prepare")}</span><b className="num">{fmt(rows.length)}</b><small>{tr(`dont ${flagged.length} à ajuster`, `${flagged.length} to adjust`)}</small></div>
            <div><span>{tr("Ventes prévues", "Forecast sales")}</span><b className="num">≈ {eur(ventes)}</b></div>
            <div><span>{tr("Ventes à ne pas manquer", "Sales not to miss")}</span><b className="num" style={{ color: manque ? "var(--dk-alert)" : undefined }}>{manque ? `≈ ${eur(manque)}` : "—"}</b><small>{tr("si l'on prépare comme d'habitude", "if you prepare as usual")}</small></div>
            <div><span>{tr("Invendus évitables", "Avoidable unsold")}</span><b className="num" style={{ color: invendus ? "var(--ch-3)" : undefined }}>{invendus ? `≈ ${eur(invendus)}` : "—"}</b><small>{tr("valeur de vente", "at sale price")}</small></div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="prep-table">
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>{tr("Produit", "Product")}</th>
                  <th>{tr("D'habitude", "Usual")}</th>
                  <th>{tr("Prévu", "Forecast")}</th>
                  <th>{tr("À préparer", "To prepare")}</th>
                  <th style={{ textAlign: "left" }}>{tr("Pourquoi", "Why")}</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => {
                  const c = CHIP[r.statut];
                  return (
                    <tr key={r.article}>
                      <td><b>{r.article}</b><small>{trData(r.category)}</small></td>
                      <td className="num">{fmt(r.usual)}</td>
                      <td className="num">{fmt(r.yhat)}</td>
                      <td className="num prep-qty">{fmt(r.prep)}</td>
                      <td>
                        {c ? (
                          <span className="prep-why">
                            <span className="prep-chip" style={{ background: c.bg, color: c.c }}>{tr(c.fr, c.en)}{r.euros ? ` · ${eur(r.euros)}` : ""}</span>
                            <span>{raisonText(r.raison)}</span>
                          </span>
                        ) : <span style={{ color: "var(--dk-muted)" }}>{tr("Comme d'habitude", "As usual")}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {rows.length > 12 && (
            <button className="link-btn" onClick={() => setAll((v) => !v)}>
              {all ? tr("Afficher moins", "Show less") : tr(`Voir les ${rows.length} produits`, `See all ${rows.length} products`)}
            </button>
          )}
          <ExpertNote>
            À préparer = borne haute de la prévision du produit (quantile 90 % des erreurs observées en test), arrondie à l'unité supérieure. Euros = |prévu − habituel| × prix moyen du produit sur les 90 derniers jours de ventes (valeur de vente, pas coût de production). Raisons : jour férié ou veille de jour férié (réglage jours_feries_pays), produit presque pas vendu ces dernières semaines, ventes du même jour de semaine 52 semaines plus tôt, sinon tendance récente. Calcul du {data.run?.run_at}.
          </ExpertNote>
        </div>
      </div>

      {/* Feuille imprimée : toute la liste, rangée par famille, avec une colonne « Préparé » à remplir à la main */}
      {printing && typeof document !== "undefined" && createPortal(
        <div className="prep-sheet">
          <h1>{siteConfig.bakeryName || siteConfig.productName} — {tr("À préparer", "To prepare")}</h1>
          <p>{dayLong(ds)} · {fmt(rows.length)} {tr("produits", "products")}</p>
          <table>
            <thead><tr><th>{tr("Produit", "Product")}</th><th>{tr("Famille", "Family")}</th><th>{tr("Habituel", "Usual")}</th><th>{tr("À préparer", "To prepare")}</th><th>{tr("Note", "Note")}</th><th>{tr("Préparé", "Made")}</th><th>{tr("Restant le soir", "Left at close")}</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.article}>
                  <td>{r.article}</td><td>{trData(r.category)}</td><td>{fmt(r.usual)}</td><td><b>{fmt(r.prep)}</b></td>
                  <td>{CHIP[r.statut] ? `${tr(CHIP[r.statut].fr, CHIP[r.statut].en)} — ${raisonText(r.raison)}` : ""}</td><td></td><td></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>, document.body)}
    </>
  );
}
