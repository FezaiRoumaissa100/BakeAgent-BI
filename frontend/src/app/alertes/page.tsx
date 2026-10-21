"use client";

import React, { useEffect, useState } from "react";
import { colors } from "@/lib/theme";
import { ExpertNote } from "@/components/Expert";
import { ProductRiskCard } from "@/components/ProductRisk";
import { PrepListCard } from "@/components/PrepList";
import { fetchAlerts } from "@/lib/api";
import { tr, trData, locale } from "@/lib/i18n";
import { ChartAssistantButton } from "@/components/ChartAssistantButton";
import { useChat } from "@/contexts/ChatContext";
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
// Saison : chaque jour est comparé au « jour habituel » (médiane de la prévision du même jour de la semaine,
// le même mois). Ce sont des niveaux d'AFFLUENCE, pas des risques de stock (le risque de manque produit par produit,
// comparé aux vraies ventes, est en haut de la page). Les clés restent celles du backend.
const STATUS_CONFIG: Record<string, { label: string; labelEn: string; color: string; bg: string; icon: React.ReactNode; desc: string; descEn: string }> = {
  RUPTURE: { label: "Très chargé", labelEn: "Very busy", color: "var(--dk-alert)", bg: "var(--dk-soft, #fef2f2)", icon: <IconXCircle size={24} color="var(--dk-alert)" />, desc: "au moins 20 % de plus qu'un jour habituel", descEn: "at least 20% more than a usual day" },
  VIGILANCE: { label: "Chargé", labelEn: "Busy", color: "var(--dk-warn)", bg: "var(--dk-soft, #fffbeb)", icon: <IconAlertTriangle size={24} color="var(--dk-warn)" />, desc: "10 à 20 % de plus qu'un jour habituel", descEn: "10 to 20% more than a usual day" },
  NORMAL: { label: "Habituel", labelEn: "Usual", color: "var(--ch-moss)", bg: "var(--dk-soft, #f0fdf4)", icon: <IconCheckCircle size={24} color="var(--ch-moss)" />, desc: "entre −20 % et +10 %", descEn: "between −20% and +10%" },
  SURSTOCK: { label: "Calme", labelEn: "Quiet", color: "var(--ch-3)", bg: "var(--dk-soft, #eff6ff)", icon: <IconCircleDot size={24} color="var(--ch-3)" />, desc: "plus de 20 % de moins qu'un jour habituel", descEn: "more than 20% less than a usual day" },
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
  const mois = "Tout";   // toute la saison (le calendrier sépare déjà les mois)
  // Détail opérationnel : replié (10 premiers jours) ou déplié (tous les jours)
  const [allDays, setAllDays] = useState(false);
  const { openChat } = useChat();

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

  // Semaine (lundi → dimanche) la plus chargée de la saison
  const busiestWeek = (() => {
    const w: Record<string, number> = {};
    days.forEach((d: any) => {
      if (!(d.yhat > 0)) return;
      const t = new Date(String(d.ds) + "T12:00:00");
      t.setDate(t.getDate() - ((t.getDay() + 6) % 7));
      const k = t.toISOString().slice(0, 10);
      w[k] = (w[k] || 0) + d.yhat;
    });
    const best = Object.entries(w).sort((a, b) => b[1] - a[1])[0];
    return best ? { fr: `${best[0].slice(8, 10)}/${best[0].slice(5, 7)}/${best[0].slice(0, 4)}`, total: best[1] } : null;
  })();

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
          {tr("Ce qu'il faut préparer : la liste du prochain jour, le risque produit par produit sur 14 jours, puis la saison à venir pour toute la boutique.", "What to prepare: the list for the next day, the risk product by product over 14 days, then the coming season for the whole shop.")}
        </p>
        <a href="/stock" className="prep-print-btn" style={{ marginTop: 10, textDecoration: "none" }}>
          {tr("Saisir le stock du jour (préparé / restant) →", "Enter today's stock (made / left) →")}
        </a>
      </div>

      {/* ── 1. LE PLUS UTILE AU QUOTIDIEN : la liste à préparer, puis le risque par produit sur 14 jours ── */}
      <PrepListCard />
      <ProductRiskCard />

      {/* ── 2. LA SAISON À VENIR, TOUTE LA BOUTIQUE ── */}
      <div className="alert-part">
        <div className="alert-part-k">{tr("Toute la boutique", "Whole shop")}</div>
        <h2 className="alert-part-t">{tr("Saison", "Season")} <span style={{ color: "var(--dk-accent)" }}>{anneePrev}</span>{plage ? <span className="alert-part-s"> · {plage}</span> : null}</h2>
        <p className="alert-part-d">{tr("Combien la boutique devrait vendre chaque jour de la saison, et quels jours seront plus chargés ou plus calmes qu'un jour habituel du même mois. Pour planifier le personnel, les congés et les commandes de matières premières.", "How much the shop should sell each day of the season, and which days will be busier or quieter than a usual day of the same month. To plan staff, time off and ingredient orders.")}</p>
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
                {tr(`Réalisé en ${kpis.annee_n1} : ${fmt(kpis.ca_n1)} € (${kpis.ca_total_prevu >= kpis.ca_n1 ? "+" : ""}${fmt(((kpis.ca_total_prevu - kpis.ca_n1) / kpis.ca_n1) * 100, 1)} %)`, `Actual ${kpis.annee_n1}: €${fmt(kpis.ca_n1)} (${kpis.ca_total_prevu >= kpis.ca_n1 ? "+" : ""}${fmt(((kpis.ca_total_prevu - kpis.ca_n1) / kpis.ca_n1) * 100, 1)}%)`)}
              </div>
            ) : null}
          </div>
          <div>
            <div style={{ fontSize: ".62rem", color: MUTED, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 2 }}>
              {tr("Ventes en plus les jours chargés", "Extra sales on busy days")}
            </div>
            <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--dk-alert)" }}>
              {fmt(kpis.ca_risque)} €
            </div>
            <div style={{ fontSize: ".7rem", color: MUTED, marginTop: 2 }}>
              {tr("à capter en préparant plus que d'habitude ces jours-là (sinon, ventes manquées)", "to capture by preparing more than usual on those days (otherwise, missed sales)")}
            </div>
          </div>
        </div>
      </div>

      <div className="sw">
        <div style={{ background: "rgba(212,165,42,0.06)", borderLeft: "4px solid var(--ch-moss)", padding: "16px 20px", borderRadius: "0 12px 12px 0", fontSize: "0.75rem", color: "var(--dk-ink2, #2F3A32)", marginBottom: "8px", display: "flex", alignItems: "flex-start", gap: "10px", lineHeight: 1.55 }}>
          <span style={{ flex: "none", display: "inline-flex", marginTop: "1px" }}><IconAlertTriangle size={16} color="var(--ch-moss)" /></span>
          <span style={{ flex: 1, minWidth: 0 }}><strong style={{ whiteSpace: "nowrap" }}>{tr("À savoir :", "Good to know:")}</strong> {tr(`Chaque jour est comparé à un jour habituel du même mois (même jour de la semaine) : « très chargé » veut dire au moins 20 % de plus. Les ventes en plus sont les articles au-dessus d'un jour habituel, au prix moyen réel par article (${fmt(kpis.prix_moyen_article, 2)} € en moyenne) ; si la boutique se prépare comme d'habitude ces jours-là, ce sont des ventes manquées. Plusieurs mois à l'avance, la prévision donne une tendance : la quantité exacte à préparer se décide avec la liste « À préparer » en haut de la page.`, `Each day is compared with a usual day of the same month (same weekday): "very busy" means at least 20% more. Extra sales are the items above a usual day, at the real average price per item (€${fmt(kpis.prix_moyen_article, 2)} on average); if the shop prepares as usual on those days, these are missed sales. Months ahead, the forecast gives a trend: the exact quantity to prepare is decided with the "To prepare" list at the top of the page.`)}</span>
        </div>
      </div>

      {/* Plus de filtre par mois : le calendrier montre déjà toute la saison, mois par mois. */}

      <div className="sec-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <IconActivity size={18} color={ORANGE} />
        {tr("Les jours chargés de la saison", "The busy days of the season")}
      </div>
      <div className="sw">
        <div className="cc" style={{ position: "relative" }}>
          <ChartAssistantButton
            chartType="alerts_demande_risque"
            chartData={{
              days,
              statuts,
              kpis,
              filters: {
                mois: mois
              }
            }}
            chartName="AlertsDemandeRisque"
            userQuestion="Explique la demande prévue et les niveaux de risque"
            position="top-right"
            onOpenChat={openChat}
          />
          {/* En-tête : titre à gauche, légende en dessous (le bouton ✦ reste seul en haut à droite) */}
          <div style={{ paddingRight: 44 }}>
            <div className="ct">{tr("Le calendrier de la saison", "The season calendar")}</div>
            <div className="cs">{tr("Chaque case est un jour, avec le nombre d'articles prévus. La couleur dit si le jour sera plus chargé ou plus calme qu'un jour habituel (même jour de la semaine, même mois).", "Each box is a day, with the number of items forecast. The colour says whether the day will be busier or quieter than a usual day (same weekday, same month).")}</div>
          </div>
          <div className="season-legend">
            {(["RUPTURE", "VIGILANCE", "NORMAL", "SURSTOCK", "FERMÉ"] as const).map((k) => (
              <span key={k}><i className={`season-dot st-${k === "FERMÉ" ? "FERME" : k}`} />{tr((STATUS_CONFIG[k] || STATUS_CONFIG.NORMAL).label, (STATUS_CONFIG[k] || STATUS_CONFIG.NORMAL).labelEn)} <b className="num">{statuts[k] || 0}</b> <small>· {tr((STATUS_CONFIG[k] || STATUS_CONFIG.NORMAL).desc, (STATUS_CONFIG[k] || STATUS_CONFIG.NORMAL).descEn)}</small></span>
            ))}
            <span>★ {tr("jour férié", "public holiday")}</span>
          </div>
          {(() => {
            // Un petit calendrier par mois (lundi → dimanche)
            const byMonth: Record<string, any[]> = {};
            days.forEach((d: any) => { const k = String(d.ds).slice(0, 7); (byMonth[k] = byMonth[k] || []).push(d); });
            const J = [tr("lu", "Mo"), tr("ma", "Tu"), tr("me", "We"), tr("je", "Th"), tr("ve", "Fr"), tr("sa", "Sa"), tr("di", "Su")];
            return (
              <div className="season-cal">
                {Object.entries(byMonth).map(([m, list]) => {
                  const first = new Date(m + "-01T12:00:00");
                  const offset = (first.getDay() + 6) % 7;            // lundi = 0
                  const nDays = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
                  const byDay: Record<number, any> = {};
                  list.forEach((d: any) => { byDay[Number(String(d.ds).slice(8, 10))] = d; });
                  const title = first.toLocaleDateString(locale(), { month: "long", year: "numeric" });
                  return (
                    <div key={m} className="season-month">
                      <div className="season-mtitle">{title.charAt(0).toUpperCase() + title.slice(1)}</div>
                      <div className="season-grid">
                        {J.map((j) => <div key={j} className="season-wd">{j}</div>)}
                        {Array.from({ length: offset }).map((_, i) => <div key={"e" + i} />)}
                        {Array.from({ length: nDays }).map((_, i) => {
                          const d = byDay[i + 1];
                          if (!d) return <div key={i} className="season-day st-NONE"><b>{i + 1}</b></div>;
                          const st = d.statut === "FERMÉ" || !(d.yhat > 0) ? "FERME" : d.statut;
                          const cfg = STATUS_CONFIG[d.statut] || STATUS_CONFIG.NORMAL;
                          return (
                            <div key={i} className={`season-day st-${st}`}
                                 title={st === "FERME" ? tr(`${d.date_fr} : fermé`, `${d.date_fr}: closed`) : tr(`${d.date_fr} : ${fmt(d.yhat)} articles prévus (entre ${fmt(d.yhat_lower)} et ${fmt(d.yhat_upper)}), jour habituel ${d.jour_type ? fmt(d.jour_type) : "—"} · ${cfg.label}${d.ferie ? ` · ${d.ferie}` : d.veille_de ? ` · veille de ${d.veille_de}` : ""}`, `${d.date_fr}: ${fmt(d.yhat)} items forecast (between ${fmt(d.yhat_lower)} and ${fmt(d.yhat_upper)}), usual day ${d.jour_type ? fmt(d.jour_type) : "—"} · ${cfg.labelEn}${d.ferie ? ` · ${d.ferie}` : ""}`)}>
                              <b>{i + 1}{d.ferie ? " ★" : ""}</b>
                              <span className="num">{st === "FERME" ? "—" : fmt(d.yhat)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
          <div style={{ marginTop: 10, fontSize: ".8rem", color: INK, lineHeight: 1.45, borderLeft: `3px solid ${ORANGE}`, paddingLeft: 10 }}>
            {tr(
              `${statuts["RUPTURE"] || 0} jour(s) très chargé(s) et ${statuts["VIGILANCE"] || 0} chargé(s), sur ${days.filter((d: any) => d.yhat > 0).length} jours ouverts. Le jour le plus chargé est le ${kpis.pic_date} (${fmt(kpis.pic_val)} articles).${busiestWeek ? ` La semaine la plus chargée commence le lundi ${busiestWeek.fr} (${fmt(busiestWeek.total)} articles prévus) : prévoir le personnel et les commandes de matières premières à l'avance.` : ""}`,
              `${statuts["RUPTURE"] || 0} very busy day(s) and ${statuts["VIGILANCE"] || 0} busy, out of ${days.filter((d: any) => d.yhat > 0).length} open days. The busiest day is ${kpis.pic_date} (${fmt(kpis.pic_val)} items).${busiestWeek ? ` The busiest week starts on Monday ${busiestWeek.fr} (${fmt(busiestWeek.total)} items forecast): plan staff and ingredient orders ahead.` : ""}`
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
        <div className="cc" style={{ position: "relative" }}>
          <ChartAssistantButton
            chartType="alerts_detail_operationnel"
            chartData={{
              days,
              statuts,
              kpis,
              filters: {
                mois: mois
              }
            }}
            chartName="AlertsDetailOperationnel"
            userQuestion="Explique le détail opérationnel des alertes"
            position="top-right"
            onOpenChat={openChat}
          />
          {/* Ligne d'en-tête : laisse la place au bouton ✦ (en haut à droite) au-dessus du tableau */}
          <div className="cs" style={{ margin: 0, minHeight: 30, paddingRight: 44, display: "flex", alignItems: "center" }}>
            {tr(`Jour par jour, ${days.length} jours de la saison`, `Day by day, ${days.length} days of the season`)}
          </div>
          <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 760, borderCollapse: "collapse", marginTop: "8px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--dk-line, #ECEDE7)", color: MUTED, fontSize: "0.7rem", textTransform: "uppercase", textAlign: "right" }}>
                <th style={{ textAlign: "left", paddingBottom: "8px" }}>{tr("Date", "Date")}</th>
                <th style={{ textAlign: "left", paddingBottom: "8px" }}>{tr("Jour", "Day")}</th>
                <th style={{ paddingBottom: "8px" }}>{tr("Articles prévus", "Forecast items")}</th>
                <th style={{ paddingBottom: "8px" }}>{tr("CA prévu", "Forecast revenue")}</th>
                <th style={{ paddingBottom: "8px" }}>{tr("Jour habituel", "Usual day")}</th>
                <th style={{ paddingBottom: "8px" }}>{tr("Écart", "Gap")}</th>
                <th style={{ paddingBottom: "8px" }}>{tr("Fourchette probable", "Likely range")}</th>
                <th style={{ paddingBottom: "8px" }}>{tr("Statut", "Status")}</th>
              </tr>
            </thead>
            <tbody>
              {(allDays ? days : days.slice(0, 10)).map((row: any, i: number) => {
                const cfg = STATUS_CONFIG[row.statut] || STATUS_CONFIG["NORMAL"];
                return (
                  <tr key={i} style={{ borderBottom: "1px solid var(--dk-surface, #FCFCFA)" }}>
                    <td style={{ padding: "10px 0", fontSize: "0.8rem", fontWeight: 700, color: INK }}>{row.date_fr}</td>
                    <td style={{ padding: "10px 0", fontSize: "0.75rem", color: MUTED }}>{trData(row.jour_semaine)}{row.ferie ? <div style={{ fontSize: ".68rem", fontWeight: 700, color: "var(--dk-accent-deep)" }}>{row.ferie}</div> : row.veille_de ? <div style={{ fontSize: ".68rem", fontWeight: 700, color: "var(--dk-accent-deep)" }}>{tr(`veille : ${row.veille_de}`, `eve of ${row.veille_de}`)}</div> : null}</td>
                    <td style={{ padding: "10px 0", textAlign: "right", fontSize: "0.85rem", fontWeight: 800, color: INK }}>{row.yhat > 0 ? fmt(row.yhat) : "—"}</td>
                    <td style={{ padding: "10px 0", textAlign: "right", fontSize: "0.75rem", color: MUTED }}>{row.yhat > 0 ? `${fmt(row.ca_prevu)} €` : "—"}</td>
                    <td style={{ padding: "10px 0", textAlign: "right", fontSize: "0.75rem", color: MUTED }}>{row.jour_type ? fmt(row.jour_type) : "—"}</td>
                    <td style={{ padding: "10px 0", textAlign: "right", fontSize: "0.75rem", fontWeight: 700, color: INK }}>{row.statut === "FERMÉ" || !row.ratio_pct ? "—" : Math.round(row.ratio_pct - 100) === 0 ? "0 %" : `${row.ratio_pct >= 100 ? "+" : "−"}${fmt(Math.abs(row.ratio_pct - 100))} %`}</td>
                    <td style={{ padding: "10px 0", textAlign: "right", fontSize: "0.78rem", fontWeight: 700, color: "var(--dk-ink2)" }}>{row.yhat > 0 ? `${fmt(row.yhat_lower)} – ${fmt(row.yhat_upper)}` : "—"}</td>
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
          {days.length > 10 && (
            <button type="button" className="fold-btn" onClick={() => setAllDays((v) => !v)} aria-expanded={allDays}>
              {allDays ? tr("Réduire", "Show less") : tr(`Voir les ${days.length} jours`, `See all ${days.length} days`)}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
                aria-hidden="true" style={{ transform: allDays ? "rotate(180deg)" : "none", transition: "transform .2s" }}>
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── JOURS À SURVEILLER (calculés à partir des données) ── */}
      <div className="sec-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <IconTarget size={18} color={ORANGE} />
        {tr("Les 5 jours qui dépassent le plus l'habitude", "The 5 days most above usual")}
      </div>
      <div className="sw">
        <div className="cc">
          <ChartAssistantButton chartType="days_to_watch" chartData={{ jours: data?.jours_a_surveiller || [], filtres_page: { mois } }} chartName="DaysToWatch"
            userQuestion="Explique les jours à surveiller" position="top-right" onOpenChat={openChat} />
          {(data?.jours_a_surveiller || []).length === 0 ? (
            <div style={{ fontSize: "0.8rem", color: MUTED }}>{tr("Aucun jour nettement plus chargé qu'un jour habituel sur la saison.", "No day clearly busier than a usual day this season.")}</div>
          ) : (
            <ul style={{ color: "var(--dk-ink2, #555)", lineHeight: "1.8", margin: 0, paddingLeft: "20px", fontSize: "0.82rem" }}>
              {(data?.jours_a_surveiller || []).map((d: any, i: number) => (
                <li key={i}>
                  <strong>{trData(d.jour_semaine)} {d.date_fr}</strong>{d.ferie ? <strong style={{ color: "var(--dk-accent-deep)" }}> · {d.ferie}</strong> : d.veille_de ? <strong style={{ color: "var(--dk-accent-deep)" }}> · {tr(`veille de ${d.veille_de}`, `eve of ${d.veille_de}`)}</strong> : null} — {tr(`${fmt(d.yhat)} articles prévus, ${fmt(d.ratio_pct - 100)} % de plus qu'un ${String(d.jour_semaine).toLowerCase()} habituel de ce mois (${fmt(d.jour_type)}) · probablement entre ${fmt(d.yhat_lower)} et ${fmt(d.yhat_upper)}`, `${fmt(d.yhat)} items forecast, ${fmt(d.ratio_pct - 100)}% more than a usual ${trData(d.jour_semaine)} that month (${fmt(d.jour_type)}) · likely between ${fmt(d.yhat_lower)} and ${fmt(d.yhat_upper)}`)}
                </li>
              ))}
            </ul>
          )}
          <div style={{ fontSize: "0.72rem", color: MUTED, marginTop: 10 }}>
            {tr("Pic de la période :", "Period peak:")} <strong>{kpis.pic_date}</strong> → <strong>{fmt(kpis.pic_val)} {tr("articles prévus", "forecast items")}</strong>
          </div>
        </div>
      </div>

    </div>
  );
}
