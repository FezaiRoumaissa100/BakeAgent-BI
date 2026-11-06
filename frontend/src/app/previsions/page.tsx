"use client";

import React, { useEffect, useState, useMemo } from "react";
import { ExpertNote } from "@/components/Expert";
import { Details, Scope } from "@/components/Ui";
import { ProductForecastSection } from "@/components/ProductForecast";
import { t as txt } from "@/lib/texts";
import { colors } from "@/lib/theme";
import { fetchForecast } from "@/lib/api";
import { niceScale, robustCap, fmtAxisNum } from "@/lib/chartScale";
import { useBox } from "@/lib/useBox";
import { tr, trData, locale } from "@/lib/i18n";
import { StoryIcons } from "@/components/PageStory";
import {
  IconSparkline as IconChartLine,
  IconBolt as IconZap,
  IconCalendarDays,
  IconTarget,
  IconFilter,
  IconBar,
  IconTrendUp,
  IconAlert,
  IconSettings,
  IconPercent,
  IconLayers,
  IconGitBranch,
  IconRefreshCw,
  IconEye,
  IconEyeOff,
  IconActivity,
  IconSparkline,
  IconSearch,
} from "@/components/Icons";
import { ChartAssistantButton } from "@/components/ChartAssistantButton";
import { useChat } from "@/contexts/ChatContext";

/* ──────────── Palette & helpers ──────────── */
const ORANGE = colors.accentDeep;
const PEACH = colors.accentDeep2;
const LIGHT = colors.amber;
const CREAM = colors.brown;
const INK = colors.ink;
const MUTED = colors.mutedDark;
const GRID = colors.grid;
const OK = colors.ok;
const WARN = colors.warn;
const ALERT = colors.alert;

function fmt(n: number, dec = 0) {
  return Number(n || 0).toLocaleString(locale(), {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
}

export default function PrevisionsPage() {
  const { openChat } = useChat();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Filter states
  const [horizon, setHorizon] = useState(14);
  const [forecastType, setForecastType] = useState("articles");
  const [product, setProduct] = useState("");
  const [category, setCategory] = useState("");
  const [season, setSeason] = useState("");
  const [event, setEvent] = useState("");
  const [historyPeriod, setHistoryPeriod] = useState("all");
  const [productSearchDebounce, setProductSearchDebounce] = useState("");

  // Visualization toggles
  const [showObserved, setShowObserved] = useState(true);
  const [showPredicted, setShowPredicted] = useState(true);
  const [showConfidence] = useState(false);

  // Debounce du champ recherche produit (350ms)
  useEffect(() => {
    const t = setTimeout(() => {
      setProduct(productSearchDebounce);
    }, 350);
    return () => clearTimeout(t);
  }, [productSearchDebounce]);

  useEffect(() => {
    loadForecast();
  }, [horizon, forecastType, product, category, season, event, historyPeriod]);

  const loadForecast = async () => {
    setLoading(true);
    try {
      const result = await fetchForecast({
        horizon,
        forecast_type: forecastType,
        product: product || undefined,
        category: category || undefined,
        season: season || undefined,
        event: event || undefined,
        history_period: historyPeriod,
      });
      setData(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <div style={{ padding: "40px", color: MUTED, fontSize: "0.9rem", fontWeight: 600 }}>
        {tr("Chargement des prévisions...", "Loading forecasts...")}
      </div>
    );
  }

  // Handle both old and new API formats
  const forecastInfo = data?.forecast_info || { type: "articles", label: "Articles", unit: "unités" };
  const metrics = data?.metrics || {};
  // Seule l'erreur médiane mesurée par le modèle est affichée (aucune valeur déduite ou par défaut)
  const prophetMetrics = data?.prophet_metrics || { mdape_cv: metrics.mdape_cv };
  const modelComparison = data?.model_comparison || [];
  const forecast = data?.forecast || data?.forecast_14j || [];
  // Historique affiché : 3 fois l'horizon (21 jours avant une prévision à 7 jours, 42 avant 14 jours)
  const history = (data?.history || []).slice(-horizon * 3);
  // Période affichée sous le titre du graphique : jours réels puis jours prévus
  const dmy = (ds?: string) => (ds ? `${ds.slice(8, 10)}/${ds.slice(5, 7)}/${ds.slice(0, 4)}` : "");
  const isCA = String(forecastInfo?.type || "").toLowerCase().includes("ca") || String(forecastInfo?.unit || "").includes("€");
  const unitPerDay = isCA ? tr("€ par jour", "€ per day") : tr("articles par jour", "items per day");
  const forecastSeason = data?.forecast_season || [];
  // Période réelle de la prévision saisonnière (ex. « juin – septembre 2026 »)
  const seasonLabel = (() => {
    const ds = forecastSeason.map((d: any) => String(d.ds || d.date || "")).filter(Boolean).sort();
    if (!ds.length) return "";
    const M = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
    const a = ds[0], b = ds[ds.length - 1];
    const ma = M[Number(a.slice(5, 7)) - 1], mb = M[Number(b.slice(5, 7)) - 1];
    return a.slice(0, 4) === b.slice(0, 4) ? `${ma} – ${mb} ${b.slice(0, 4)}` : `${ma} ${a.slice(0, 4)} – ${mb} ${b.slice(0, 4)}`;
  })();
  const decomposition = data?.decomposition || {};
  const availableFilters = data?.available_filters || { products: [], categories: [], seasons: [], events: [] };

  const pageTitle = forecastType === "ca" 
    ? tr(`Prévision du chiffre d'affaires à ${horizon} jours`, `${horizon}-day revenue forecast`)
    : tr(`Prévision des quantités vendues à ${horizon} jours`, `${horizon}-day forecast of units sold`);

  return (
    <div style={{ paddingBottom: "40px" }}>
      {/* ── TITRE + DESCRIPTION ── */}
      <div style={{ marginBottom: "16px", padding: "0 28px" }}>
        <h1 style={{ fontSize:"1.8rem", fontWeight:800, color:INK,
                     letterSpacing:"-0.03em", lineHeight:1.1, margin:0 }}>
          {tr("Prévisions", "Sales")} <span style={{ color: ORANGE }}>{tr("Ventes", "Forecasts")}</span>
        </h1>
        <p className="page-lead">
          <span className="page-lead-ic" aria-hidden="true"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.3-2.4 3.6M12 17h.01" /></svg></span>
          <span>
          {forecastType === "ca"
            ? tr(`Combien la boutique devrait encaisser (€) dans les ${horizon} prochains jours ; la prévision de la saison plus bas reste en articles.`, `How much the shop should take in (€) over the next ${horizon} days; the season forecast below stays in items.`)
            : tr(`Combien d'articles la boutique devrait vendre dans les ${horizon} prochains jours, et sur la prochaine saison.`, `How many items the shop should sell over the next ${horizon} days, and over the next season.`)}
          </span>
        </p>
      </div>

      {/* Horizon : 7 ou 14 jours (prévision jour par jour J+1 à J+14). Les filtres produit, catégorie, saison et
          événement restent retirés : la prévision porte sur toute la boutique (le détail par produit est plus bas). */}
      <div className="sw">
        <div className="cc" style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", padding: "12px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.75rem", fontWeight: 700, color: INK, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            <IconCalendarDays size={16} color={ORANGE} />
            {tr("Horizon", "Horizon")}
          </div>
          <div className="seg" role="group" aria-label={tr("Horizon", "Horizon")}>
            {[7, 14, 30].map((h) => {
              // 30 jours seulement si la dernière prévision calculée les contient (relancer forecasting\pipeline.py sinon)
              const off = h > (data?.forecast_info?.max_horizon ?? 14);
              return (
                <button key={h} type="button" onClick={() => setHorizon(h)} disabled={off} className={horizon === h ? "on" : ""} aria-pressed={horizon === h}
                  title={off ? tr("Disponible après le prochain calcul de la prévision (python forecasting\\pipeline.py)", "Available after the next forecast run (python forecasting\\pipeline.py)") : undefined}
                  style={off ? { opacity: 0.45, cursor: "not-allowed" } : undefined}>
                  {tr(`${h} jours`, `${h} days`)}
                </button>
              );
            })}
          </div>
          <div className="seg" role="group" aria-label={tr("Unité", "Unit")}>
            {[["articles", tr("Articles", "Items")], ["ca", tr("Chiffre d'affaires (€)", "Revenue (€)")]].map(([k, lbl]) => (
              <button key={k} type="button" onClick={() => setForecastType(k)} className={forecastType === k ? "on" : ""} aria-pressed={forecastType === k}>{lbl}</button>
            ))}
          </div>
          <span style={{ fontSize: "0.7rem", color: MUTED }}>
            {horizon > 14 && data?.prophet_metrics?.long?.wape_jour != null
              ? tr(`Les 14 premiers jours sont les plus fiables ; au-delà, l'écart moyen mesuré sur 30 jours est d'environ ${fmt(data.prophet_metrics.long.wape_jour * 100)} % par jour.`,
                   `The first 14 days are the most reliable; beyond that, the average error measured over 30 days is about ${fmt(data.prophet_metrics.long.wape_jour * 100)}% per day.`)
              : tr("Jour par jour jusqu'à 14 ou 30 jours ; plus loin, voir la prévision de la saison plus bas.", "Day by day up to 14 or 30 days; further ahead, see the season forecast below.")}
          </span>
        </div>
      </div>

      {/* ── L'HISTOIRE EN BREF : ce que disent les prévisions, avant les graphiques ── */}
      {(() => {
        const open = forecast.filter((f: any) => !f.is_ferme && f.yhat > 0);
        if (!open.length) return null;
        const isCa = forecastType === "ca";
        const u = (n: number) => isCa ? tr(`${fmt(n)} €`, `€${fmt(n)}`) : tr(`${fmt(n)} articles`, `${fmt(n)} items`);
        const total = open.reduce((a: number, f: any) => a + f.yhat, 0);
        const withLy = open.filter((f: any) => f.last_year != null && f.last_year > 0);
        const lyTot = withLy.reduce((a: number, f: any) => a + f.last_year, 0);
        const fcLy = withLy.reduce((a: number, f: any) => a + f.yhat, 0);
        const evo = lyTot > 0 && withLy.length >= Math.ceil(open.length / 2) ? (fcLy / lyTot - 1) * 100 : null;
        const pk = open.reduce((m: any, f: any) => (f.yhat > m.yhat ? f : m), open[0]);
        const low = open.reduce((m: any, f: any) => (f.yhat < m.yhat ? f : m), open[0]);
        const dayName = (f: any) => { const t = new Date(String(f.ds) + "T12:00:00").toLocaleDateString(locale(), { weekday: "long", day: "numeric", month: "long" }); return t; };
        // Saison : mois le plus chargé
        const byMonth: Record<string, number> = {};
        forecastSeason.filter((d: any) => d.yhat > 0).forEach((d: any) => { const k = String(d.ds).slice(0, 7); byMonth[k] = (byMonth[k] || 0) + d.yhat; });
        const bestM = Object.entries(byMonth).sort((a, b) => b[1] - a[1])[0];
        const monthName = (k: string) => new Date(k + "-15T12:00:00").toLocaleDateString(locale(), { month: "long", year: "numeric" });
        const errW = prophetMetrics.erreur_semaine != null ? Number(prophetMetrics.erreur_semaine) * 100 : null;
        const errD = prophetMetrics.mdape_cv != null ? Number(prophetMetrics.mdape_cv) : null;
        const points = [
          { icon: StoryIcons.trend, label: tr("Jour le plus chargé", "Busiest day"),
            value: u(pk.yhat),
            text: `${dayName(pk)}${pk.last_year ? tr(` · ${fmt(pk.last_year)} l'an dernier`, ` · ${fmt(pk.last_year)} last year`) : ""}` },
          { icon: StoryIcons.down, label: tr("Le plus calme", "Quietest"),
            value: u(low.yhat),
            text: dayName(low) },
          bestM ? { icon: StoryIcons.calendar, label: tr("Mois le plus chargé", "Busiest month"),
            value: tr(`${fmt(bestM[1])} articles`, `${fmt(bestM[1])} items`),
            text: tr(`${monthName(bestM[0])}, saison à venir`, `${monthName(bestM[0])}, coming season`) } : null,
          errW != null || errD != null ? { icon: StoryIcons.shield, label: tr("Fiabilité", "Reliability"),
            value: `± ${fmt(errW != null ? errW : (errD || 0))} %`,
            text: errW != null
              ? tr(`d'écart sur une semaine · ± ${fmt(errD || 0)} % sur un jour seul`, `off over a week · ± ${fmt(errD || 0)}% for a single day`)
              : tr("d'écart moyen sur un jour", "average daily error") } : null,
        ].filter(Boolean) as any[];
        const headline = evo !== null
          ? tr(`${horizon} prochains jours : environ ${u(total)}, soit ${fmt(Math.abs(evo))} % ${evo >= 0 ? "de plus" : "de moins"} que les mêmes jours l'an dernier.`,
               `Next ${horizon} days: about ${u(total)}, ${fmt(Math.abs(evo))}% ${evo >= 0 ? "more" : "less"} than the same days last year.`)
          : tr(`${horizon} prochains jours : environ ${u(total)} sur ${open.length} jours d'ouverture.`, `Next ${horizon} days: about ${u(total)} over ${open.length} open days.`);
        const todo = tr(`Prévoir fournées et personnel du ${dayName(pk)} dès la veille ; la quantité à préparer produit par produit est dans Alertes & Stock.`,
                        `Plan batches and staff for ${dayName(pk)} the day before; the quantity to prepare per product is in Alerts & Stock.`);
        // Résumé en une ligne (sans grand bandeau) : la phrase clé, puis la note « À savoir » en petit
        return (
          <div className="sw">
            <div className="fc-sum">
              <span className="fc-sum-ic" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l6-6 4 4 8-8" /><path d="M14 7h7v7" /></svg>
              </span>
              <div style={{ minWidth: 0 }}>
                <div className="fc-sum-h">{headline}</div>
                <div className="fc-sum-n">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
                  {tr("Ce sont des estimations à partir des ventes passées, pas un comptage du stock.", "These are estimates based on past sales, not a stock count.")}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── HISTORY + FORECAST CHART ── */}
      <div className="sec-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <IconChartLine size={18} color={ORANGE} />
        {tr("Avant et après aujourd'hui", "Before and after today")}
      </div>
      <>
      <div className="sw">
        {/* Graphique (2/3) + chiffres à retenir à côté (1/3) */}
        <div className="fc-layout">
        <div className="cc">
          <ChartAssistantButton chartType="forecast" chartData={{ history, forecast, showObserved, showPredicted, showConfidence, horizon, filtres_page: { horizon, type: forecastType, produit: product, categorie: category, saison: season, evenement: event } }} chartName="ForecastChart"
            userQuestion="Explique cette prévision de demande" position="top-right" onOpenChat={openChat} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: "6px" }}>
            <div>
              <div className="ct">{tr("Ventes récentes et prévision", "Recent sales and forecast")}</div>
              <Scope period={history.length && forecast.length
                  ? tr(`Réel ${dmy(history[0].ds)} → ${dmy(history[history.length - 1].ds)} · Prévu ${dmy(forecast[0].ds)} → ${dmy(forecast[forecast.length - 1].ds)}`,
                       `Actual ${dmy(history[0].ds)} → ${dmy(history[history.length - 1].ds)} · Forecast ${dmy(forecast[0].ds)} → ${dmy(forecast[forecast.length - 1].ds)}`)
                  : undefined}
                calc={tr("Ventes de toute la boutique", "Whole-shop sales")} unit={unitPerDay} />
            </div>
          </div>
          
          <div style={{ height: "300px", width: "100%" }}>
            {history.length > 0 && forecast.length > 0 ? (
              <ForecastChart 
                history={history} 
                forecast={forecast}
                showObserved={showObserved}
                showPredicted={showPredicted}
                showConfidence={showConfidence}
                unit={forecastType === "ca" ? "€" : tr("articles", "items")}
                controls={(
            <div className="seg" role="group" aria-label={tr("Afficher", "Show")} style={{ flex: "none" }}>
              {([[tr("Ventes réelles", "Actual sales"), showObserved, setShowObserved, INK], [tr("Prévision", "Forecast"), showPredicted, setShowPredicted, ORANGE]] as [string, boolean, (v: boolean) => void, string][]).map(([lbl, on, set, c]) => (
                <button key={lbl} type="button" className={on ? "on" : ""} aria-pressed={on} onClick={() => set(!on)} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: on ? "#fff" : c }} />{lbl}
                </button>
              ))}
            </div>
                )}
              />
            ) : (
              <div style={{ 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center", 
                height: "100%", 
                color: MUTED, 
                fontSize: "0.9rem",
                fontWeight: 600 
              }}>
                {loading ? tr("Chargement du graphique...", "Loading chart...") : tr("Données insuffisantes pour afficher le graphique", "Not enough data to display the chart")}
              </div>
            )}
          </div>
          <ExpertNote>
            {prophetMetrics.source === "pipeline" ? (
              <>Source : forecasting/pipeline.py (calcul du {prophetMetrics.run_at}, données jusqu'au {prophetMetrics.data_end}), table shop_forecasts. Prévision de la boutique = {prophetMetrics.poids_an_dernier != null ? `${fmt((1 - prophetMetrics.poids_an_dernier) * 100)} % somme des prévisions par produit + ${fmt(prophetMetrics.poids_an_dernier * 100)} % ventes de la boutique le même jour l'an dernier` : "somme des prévisions par produit"} (la somme des produits suit le niveau récent ; l'an dernier voit venir les changements de saison et les jours fériés) ; poids choisi sur les fenêtres de test{prophetMetrics.choix_poids ? ` (${prophetMetrics.choix_poids})` : ""}. Le total peut donc différer un peu de la somme des produits affichés plus bas. Précision mesurée honnêtement sur {prophetMetrics.jours_testes ?? "—"} jours de test ({prophetMetrics.fenetres ?? "—"} fenêtres de 14 jours ; pour chaque fenêtre, chaque produit utilise la méthode qu'il aurait choisie sans elle) : écart médian d'un jour {prophetMetrics.mdape_cv != null ? fmt(Number(prophetMetrics.mdape_cv), 1) : "—"} %, WAPE {prophetMetrics.wape_jour != null ? fmt(prophetMetrics.wape_jour * 100, 1) : "—"} %, erreur sur la semaine {prophetMetrics.erreur_semaine != null ? fmt(prophetMetrics.erreur_semaine * 100, 1) : "—"} %, biais {prophetMetrics.biais != null ? fmt(prophetMetrics.biais * 100, 1) : "—"} %{prophetMetrics.biais_fenetre_min != null ? ` (selon la fenêtre, de ${fmt(prophetMetrics.biais_fenetre_min * 100)} % à +${fmt(prophetMetrics.biais_fenetre_max * 100)} % : écarts plus forts aux changements de saison et autour des fêtes)` : ""} ; objectif cahier : 15–20 % à 14 jours. Fourchette = écarts relatifs observés sur le total, niveaux ajustés pour viser ≈ 10 % des jours au-dessus de la borne haute ; mesuré sans la fenêtre testée : {prophetMetrics.couverture_fourchette != null ? fmt(prophetMetrics.couverture_fourchette * 100, 0) : "—"} % des ventes dans la fourchette, {prophetMetrics.au_dessus_fourchette != null ? fmt(prophetMetrics.au_dessus_fourchette * 100, 0) : "—"} % au-dessus (en conditions réelles, les changements de saison peuvent faire dépasser plus souvent). Chiffre d'affaires = quantités × prix moyen récent de chaque produit ; WAPE {prophetMetrics.wape_jour_ca != null ? fmt(prophetMetrics.wape_jour_ca * 100, 1) : "—"} %, biais {prophetMetrics.biais_ca != null ? fmt(prophetMetrics.biais_ca * 100, 1) : "—"} % (moins fiable que les quantités autour des fêtes : produits chers comme les bûches). Jours fériés pris en compte : {prophetMetrics.jours_feries_pays ? `pays « ${prophetMetrics.jours_feries_pays} » (réglage jours_feries_pays de forecasting/config.json)` : "aucun (réglage jours_feries_pays vide)"}. Référence = AVG(nb_articles) des mêmes jours décalés de 364 jours.</>
            ) : (
              <>Source : prévision Prophet du notebook (model_name « 14j_global »), utilisée parce que forecasting/pipeline.py n'a pas encore été lancé. Fiabilité = MDAPE en validation croisée{prophetMetrics.mdape_cv != null ? ` = ${fmt(Number(prophetMetrics.mdape_cv), 2)} %` : " : non disponible"}. Intervalle = yhat_lower / yhat_upper. Cette prévision n'a pas été vérifiée pour les jours fériés et les fermetures : lancer python forecasting\pipeline.py.</>
            )}
          </ExpertNote>
        </div>
          <div className="side-col" style={{ alignSelf: "start" }}>
          <div className="cc kpi-card">
          <div className="kpi-card-t">{tr("Chiffres clés", "Key figures")}</div>
          {/* Uniquement ce que le bandeau ne dit pas déjà : jours d'ouverture, moyenne par jour, total probable */}
          {(() => {
            const isCa = forecastType === "ca";
            const u = (n: number) => (isCa ? `${fmt(n)} €` : tr(`${fmt(n)} articles`, `${fmt(n)} items`));
            const open = forecast.filter((f: any) => !f.is_ferme && f.yhat > 0);
            const closed = forecast.filter((f: any) => f.is_ferme || !(f.yhat > 0));
            const total = open.reduce((a: number, f: any) => a + f.yhat, 0);
            const avg = open.length ? total / open.length : 0;
            const ly = Number(metrics.moy_jour_historique) || 0;
            const errW = prophetMetrics.erreur_semaine != null ? Number(prophetMetrics.erreur_semaine) : null;
            const dd = (f: any) => new Date(String(f.ds) + "T12:00:00").toLocaleDateString(locale(), { weekday: "short", day: "numeric", month: "short" });
            const closedTxt = closed.slice(0, 3).map(dd).join(", ") + (closed.length > 3 ? "…" : "");
            const rows = [
              { ic: <IconCalendarDays size={16} />, l: tr("Jours d'ouverture", "Open days"), v: tr(`${open.length} sur ${forecast.length}`, `${open.length} of ${forecast.length}`),
                s: closed.length ? tr(`fermé : ${closedTxt}`, `closed: ${closedTxt}`) : tr("aucun jour fermé prévu", "no closed day expected") },
              { ic: <IconBar size={16} />, l: tr("Moyenne par jour ouvert", "Average per open day"), v: u(avg),
                s: ly ? tr(`${u(ly)} l'an dernier, mêmes jours`, `${u(ly)} last year, same days`) : tr("jours d'ouverture seulement", "open days only") },
              errW != null ? { ic: <IconTarget size={16} />, l: tr("Total probable", "Likely total"),
                v: `${fmt(total * (1 - errW))} – ${fmt(total * (1 + errW))}${isCa ? " €" : ""}`,
                s: tr(`sur ${horizon} jours, selon l'écart habituel (± ${fmt(errW * 100)} %)`, `over ${horizon} days, given the usual error (± ${fmt(errW * 100)}%)`) } : null,
            ].filter(Boolean) as any[];
            return rows.map((r) => (
              <div key={r.l} className="kpi-line">
                <div className="kpi-top"><span className="kpi-ic">{r.ic}</span>{r.l}</div>
                <div className="kpi-v num">{r.v}</div>
                <span className="kpi-d">{r.s}</span>
              </div>
            ));
          })()}
          </div>
          </div>
        </div>
      </div>

      {/* ── PROPHET DECOMPOSITION ── */}
      {Object.keys(decomposition).length > 0 && (
        <>
          <div className="sw">
            <Details label={tr("Voir le détail : ce qui explique la prévision", "See details: what drives the forecast")}>
            <div className="cc">
              <ChartAssistantButton chartType="forecast_decomposition" chartData={{ decomposition, filtres_page: { horizon, type: forecastType, produit: product, categorie: category, saison: season, evenement: event } }} chartName="ForecastDecomposition"
                userQuestion="Explique la décomposition de la prévision (tendance, saisonnalité, événements)" position="top-right" onOpenChat={openChat} />
              <div className="ct">{tr("Ce qui fait monter ou baisser la prévision (décomposition)", "What pushes the forecast up or down (breakdown)")}</div>
              <div className="cs">{tr("Tendance, saisonnalité et événements", "Trend, seasonality and events")}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px", marginTop: "16px" }}>
                {decomposition.trend && (
                  <div>
                    <div style={{ fontSize: "0.8rem", fontWeight: 700, color: INK, marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                      <IconTrendUp size={16} color={ORANGE} />
                      {tr("Tendance", "Trend")}
                    </div>
                    <div style={{ height: "150px" }}>
                      <MiniChart data={decomposition.trend} color={ORANGE} />
                    </div>
                  </div>
                )}
                {decomposition.seasonal && (
                  <div>
                    <div style={{ fontSize: "0.8rem", fontWeight: 700, color: INK, marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                      <IconSparkline size={16} color={OK} />
                      {tr("Saisonnalité", "Seasonality")}
                    </div>
                    <div style={{ height: "150px" }}>
                      <MiniChart data={decomposition.seasonal} color={OK} />
                    </div>
                  </div>
                )}
                {decomposition.holidays && (
                  <div>
                    <div style={{ fontSize: "0.8rem", fontWeight: 700, color: INK, marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                      <IconAlert size={16} color={WARN} />
                      {tr("Événements", "Events")}
                    </div>
                    <div style={{ height: "150px" }}>
                      <MiniChart data={decomposition.holidays} color={WARN} />
                    </div>
                  </div>
                )}
              </div>
            </div>
            </Details>
          </div>
        </>
      )}

      </>

      {/* ── SEASONAL FORECAST ── */}
      {forecastSeason.length > 0 && (
        <>
          <div className="sw">
            <Details label={tr("Voir le détail : la saison à venir", "See details: the coming season")}>
            <div className="cc">
              <ChartAssistantButton chartType="seasonal" chartData={{ data: forecastSeason, filtres_page: { horizon, type: forecastType, produit: product, categorie: category, saison: season, evenement: event } }} chartName="SeasonalChart"
                userQuestion="Explique cette saisonnalité" position="top-right" onOpenChat={openChat} />
              <div className="ct">{tr("Prévision des ventes pour la prochaine saison", "Sales forecast for the next season")}</div>
              <Scope period={tr(`Prévision : ${seasonLabel}`, `Forecast: ${seasonLabel}`)} calc={tr("Total prévu de chaque jour, tous produits", "Forecast total of each day, all products")} unit={tr("articles par jour", "items per day")} />
              <div className="cs">{tr(`Articles par jour, ${seasonLabel}, avec la fourchette basse – haute. × = jour prévu fermé (d'après les habitudes de la boutique l'an dernier), à confirmer avec la boutique.`, `Items per day, ${seasonLabel}, with the low – high range. × = day expected closed (based on the shop's habits last year), to be confirmed with the shop.`)}</div>
              <div style={{ height: "300px", width: "100%", marginTop: "12px" }}>
                <SeasonalChart data={forecastSeason} />
              </div>
              {(() => {
                const open = forecastSeason.filter((d: any) => d.yhat > 0);
                if (!open.length) return null;
                const pk = open.reduce((m: any, d: any) => (d.yhat > m.yhat ? d : m), open[0]);
                const shut = forecastSeason.filter((d: any) => !(d.yhat > 0));
                const JF = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
                const JE = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
                const cnt: Record<number, number> = {};
                shut.forEach((d: any) => { const k = new Date(String(d.ds) + "T00:00:00").getDay(); cnt[k] = (cnt[k] || 0) + 1; });
                const top = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
                const shutFr = shut.length ? ` ${shut.length} jour${shut.length > 1 ? "s" : ""} prévu${shut.length > 1 ? "s" : ""} fermé${shut.length > 1 ? "s" : ""}${top && top[1] > 1 ? ` (dont ${top[1]} ${JF[Number(top[0])]}s)` : ""}.` : "";
                const shutEn = shut.length ? ` ${shut.length} day${shut.length > 1 ? "s" : ""} expected closed${top && top[1] > 1 ? ` (incl. ${top[1]} ${JE[Number(top[0])]}s)` : ""}.` : "";
                // Évolution récente non appliquée : on le dit, pour que le gérant puisse en tenir compte
                const sz: any = prophetMetrics.saison || {};
                const ev3 = sz.evolution_3_mois;
                const trendNote = sz.alpha === 0 && ev3 != null && Math.abs(ev3 - 1) >= 0.05
                  ? [` Les 3 derniers mois sont ${fmt(Math.abs(ev3 - 1) * 100)} % ${ev3 < 1 ? "sous" : "au-dessus de"} l'an dernier : cette évolution n'est pas appliquée à la saison, car sur l'historique de la boutique l'appliquer rendait les prévisions moins justes.`,
                     ` The last 3 months are ${fmt(Math.abs(ev3 - 1) * 100)}% ${ev3 < 1 ? "below" : "above"} last year: this trend is not applied to the season because, on the shop's history, applying it made forecasts less accurate.`]
                  : ["", ""];
                return (
                  <Takeaway>
                    {tr(
                      `Pic le ${pk.label} avec ${fmt(pk.yhat)} articles. Prévoir le personnel et les achats en conséquence.${shutFr}${trendNote[0]}`,
                      `Peak on ${pk.label} with ${fmt(pk.yhat)} items. Plan staff and purchases accordingly.${shutEn}${trendNote[1]}`
                    )}
                  </Takeaway>
                );
              })()}
              <ExpertNote>
                {prophetMetrics.source === "pipeline" && prophetMetrics.saison?.debut ? (() => {
                  const sz = prophetMetrics.saison;
                  const pc = (v: any, d = 1) => (v != null ? `${fmt(v * 100, d)} %` : "—");
                  return <>Source : forecasting/pipeline.py, table shop_forecasts (kind = « saison »). Période choisie automatiquement : {sz.choix_mois}, plus un mois avant et après ({sz.libelle}). Prévision = ventes de la boutique le même jour l'an dernier (même jour de semaine, lissé avec les semaines voisines{sz.part_meme_date ? `, mélangé à ${fmt(sz.part_meme_date * 100)} % avec la même date l'an dernier` : ""}) × évolution des ventes sur un an ({fmt(sz.evolution, 3)}) puissance α = {sz.alpha} ; réglages {sz.choix_alpha}. Évolution des 3 derniers mois : {sz.evolution_3_mois != null ? fmt(sz.evolution_3_mois, 3) : "—"} ; évolution des prix à panier constant : {sz.evolution_prix != null ? fmt(sz.evolution_prix, 3) : "—"}. Mesuré sur {sz.dates_test} dates passées, 1 à 8 mois à l'avance : écart {pc(sz.wape_jour)} par jour, {pc(sz.erreur_mois)} par mois, biais {pc(sz.biais)}. Fourchette = quantiles 10 % / 90 % des écarts observés ({sz.fourchette}) ; ventes réelles dans la fourchette, mesuré sans la date testée : {pc(sz.couverture_fourchette, 0)}. Jours fermés : même habitude que l'an dernier à la même période (ex. mercredis), jours fériés fermés l'an dernier s'ils se répètent ; une fermeture ponctuelle n'est pas reproduite. Jours d'événement (calendrier, et jours fériés du pays choisi dans forecasting/config.json s'ils ont réellement été des jours à part l'an dernier) : même jour d'événement l'an dernier.</>;
                })() : (
                  <>Source : prévision de saison du notebook (Prophet × coefficients mensuels), utilisée parce que forecasting/pipeline.py n'a pas encore été lancé. Non vérifiée : jours à 0 traités comme fermés sans contrôle. Lancer python forecasting\pipeline.py.</>
                )}
              </ExpertNote>
            </div>
            </Details>
          </div>
        </>
      )}


      <ProductForecastSection horizon={horizon} unit={forecastType} />
    </div>
  );
}

// ── COMPONENTS ──

function MetricCard({ icon, title, subtitle, value, unit = "", color }: any) {
  return (
    <div className="cc" style={{ textAlign: "left" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
        {icon}
        <div>
          <div className="ct">{title}</div>
          <div className="cs">{subtitle}</div>
        </div>
      </div>
      <div style={{ fontSize: "1.8rem", fontWeight: 800, color: color }}>
        {value}{unit && <span style={{ fontSize: "1rem", fontWeight: 500, color: MUTED, marginLeft: "4px" }}>{unit}</span>}
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange, icon }: any) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "8px 16px",
        borderRadius: "8px",
        border: checked ? "2px solid var(--dk-accent-deep, #43309E)" : "1px solid var(--dk-line, #E3E4DD)",
        background: checked ? "rgba(115,87,217,0.10)" : "var(--dk-surface, white)",
        fontSize: "0.85rem",
        fontWeight: checked ? 700 : 500,
        color: checked ? "var(--dk-accent-deep, #43309E)" : INK,
        cursor: "pointer"
      }}
    >
      {checked ? <IconEye size={16} color="var(--dk-accent-deep, #43309E)" /> : <IconEyeOff size={16} color={MUTED} />}
      {label}
    </button>
  );
}

function Takeaway({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 10, fontSize: ".8rem", color: INK, lineHeight: 1.45, borderLeft: `3px solid ${ORANGE}`, paddingLeft: 10 }}>
      {children}
    </div>
  );
}

// « 2026-01-07 » → « 07/01 »
function ddmm(ds?: string) {
  if (!ds || ds.length < 10) return ds || "";
  return `${ds.slice(8, 10)}/${ds.slice(5, 7)}`;
}

// Pas « rond » pour l'axe vertical (100, 200, 250, 500…)
function niceStep(max: number, ticks = 5) {
  const raw = max / ticks;
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1))));
  const m = raw / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
}

function ForecastChart({ history, forecast: forecastAll, showObserved, showPredicted, showConfidence, controls, unit = "" }: any) {
  // Jour survolé : une ligne verticale + une petite bulle avec les chiffres du jour
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  // Les jours de fermeture ne sont pas tracés (l'historique n'en contient pas non plus) :
  // ils restent visibles dans le calendrier.
  const forecast = (forecastAll || [])
    .filter((f: any) => !(f.is_ferme === 1 || f.yhat === 0))
    .map((f: any) => ({ ...f, label: ddmm(f.ds) }));
  // Proportions proches de la carte : le texte du graphique garde à peu près sa taille réelle
  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const [, W, H] = useBox(1200, 560, svgRef);   // taille réelle du graphique
  const pad = { l: 70, r: 30, t: 46, b: 46 };
  
  // Zoom state
  const [zoomStart, setZoomStart] = useState<number | null>(null);
  const [zoomEnd, setZoomEnd] = useState<number | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selStart, setSelStart] = useState<number | null>(null);
  const [selCurrent, setSelCurrent] = useState<number | null>(null);

  const allData = [...history, ...forecast];
  const totalPts = allData.length;
  const n = Math.max(totalPts - 1, 1);
  
  const effStart = zoomStart ?? 0;
  const effEnd = zoomEnd ?? n;
  const effN = Math.max(effEnd - effStart, 1);

  // Échelle calculée sur la partie AFFICHÉE (un zoom sur la prévision donne une échelle à sa taille), avec des
  // graduations rondes. Un jour isolé très au-dessus des autres (ex. 31 décembre) ne doit pas écraser la courbe :
  // il est coupé en haut du graphique avec sa valeur écrite.
  const visVals = allData.map((d: any, i: number) => (i < history.length ? d.y : (showConfidence ? d.yhat_upper : d.yhat)))
    .filter((_: number, i: number) => i >= effStart && i <= effEnd);
  const { cap } = robustCap(visVals, 1.35);
  const scale = niceScale(Math.max(cap, 10) * 1.06, 5);
  const max = scale.max;
  const min = 0;

  const toX = (i: number) => pad.l + ((i - effStart) / effN) * (W - pad.l - pad.r);
  const toY = (v: number) => H - pad.b - ((Math.min(v, max) - min) / (max - min)) * (H - pad.t - pad.b);
  // Jours historiques au-dessus de l'échelle (affichés coupés, avec leur valeur)
  const clippedHist = history.map((h: any, i: number) => ({ i, y: h.y })).filter((h: any) => h.y > max && h.i >= effStart && h.i <= effEnd);

  const clientXToIdx = (clientX: number): number | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const relX = ((clientX - rect.left) / rect.width) * W;
    if (relX < pad.l || relX > W - pad.r) return null;
    const raw = ((relX - pad.l) / (W - pad.l - pad.r)) * effN + effStart;
    return Math.max(effStart, Math.min(effEnd, Math.round(raw)));
  };

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    const idx = clientXToIdx(e.clientX);
    if (idx === null) return;
    setIsSelecting(true);
    setSelStart(idx);
    setSelCurrent(idx);
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isSelecting) { setHoverIdx(clientXToIdx(e.clientX)); return; }
    const idx = clientXToIdx(e.clientX);
    if (idx === null) return;
    setSelCurrent(idx);
  };

  const handleMouseUp = () => {
    if (!isSelecting || selStart === null || selCurrent === null) {
      setIsSelecting(false);
      setSelStart(null);
      setSelCurrent(null);
      return;
    }
    const a = Math.min(selStart, selCurrent);
    const b = Math.max(selStart, selCurrent);
    if (b - a >= 2) {
      setZoomStart(a);
      setZoomEnd(b);
    }
    setIsSelecting(false);
    setSelStart(null);
    setSelCurrent(null);
  };

  const handleMouseLeave = () => {
    setHoverIdx(null);
    if (isSelecting) {
      handleMouseUp();
    }
  };

  const resetZoom = () => {
    setZoomStart(null);
    setZoomEnd(null);
  };

  const selX1 = selStart !== null && selCurrent !== null ? toX(Math.min(selStart, selCurrent)) : 0;
  const selX2 = selStart !== null && selCurrent !== null ? toX(Math.max(selStart, selCurrent)) : 0;
  const isZoomed = zoomStart !== null && zoomEnd !== null;

  // Generate chart paths
  const histPts = history.map((h: any, i: number) => ({ x: toX(i), y: toY(h.y) }));
  let histPath = histPts.length > 0 ? `M ${histPts[0].x} ${histPts[0].y}` : "";
  for (let i = 0; i < histPts.length - 1; i++) { histPath += ` L ${histPts[i + 1].x} ${histPts[i + 1].y}`; }

  const fcPts = [histPts[history.length - 1], ...forecast.map((f: any, i: number) => ({ x: toX(history.length + i), y: toY(f.yhat) }))];
  let fcPath = fcPts.length > 0 ? `M ${fcPts[0].x} ${fcPts[0].y}` : "";
  for (let i = 0; i < fcPts.length - 1; i++) { fcPath += ` L ${fcPts[i + 1].x} ${fcPts[i + 1].y}`; }

  // Confidence interval
  let confidencePath = "";
  if (showConfidence) {
    const upperPts = forecast.map((f: any, i: number) => ({ x: toX(history.length + i), y: toY(f.yhat_upper) }));
    const lowerPts = [...forecast.map((f: any, i: number) => ({ x: toX(history.length + i), y: toY(f.yhat_lower) }))].reverse();
    confidencePath = `M ${histPts[history.length - 1].x} ${histPts[history.length - 1].y}`;
    upperPts.forEach((pt: { x: number; y: number }) => confidencePath += ` L ${pt.x} ${pt.y}`);
    lowerPts.forEach((pt) => confidencePath += ` L ${pt.x} ${pt.y}`);
    confidencePath += ` Z`;
  }

  const splitX = toX(history.length - 1);

  // Date labels - show intelligently based on zoom
  const dateStep = Math.max(1, Math.floor(effN / 10)); // Show ~10 dates max for better coverage
  const dateLabels = [];
  for (let i = effStart; i <= effEnd; i += dateStep) {
    if (i < allData.length) {
      const dataPoint = allData[i];
      const label = dataPoint.label || dataPoint.date_fr || "";
      const shortLabel = label.length > 8 ? label.slice(0, 8) : label;
      dateLabels.push({ x: toX(i), label: shortLabel, fullDate: dataPoint.ds || dataPoint.date_fr });
    }
  }

  // Y-axis labels
  const yLabels = scale.ticks.map((v) => ({ y: toY(v), value: fmtAxisNum(v, locale()) }));

  // Colors for different elements - using varied colors as requested
  const histColor = "var(--dk-ink, #24213A)";      // Dark for history
  const fcColor = "var(--dk-accent-deep, #43309E)";       // Orange for forecast
  const confColor = "rgba(115,87,217,0.16)"; // Light orange for confidence
  const gridColor = "var(--dk-grid, rgba(120,140,120,0.2))";

  // Bulle du jour survolé (rien pendant une sélection de zoom, ni sur une série masquée)
  const hov = (() => {
    if (hoverIdx == null || isSelecting) return null;
    const isFc = hoverIdx >= history.length;
    if (isFc ? !showPredicted : !showObserved) return null;
    const d: any = allData[hoverIdx];
    if (!d) return null;
    const v = isFc ? d.yhat : d.y;
    if (v == null) return null;
    const date = d.ds ? new Date(String(d.ds) + "T12:00:00").toLocaleDateString(locale(), { weekday: "long", day: "numeric", month: "long" }) : d.label;
    return { x: toX(hoverIdx), y: toY(Math.min(v, max)), v, fc: isFc, date, lo: isFc ? d.yhat_lower : null, hi: isFc ? d.yhat_upper : null, ly: isFc && d.last_year ? d.last_year : null };
  })();

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 4, paddingRight: 4 }}>
        {controls}
        <span style={{ fontSize: "0.72rem", color: MUTED, fontWeight: 600, flex: 1, minWidth: 0 }}>
          {isZoomed
            ? tr(`Zoom : ${allData[effStart]?.label || ''} → ${allData[effEnd]?.label || ''} · Double-cliquez pour réinitialiser`, `Zoom: ${allData[effStart]?.label || ''} → ${allData[effEnd]?.label || ''} · Double-click to reset`)
            : tr("Glissez sur le graphique pour zoomer · jours fermés non tracés", "Drag on the chart to zoom · closed days not plotted")}
        </span>
        {!isZoomed && history.length > 15 && (
          <button
            onClick={() => { setZoomStart(Math.max(0, history.length - 15)); setZoomEnd(n); }}
            style={{ fontSize: "0.7rem", background: "transparent", border: `1px solid ${fcColor}`, color: fcColor,
                     padding: "4px 12px", borderRadius: 999, cursor: "pointer", fontWeight: 700 }}
          >
            {tr("Voir la prévision de près", "Zoom on the forecast")}
          </button>
        )}
        {isZoomed && (
          <button
            onClick={resetZoom}
            onDoubleClick={resetZoom}
            style={{
              fontSize: "0.7rem",
              background: "transparent",
              border: `1px solid ${fcColor}`,
              color: fcColor,
              padding: "4px 12px",
              borderRadius: 999,
              cursor: "pointer",
              fontWeight: 700
            }}
          >
            {tr("× Réinitialiser", "× Reset")}
          </button>
        )}
      </div>

      <div style={{ position: "relative", flex: 1, minHeight: 0, display: "flex" }}>
      <svg 
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`} 
        style={{ width: "100%", height: "100%" }} 
        preserveAspectRatio="xMidYMid meet"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onDoubleClick={resetZoom}
      >
        {/* Grid lines */}
        {yLabels.map((label) => (
          <line key={label.y} x1={pad.l} y1={label.y} x2={W - pad.r} y2={label.y} stroke={gridColor} strokeWidth="1" />
        ))}

        {/* Y-axis labels */}
        {yLabels.map((label) => (
          <text key={label.y} x={pad.l - 10} y={label.y + 5} textAnchor="end" fontSize="11" fill={MUTED} fontWeight="600">
            {label.value}
          </text>
        ))}

        {/* X-axis labels (dates) */}
        {dateLabels.map((label) => (
          <text key={label.x} x={label.x} y={H - pad.b + 20} textAnchor="middle" fontSize="11" fill={MUTED} fontWeight="600">
            {label.label}
          </text>
        ))}

        {/* Split line between history and forecast */}
        <line x1={splitX} y1={pad.t} x2={splitX} y2={H - pad.b} stroke="var(--ch-moss)" strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />
        <text x={splitX - 8} y={pad.t - 12} textAnchor="end" fontSize="12" fill="var(--dk-muted, #5E5A78)" fontWeight="700">{tr("Historique", "History")}</text>
        <text x={splitX + 8} y={pad.t - 12} textAnchor="start" fontSize="12" fill="var(--dk-accent-deep, #43309E)" fontWeight="700">{tr(`${(forecastAll || []).length} prochains jours`, `Next ${(forecastAll || []).length} days`)}</text>

        {/* Zone de prévision : fond violet léger */}
        <rect x={Math.min(Math.max(splitX, pad.l), W - pad.r)} y={pad.t} width={Math.max(0, W - pad.r - Math.max(splitX, pad.l))} height={H - pad.t - pad.b} fill="var(--dk-accent-wash)" opacity={0.6} rx={6} />

        {/* Confidence interval */}
        {showConfidence && confidencePath && (
          <path d={confidencePath} fill={confColor} stroke="none" />
        )}

        {/* History line */}
        {showObserved && histPath && (
          <path d={histPath} fill="none" stroke={histColor} strokeWidth="2" opacity="0.7" />
        )}

        {/* Forecast line */}
        {showPredicted && fcPath && (
          <path d={fcPath} fill="none" stroke={fcColor} strokeWidth="3" />
        )}

        {/* Jours au-dessus de l'échelle : coupés en haut, valeur écrite */}
        {showObserved && clippedHist.map((c: any) => (
          <g key={`clip${c.i}`}>
            <text x={toX(c.i)} y={pad.t - 2} textAnchor="middle" fontSize="13" fill={histColor} fontWeight="800">▲ {fmt(c.y)}</text>
            <title>{tr(`${allData[c.i]?.label || ""} : ${fmt(c.y)} (hors échelle)`, `${allData[c.i]?.label || ""}: ${fmt(c.y)} (off scale)`)}</title>
          </g>
        ))}

        {/* Forecast points */}
        {showPredicted && fcPts.slice(1).map((pt: any, i: number) => (
          <circle key={i} cx={pt.x} cy={pt.y} r="5" fill="var(--dk-surface, white)" stroke={fcColor} strokeWidth="2.5" />
        ))}

        {/* Selection rectangle */}
        {isSelecting && selStart !== null && selCurrent !== null && (
          <rect 
            x={Math.min(selX1, selX2)} 
            y={pad.t} 
            width={Math.abs(selX2 - selX1)} 
            height={H - pad.t - pad.b} 
            fill="rgba(115,87,217,0.10)" 
            stroke={fcColor} 
            strokeWidth="1" 
            strokeDasharray="4 4"
          />
        )}

        {/* Axes */}
        <line x1={pad.l} y1={pad.t} x2={pad.l} y2={H - pad.b} stroke={INK} strokeWidth="1" />
        <line x1={pad.l} y1={H - pad.b} x2={W - pad.r} y2={H - pad.b} stroke={INK} strokeWidth="1" />
        {/* Survol : ligne verticale + point du jour */}
        {hov && (
          <g pointerEvents="none">
            <line x1={hov.x} y1={pad.t} x2={hov.x} y2={H - pad.b} stroke="var(--dk-muted)" strokeWidth="1" strokeDasharray="3 3" opacity="0.7" />
            <circle cx={hov.x} cy={hov.y} r="6" fill={hov.fc ? fcColor : histColor} stroke="var(--dk-surface, white)" strokeWidth="2" />
          </g>
        )}
      </svg>
      {hov && (
        <div className="ch-tip" style={{ left: `${(hov.x / W) * 100}%`, transform: `translateX(${hov.x / W > 0.75 ? "-100%" : hov.x / W < 0.2 ? "0" : "-50%"})` }}>
          <div className="ch-tip-d">{hov.date}</div>
          {hov.fc ? (
            <>
              <div><span className="ch-tip-k">{tr("Prévu", "Forecast")}</span> <b className="num">{fmt(hov.v)} {unit}</b></div>
              {hov.lo != null && hov.hi != null && <div className="ch-tip-s">{tr(`entre ${fmt(hov.lo)} et ${fmt(hov.hi)}`, `between ${fmt(hov.lo)} and ${fmt(hov.hi)}`)}</div>}
              {hov.ly != null && <div className="ch-tip-s">{tr(`l'an dernier, même jour : ${fmt(hov.ly)}`, `last year, same weekday: ${fmt(hov.ly)}`)}</div>}
            </>
          ) : (
            <div><span className="ch-tip-k">{tr("Vendu", "Sold")}</span> <b className="num">{fmt(hov.v)} {unit}</b></div>
          )}
        </div>
      )}
      </div>

      {/* Une seule légende : les boutons « Ventes réelles / Prévision » en haut de la carte */}
      {clippedHist.length > 0 && (
      <div style={{ display: "flex", gap: "16px", marginTop: "6px", justifyContent: "center", flexWrap: "wrap" }}>
        {clippedHist.length > 0 && <span style={{ fontSize: "0.72rem", color: MUTED }}>{tr("▲ jour très au-dessus des autres, coupé (valeur écrite)", "▲ day far above the others, cut (value shown)")}</span>}
      </div>
      )}
    </div>
  );
}

function SeasonalChart({ data: dataAll }: any) {
  const [boxRef, W, H] = useBox(1000, 350);
  const [hi, setHi] = useState<number | null>(null);   // jour survolé
  const pad = { l: 60, r: 30, t: 20, b: 40 };
  const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // Axe = toutes les dates ; les jours de fermeture (prévision à 0) ne sont pas tracés.
  const data = dataAll || [];
  const n = Math.max(data.length - 1, 1);
  const open = data.map((d: any, i: number) => ({ ...d, i })).filter((d: any) => d.yhat > 0);

  const max = Math.max(...open.map((d: any) => d.yhat_upper || d.yhat), 100) * 1.05;
  const getX = (i: number) => pad.l + (i / n) * (W - pad.l - pad.r);
  const getY = (v: number) => H - pad.b - (v / max) * (H - pad.t - pad.b);

  const linePath = open.map((d: any, k: number) => `${k === 0 ? "M" : "L"} ${getX(d.i)} ${getY(d.yhat)}`).join(" ");
  const band = open.length
    ? open.map((d: any, k: number) => `${k === 0 ? "M" : "L"} ${getX(d.i)} ${getY(d.yhat_upper ?? d.yhat)}`).join(" ") + " " +
      [...open].reverse().map((d: any) => `L ${getX(d.i)} ${getY(d.yhat_lower ?? d.yhat)}`).join(" ") + " Z"
    : "";

  // Un repère au 1er de chaque mois
  const monthMarks = data
    .map((d: any, i: number) => ({ d, i }))
    .filter(({ d }: any) => String(d.ds || "").slice(8, 10) === "01")
    .map(({ d, i }: any) => {
      const m = parseInt(String(d.ds).slice(5, 7), 10) - 1;
      return { x: getX(i), label: tr(MOIS[m], MONTHS_EN[m]) };
    });

  const closed = data.map((d: any, i: number) => ({ d, i })).filter(({ d }: any) => !(d.yhat > 0));

  const yStep = niceStep(max, 4);
  const yLabels = [];
  for (let v = 0; v <= max; v += yStep) yLabels.push({ y: getY(v), value: fmt(v) });

  const lineColor = "var(--ch-1)";
  const gridColor = "var(--dk-grid, rgba(120,140,120,0.2))";

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const relX = ((e.clientX - r.left) / r.width) * W;
    if (relX < pad.l || relX > W - pad.r) { setHi(null); return; }
    setHi(Math.max(0, Math.min(data.length - 1, Math.round(((relX - pad.l) / (W - pad.l - pad.r)) * n))));
  };
  const hd: any = hi != null ? data[hi] : null;
  const hx = hi != null ? getX(hi) : 0;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
    <svg ref={boxRef} viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "100%" }} preserveAspectRatio="xMidYMid meet"
      onMouseMove={onMove} onMouseLeave={() => setHi(null)}>
      {yLabels.map((l) => (
        <g key={l.y}>
          <line x1={pad.l} y1={l.y} x2={W - pad.r} y2={l.y} stroke={gridColor} strokeWidth="1" />
          <text x={pad.l - 8} y={l.y + 4} textAnchor="end" fontSize="10" fill={MUTED} fontWeight="600">{l.value}</text>
        </g>
      ))}
      {monthMarks.map((m: any) => (
        <g key={m.x}>
          <line x1={m.x} y1={pad.t} x2={m.x} y2={H - pad.b} stroke={gridColor} strokeWidth="1" strokeDasharray="3 3" />
          <text x={m.x + 4} y={H - pad.b + 16} textAnchor="start" fontSize="11" fill={INK} fontWeight="700">{m.label}</text>
        </g>
      ))}
      {band && <path d={band} fill="rgba(115,87,217,0.16)" stroke="none" />}
      <path d={linePath} fill="none" stroke={lineColor} strokeWidth="2" />
      {/* Jours prévus fermés : une petite croix sur l'axe (le détail est dans le texte sous le graphique) */}
      {closed.map(({ d, i }: any) => (
        <g key={i}>
          <text x={getX(i)} y={H - pad.b - 4} textAnchor="middle" fontSize="10" fill={MUTED} fontWeight="700">×</text>
          <title>{`${ddmm(d.ds)} : ${tr("fermé", "closed")}`}</title>
        </g>
      ))}
      <line x1={pad.l} y1={pad.t} x2={pad.l} y2={H - pad.b} stroke={INK} strokeWidth="1" />
      <line x1={pad.l} y1={H - pad.b} x2={W - pad.r} y2={H - pad.b} stroke={INK} strokeWidth="1" />
      {hd && (
        <g pointerEvents="none">
          <line x1={hx} y1={pad.t} x2={hx} y2={H - pad.b} stroke="var(--dk-muted)" strokeWidth="1" strokeDasharray="3 3" opacity="0.7" />
          {hd.yhat > 0 && <circle cx={hx} cy={getY(hd.yhat)} r="5" fill={lineColor} stroke="var(--dk-surface, white)" strokeWidth="2" />}
        </g>
      )}
    </svg>
    {hd && (
      <div className="ch-tip" style={{ left: `${(hx / W) * 100}%`, transform: `translateX(${hx / W > 0.75 ? "-100%" : hx / W < 0.2 ? "0" : "-50%"})` }}>
        <div className="ch-tip-d">{new Date(String(hd.ds) + "T12:00:00").toLocaleDateString(locale(), { weekday: "long", day: "numeric", month: "long" })}</div>
        {hd.yhat > 0 ? (
          <>
            <div><span className="ch-tip-k">{tr("Prévu", "Forecast")}</span> <b className="num">{fmt(hd.yhat)} {tr("articles", "items")}</b></div>
            {hd.yhat_lower != null && hd.yhat_upper != null && <div className="ch-tip-s">{tr(`entre ${fmt(hd.yhat_lower)} et ${fmt(hd.yhat_upper)}`, `between ${fmt(hd.yhat_lower)} and ${fmt(hd.yhat_upper)}`)}</div>}
          </>
        ) : (
          <div className="ch-tip-s">{tr("Prévu fermé (comme l'an dernier à la même période)", "Expected closed (as last year at the same time)")}</div>
        )}
      </div>
    )}
    </div>
  );
}

function MiniChart({ data, color }: any) {
  const W = 300; const H = 150;
  const pad = { l: 30, r: 15, t: 15, b: 25 };
  
  const vals = data.map((d: any) => d.value);
  const max = Math.max(...vals, 1) * 1.1;
  const min = Math.min(...vals, 0);
  const n = Math.max(data.length - 1, 1);

  const getX = (i: number) => pad.l + (i / n) * (W - pad.l - pad.r);
  const getY = (v: number) => H - pad.b - ((v - min) / (max - min)) * (H - pad.t - pad.b);

  const pts = data.map((d: any, i: number) => ({ x: getX(i), y: getY(d.value) }));
  let path = pts.length > 0 ? `M ${pts[0].x} ${pts[0].y}` : "";
  for (let i = 0; i < pts.length - 1; i++) { path += ` L ${pts[i + 1].x} ${pts[i + 1].y}`; }

  // Minimal grid
  const gridColor = "var(--dk-grid, rgba(120,140,120,0.15))";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "100%" }} preserveAspectRatio="none">
      {/* Simple grid */}
      <line x1={pad.l} y1={getY(max * 0.5)} x2={W - pad.r} y2={getY(max * 0.5)} stroke={gridColor} strokeWidth="1" />
      
      {/* Main line */}
      <path d={path} fill="none" stroke={color} strokeWidth="2" />
      
      {/* Points */}
      {pts.map((pt: any, i: number) => (
        <circle key={i} cx={pt.x} cy={pt.y} r="2.5" fill="var(--dk-surface, white)" stroke={color} strokeWidth="1.5" />
      ))}

      {/* Axes */}
      <line x1={pad.l} y1={pad.t} x2={pad.l} y2={H - pad.b} stroke={INK} strokeWidth="1" opacity="0.3" />
      <line x1={pad.l} y1={H - pad.b} x2={W - pad.r} y2={H - pad.b} stroke={INK} strokeWidth="1" opacity="0.3" />
    </svg>
  );
}
