"use client";

import React, { useEffect, useState, useMemo } from "react";
import { ExpertNote } from "@/components/Expert";
import { ProductForecastSection } from "@/components/ProductForecast";
import { t as txt } from "@/lib/texts";
import { colors } from "@/lib/theme";
import { fetchForecast } from "@/lib/api";
import { tr, trData, locale } from "@/lib/i18n";
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
  const [showConfidence, setShowConfidence] = useState(true);

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
        <p style={{ color:MUTED, fontSize:"0.82rem", marginTop:"6px",
                    maxWidth:"640px", lineHeight:1.5 }}>
          {tr(`Combien d'articles la boutique devrait vendre dans les ${horizon} prochains jours, et sur la prochaine saison.`, `How many items the shop should sell over the next ${horizon} days, and over the next season.`)}
        </p>
      </div>

      {/* ── WARNING BANNER ── */}
      <div className="sw">
        <div style={{ 
          background: "rgba(212,165,42,0.06)", 
          borderLeft: "4px solid #6F9A64", 
          padding: "16px 20px", 
          borderRadius: "0 12px 12px 0", 
          fontSize: "0.75rem", 
          color: "var(--dk-ink2, #2F3A32)", 
          marginBottom: "8px",
          display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap"
        }}>
          <IconAlert size={14} color="#6F9A64" />
          <strong>{tr("À savoir :", "Good to know:")}</strong>
          <span style={{ flex: "1 1 320px", minWidth: 0 }}>{tr("Les prévisions représentent les valeurs estimées par le modèle à partir des données historiques. Elles ne constituent pas une mesure du stock réel ou des invendus physiques.", "Forecasts are values estimated by the model from historical data. They do not measure actual stock or physical unsold items.")}</span>
        </div>
      </div>

      {/* Horizon : 7 ou 14 jours (prévision jour par jour J+1 à J+14). Les filtres produit, catégorie, saison et
          événement restent retirés : la prévision porte sur toute la boutique (le détail par produit est plus bas). */}
      <div className="sw">
        <div className="cc" style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", padding: "12px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.75rem", fontWeight: 700, color: INK, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            <IconCalendarDays size={16} color={ORANGE} />
            {tr("Horizon", "Horizon")}
          </div>
          {[7, 14].map((h) => (
            <button
              key={h}
              onClick={() => setHorizon(h)}
              style={{
                padding: "6px 14px", fontSize: "0.75rem", fontWeight: 700, borderRadius: "8px", cursor: "pointer",
                border: horizon === h ? "1px solid var(--dk-pill, #1E2420)" : "1px solid var(--dk-line, #E3E4DD)",
                background: horizon === h ? "var(--dk-pill, #1E2420)" : "var(--dk-surface, #FAFAF7)",
                color: horizon === h ? "white" : INK,
              }}
            >
              {tr(`${h} jours`, `${h} days`)}
            </button>
          ))}
          <span style={{ fontSize: "0.7rem", color: MUTED }}>
            {tr("Jour par jour sur 14 jours ; plus loin, voir la prévision de la saison plus bas.", "Day by day over 14 days; further ahead, see the season forecast below.")}
          </span>
        </div>
      </div>

      {/* ── VISUALIZATION TOGGLES ── */}
      <div className="sec-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <IconSettings size={18} color={ORANGE} />
        {tr("Afficher", "Show")}
      </div>
      <div className="sw">
        <div className="cc" style={{ 
          padding:"16px 20px", borderRadius:"14px",
          background: "var(--dk-soft, #F5F6F1)",
          border:"1px solid var(--dk-line, rgba(140,160,140,.25))",
          boxShadow:"0 4px 16px rgba(0,0,0,0.15)"
        }}>
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
            <Toggle 
              label={tr("Ventes réelles", "Actual sales")} 
              checked={showObserved} 
              onChange={setShowObserved}
              icon={<IconEye size={16} />}
            />
            <Toggle 
              label={tr("Prévision", "Forecast")} 
              checked={showPredicted} 
              onChange={setShowPredicted}
              icon={<IconZap size={16} />}
            />
            <Toggle 
              label={tr("Fourchette basse – haute", "Low – high range")} 
              checked={showConfidence} 
              onChange={setShowConfidence}
              icon={<IconActivity size={16} />}
            />
          </div>
        </div>
      </div>

      {/* ── KEY METRICS ── */}
      <div className="sec-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <IconTarget size={18} color={ORANGE} />
        {tr("Indicateurs Clés", "Key indicators")}
      </div>
      <div className="sw">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
          <MetricCard 
            icon={<IconCalendarDays size={24} color={ORANGE} />}
            title={tr("Horizon", "Horizon")}
            subtitle={tr("Fenêtre de prévision", "Forecast window")}
            value={tr(`${horizon} Jours`, `${horizon} Days`)}
            color={INK}
          />
          <MetricCard 
            icon={<IconChartLine size={24} color={ORANGE} />}
            title={tr(`Total Prévu (${horizon}j)`, `Forecast total (${horizon}d)`)}
            subtitle={tr(`${forecastInfo.label} cumulés`, `Cumulative ${trData(forecastInfo.label).toLowerCase()}`)}
            value={fmt(metrics.total_prevision || metrics.total_prevision_14j)}
            unit={trData(forecastInfo.unit)}
            color={ORANGE}
          />
          <MetricCard 
            icon={<IconBar size={24} color={ORANGE} />}
            title={tr("Même période l'an dernier", "Same period last year")}
            subtitle={metrics.moy_jour_periode
              ? tr(`${forecastInfo.label} par jour ouvert · ${metrics.moy_jour_periode}`, `${trData(forecastInfo.label)} per open day · ${metrics.moy_jour_periode}`)
              : tr(`${forecastInfo.label} par jour ouvert`, `${trData(forecastInfo.label)} per open day`)}
            value={metrics.moy_jour_periode ? fmt(metrics.moy_jour_historique) : "—"}
            unit={trData(forecastInfo.unit)}
            color={INK}
          />
          <MetricCard 
            icon={<IconPercent size={24} color={OK} />}
            title={txt.forecast.reliability}
            subtitle={txt.forecast.reliabilitySub}
            value={prophetMetrics.mdape_cv != null ? `± ${Math.round(Number(prophetMetrics.mdape_cv))} %` : "—"}
            color={OK}
          />
        </div>
      </div>

      {/* Bloc « Métriques Prophet » retiré : erreur d'entraînement et erreurs par horizon
          étaient déduites de l'erreur médiane par multiplication, pas mesurées. */}

      {/* ── FORECAST CALENDAR ── */}
      <div className="sec-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <IconCalendarDays size={18} color={ORANGE} />
        {tr("Calendrier des Prévisions", "Forecast calendar")}
      </div>
      <div className="sw">
        <div className="cc" style={{ paddingRight: 46 }}>
          <ChartAssistantButton chartType="forecast_daily_cards" chartData={{ forecast, horizon, filtres_page: { horizon, type: forecastType, produit: product, categorie: category, saison: season, evenement: event } }} chartName="ForecastDailyCards"
            userQuestion="Explique la prévision jour par jour" position="top-right" onOpenChat={openChat} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "12px", paddingTop: "8px" }}>
            {forecast.map((day: any, i: number) => {
              const isFerme = day.is_ferme === 1;
              return (
                <div key={i} style={{ 
                  padding: "12px", 
                  borderRadius: "12px", 
                  border: isFerme ? "1px dashed var(--dk-line, #E3E4DD)" : "1px solid rgba(46,125,79,0.3)", 
                  background: isFerme ? "var(--dk-surface, #FAFAF7)" : "var(--dk-surface, #FFFFFF)", 
                  textAlign: "center", 
                  display: "flex", 
                  flexDirection: "column", 
                  gap: "8px" 
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.6rem", fontWeight: 700, color: MUTED, textTransform: "uppercase" }}>
                    <span>{tr(day.horizon, String(day.horizon ?? "").replace(/^J\+/, "D+"))}</span>
                    <span>{trData(day.jour_semaine)?.slice(0, 3)}</span>
                  </div>
                  <div style={{ fontSize: "0.75rem", fontWeight: 800, color: INK }}>{day.date_fr}</div>
                  {isFerme ? (
                    <div style={{ margin: "12px 0", fontSize: "0.8rem", fontWeight: 700, color: MUTED }}>
                      <IconAlert size={20} color={MUTED} />
                      <div style={{ marginTop: "4px" }}>{tr("FERMÉ", "CLOSED")}</div>
                    </div>
                  ) : (
                    <div style={{ margin: "8px 0" }}>
                      <div style={{ fontSize: "1.3rem", fontWeight: 800, color: ORANGE }}>{fmt(day.yhat)}</div>
                      {showConfidence && (
                        <div style={{ fontSize: "0.6rem", fontWeight: 600, color: MUTED, marginTop: "2px" }}>
                          [{fmt(day.yhat_lower)} – {fmt(day.yhat_upper)}]
                        </div>
                      )}
                    </div>
                  )}
                  <div style={{ fontSize: "0.6rem", fontWeight: 700, color: MUTED }}>
                    {isFerme ? tr("Repos", "Day off") : trData(forecastInfo.unit)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── HISTORY + FORECAST CHART ── */}
      <div className="sec-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <IconChartLine size={18} color={ORANGE} />
        {tr("Historique + Prévision", "History + forecast")}
      </div>
      <div className="sw">
        <div className="cc" style={{ minHeight: "900px" }}>
          <ChartAssistantButton chartType="forecast" chartData={{ history, forecast, showObserved, showPredicted, showConfidence, horizon, filtres_page: { horizon, type: forecastType, produit: product, categorie: category, saison: season, evenement: event } }} chartName="ForecastChart"
            userQuestion="Explique cette prévision de demande" position="top-right" onOpenChat={openChat} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
            <div>
              <div className="ct">{tr("Historique Récent et Prévision", "Recent history and forecast")}</div>
              <div className="cs">{tr("Ventes réelles des derniers jours, puis prévision jour par jour avec sa fourchette", "Actual sales over recent days, then the day-by-day forecast with its range")}</div>
            </div>
            <div style={{ display: "flex", gap: "16px", fontSize: "0.7rem", fontWeight: 700, paddingRight: "28px" }}>
              {showObserved && <span style={{ display: "flex", alignItems: "center", gap: "6px", color: INK }}><div style={{ width: "8px", height: "8px", borderRadius: "50%", background: INK }} />{tr("Historique", "History")}</span>}
              {showPredicted && <span style={{ display: "flex", alignItems: "center", gap: "6px", color: ORANGE }}><div style={{ width: "8px", height: "8px", borderRadius: "50%", background: ORANGE }} />{tr("Prévision", "Forecast")}</span>}
            </div>
          </div>
          
          <div style={{ height: "800px", width: "100%", marginTop: "12px" }}>
            {history.length > 0 && forecast.length > 0 ? (
              <ForecastChart 
                history={history} 
                forecast={forecast}
                showObserved={showObserved}
                showPredicted={showPredicted}
                showConfidence={showConfidence}
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
          {(() => {
            const open = forecast.filter((f: any) => f.yhat > 0);
            if (!open.length) return null;
            const pk = open.reduce((m: any, f: any) => (f.yhat > m.yhat ? f : m), open[0]);
            const ref = Number(metrics.moy_jour_historique || 0);
            const avg = open.reduce((a: number, f: any) => a + f.yhat, 0) / open.length;
            return (
              <Takeaway>
                {tr(
                  `Jour le plus chargé prévu : ${pk.jour_semaine.toLowerCase()} ${pk.date_fr} (${fmt(pk.yhat)} ${forecastType === "ca" ? "€" : "articles"}). En moyenne ${fmt(avg)} ${forecastType === "ca" ? "€" : "articles"} par jour ouvert${ref ? `, contre ${fmt(ref)} sur la même période l'an dernier` : ""}.${prophetMetrics.mdape_cv != null ? ` Un jour donné, l'écart habituel entre prévu et vendu est d'environ ${fmt(Number(prophetMetrics.mdape_cv))} %${prophetMetrics.erreur_semaine != null ? `, et d'environ ${fmt(prophetMetrics.erreur_semaine * 100)} % sur une semaine entière` : ""} (mesuré sur l'historique).` : ""}`,
                  `Busiest forecast day: ${trData(pk.jour_semaine)} ${pk.date_fr} (${fmt(pk.yhat)} ${forecastType === "ca" ? "€" : "items"}). On average ${fmt(avg)} ${forecastType === "ca" ? "€" : "items"} per open day${ref ? `, versus ${fmt(ref)} over the same period last year` : ""}.${prophetMetrics.mdape_cv != null ? ` On a given day the usual gap between forecast and actual is about ${fmt(Number(prophetMetrics.mdape_cv))}%${prophetMetrics.erreur_semaine != null ? `, and about ${fmt(prophetMetrics.erreur_semaine * 100)}% over a whole week` : ""} (measured on past data).` : ""}`
                )}
              </Takeaway>
            );
          })()}
          <ExpertNote>
            {prophetMetrics.source === "pipeline" ? (
              <>Source : forecasting/pipeline.py (calcul du {prophetMetrics.run_at}, données jusqu'au {prophetMetrics.data_end}), table shop_forecasts. Prévision de la boutique = {prophetMetrics.poids_an_dernier != null ? `${fmt((1 - prophetMetrics.poids_an_dernier) * 100)} % somme des prévisions par produit + ${fmt(prophetMetrics.poids_an_dernier * 100)} % ventes de la boutique le même jour l'an dernier` : "somme des prévisions par produit"} (la somme des produits suit le niveau récent ; l'an dernier voit venir les changements de saison et les jours fériés) ; poids choisi sur les fenêtres de test{prophetMetrics.choix_poids ? ` (${prophetMetrics.choix_poids})` : ""}. Le total peut donc différer un peu de la somme des produits affichés plus bas. Précision mesurée honnêtement sur {prophetMetrics.jours_testes ?? "—"} jours de test ({prophetMetrics.fenetres ?? "—"} fenêtres de 14 jours ; pour chaque fenêtre, chaque produit utilise la méthode qu'il aurait choisie sans elle) : écart médian d'un jour {prophetMetrics.mdape_cv != null ? fmt(Number(prophetMetrics.mdape_cv), 1) : "—"} %, WAPE {prophetMetrics.wape_jour != null ? fmt(prophetMetrics.wape_jour * 100, 1) : "—"} %, erreur sur la semaine {prophetMetrics.erreur_semaine != null ? fmt(prophetMetrics.erreur_semaine * 100, 1) : "—"} %, biais {prophetMetrics.biais != null ? fmt(prophetMetrics.biais * 100, 1) : "—"} %{prophetMetrics.biais_fenetre_min != null ? ` (selon la fenêtre, de ${fmt(prophetMetrics.biais_fenetre_min * 100)} % à +${fmt(prophetMetrics.biais_fenetre_max * 100)} % : écarts plus forts aux changements de saison et autour des fêtes)` : ""} ; objectif cahier : 15–20 % à 14 jours. Fourchette = écarts relatifs observés sur le total, niveaux ajustés pour viser ≈ 10 % des jours au-dessus de la borne haute ; mesuré sans la fenêtre testée : {prophetMetrics.couverture_fourchette != null ? fmt(prophetMetrics.couverture_fourchette * 100, 0) : "—"} % des ventes dans la fourchette, {prophetMetrics.au_dessus_fourchette != null ? fmt(prophetMetrics.au_dessus_fourchette * 100, 0) : "—"} % au-dessus (en conditions réelles, les changements de saison peuvent faire dépasser plus souvent). Chiffre d'affaires = quantités × prix moyen récent de chaque produit ; WAPE {prophetMetrics.wape_jour_ca != null ? fmt(prophetMetrics.wape_jour_ca * 100, 1) : "—"} %, biais {prophetMetrics.biais_ca != null ? fmt(prophetMetrics.biais_ca * 100, 1) : "—"} % (moins fiable que les quantités autour des fêtes : produits chers comme les bûches). Jours fériés pris en compte : {prophetMetrics.jours_feries_pays ? `pays « ${prophetMetrics.jours_feries_pays} » (réglage jours_feries_pays de forecasting/config.json)` : "aucun (réglage jours_feries_pays vide)"}. Référence = AVG(nb_articles) des mêmes jours décalés de 364 jours.</>
            ) : (
              <>Source : prévision Prophet du notebook (model_name « 14j_global »), utilisée parce que forecasting/pipeline.py n'a pas encore été lancé. Fiabilité = MDAPE en validation croisée{prophetMetrics.mdape_cv != null ? ` = ${fmt(Number(prophetMetrics.mdape_cv), 2)} %` : " : non disponible"}. Intervalle = yhat_lower / yhat_upper. Cette prévision n'a pas été vérifiée pour les jours fériés et les fermetures : lancer python forecasting\pipeline.py.</>
            )}
          </ExpertNote>
        </div>
      </div>

      {/* ── SEASONAL FORECAST ── */}
      {forecastSeason.length > 0 && (
        <>
          <div className="sec-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <IconTrendUp size={18} color={ORANGE} />
            {tr("Prévision de la saison", "Season forecast")}
          </div>
          <div className="sw">
            <div className="cc">
              <ChartAssistantButton chartType="seasonal" chartData={{ data: forecastSeason, filtres_page: { horizon, type: forecastType, produit: product, categorie: category, saison: season, evenement: event } }} chartName="SeasonalChart"
                userQuestion="Explique cette saisonnalité" position="top-right" onOpenChat={openChat} />
              <div className="ct">{tr("Prévision des ventes pour la prochaine saison", "Sales forecast for the next season")}</div>
              <div className="cs">{tr(`Articles par jour, ${seasonLabel}, avec la fourchette basse – haute. × = jour prévu fermé (d'après les habitudes de la boutique l'an dernier), à confirmer avec la boutique.`, `Items per day, ${seasonLabel}, with the low – high range. × = day expected closed (based on the shop's habits last year), to be confirmed with the shop.`)}</div>
              <div style={{ height: "350px", width: "100%", marginTop: "16px" }}>
                <SeasonalChart data={forecastSeason} />
              </div>
              {(() => {
                const open = forecastSeason.filter((d: any) => d.yhat > 0);
                if (!open.length) return null;
                const pk = open.reduce((m: any, d: any) => (d.yhat > m.yhat ? d : m), open[0]);
                const byMonth: Record<string, number> = {};
                open.forEach((d: any) => { const m = String(d.ds).slice(5, 7); byMonth[m] = (byMonth[m] || 0) + d.yhat; });
                const best = Object.entries(byMonth).sort((a, b) => b[1] - a[1])[0];
                const MOIS: Record<string, string> = { "01": "janvier", "02": "février", "03": "mars", "04": "avril", "05": "mai", "06": "juin", "07": "juillet", "08": "août", "09": "septembre", "10": "octobre", "11": "novembre", "12": "décembre" };
                const MON: Record<string, string> = { "01": "January", "02": "February", "03": "March", "04": "April", "05": "May", "06": "June", "07": "July", "08": "August", "09": "September", "10": "October", "11": "November", "12": "December" };
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
                      `${MOIS[best[0]] || best[0]} est le mois le plus chargé (${fmt(best[1])} articles prévus) ; pic le ${pk.label} avec ${fmt(pk.yhat)} articles. Prévoir le personnel et les achats en conséquence.${shutFr}${trendNote[0]}`,
                      `${MON[best[0]] || best[0]} is the busiest month (${fmt(best[1])} items forecast); peak on ${pk.label} with ${fmt(pk.yhat)} items. Plan staff and purchases accordingly.${shutEn}${trendNote[1]}`
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
          </div>
        </>
      )}

      {/* ── PROPHET DECOMPOSITION ── */}
      {Object.keys(decomposition).length > 0 && (
        <>
          <div className="sec-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <IconLayers size={18} color={ORANGE} />
            {tr("Ce qui explique la prévision", "What drives the forecast")}
          </div>
          <div className="sw">
            <div className="cc">
              <ChartAssistantButton chartType="forecast_decomposition" chartData={{ decomposition, filtres_page: { horizon, type: forecastType, produit: product, categorie: category, saison: season, evenement: event } }} chartName="ForecastDecomposition"
                userQuestion="Explique la décomposition de la prévision (tendance, saisonnalité, événements)" position="top-right" onOpenChat={openChat} />
              <div className="ct">{tr("Décomposition des prévisions", "Forecast breakdown")}</div>
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
          </div>
        </>
      )}

      {/* Tableau « Détail numérique » retiré : il répétait le calendrier des prévisions. */}

      {/* ── NOUVEAU : prévision par produit (pipeline forecasting/pipeline.py), en plus de la prévision globale ── */}
      <ProductForecastSection />
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
        border: checked ? "2px solid var(--dk-accent-deep, #256B42)" : "1px solid var(--dk-line, #E3E4DD)",
        background: checked ? "rgba(37,107,66,0.1)" : "var(--dk-surface, white)",
        fontSize: "0.85rem",
        fontWeight: checked ? 700 : 500,
        color: checked ? "var(--dk-accent-deep, #256B42)" : INK,
        cursor: "pointer"
      }}
    >
      {checked ? <IconEye size={16} color="var(--dk-accent-deep, #256B42)" /> : <IconEyeOff size={16} color={MUTED} />}
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

function ForecastChart({ history, forecast: forecastAll, showObserved, showPredicted, showConfidence }: any) {
  // Les jours de fermeture ne sont pas tracés (l'historique n'en contient pas non plus) :
  // ils restent visibles dans le calendrier.
  const forecast = (forecastAll || [])
    .filter((f: any) => !(f.is_ferme === 1 || f.yhat === 0))
    .map((f: any) => ({ ...f, label: ddmm(f.ds) }));
  const W = 1200; const H = 800; 
  const pad = { l: 70, r: 50, t: 50, b: 80 };
  
  // Zoom state
  const [zoomStart, setZoomStart] = useState<number | null>(null);
  const [zoomEnd, setZoomEnd] = useState<number | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selStart, setSelStart] = useState<number | null>(null);
  const [selCurrent, setSelCurrent] = useState<number | null>(null);
  const svgRef = React.useRef<SVGSVGElement | null>(null);

  const allData = [...history, ...forecast];
  const totalPts = allData.length;
  const n = Math.max(totalPts - 1, 1);
  
  const allVals = [...history.map((h: any) => h.y), ...forecast.map((f: any) => f.yhat_upper)];
  const max = Math.max(...allVals, 100) * 1.05;
  const min = 0;

  const effStart = zoomStart ?? 0;
  const effEnd = zoomEnd ?? n;
  const effN = Math.max(effEnd - effStart, 1);

  const toX = (i: number) => pad.l + ((i - effStart) / effN) * (W - pad.l - pad.r);
  const toY = (v: number) => H - pad.b - ((v - min) / (max - min)) * (H - pad.t - pad.b);

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
    if (!isSelecting) return;
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
  const yStep = niceStep(max, 5);
  const yLabels = [];
  for (let v = 0; v <= max; v += yStep) {
    yLabels.push({ y: toY(v), value: fmt(v) });
  }

  // Colors for different elements - using varied colors as requested
  const histColor = "var(--dk-ink, #1E2420)";      // Dark for history
  const fcColor = "var(--dk-accent-deep, #256B42)";       // Orange for forecast
  const confColor = "rgba(37,107,66,0.15)"; // Light orange for confidence
  const gridColor = "var(--dk-grid, rgba(120,140,120,0.2))";

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, paddingRight: 4 }}>
        <span style={{ fontSize: "0.75rem", color: MUTED, fontWeight: 600 }}>
          {isZoomed
            ? tr(`Zoom : ${allData[effStart]?.label || ''} → ${allData[effEnd]?.label || ''} · Double-cliquez pour réinitialiser`, `Zoom: ${allData[effStart]?.label || ''} → ${allData[effEnd]?.label || ''} · Double-click to reset`)
            : tr("Glissez une sélection horizontale sur le graphique pour zoomer", "Drag a horizontal selection on the chart to zoom in")}
        </span>
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

      <svg 
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`} 
        style={{ width: "100%", flex: 1, minHeight: 0 }} 
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
          <text key={label.y} x={pad.l - 8} y={label.y + 4} textAnchor="end" fontSize="10" fill={MUTED} fontWeight="600">
            {label.value}
          </text>
        ))}

        {/* X-axis labels (dates) */}
        {dateLabels.map((label) => (
          <text key={label.x} x={label.x} y={H - pad.b + 18} textAnchor="middle" fontSize="10" fill={INK} fontWeight="700">
            {label.label}
          </text>
        ))}

        {/* Split line between history and forecast */}
        <line x1={splitX} y1={pad.t} x2={splitX} y2={H - pad.b} stroke="#6F9A64" strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />
        <text x={splitX - 8} y={pad.t + 12} textAnchor="end" fontSize="11" fill="var(--dk-muted, #6E756F)" fontWeight="700">{tr("Historique", "History")}</text>
        <text x={splitX + 8} y={pad.t + 12} textAnchor="start" fontSize="11" fill="var(--dk-accent-deep, #256B42)" fontWeight="700">{tr(`Prévision J+${(forecastAll || []).length}`, `Forecast D+${(forecastAll || []).length}`)}</text>

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

        {/* Forecast points */}
        {showPredicted && fcPts.slice(1).map((pt: any, i: number) => (
          <circle key={i} cx={pt.x} cy={pt.y} r="4" fill="var(--dk-surface, white)" stroke={fcColor} strokeWidth="2" />
        ))}

        {/* Selection rectangle */}
        {isSelecting && selStart !== null && selCurrent !== null && (
          <rect 
            x={Math.min(selX1, selX2)} 
            y={pad.t} 
            width={Math.abs(selX2 - selX1)} 
            height={H - pad.t - pad.b} 
            fill="rgba(37,107,66,0.1)" 
            stroke={fcColor} 
            strokeWidth="1" 
            strokeDasharray="4 4"
          />
        )}

        {/* Axes */}
        <line x1={pad.l} y1={pad.t} x2={pad.l} y2={H - pad.b} stroke={INK} strokeWidth="1" />
        <line x1={pad.l} y1={H - pad.b} x2={W - pad.r} y2={H - pad.b} stroke={INK} strokeWidth="1" />
      </svg>

      {/* Legend */}
      <div style={{ display: "flex", gap: "16px", marginTop: "8px", justifyContent: "center", flexWrap: "wrap" }}>
        {showObserved && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: histColor }} />
            <span style={{ fontSize: "0.75rem", color: INK, fontWeight: 600 }}>{tr("Historique", "History")}</span>
          </div>
        )}
        {showPredicted && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: fcColor }} />
            <span style={{ fontSize: "0.75rem", color: INK, fontWeight: 600 }}>{tr("Prévision", "Forecast")}</span>
          </div>
        )}
        {showConfidence && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ width: "12px", height: "12px", borderRadius: "2px", background: confColor, border: "1px solid var(--dk-accent-deep, #256B42)" }} />
            <span style={{ fontSize: "0.75rem", color: INK, fontWeight: 600 }}>{tr("Fourchette basse – haute", "Low – high range")}</span>
          </div>
        )}
        <span style={{ fontSize: "0.72rem", color: MUTED }}>{tr("Jours de fermeture non tracés", "Closed days not plotted")}</span>
      </div>
    </div>
  );
}

function SeasonalChart({ data: dataAll }: any) {
  const W = 1000; const H = 350;
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

  const lineColor = "#3E8E5E";
  const gridColor = "var(--dk-grid, rgba(120,140,120,0.2))";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "100%" }} preserveAspectRatio="xMidYMid meet">
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
      {band && <path d={band} fill="rgba(234,88,12,0.12)" stroke="none" />}
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
    </svg>
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
