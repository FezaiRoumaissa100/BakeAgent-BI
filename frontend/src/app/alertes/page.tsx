"use client";

import React, { useEffect, useState } from "react";
import { colors } from "@/lib/theme";
import { ExpertNote } from "@/components/Expert";
import { Details, Scope } from "@/components/Ui";
import { ProductRiskCard } from "@/components/ProductRisk";
import { PrepListCard } from "@/components/PrepList";
import { AlertsToday, AlertsWatch } from "@/components/AlertsToday";
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
  RUPTURE: { label: "Très chargé", labelEn: "Very busy", color: "var(--dk-alert)", bg: "var(--dk-soft, #F4F1FC)", icon: <IconXCircle size={24} color="var(--dk-alert)" />, desc: "au moins 20 % de plus qu'un jour habituel", descEn: "at least 20% more than a usual day" },
  VIGILANCE: { label: "Chargé", labelEn: "Busy", color: "var(--dk-warn)", bg: "var(--dk-soft, #F4F1FC)", icon: <IconAlertTriangle size={24} color="var(--dk-warn)" />, desc: "10 à 20 % de plus qu'un jour habituel", descEn: "10 to 20% more than a usual day" },
  NORMAL: { label: "Habituel", labelEn: "Usual", color: "var(--ch-moss)", bg: "var(--dk-soft, #F4F1FC)", icon: <IconCheckCircle size={24} color="var(--ch-moss)" />, desc: "entre −20 % et +10 %", descEn: "between −20% and +10%" },
  SURSTOCK: { label: "Calme", labelEn: "Quiet", color: "var(--ch-3)", bg: "var(--dk-soft, #F4F1FC)", icon: <IconCircleDot size={24} color="var(--ch-3)" />, desc: "plus de 20 % de moins qu'un jour habituel", descEn: "more than 20% less than a usual day" },
  FERMÉ: { label: "Fermé", labelEn: "Closed", color: "var(--dk-muted, #5E5A78)", bg: "var(--dk-soft, #F4F1FC)", icon: <IconActivity size={24} color="var(--dk-muted, #5E5A78)" />, desc: "Boutique fermée", descEn: "Shop closed" },
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
  const mois = "Tout";   // toute la saison
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
  // Pas de prévision de saison (moins d'environ un an de ventes) : un message plutôt que des zéros
  const noSeason = !(Number(kpis.total_articles) > 0);
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

  // Phrase de la saison : jours chargés, jour et semaine les plus chargés
  const openSeason = days.filter((d: any) => d.yhat > 0).length;
  const seasonText = tr(
    `${statuts["RUPTURE"] || 0} jour(s) très chargé(s) et ${statuts["VIGILANCE"] || 0} chargé(s) sur ${openSeason} jours ouverts. Le plus chargé : le ${kpis.pic_date}.${busiestWeek ? ` La semaine la plus chargée commence le lundi ${busiestWeek.fr} : prévoir le personnel et les commandes à l'avance.` : ""}`,
    `${statuts["RUPTURE"] || 0} very busy and ${statuts["VIGILANCE"] || 0} busy day(s) out of ${openSeason} open days. Busiest: ${kpis.pic_date}.${busiestWeek ? ` The busiest week starts on Monday ${busiestWeek.fr}: plan staff and orders ahead.` : ""}`);

  return (
      <div style={{ paddingBottom: "40px" }}>
      {/* ── TITRE ── */}
      <div style={{ marginBottom: "14px", padding: "0 28px" }}>
        <h1 style={{ fontSize:"1.8rem", fontWeight:800, color:INK,
                     letterSpacing:"-0.03em", lineHeight:1.1, margin:0 }}>
          {tr("Alertes &", "Alerts &")} <span style={{ color: ORANGE }}>{tr("Stock", "Stock")}</span>
        </h1>
        <p className="page-lead">
          <span className="page-lead-ic" aria-hidden="true"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.3-2.4 3.6M12 17h.01" /></svg></span>
          <span>{tr("Ce qui change demain, les produits à surveiller, la saison.", "What changes tomorrow, products to watch, the season.")}</span>
        </p>
      </div>

      {/* ── 1. DEMAIN : seulement ce qui change, et la liste à imprimer ── */}
      <AlertsToday />

      {/* ── 2. À SURVEILLER sur les 14 prochains jours ── */}
      <AlertsWatch />

      {/* ── 3. LA SAISON, en une bande ── */}
      <div className="sw">
        {noSeason ? (
          <div>
          <div className="cc cs" style={{ lineHeight: 1.6 }}>
            {tr("Pas encore de prévision de saison : elle s'appuie sur la même période de l'année précédente, il faut donc environ un an de ventes. La liste « À préparer » et les 14 prochains jours, plus haut, fonctionnent déjà.",
                "No season forecast yet: it relies on the same period of the previous year, so it needs about a year of sales. The “To prepare” list and the next 14 days above already work.")}
          </div>
        </div>
        ) : (
          <div className="al-season">
            <ChartAssistantButton
              chartType="alerts_demande_risque"
              chartData={{ days, statuts, kpis, filters: { mois } }}
              chartName="AlertsDemandeRisque"
              userQuestion="Explique la demande prévue et les niveaux de risque"
              position="top-right"
              onOpenChat={openChat}
            />
            <div className="al-season-ic" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" /></svg>
            </div>
            <div className="al-season-txt">
              <div className="al-season-k">
                {tr("La saison", "The season")} <b>{anneePrev}</b>{plage ? ` · ${plage}` : ""}
                <span className="al-info" tabIndex={0} aria-label={tr("À savoir", "Good to know")}>
                  i<span className="al-info-tip" role="tooltip">{tr(`Chaque jour est comparé à un jour habituel du même mois (même jour de la semaine) : « très chargé » veut dire au moins 20 % de plus. Les ventes en plus sont les articles au-dessus d'un jour habituel, au prix moyen réel par article (${fmt(kpis.prix_moyen_article, 2)} € en moyenne) ; si la boutique se prépare comme d'habitude ces jours-là, ce sont des ventes manquées. Plusieurs mois à l'avance, la prévision donne une tendance : la quantité exacte à préparer se décide avec la carte du jour, en haut de la page.`, `Each day is compared with a usual day of the same month (same weekday): "very busy" means at least 20% more. Extra sales are the items above a usual day, at the real average price per item (€${fmt(kpis.prix_moyen_article, 2)} on average); if the shop prepares as usual on those days, these are missed sales. Months ahead, the forecast gives a trend: the exact quantity to prepare is decided with the day card at the top of the page.`)}</span>
                </span>
              </div>
              <p>{seasonText}</p>
            </div>
            <div className="al-season-chips">
              <div><b className="num">{fmt(kpis.total_articles)}</b><span>{tr("articles prévus", "items forecast")}</span></div>
              <div><b className="num">{fmt(kpis.ca_total_prevu)} €</b><span>{tr("de CA prévu", "forecast revenue")}</span></div>
              <div className="hot"><b className="num">{fmt(kpis.ca_risque)} €</b><span>{tr("à gagner les jours chargés", "to gain on busy days")}</span></div>
            </div>
          </div>
        )}
      </div>

      {/* ── 4. LE DÉTAIL, replié : liste complète, grille des 14 jours, détail de la saison ── */}
      <div className="sw al-more">
        <Details label={tr("La liste complète à préparer", "The full list to prepare")}>
          <PrepListCard bare />
        </Details>
        <Details label={tr("Les 14 prochains jours, produit par produit", "The next 14 days, product by product")}>
          <ProductRiskCard bare />
        </Details>
        {!noSeason && (<>
        <Details label={tr("La saison jour par jour, et les jours à surveiller", "The season day by day, and the days to watch")}>
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
                  <tr key={i} style={{ borderBottom: "1px solid var(--dk-surface, #FFFFFF)" }}>
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

      {/* ── JOURS À SURVEILLER (calculés à partir des données) ── */}
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
        </Details>
        </>)}
      </div>
    </div>
  );
}
