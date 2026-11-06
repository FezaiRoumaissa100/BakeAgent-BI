"use client";

// Carte « À préparer » (page Alertes & Stock) : la liste de production d'un jour, produit par produit,
// avec la quantité conseillée, l'écart avec l'habitude, sa raison et sa valeur en euros. Imprimable.
// Données : /api/alerts/products (mêmes chiffres que la grille « Les 14 prochains jours »).

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { fetchProductAlerts, fetchProductionSlots } from "@/lib/api";
import { planTrays, splitQty, TrayInfo } from "@/lib/trays";
import { tr, trData, locale } from "@/lib/i18n";
import { siteConfig } from "@/lib/siteConfig";
import { ExpertNote } from "@/components/Expert";
import { Scope } from "@/components/Ui";

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

// Réponse de /api/production/slots : part des ventes de chaque produit par tranche horaire
type SlotPlan = { available: boolean; edges: number[]; shop_shares: number[]; history_days: string[]; items: { product_id: number; shares: number[]; n: number }[] };

// Titres des tranches à partir des frontières en heures (ex. [10, 13] : avant 10 h · 10 h–13 h · dès 13 h)
function slotLabels(edges: number[]): string[] {
  return [tr(`Avant ${edges[0]} h`, `Before ${edges[0]}:00`),
    ...edges.slice(1).map((e, k) => `${edges[k]} h – ${e} h`),
    tr(`Dès ${edges[edges.length - 1]} h`, `From ${edges[edges.length - 1]}:00`)];
}

// Pourquoi la quantité conseillée d'un produit a été corrigée d'après la saisie du stock (backend/engines/quantity_engine.py)
export function ajustementText(q: any): string {
  if (!q || !q.ajustement) return "";
  if (q.ajustement === "souvent_epuise") return tr(`Épuisé ${q.jours_epuises} soirs sur ${q.jours_saisis} ces dernières semaines : on conseille un peu plus`, `Sold out ${q.jours_epuises} evenings out of ${q.jours_saisis} in recent weeks: suggesting a bit more`);
  if (q.ajustement === "souvent_restes") return tr(`Il en restait ${fmt((q.part_restes || 0) * 100)} % le soir ces dernières semaines : on conseille un peu moins`, `${fmt((q.part_restes || 0) * 100)}% was left over in the evening in recent weeks: suggesting a bit less`);
  return "";
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
  const [bySlot, setBySlot] = useState(false);      // plan par tranche horaire (fournées)
  const [plan, setPlan] = useState<SlotPlan | null>(null);
  // Liste à préparer en PIÈCES uniquement (retour demandé : plus de conversion en plaques ici).
  // Les plaques restent disponibles sur la page « Saisie du stock » (saisie et tailles de plaque).
  const trayMap = useMemo(() => new Map<number, TrayInfo>(), []);

  useEffect(() => { fetchProductAlerts(7).then(setData).catch(() => setData({ available: false })); }, []);

  const items: any[] = data?.items || [];
  // Jours ouverts proposés (les 4 premiers)
  const openDays: string[] = useMemo(() => (data?.dates || []).filter((ds: string) =>
    items.some((i) => (i.days || []).some((d: any) => d.ds === ds && d.statut !== "FERMÉ"))).slice(0, 4), [data, items]);
  const ds = day && openDays.includes(day) ? day : openDays[0];

  // Parts des ventes par tranche horaire pour le jour choisi (chargées seulement si le plan par fournée est affiché)
  useEffect(() => {
    if (!bySlot || !ds) return;
    setPlan(null);
    fetchProductionSlots(ds).then(setPlan).catch(() => setPlan({ available: false, edges: [], shop_shares: [], history_days: [], items: [] }));
  }, [bySlot, ds]);
  const slotOn = bySlot && !!plan?.available;
  const labels: string[] = slotOn && plan ? slotLabels(plan.edges) : [];
  const shareOf = useMemo(() => {
    const m = new Map<number, number[]>();
    (plan?.items || []).forEach((x) => m.set(x.product_id, x.shares));
    return m;
  }, [plan]);
  // Par tranche : des plaques entières pour un produit en plaques (les plaques sont réparties, pas les pièces), sinon des pièces
  const slotCells = (r: { product_id: number; prep: number; tp: ReturnType<typeof planTrays> }): { vals: number[]; unit: string } | null => {
    if (!slotOn || !plan) return null;
    const sh = shareOf.get(r.product_id) || plan.shop_shares;
    return r.tp ? { vals: splitQty(r.tp.trays, sh), unit: tr(" pl.", " tr.") } : { vals: splitQty(r.prep, sh), unit: "" };
  };

  const rows = useMemo(() => {
    if (!ds) return [];
    return items.map((i) => ({ i, d: (i.days || []).find((x: any) => x.ds === ds) }))
      .filter(({ d }) => d && d.statut !== "FERMÉ" && (d.yhat >= 1 || d.usual >= 1))
      .map(({ i, d }) => {
        const prep = Math.max(0, Math.ceil(d.conseille ?? d.yhat));
        return { product_id: i.product_id, article: i.article, category: i.category, prix: i.prix, ...d, prep, tp: planTrays(prep, trayMap.get(i.product_id)) };
      })
      .sort((a, b) => (a.category || "").localeCompare(b.category || "") || b.prep - a.prep);
  }, [items, ds, trayMap]);

  if (!data || !data.available || !ds) return null;

  const flagged = rows.filter((r) => CHIP[r.statut]);
  const manque = flagged.filter((r) => r.statut !== "SURSTOCK").reduce((s, r) => s + (r.euros || 0), 0);
  const invendus = flagged.filter((r) => r.statut === "SURSTOCK").reduce((s, r) => s + (r.euros || 0), 0);
  const ventes = rows.reduce((s, r) => s + (r.prix ? r.yhat * r.prix : 0), 0);
  // Plaques : pièces en plus créées par l'arrondi à la plaque entière, valorisées au prix de vente
  const anyTray = rows.some((r) => r.tp);
  const nbTray = rows.filter((r) => r.tp).length;
  const surplusEur = rows.reduce((s, r) => s + (r.tp && r.prix ? Math.max(0, r.tp.surplus) * r.prix : 0), 0);
  const plaque = (n: number) => (n > 1 ? tr("plaques", "trays") : tr("plaque", "tray"));
  const trayCell = (r: (typeof rows)[number]) => {
    if (!r.tp) return <span style={{ color: "var(--dk-muted)" }}>—</span>;
    const est = trayMap.get(r.product_id)?.estimate;
    return (
      <>
        <b>{fmt(r.tp.trays)}</b> {plaque(r.tp.trays)}
        <small style={{ display: "block", color: "var(--dk-muted)" }}>
          {`= ${fmt(r.tp.planned)} ${tr("pièces", "pieces")}`}{r.tp.surplus ? ` (${r.tp.surplus > 0 ? "+" : ""}${fmt(r.tp.surplus)})` : ""}
          {est ? ` · ${tr("taille à confirmer", "size to confirm")}` : ""}
        </small>
      </>
    );
  };
  // À l'écran : d'abord les produits qui changent, puis les plus gros volumes
  const screenRows = [...rows].sort((a, b) => (CHIP[b.statut] ? 1 : 0) - (CHIP[a.statut] ? 1 : 0) || (b.euros || 0) - (a.euros || 0) || b.prep - a.prep);
  const shown = all ? screenRows : screenRows.slice(0, 8);   // 8 lignes à l'écran (moins chargé) ; « Voir les N produits » pour le reste

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
        <p className="alert-part-d">{tr("Quantité conseillée par produit = prévision + une petite marge, calculée pour limiter les invendus jetés le soir sans trop manquer de ventes. À imprimer pour la production.", "Suggested quantity per product = forecast + a small margin, set to limit unsold items thrown away in the evening without missing too many sales. Print it for production.")}</p>
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
            <button className="prep-print-btn" onClick={() => setBySlot((v) => !v)} aria-pressed={bySlot}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
              {bySlot ? tr("Masquer les fournées", "Hide the batches") : tr("Plan par fournée", "Batch plan")}
            </button>
            <button className="prep-print-btn" onClick={print} disabled={printing}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
              {tr("Imprimer la liste", "Print the list")}
            </button>
          </div>

          <div className="prep-sum">
            <div><span>{tr("Produits à préparer", "Products to prepare")}</span><b className="num">{fmt(rows.length)}</b><small>{tr(`dont ${flagged.length} à ajuster`, `${flagged.length} to adjust`)}</small></div>
            <div><span>{tr("Ventes à ne pas manquer", "Sales not to miss")}</span><b className="num" style={{ color: manque ? "var(--dk-alert)" : undefined }}>{manque ? `≈ ${eur(manque)}` : "—"}</b><small>{tr("si l'on prépare comme d'habitude", "if you prepare as usual")}</small></div>
            <div><span>{tr("Invendus évitables", "Avoidable unsold")}</span><b className="num" style={{ color: invendus ? "var(--ch-3)" : undefined }}>{invendus ? `≈ ${eur(invendus)}` : "—"}</b><small>{tr("valeur de vente", "at sale price")}</small></div>
            {anyTray && (
              <div><span>{tr("Surplus de plaques entières", "Whole-tray surplus")}</span><b className="num">{surplusEur ? `≈ ${eur(surplusEur)}` : "—"}</b><small>{tr(`pièces en plus pour finir les plaques (${nbTray} produits) · valeur de vente`, `extra pieces to fill whole trays (${nbTray} products) · at sale price`)}</small></div>
            )}
          </div>

          {bySlot && (
            <p className="alert-part-d" style={{ margin: "4px 0 10px" }}>
              {!plan ? tr("Calcul du plan par fournée…", "Computing the batch plan…")
                : !plan.available ? tr("Pas assez d'historique horaire pour ce jour.", "Not enough hourly history for this day.")
                : tr(`Ce jour de la semaine, la boutique vend d'habitude ${plan.shop_shares.map((s: number, k: number) => `${fmt(s * 100)} % ${labels[k].toLowerCase()}`).join(", ")}. La quantité à préparer de chaque produit est répartie selon son propre rythme (les ${plan.history_days.length} derniers mêmes jours de la semaine).`,
                     `On this weekday the shop usually sells ${plan.shop_shares.map((s: number, k: number) => `${fmt(s * 100)}% ${labels[k].toLowerCase()}`).join(", ")}. Each product's quantity to prepare is split by its own rhythm (the last ${plan.history_days.length} same weekdays).`)}
              {anyTray && " " + tr("Pour les produits en plaques, la colonne indique des plaques entières (pl.) ; sinon des pièces.", "For products made in trays the column shows whole trays (tr.); otherwise pieces.")}
            </p>
          )}

          {ds && (
            <Scope period={tr(`Pour ${dayLong(ds).toLowerCase()} ${ds.slice(0, 4)}`, `For ${dayLong(ds)} ${ds.slice(0, 4)}`)}
              calc={tr("D'habitude = ce que le produit vend un jour comme celui-ci · Prévu = prévision du jour · À préparer = prévu + petite marge", "Usual = what the product sells on a day like this · Forecast = the day's forecast · To prepare = forecast + small margin")}
              unit={tr("pièces", "pieces")} />
          )}
          <div style={{ overflowX: "auto" }}>
            <table className="prep-table">
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>{tr("Produit", "Product")}</th>
                  <th>{tr("D'habitude", "Usual")}</th>
                  <th>{tr("Prévu", "Forecast")}</th>
                  <th>{tr("À préparer", "To prepare")}</th>
                  {anyTray && <th>{tr("En plaques", "In trays")}</th>}
                  {labels.map((l) => <th key={l}>{l}</th>)}
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
                      {anyTray && <td className="num">{trayCell(r)}</td>}
                      {slotCells(r)?.vals.map((q, k) => <td key={k} className="num">{fmt(q)}{slotCells(r)?.unit}</td>)}
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
            À préparer = quantile de la prévision au niveau de couverture du produit, arrondi à l'unité supérieure (backend/engines/quantity_engine.py). Niveau = 1 − coût de revient / prix (PART_COUT_DEFAUT = 0,35 par défaut, soit 65 % : point d'équilibre entre le coût d'un invendu et la marge d'une vente manquée), lu par interpolation entre la prévision centrale (50 %) et la borne haute (90 %). Il monte de 10 points si le produit a été épuisé bien plus souvent que prévu, baisse de 10 points s'il en restait souvent (saisie du stock, 4 dernières semaines, 8 jours minimum). Avant : borne haute (90 %), soit des restes presque tous les soirs. Euros = |prévu − habituel| × prix moyen du produit sur les 90 derniers jours de ventes (valeur de vente, pas coût de production). Raisons : jour férié ou veille de jour férié (réglage jours_feries_pays), produit presque pas vendu ces dernières semaines, ventes du même jour de semaine 52 semaines plus tôt, sinon tendance récente. Plan par fournée : parts des ventes de chaque tranche horaire mesurées sur les derniers mêmes jours de la semaine où la boutique était ouverte (un produit peu vendu emprunte en partie le profil de la boutique) ; la quantité à préparer est répartie entre les tranches, la somme reste égale au total. Les frontières des tranches se règlent dans backend/config.py (CRENEAUX_HORAIRES). Toutes les quantités sont en pièces (les plaques se gèrent sur la page « Saisie du stock »). Calcul du {data.run?.run_at}.
          </ExpertNote>
        </div>
      </div>

      {/* Feuille imprimée : toute la liste, rangée par famille, avec une colonne « Préparé » à remplir à la main */}
      {printing && typeof document !== "undefined" && createPortal(
        <div className="prep-sheet">
          <h1>{siteConfig.bakeryName || siteConfig.productName} — {tr("À préparer", "To prepare")}</h1>
          <p>{dayLong(ds)} · {fmt(rows.length)} {tr("produits", "products")}</p>
          <table>
            <thead><tr><th>{tr("Produit", "Product")}</th><th>{tr("Famille", "Family")}</th><th>{tr("Habituel", "Usual")}</th><th>{tr("À préparer", "To prepare")}</th>{anyTray && <th>{tr("Plaques", "Trays")}</th>}{labels.map((l) => <th key={l}>{l}</th>)}<th>{tr("Note", "Note")}</th><th>{tr("Préparé", "Made")}</th><th>{tr("Restant le soir", "Left at close")}</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.article}>
                  <td>{r.article}</td><td>{trData(r.category)}</td><td>{fmt(r.usual)}</td><td><b>{fmt(r.prep)}</b></td>{anyTray && <td>{r.tp ? `${fmt(r.tp.trays)} ${plaque(r.tp.trays)} (${fmt(r.tp.planned)})` : ""}</td>}{slotCells(r)?.vals.map((q, k) => <td key={k}>{fmt(q)}{slotCells(r)?.unit}</td>)}
                  <td>{CHIP[r.statut] ? `${tr(CHIP[r.statut].fr, CHIP[r.statut].en)} — ${raisonText(r.raison)}` : ""}</td><td></td><td></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>, document.body)}
    </>
  );
}
