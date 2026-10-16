"use client";

import React, { useEffect, useState } from "react";
import { colors } from "@/lib/theme";
import { ExpertNote } from "@/components/Expert";
import { ProductRiskCard } from "@/components/ProductRisk";
import { fetchAlerts } from "@/lib/api";
import { tr, trData, locale } from "@/lib/i18n";
import {
  IconPackage,
  IconShoppingCart,
  IconEuro,
  IconAlertTriangle,
  IconCircleDot,
  IconCheckCircle,
  IconXCircle,
  IconFilter,
  IconCalendarDays,
  IconTarget,
  IconBolt,
  IconActivity,
} from "@/components/Icons";

const INK = colors.ink;
const MUTED = colors.muted;
const ORANGE = colors.accentDeep;
const OK = colors.ok;
const WARN = colors.warn;
const ALERT = colors.alert;

// label et desc restent en français ici : traduits à l'affichage (trData / tr avec descEn)
// Le stock réel n'étant pas enregistré, chaque jour est comparé au « jour type » de la période
// (même jour de la semaine, même mois). Les clés restent celles du backend.
const STATUS_CONFIG: Record<string, { label: string; labelEn: string; color: string; bg: string; icon: React.ReactNode; desc: string; descEn: string }> = {
  RUPTURE: { label: "Risque de manque", labelEn: "Shortage risk", color: "#C0392B", bg: "var(--dk-soft, #fef2f2)", icon: <IconXCircle size={24} color="#C0392B" />, desc: "Demande ≥ 120 % d'un jour type", descEn: "Demand ≥ 120% of a typical day" },
  VIGILANCE: { label: "À surveiller", labelEn: "Watch", color: "#D4A52A", bg: "var(--dk-soft, #fffbeb)", icon: <IconAlertTriangle size={24} color="#D4A52A" />, desc: "Demande 110–120 % d'un jour type", descEn: "Demand 110–120% of a typical day" },
  NORMAL: { label: "Normal", labelEn: "Normal", color: "#6F9A64", bg: "var(--dk-soft, #f0fdf4)", icon: <IconCheckCircle size={24} color="#6F9A64" />, desc: "Demande 80–110 % d'un jour type", descEn: "Demand 80–110% of a typical day" },
  SURSTOCK: { label: "Risque d'invendus", labelEn: "Unsold risk", color: "#4A78A8", bg: "var(--dk-soft, #eff6ff)", icon: <IconCircleDot size={24} color="#4A78A8" />, desc: "Demande < 80 % d'un jour type", descEn: "Demand < 80% of a typical day" },
  FERMÉ: { label: "Fermé", labelEn: "Closed", color: "var(--dk-muted, #B4B2A9)", bg: "var(--dk-soft, #f5f5f4)", icon: <IconActivity size={24} color="var(--dk-muted, #B4B2A9)" />, desc: "Boutique fermée", descEn: "Shop closed" },
};

function fmt(n: number, dec = 0) {
  return Number(n || 0).toLocaleString(locale(), {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
}

export default function AlertesPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mois, setMois] = useState("Tout");

  useEffect(() => {
    setLoading(true);
    fetchAlerts(mois)
      .then((res) => { setData(res); setLoading(false); })
      .catch((err) => { console.error(err); setLoading(false); });
  }, [mois]);

  if (loading && !data) {
    return <div style={{ padding: "40px", color: MUTED, fontSize: "0.9rem", fontWeight: 600 }}>{tr("Chargement du système d'alertes...", "Loading alert system...")}</div>;
  }

  const kpis = data?.kpis || {};
  const days = data?.days || [];
  const statuts = kpis?.statuts || {};
  // Mois et année couverts par la prévision (envoyés par le backend)
  const moisDispo: string[] = (data?.available_mois || ["Tout"]).filter((m: string) => m !== "Tout");
  const anneePrev = kpis.annee_n1 ? kpis.annee_n1 + 1 : (days[0]?.ds ? String(days[0].ds).slice(0, 4) : "");
  const plage = moisDispo.length ? `${moisDispo[0].toLowerCase()}–${moisDispo[moisDispo.length - 1].toLowerCase()}` : "";

  return (
    <div style={{ paddingBottom: "40px" }}>
      {/* ── TITRE + DESCRIPTION ── */}
      <div style={{ marginBottom: "16px", padding: "0 28px" }}>
        <h1 style={{ fontSize:"1.8rem", fontWeight:800, color:INK,
                     letterSpacing:"-0.03em", lineHeight:1.1, margin:0 }}>
          {tr("Alertes &", "Alerts &")} <span style={{ color: ORANGE }}>{tr("Stock", "Stock")}</span>
        </h1>
        <p style={{ color:MUTED, fontSize:"0.82rem", marginTop:"6px",
                    maxWidth:"640px", lineHeight:1.5 }}>
          {tr(`Prévision ${anneePrev}${plage ? ` (${plage})` : ""} : jours plus chargés qu'un jour type et quantités conseillées.`, `${anneePrev} forecast${plage ? ` (${plage})` : ""}: days busier than a typical day and suggested quantities.`)}
        </p>
      </div>

      {/* ── MINI KPIs ── */}
      <div style={{ margin: "0 28px 12px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14,
                      padding:"14px 18px", borderRadius:"14px",
                      background:"var(--dk-surface, #fff)",
                      border:"1px solid var(--dk-line, rgba(120,140,120,0.18))",
                      boxShadow:"0 2px 12px rgba(0,0,0,0.06)" }}>
          <div>
            <div style={{ fontSize: ".62rem", color: MUTED, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 2 }}>
              {tr("Articles prévus", "Forecast items")}
            </div>
            <div style={{ fontSize: "1.35rem", fontWeight: 800, color: INK }}>
              {fmt(kpis.total_articles)}
            </div>
            {kpis.articles_n1 ? (
              <div style={{ fontSize: ".7rem", color: MUTED, marginTop: 2 }}>
                {tr(`Vendus en ${kpis.annee_n1} sur la même période : ${fmt(kpis.articles_n1)} (${kpis.total_articles >= kpis.articles_n1 ? "+" : ""}${fmt(((kpis.total_articles - kpis.articles_n1) / kpis.articles_n1) * 100, 1)} %)`,
                    `Sold in ${kpis.annee_n1} over the same period: ${fmt(kpis.articles_n1)} (${kpis.total_articles >= kpis.articles_n1 ? "+" : ""}${fmt(((kpis.total_articles - kpis.articles_n1) / kpis.articles_n1) * 100, 1)}%)`)}
              </div>
            ) : null}
          </div>
          <div>
            <div style={{ fontSize: ".62rem", color: MUTED, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 2 }}>
              {tr("CA prévu", "Forecast revenue")}
            </div>
            <div style={{ fontSize: "1.35rem", fontWeight: 800, color: ORANGE }}>
              {fmt(kpis.ca_total_prevu)} €
            </div>
            {kpis.ca_n1 ? (
              <div style={{ fontSize: ".7rem", color: MUTED, marginTop: 2 }}>
                {tr(`Réalisé en ${kpis.annee_n1} : ${fmt(kpis.ca_n1)} € `, `Actual ${kpis.annee_n1}: ${fmt(kpis.ca_n1)} € `)}
              </div>
            ) : null}
          </div>
          <div>
            <div style={{ fontSize: ".62rem", color: MUTED, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 2 }}>
              {tr("Ventes à risque (estimées)", "Sales at risk (estimated)")}
            </div>
            <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#C0392B" }}>
              {fmt(kpis.ca_risque)} €
            </div>
          </div>
        </div>
      </div>

      <div className="sw">
        <div style={{ background: "rgba(212,165,42,0.06)", borderLeft: "4px solid #6F9A64", padding: "16px 20px", borderRadius: "0 12px 12px 0", fontSize: "0.75rem", color: "var(--dk-ink2, #2F3A32)", marginBottom: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
          <IconAlertTriangle size={16} color="#6F9A64" />
          <strong>{tr("À savoir :", "Good to know:")}</strong> {tr(`Risque estimé, pas une rupture réelle : le stock n'est pas enregistré en caisse. Chaque jour est comparé au jour type de la période (même jour de la semaine, même mois). Les ventes à risque sont les articles en plus d'un jour type, au prix moyen réel par article du même mois l'an dernier (${fmt(kpis.prix_moyen_article, 2)} € en moyenne). La quantité conseillée est la prévision haute du jour.`, `Estimated risk, not an actual stock-out: stock is not recorded at the till. Each day is compared with the period's typical day (same weekday, same month). Sales at risk are the items above a typical day, at the actual average price per item for the same month last year (${fmt(kpis.prix_moyen_article, 2)} € on average). The suggested quantity is the day's high forecast.`)}
        </div>
      </div>

      {/* ── ARTICLES PRÉVUS AVEC ALERTES ── */}
      <div className="sec-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <IconPackage size={18} color={ORANGE} />
        {tr("Jours par niveau d'alerte", "Days by alert level")}
      </div>
      <div className="sw">
        <div className="cc">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "12px" }}>
            {Object.keys(STATUS_CONFIG).map((key) => {
              const cfg = STATUS_CONFIG[key];
              const count = statuts[key] || 0;
              return (
                <div key={key} className="cc" style={{ borderTop: `4px solid ${cfg.color}`, textAlign: "center", padding: "16px" }}>
                  <div style={{ marginBottom: "8px", display: "flex", justifyContent: "center" }}>{cfg.icon}</div>
                  <div style={{ fontSize: "0.75rem", fontWeight: 800, color: cfg.color, letterSpacing: "0.05em" }}>{tr(cfg.label, cfg.labelEn)}</div>
                  <div style={{ fontSize: "1.8rem", fontWeight: 800, color: INK, margin: "8px 0" }}>{count}</div>
                  <div style={{ fontSize: "0.65rem", color: MUTED }}>{tr(cfg.desc, cfg.descEn)}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="sw" style={{ marginBottom: "16px" }}>
        <div className="cc" style={{ 
          padding:"16px 20px", borderRadius:"14px",
          background: "var(--dk-soft, #F5F6F1)",
          border:"1px solid var(--dk-line, rgba(140,160,140,.25))",
          boxShadow:"0 4px 16px rgba(0,0,0,0.15)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.75rem", fontWeight: 700, color: INK, textTransform: "uppercase", letterSpacing: "0.05em", borderRight: "1px solid var(--dk-line, #ECEDE7)", paddingRight: "16px" }}>
            <IconCalendarDays size={16} color={ORANGE} />
            {tr("Période", "Period")}
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            {["Tout", ...moisDispo].map((m) => (
              <button
                key={m}
                onClick={() => setMois(m)}
                style={{
                  padding: "6px 14px",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  borderRadius: "8px",
                  border: mois === m ? "1px solid var(--dk-pill, #1E2420)" : "1px solid var(--dk-line, #E3E4DD)",
                  background: mois === m ? "var(--dk-pill, #1E2420)" : "var(--dk-surface, #FAFAF7)",
                  color: mois === m ? "white" : INK,
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                {trData(m)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="sec-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <IconActivity size={18} color={ORANGE} />
        {tr("Demande Prévue & Niveaux de Risque", "Forecast demand & risk levels")}
      </div>
      <div className="sw">
        <div className="cc">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
            <div>
              <div className="ct">{tr("Demande Prévue et Niveaux d'Alerte", "Forecast demand and alert levels")}</div>
              <div className="cs">{tr("Quantité d'articles par jour", "Number of items per day")}</div>
            </div>
            <div style={{ display: "flex", gap: "12px", fontSize: "0.65rem", fontWeight: 700, color: MUTED }}>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><IconXCircle size={12} color="#C0392B" />{tr("Risque de manque", "Shortage risk")}</span>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><IconAlertTriangle size={12} color="#D4A52A" />{tr("À surveiller", "Watch")}</span>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><IconCheckCircle size={12} color="#6F9A64" />{tr("Normal", "Normal")}</span>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><IconCircleDot size={12} color="#4A78A8" />{tr("Risque d'invendus", "Unsold risk")}</span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", gap: "2px", height: "180px", borderBottom: "1px solid var(--dk-line, #ECEDE7)", paddingBottom: "12px", marginTop: "12px" }}>
            {days.map((d: any, i: number) => {
              const maxVal = Math.max(...days.map((x: any) => x.yhat), 1);
              const pct = Math.max(4, (d.yhat / maxVal) * 100);
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%", position: "relative" }} title={tr(`${d.date_fr} : ${fmt(d.yhat)} art. (${(STATUS_CONFIG[d.statut] || STATUS_CONFIG.NORMAL).label})`, `${d.date_fr}: ${fmt(d.yhat)} items (${(STATUS_CONFIG[d.statut] || STATUS_CONFIG.NORMAL).labelEn})`)}>
                  <div style={{ width: "100%", height: `${pct}%`, background: (STATUS_CONFIG[d.statut]?.color || d.bar_color), borderRadius: "2px 2px 0 0", opacity: 0.85, transition: "opacity 0.2s" }} />
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.6rem", fontWeight: 700, color: MUTED, marginTop: "8px" }}>
            <span>{days[0]?.date_fr}</span>
            <span>{days[Math.floor(days.length / 2)]?.date_fr}</span>
            <span>{days[days.length - 1]?.date_fr}</span>
          </div>
          <div style={{ marginTop: 10, fontSize: ".8rem", color: INK, lineHeight: 1.45, borderLeft: `3px solid ${ORANGE}`, paddingLeft: 10 }}>
            {tr(
              `${statuts["RUPTURE"] || 0} jour(s) nettement plus chargé(s) qu'un jour type et ${statuts["VIGILANCE"] || 0} à surveiller, sur ${days.filter((d: any) => d.yhat > 0).length} jours ouverts. Le jour le plus chargé est le ${kpis.pic_date} (${fmt(kpis.pic_val)} articles).`,
              `${statuts["RUPTURE"] || 0} day(s) clearly busier than a typical day and ${statuts["VIGILANCE"] || 0} to watch, out of ${days.filter((d: any) => d.yhat > 0).length} open days. The busiest day is ${kpis.pic_date} (${fmt(kpis.pic_val)} items).`
            )}
          </div>
          <ExpertNote>
            ratio_pct = yhat / médiane(yhat du même jour de semaine, même mois, jours ouverts) × 100. Statuts (clés backend) : RUPTURE ≥ 120 %, VIGILANCE ≥ 110 %, NORMAL ≥ 80 %, SURSTOCK &lt; 80 %, FERMÉ si yhat = 0 (config.py). commande_recommandee = yhat_upper. ca_prevu = yhat × (CA / articles du même mois sur les 12 derniers mois). ca_risque = Σ max(0, yhat − jour type) × prix. Stock réel non disponible.
          </ExpertNote>
        </div>
      </div>

      <div className="sec-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <IconBolt size={18} color={ORANGE} />
        {tr("Détail Opérationnel", "Operational detail")}
      </div>
      <div className="sw">
        <div className="cc">
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "8px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--dk-line, #ECEDE7)", color: MUTED, fontSize: "0.7rem", textTransform: "uppercase", textAlign: "right" }}>
                <th style={{ textAlign: "left", paddingBottom: "8px" }}>{tr("Date", "Date")}</th>
                <th style={{ textAlign: "left", paddingBottom: "8px" }}>{tr("Jour", "Day")}</th>
                <th style={{ paddingBottom: "8px" }}>{tr("Demande Prévue", "Forecast demand")}</th>
                <th style={{ paddingBottom: "8px" }}>{tr("CA Prévu", "Forecast revenue")}</th>
                <th style={{ paddingBottom: "8px" }}>{tr("Jour type", "Typical day")}</th>
                <th style={{ paddingBottom: "8px" }}>{tr("Écart", "Gap")}</th>
                <th style={{ paddingBottom: "8px" }}>{tr("Quantité conseillée", "Suggested quantity")}</th>
                <th style={{ paddingBottom: "8px" }}>{tr("Statut", "Status")}</th>
              </tr>
            </thead>
            <tbody>
              {days.map((row: any, i: number) => {
                const cfg = STATUS_CONFIG[row.statut] || STATUS_CONFIG["NORMAL"];
                return (
                  <tr key={i} style={{ borderBottom: "1px solid var(--dk-surface, #FCFCFA)" }}>
                    <td style={{ padding: "10px 0", fontSize: "0.8rem", fontWeight: 700, color: INK }}>{row.date_fr}</td>
                    <td style={{ padding: "10px 0", fontSize: "0.75rem", color: MUTED }}>{trData(row.jour_semaine)}</td>
                    <td style={{ padding: "10px 0", textAlign: "right", fontSize: "0.85rem", fontWeight: 800, color: INK }}>{fmt(row.yhat)}</td>
                    <td style={{ padding: "10px 0", textAlign: "right", fontSize: "0.75rem", color: MUTED }}>{fmt(row.ca_prevu)} €</td>
                    <td style={{ padding: "10px 0", textAlign: "right", fontSize: "0.75rem", color: MUTED }}>{row.jour_type ? fmt(row.jour_type) : "—"}</td>
                    <td style={{ padding: "10px 0", textAlign: "right", fontSize: "0.75rem", fontWeight: 700, color: INK }}>{row.statut === "FERMÉ" || !row.ratio_pct ? "—" : `${row.ratio_pct >= 100 ? "+" : ""}${fmt(row.ratio_pct - 100)} %`}</td>
                    <td style={{ padding: "10px 0", textAlign: "right", fontSize: "0.85rem", fontWeight: 800, color: "#6F9A64" }}>{fmt(row.commande_recommandee)}</td>
                    <td style={{ padding: "10px 0", textAlign: "right" }}>
                      <span style={{ fontSize: "0.65rem", fontWeight: 800, background: cfg.bg, color: cfg.color, padding: "3px 8px", borderRadius: "12px", border: `1px solid color-mix(in srgb, ${cfg.color} 19%, transparent)` }}>
                        {tr(cfg.label, cfg.labelEn)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── JOURS À SURVEILLER (calculés à partir des données) ── */}
      <div className="sec-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <IconTarget size={18} color={ORANGE} />
        {tr("Jours à surveiller", "Days to watch")}
      </div>
      <div className="sw">
        <div className="cc">
          {(data?.jours_a_surveiller || []).length === 0 ? (
            <div style={{ fontSize: "0.8rem", color: MUTED }}>{tr("Aucun jour nettement plus chargé qu'un jour type sur cette période.", "No day clearly busier than a typical day in this period.")}</div>
          ) : (
            <ul style={{ color: "var(--dk-ink2, #555)", lineHeight: "1.8", margin: 0, paddingLeft: "20px", fontSize: "0.82rem" }}>
              {(data?.jours_a_surveiller || []).map((d: any, i: number) => (
                <li key={i}>
                  <strong>{trData(d.jour_semaine)} {d.date_fr}</strong> — {tr(d.raison, `forecast ${fmt(d.ratio_pct - 100)}% above a typical ${trData(d.jour_semaine)} (${fmt(d.jour_type)} items)`)} · {tr("préparer", "prepare")} <strong>{fmt(d.commande_recommandee)}</strong> {tr("articles", "items")}
                </li>
              ))}
            </ul>
          )}
          <div style={{ fontSize: "0.72rem", color: MUTED, marginTop: 10 }}>
            {tr("Pic de la période :", "Period peak:")} <strong>{kpis.pic_date}</strong> → <strong>{fmt(kpis.pic_val)} {tr("articles prévus", "forecast items")}</strong>
          </div>
        </div>
      </div>

      {/* ── NOUVEAU : risque par produit (prévision par produit), en plus des alertes globales ── */}
      <ProductRiskCard />
    </div>
  );
}
