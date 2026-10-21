"use client";

// Carte « Risque par produit » (page Alertes & Stock).
// Grille produit × jour : chaque case compare la prévision du produit à son jour habituel
// (médiane des 8 derniers mêmes jours de semaine ouverts, calculée par le pipeline), avec les mêmes seuils que la page.
// Clic sur une case : détail du jour ; clic sur un produit : sa prévision sur la page Prévisions.
// Données : /api/alerts/products (résultats de forecasting/pipeline.py).

import React, { useEffect, useMemo, useState } from "react";
import { fetchProductAlerts } from "@/lib/api";
import { tr, trData, locale } from "@/lib/i18n";
import { ExpertNote } from "@/components/Expert";
import { Takeaway } from "@/components/Ui";
import { ChartAssistantButton } from "@/components/ChartAssistantButton";
import { useChat } from "@/contexts/ChatContext";
import { raisonText } from "@/components/PrepList";

const fmt = (n: number, d = 0) => Number(n || 0).toLocaleString(locale(), { minimumFractionDigits: d, maximumFractionDigits: d });
const ST: Record<string, { fr: string; en: string; c: string; bg: string }> = {
  RUPTURE: { fr: "Risque de manque", en: "Shortage risk", c: "#fff", bg: "var(--dk-alert)" },
  VIGILANCE: { fr: "À surveiller", en: "Watch", c: "#1E2A22", bg: "#E9C46A" },
  NORMAL: { fr: "Normal", en: "Normal", c: "var(--dk-ink2)", bg: "var(--dk-soft)" },
  SURSTOCK: { fr: "Risque d'invendus", en: "Unsold risk", c: "#fff", bg: "#7FA3C8" },
  "FERMÉ": { fr: "Fermé", en: "Closed", c: "var(--dk-muted)", bg: "transparent" },
};
const J = ["di", "lu", "ma", "me", "je", "ve", "sa"], JE = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function ProductRiskCard() {
  const { openChat } = useChat();
  const [data, setData] = useState<any>(null);
  const [fam, setFam] = useState("Toutes");
  const [onlyRisk, setOnlyRisk] = useState(true);
  const [all, setAll] = useState(false);
  const [cell, setCell] = useState<{ p: any; d: any } | null>(null);

  useEffect(() => { fetchProductAlerts(14).then(setData).catch(() => setData({ available: false })); }, []);

  const items: any[] = data?.items || [];
  const fams = useMemo(() => ["Toutes", ...Array.from(new Set(items.map((i) => i.category))).sort()], [items]);
  const rows = useMemo(() => items
    .filter((i) => fam === "Toutes" || i.category === fam)
    .filter((i) => !onlyRisk || i.nb_risque + i.nb_vigilance > 0), [items, fam, onlyRisk]);
  const shown = all ? rows : rows.slice(0, 12);

  if (!data) return null;
  if (!data.available) {
    return (
      <div className="sw"><div className="cc">
        <div className="ct">{tr("Risque par produit", "Risk by product")}</div>
        <div className="cs" style={{ marginBottom: 0 }}>{tr("La prévision par produit n'a pas encore été calculée (python forecasting\\pipeline.py).", "The per-product forecast has not been computed yet (python forecasting\\pipeline.py).")}</div>
      </div></div>
    );
  }
  const dates: string[] = data.dates || [];
  const nbProdRisk = items.filter((i) => i.nb_risque > 0).length;
  const top = items[0];
  const eurManque = items.reduce((s, i) => s + (i.euros_manque || 0), 0);
  const eurInvendus = items.reduce((s, i) => s + (i.euros_invendus || 0), 0);

  return (
    <>
      <div className="alert-part">
        <div className="alert-part-k">{tr("Par produit", "By product")}</div>
        <h2 className="alert-part-t">{tr("Les 14 prochains", "The next 14")} <span style={{ color: "var(--dk-accent)" }}>{tr("jours", "days")}</span></h2>
        <p className="alert-part-d">{tr("Le plus utile au quotidien : quels produits risquent de manquer ou de rester invendus, et quel jour.", "Most useful day to day: which products may run short or stay unsold, and on which day.")}</p>
      </div>
      <div className="sw">
        <div className="cc hero-card" style={{ marginBottom: 16 }}>
          <ChartAssistantButton chartType="product_risk_grid" chartData={{
            dates, famille: fam, seulement_produits_a_risque: onlyRisk, nb_produits: rows.length,
            // Pour chaque produit : seulement les jours qui ne sont pas « normaux », pour rester lisible
            produits: rows.slice(0, 30).map((i: any) => ({ article: i.article, categorie: i.category, jours_risque: i.nb_risque, jours_vigilance: i.nb_vigilance,
              jours: (i.days || []).filter((d: any) => d.statut !== "NORMAL" && d.statut !== "FERMÉ").map((d: any) => ({ date: d.ds, statut: d.statut, prevu: d.yhat, habituel: d.usual, conseille: d.conseille })) })) }} chartName="ProductRiskGrid"
            userQuestion="Explique quels produits risquent de manquer et quels jours" position="top-right" onOpenChat={openChat} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", paddingRight: 34 }}>
            <div>
              <div className="ct">{tr("Quels produits risquent de manquer, et quel jour ?", "Which products may run short, and on which day?")}</div>
              <div className="cs">{tr("Chaque case compare la prévision du produit à ce qu'il vend d'habitude ce jour de la semaine (début de saison compris : une galette en janvier apparaît en rouge, il faut en préparer plus). Cliquez sur une case pour la quantité à préparer, sur un produit pour sa prévision.", "Each cell compares the product's forecast with what it usually sells on that weekday. Click a cell for the quantity to prepare, a product for its forecast.")}</div>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <select value={fam} onChange={(e) => setFam(e.target.value)} style={{ padding: "6px 12px", borderRadius: 999, border: "1px solid var(--dk-line)", background: "var(--dk-surface)", color: "var(--dk-ink)", fontSize: ".78rem", fontWeight: 600 }}>
                {fams.map((f) => <option key={f} value={f}>{f === "Toutes" ? tr("Toutes les familles", "All families") : trData(f)}</option>)}
              </select>
              <div style={{ display: "flex", gap: 3, padding: 3, borderRadius: 999, background: "var(--dk-soft)" }}>
                {[true, false].map((v) => (
                  <button key={String(v)} onClick={() => setOnlyRisk(v)} style={{ border: "none", cursor: "pointer", padding: "5px 12px", borderRadius: 999, fontSize: ".74rem", fontWeight: 700, background: onlyRisk === v ? "var(--dk-pill, #1F2B23)" : "transparent", color: onlyRisk === v ? "#fff" : "var(--dk-ink2)" }}>
                    {v ? tr("Produits à risque", "At-risk products") : tr("Tous les produits", "All products")}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ overflowX: "auto", marginTop: 10 }}>
            <table style={{ borderCollapse: "separate", borderSpacing: 3, width: "100%", minWidth: 760 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", fontSize: ".72rem", padding: "4px 6px", minWidth: 170 }}>{tr("Produit", "Product")}</th>
                  {dates.map((d) => {
                    const dt = new Date(d + "T00:00:00");
                    return <th key={d} style={{ fontSize: ".66rem", padding: "2px 0", textAlign: "center", fontWeight: 600, lineHeight: 1.2 }}>{tr(J[dt.getDay()], JE[dt.getDay()])}<br />{d.slice(8, 10)}/{d.slice(5, 7)}</th>;
                  })}
                </tr>
              </thead>
              <tbody>
                {shown.map((p) => (
                  <tr key={p.product_id}>
                    <td style={{ padding: "2px 6px", whiteSpace: "nowrap", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}>
                      <a className="prod-link" href={`/previsions?produit=${encodeURIComponent(p.article)}#par-produit`} style={{ fontSize: ".78rem", fontWeight: 700, color: "var(--dk-ink)" }}>{p.article}</a>
                      <div style={{ fontSize: ".66rem", color: "var(--dk-muted)" }}>{trData(p.category)}{p.excedent > 0 ? tr(` · +${fmt(p.excedent)} art. à prévoir`, ` · +${fmt(p.excedent)} extra items`) : ""}</div>
                    </td>
                    {p.days.map((d: any) => {
                      const s = ST[d.statut] || ST.NORMAL;
                      const on = cell?.p.product_id === p.product_id && cell?.d.ds === d.ds;
                      return (
                        <td key={d.ds} onClick={() => d.statut !== "FERMÉ" && setCell(on ? null : { p, d })}
                            title={`${p.article} · ${d.ds} : ${tr(s.fr, s.en)} (${fmt(d.yhat, 1)} / ${tr("habituel", "usual")} ${fmt(d.usual, 1)})`}
                            style={{ background: s.bg, color: s.c, textAlign: "center", fontSize: ".7rem", fontWeight: 700, borderRadius: 8, height: 34, minWidth: 40,
                                     cursor: d.statut === "FERMÉ" ? "default" : "pointer", outline: on ? "2.5px solid var(--dk-ink)" : "none", outlineOffset: -2,
                                     border: d.statut === "FERMÉ" ? "1px dashed var(--dk-line)" : "none" }}
                            className="num">
                          {d.statut === "FERMÉ" ? "—" : fmt(d.yhat)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && <div className="cs" style={{ padding: "16px 4px" }}>{tr("Aucun produit à risque sur ces jours.", "No at-risk product on these days.")}</div>}
          </div>

          {cell && (
            <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 16, background: "var(--dk-accent-wash)", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
              <div><div style={{ fontSize: ".72rem", color: "var(--dk-muted)" }}>{tr("Produit", "Product")}</div><div style={{ fontWeight: 800 }}>{cell.p.article}</div></div>
              <div><div style={{ fontSize: ".72rem", color: "var(--dk-muted)" }}>{tr("Jour", "Day")}</div><div style={{ fontWeight: 700 }}>{cell.d.ds.slice(8, 10)}/{cell.d.ds.slice(5, 7)}/{cell.d.ds.slice(0, 4)}</div></div>
              <div><div style={{ fontSize: ".72rem", color: "var(--dk-muted)" }}>{tr("Prévu", "Forecast")}</div><div className="num" style={{ fontWeight: 800, color: "var(--ch-1)" }}>{fmt(cell.d.yhat, 1)}</div></div>
              <div><div style={{ fontSize: ".72rem", color: "var(--dk-muted)" }}>{tr("D'habitude ce jour-là", "Usually that weekday")}</div><div className="num" style={{ fontWeight: 700 }}>{fmt(cell.d.usual, 1)}</div></div>
              <div><div style={{ fontSize: ".72rem", color: "var(--dk-muted)" }}>{tr("Quantité conseillée", "Suggested quantity")}</div><div className="num" style={{ fontWeight: 800 }}>{fmt(Math.ceil(cell.d.conseille || 0))}</div></div>
              <div><div style={{ fontSize: ".72rem", color: "var(--dk-muted)" }}>{tr("Statut", "Status")}</div><div style={{ fontWeight: 800 }}>{tr(ST[cell.d.statut]?.fr, ST[cell.d.statut]?.en)}</div></div>
              {cell.d.euros > 0 && (
                <div><div style={{ fontSize: ".72rem", color: "var(--dk-muted)" }}>{cell.d.statut === "SURSTOCK" ? tr("Invendus évitables", "Avoidable unsold") : tr("Ventes à ne pas manquer", "Sales not to miss")}</div><div className="num" style={{ fontWeight: 800 }}>≈ {fmt(cell.d.euros)} €</div></div>
              )}
              {cell.d.raison && (
                <div style={{ gridColumn: "1 / -1" }}><div style={{ fontSize: ".72rem", color: "var(--dk-muted)" }}>{tr("Pourquoi", "Why")}</div><div style={{ fontWeight: 700 }}>{raisonText(cell.d.raison)}</div></div>
              )}
            </div>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginTop: 12, fontSize: ".72rem", color: "var(--dk-muted)" }}>
            {(["RUPTURE", "VIGILANCE", "NORMAL", "SURSTOCK"] as const).map((k) => (
              <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, height: 12, borderRadius: 4, background: ST[k].bg, border: "1px solid var(--dk-line)" }} />{tr(ST[k].fr, ST[k].en)}</span>
            ))}
            <span>· {tr("chiffre = articles prévus", "number = forecast items")}</span>
            {rows.length > 12 && (
              <button className="link-btn" style={{ marginTop: 0, marginLeft: "auto" }} onClick={() => setAll((v) => !v)}>
                {all ? tr("Afficher moins", "Show less") : tr(`Voir les ${rows.length} produits`, `See all ${rows.length} products`)}
              </button>
            )}
          </div>

          {top && top.excedent > 0 && (
            <Takeaway>
              {tr(
                `${nbProdRisk} produit(s) risquent de manquer au moins un jour sur les ${dates.length} prochains jours. Le plus concerné : ${top.article} (environ ${fmt(top.excedent)} articles de plus que d'habitude à prévoir).${eurManque || eurInvendus ? ` En préparant comme d'habitude, environ ${fmt(eurManque)} € de ventes risquent d'être manquées et ${fmt(eurInvendus)} € de produits de rester invendus (valeur de vente).` : ""}`,
                `${nbProdRisk} product(s) may run short at least one day over the next ${dates.length} days. Most affected: ${top.article} (about ${fmt(top.excedent)} more items than usual to plan).${eurManque || eurInvendus ? ` Preparing as usual, about €${fmt(eurManque)} of sales may be missed and €${fmt(eurInvendus)} of products left unsold (at sale price).` : ""}`
              )}
            </Takeaway>
          )}
          <ExpertNote>
            Statut par produit et par jour : ratio = prévision du produit (forecasting/pipeline.py) / habitude du produit ce jour de la semaine. RUPTURE ≥ {data.seuils?.eleve}, VIGILANCE ≥ {data.seuils?.vigilance}, SURSTOCK &lt; {data.seuils?.faible} (config.py), et aucun statut si l'écart est inférieur à {data.seuils?.ecart_min_unites} articles. « Habitude » = médiane des 8 derniers mêmes jours de semaine ouverts (calculée par le pipeline). Quantité conseillée = borne haute du jour (quantile 90 % des erreurs observées en test). Calcul du {data.run?.run_at}. API : /api/alerts/products.
          </ExpertNote>
        </div>
      </div>
    </>
  );
}
