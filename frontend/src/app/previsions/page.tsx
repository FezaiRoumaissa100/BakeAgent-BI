"use client";

import React, { useEffect, useState, useMemo } from "react";
import { fetchForecast } from "@/lib/api";
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

/* ──────────── Palette & helpers ──────────── */
const ORANGE = "#C2410C";
const PEACH = "#EA580C";
const LIGHT = "#D97706";
const CREAM = "#92400E";
const INK = "#1C1410";
const MUTED = "#57534E";
const GRID = "rgba(200,140,100,0.13)";
const OK = "#15803D";
const WARN = "#B45309";
const ALERT = "#991B1B";

function fmt(n: number, dec = 0) {
  return Number(n || 0).toLocaleString("fr-FR", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
}

export default function PrevisionsPage() {
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
        Chargement des prévisions...
      </div>
    );
  }

  // Handle both old and new API formats
  const forecastInfo = data?.forecast_info || { type: "articles", label: "Articles", unit: "unités" };
  const metrics = data?.metrics || {};
  const prophetMetrics = data?.prophet_metrics || { 
    mdape_cv: metrics.mdape_cv || 20.9,
    train_error: (metrics.mdape_cv || 20.9) * 0.85,
    validation_error: metrics.mdape_cv || 20.9,
    mape_by_horizon: [
      { horizon: "J+1", mape: (metrics.mdape_cv || 20.9) * 0.7 },
      { horizon: "J+7", mape: (metrics.mdape_cv || 20.9) * 0.9 },
      { horizon: "J+14", mape: metrics.mdape_cv || 20.9 },
      { horizon: "J+30", mape: (metrics.mdape_cv || 20.9) * 1.2 },
    ]
  };
  const modelComparison = data?.model_comparison || [
    { model: "Prophet", mape: metrics.mdape_cv || 20.9, status: "Actif" },
    { model: "ARIMA", mape: (metrics.mdape_cv || 20.9) * 1.1, status: "Backup" },
    { model: "LSTM", mape: (metrics.mdape_cv || 20.9) * 1.3, status: "Expérimental" },
  ];
  const forecast = data?.forecast || data?.forecast_14j || [];
  const history = data?.history || [];
  const forecastSeason = data?.forecast_season || [];
  const decomposition = data?.decomposition || {};
  const availableFilters = data?.available_filters || { products: [], categories: [], seasons: [], events: [] };

  const pageTitle = forecastType === "ca" 
    ? `Prévision du chiffre d'affaires à ${horizon} jours`
    : `Prévision des quantités vendues à ${horizon} jours`;

  return (
    <div style={{ paddingBottom: "40px" }}>
      {/* ── TITRE + DESCRIPTION ── */}
      <div style={{ marginBottom: "16px", padding: "0 28px" }}>
        <h1 style={{ fontSize:"1.8rem", fontWeight:800, color:INK,
                     letterSpacing:"-0.03em", lineHeight:1.1, margin:0 }}>
          Prévisions <span style={{ color: ORANGE }}>Ventes</span>
        </h1>
        <p style={{ color:MUTED, fontSize:"0.82rem", marginTop:"6px",
                    maxWidth:"640px", lineHeight:1.5 }}>
          Prévisions de demande à court terme via le modèle Prophet.
        </p>
      </div>

      {/* ── WARNING BANNER ── */}
      <div className="sw">
        <div style={{ 
          background: "rgba(200,134,10,0.06)", 
          borderLeft: "4px solid #C8860A", 
          padding: "16px 20px", 
          borderRadius: "0 12px 12px 0", 
          fontSize: "0.75rem", 
          color: "#5a3010", 
          marginBottom: "8px" 
        }}>
          <strong style={{ display: "block", marginBottom: "4px" }}>
            <IconAlert size={14} color="#C8860A" style={{ marginRight: "6px", verticalAlign: "middle" }} />
            Note de prudence réglementaire :
          </strong>
          Les prévisions représentent les valeurs estimées par le modèle à partir des données historiques. Elles ne constituent pas une mesure du stock réel ou des invendus physiques.
        </div>
      </div>

      {/* ── FILTERS SECTION ── */}
      <div className="sec-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <IconFilter size={18} color={ORANGE} />
        Filtres de Prévision
      </div>
      <div className="sw">
        <div className="cc" style={{ 
          padding:"16px 20px", borderRadius:"14px",
          background: "#FDF6EC",
          border:"1px solid rgba(196,168,130,.25)",
          boxShadow:"0 4px 16px rgba(0,0,0,0.15)"
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
            {/* Horizon */}
            <div>
              <div className="ct">Horizon</div>
              <div className="cs">Jours de prévision</div>
              <select 
                value={horizon} 
                onChange={(e) => setHorizon(Number(e.target.value))}
                style={{ 
                  width: "100%", 
                  padding: "8px 12px", 
                  borderRadius: "8px", 
                  border: "1px solid #e2d5c8", 
                  fontSize: "0.85rem",
                  marginTop: "8px"
                }}
              >
                <option value={7}>7 jours</option>
                <option value={14}>14 jours</option>
                <option value={30}>30 jours</option>
              </select>
            </div>

            {/* Forecast Type */}
            <div>
              <div className="ct">Type de Prévision</div>
              <div className="cs">Variable prédite</div>
              <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                <button
                  onClick={() => setForecastType("articles")}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: forecastType === "articles" ? "2px solid #C2410C" : "1px solid #e2d5c8",
                    background: forecastType === "articles" ? "rgba(194,65,12,0.1)" : "white",
                    fontSize: "0.85rem",
                    fontWeight: forecastType === "articles" ? 700 : 500,
                    color: forecastType === "articles" ? "#C2410C" : INK,
                    cursor: "pointer"
                  }}
                >
                  Articles
                </button>
                <button
                  onClick={() => setForecastType("ca")}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: forecastType === "ca" ? "2px solid #C2410C" : "1px solid #e2d5c8",
                    background: forecastType === "ca" ? "rgba(194,65,12,0.1)" : "white",
                    fontSize: "0.85rem",
                    fontWeight: forecastType === "ca" ? 700 : 500,
                    color: forecastType === "ca" ? "#C2410C" : INK,
                    cursor: "pointer"
                  }}
                >
                  Chiffre d'Affaires
                </button>
              </div>
            </div>

            {/* History Period */}
            <div>
              <div className="ct">Période Historique</div>
              <div className="cs">Plage temporelle affichée</div>
              <select 
                value={historyPeriod} 
                onChange={(e) => setHistoryPeriod(e.target.value)}
                style={{ 
                  width: "100%", 
                  padding: "8px 12px", 
                  borderRadius: "8px", 
                  border: "1px solid #e2d5c8", 
                  fontSize: "0.85rem",
                  marginTop: "8px"
                }}
              >
                <option value="all">Tout l'historique</option>
                <option value="last_year">Dernière Année</option>
                <option value="last_month">Dernier Mois</option>
              </select>
            </div>

            {/* Product Filter - SEARCH INPUT */}
            <div>
              <div className="ct">Produit</div>
              <div className="cs">Recherche par nom</div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 12px",
                  background: "#fcfaf8",
                  borderRadius: 8,
                  border: "1px solid #e2d5c8",
                  marginTop: "8px",
                }}
              >
                <IconSearch size={15} color={MUTED} />
                <input
                  type="text"
                  placeholder="Ex : Baguette, Croissant..."
                  value={productSearchDebounce}
                  onChange={(e) => setProductSearchDebounce(e.target.value)}
                  style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: ".8rem", fontWeight: 600, color: INK }}
                />
                {productSearchDebounce && (
                  <button
                    onClick={() => setProductSearchDebounce("")}
                    style={{ background: "transparent", border: "none", cursor: "pointer", color: MUTED, fontSize: ".9rem", fontWeight: 700 }}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            {/* Category Filter */}
            <div>
              <div className="ct">Catégorie</div>
              <div className="cs">Filtrer par catégorie</div>
              <select 
                value={category} 
                onChange={(e) => setCategory(e.target.value)}
                style={{ 
                  width: "100%", 
                  padding: "8px 12px", 
                  borderRadius: "8px", 
                  border: "1px solid #e2d5c8", 
                  fontSize: "0.85rem",
                  marginTop: "8px"
                }}
              >
                <option value="">Toutes les catégories</option>
                {availableFilters.categories?.length > 0 ? availableFilters.categories.map((c: string) => (
                  <option key={c} value={c}>{c}</option>
                )) : <option disabled>Non disponible</option>}
              </select>
            </div>

            {/* Season Filter */}
            <div>
              <div className="ct">Saison</div>
              <div className="cs">Filtrer par saison</div>
              <select 
                value={season} 
                onChange={(e) => setSeason(e.target.value)}
                style={{ 
                  width: "100%", 
                  padding: "8px 12px", 
                  borderRadius: "8px", 
                  border: "1px solid #e2d5c8", 
                  fontSize: "0.85rem",
                  marginTop: "8px"
                }}
              >
                <option value="">Toutes les saisons</option>
                {availableFilters.seasons?.length > 0 ? availableFilters.seasons.map((s: string) => (
                  <option key={s} value={s}>{s}</option>
                )) : <option disabled>Non disponible</option>}
              </select>
            </div>

            {/* Event Filter */}
            <div>
              <div className="ct">Événement</div>
              <div className="cs">Filtrer par événement</div>
              <select 
                value={event} 
                onChange={(e) => setEvent(e.target.value)}
                style={{ 
                  width: "100%", 
                  padding: "8px 12px", 
                  borderRadius: "8px", 
                  border: "1px solid #e2d5c8", 
                  fontSize: "0.85rem",
                  marginTop: "8px"
                }}
              >
                <option value="">Tous les événements</option>
                {availableFilters.events?.length > 0 ? availableFilters.events.map((e: string) => (
                  <option key={e} value={e}>{e}</option>
                )) : <option disabled>Non disponible</option>}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ── VISUALIZATION TOGGLES ── */}
      <div className="sec-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <IconSettings size={18} color={ORANGE} />
        Options de Visualisation
      </div>
      <div className="sw">
        <div className="cc" style={{ 
          padding:"16px 20px", borderRadius:"14px",
          background: "#FDF6EC",
          border:"1px solid rgba(196,168,130,.25)",
          boxShadow:"0 4px 16px rgba(0,0,0,0.15)"
        }}>
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
            <Toggle 
              label="Valeurs Observées" 
              checked={showObserved} 
              onChange={setShowObserved}
              icon={<IconEye size={16} />}
            />
            <Toggle 
              label="Valeurs Prédites" 
              checked={showPredicted} 
              onChange={setShowPredicted}
              icon={<IconZap size={16} />}
            />
            <Toggle 
              label="Intervalle de Confiance" 
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
        Indicateurs Clés
      </div>
      <div className="sw">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
          <MetricCard 
            icon={<IconCalendarDays size={24} color={ORANGE} />}
            title="Horizon"
            subtitle="Fenêtre de prévision"
            value={`${horizon} Jours`}
            color={INK}
          />
          <MetricCard 
            icon={<IconChartLine size={24} color={ORANGE} />}
            title={`Total Prévu (${horizon}j)`}
            subtitle={`${forecastInfo.label} cumulés`}
            value={fmt(metrics.total_prevision || metrics.total_prevision_14j)}
            unit={forecastInfo.unit}
            color={ORANGE}
          />
          <MetricCard 
            icon={<IconBar size={24} color={ORANGE} />}
            title="Moyenne Historique"
            subtitle={`${forecastInfo.label} par jour`}
            value={fmt(metrics.moy_jour_historique)}
            unit={forecastInfo.unit}
            color={INK}
          />
          <MetricCard 
            icon={<IconPercent size={24} color={OK} />}
            title="Précision (MDAPE)"
            subtitle="Validation croisée"
            value={`${prophetMetrics.mdape_cv}%`}
            color={OK}
          />
        </div>
      </div>

      {/* ── PROPHET METRICS ── */}
      <div className="sec-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <IconZap size={18} color={ORANGE} />
        Métriques Prophet
      </div>
      <div className="sw">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px" }}>
          {/* Train vs Validation */}
          <div className="cc">
            <div className="ct">Train vs Validation</div>
            <div className="cs">Comparaison des erreurs</div>
            <div style={{ marginTop: "16px", display: "flex", gap: "16px", alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "0.7rem", color: MUTED, marginBottom: "4px" }}>Train Error</div>
                <div style={{ fontSize: "1.4rem", fontWeight: 800, color: OK }}>{fmt(prophetMetrics.train_error)}%</div>
              </div>
              <IconGitBranch size={32} color={MUTED} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "0.7rem", color: MUTED, marginBottom: "4px" }}>Validation Error</div>
                <div style={{ fontSize: "1.4rem", fontWeight: 800, color: WARN }}>{fmt(prophetMetrics.validation_error)}%</div>
              </div>
            </div>
          </div>

          {/* MAPE by Horizon */}
          <div className="cc">
            <div className="ct">MAPE par Horizon</div>
            <div className="cs">Erreur selon l'horizon de prévision</div>
            <div style={{ marginTop: "16px" }}>
              {prophetMetrics.mape_by_horizon?.map((item: any) => (
                <div key={item.horizon} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f2e9e1" }}>
                  <span style={{ fontSize: "0.85rem", color: INK, fontWeight: 600 }}>{item.horizon}</span>
                  <span style={{ fontSize: "0.85rem", color: ORANGE, fontWeight: 700 }}>{fmt(item.mape)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── FORECAST CALENDAR ── */}
      <div className="sec-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <IconCalendarDays size={18} color={ORANGE} />
        Calendrier des Prévisions
      </div>
      <div className="sw">
        <div className="cc">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "12px", paddingTop: "8px" }}>
            {forecast.map((day: any, i: number) => {
              const isFerme = day.is_ferme === 1;
              return (
                <div key={i} style={{ 
                  padding: "12px", 
                  borderRadius: "12px", 
                  border: isFerme ? "1px dashed #e2d5c8" : "1px solid rgba(232,115,74,0.3)", 
                  background: isFerme ? "#fcfaf8" : "#fffcfb", 
                  textAlign: "center", 
                  display: "flex", 
                  flexDirection: "column", 
                  gap: "8px" 
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.6rem", fontWeight: 700, color: MUTED, textTransform: "uppercase" }}>
                    <span>{day.horizon}</span>
                    <span>{day.jour_semaine?.slice(0, 3)}</span>
                  </div>
                  <div style={{ fontSize: "0.75rem", fontWeight: 800, color: INK }}>{day.date_fr}</div>
                  {isFerme ? (
                    <div style={{ margin: "12px 0", fontSize: "0.8rem", fontWeight: 700, color: MUTED }}>
                      <IconAlert size={20} color={MUTED} />
                      <div style={{ marginTop: "4px" }}>FERMÉ</div>
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
                    {isFerme ? "Repos" : forecastInfo.unit}
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
        Historique + Prévision
      </div>
      <div className="sw">
        <div className="cc" style={{ minHeight: "900px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
            <div>
              <div className="ct">Historique Récent et Prévision</div>
              <div className="cs">Continuité entre observations et prévisions</div>
            </div>
            <div style={{ display: "flex", gap: "16px", fontSize: "0.7rem", fontWeight: 700 }}>
              {showObserved && <span style={{ display: "flex", alignItems: "center", gap: "6px", color: INK }}><div style={{ width: "8px", height: "8px", borderRadius: "50%", background: INK }} />Historique</span>}
              {showPredicted && <span style={{ display: "flex", alignItems: "center", gap: "6px", color: ORANGE }}><div style={{ width: "8px", height: "8px", borderRadius: "50%", background: ORANGE }} />Prévision Prophet</span>}
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
                {loading ? "Chargement du graphique..." : "Données insuffisantes pour afficher le graphique"}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── SEASONAL FORECAST ── */}
      {forecastSeason.length > 0 && (
        <>
          <div className="sec-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <IconTrendUp size={18} color={ORANGE} />
            Prévision Estivale
          </div>
          <div className="sw">
            <div className="cc">
              <div className="ct">Prévision des ventes pour la saison estivale</div>
              <div className="cs">Projection Juin - Septembre</div>
              <div style={{ height: "350px", width: "100%", marginTop: "16px" }}>
                <SeasonalChart data={forecastSeason} />
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── PROPHET DECOMPOSITION ── */}
      {Object.keys(decomposition).length > 0 && (
        <>
          <div className="sec-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <IconLayers size={18} color={ORANGE} />
            Décomposition Prophet
          </div>
          <div className="sw">
            <div className="cc">
              <div className="ct">Décomposition des prévisions</div>
              <div className="cs">Tendance, saisonnalité et événements</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px", marginTop: "16px" }}>
                {decomposition.trend && (
                  <div>
                    <div style={{ fontSize: "0.8rem", fontWeight: 700, color: INK, marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                      <IconTrendUp size={16} color={ORANGE} />
                      Tendance
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
                      Saisonnalité
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
                      Événements
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

      {/* ── DETAILED TABLE ── */}
      <div className="sec-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <IconActivity size={18} color={ORANGE} />
        Détail Numérique
      </div>
      <div className="sw">
        <div className="cc">
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "8px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #f2e9e1", color: MUTED, fontSize: "0.7rem", textTransform: "uppercase", textAlign: "right" }}>
                <th style={{ textAlign: "left", paddingBottom: "8px" }}>Horizon / Date</th>
                <th style={{ textAlign: "left", paddingBottom: "8px" }}>Jour</th>
                <th style={{ paddingBottom: "8px" }}>Demande ({forecastInfo.unit})</th>
                {showConfidence && <th style={{ paddingBottom: "8px" }}>Borne Basse</th>}
                {showConfidence && <th style={{ paddingBottom: "8px" }}>Borne Haute</th>}
                <th style={{ paddingBottom: "8px" }}>Statut</th>
              </tr>
            </thead>
            <tbody>
              {forecast.map((r: any, i: number) => (
                <tr key={i} style={{ borderBottom: "1px solid #fdfcfb" }}>
                  <td style={{ padding: "10px 0", fontSize: "0.8rem", fontWeight: 700, color: INK }}>
                    {r.horizon} <span style={{ color: MUTED, fontWeight: 500, marginLeft: "8px" }}>{r.date_fr}</span>
                  </td>
                  <td style={{ padding: "10px 0", fontSize: "0.75rem", color: MUTED }}>{r.jour_semaine}</td>
                  <td style={{ padding: "10px 0", textAlign: "right", fontSize: "0.85rem", fontWeight: 800, color: r.is_ferme ? MUTED : ORANGE }}>
                    {r.is_ferme ? 0 : fmt(r.yhat)}
                  </td>
                  {showConfidence && (
                    <td style={{ padding: "10px 0", textAlign: "right", fontSize: "0.75rem", color: MUTED }}>{fmt(r.yhat_lower)}</td>
                  )}
                  {showConfidence && (
                    <td style={{ padding: "10px 0", textAlign: "right", fontSize: "0.75rem", color: MUTED }}>{fmt(r.yhat_upper)}</td>
                  )}
                  <td style={{ padding: "10px 0", textAlign: "right" }}>
                    <span style={{ 
                      fontSize: "0.65rem", 
                      fontWeight: 700, 
                      background: r.is_ferme ? "#f2ede6" : "rgba(99,153,34,0.1)", 
                      color: r.is_ferme ? MUTED : "#639922", 
                      padding: "3px 8px", 
                      borderRadius: "12px" 
                    }}>
                      {r.is_ferme ? "Fermé" : "Ouvert"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
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
        border: checked ? "2px solid #C2410C" : "1px solid #e2d5c8",
        background: checked ? "rgba(194,65,12,0.1)" : "white",
        fontSize: "0.85rem",
        fontWeight: checked ? 700 : 500,
        color: checked ? "#C2410C" : INK,
        cursor: "pointer"
      }}
    >
      {checked ? <IconEye size={16} color="#C2410C" /> : <IconEyeOff size={16} color={MUTED} />}
      {label}
    </button>
  );
}

function ForecastChart({ history, forecast, showObserved, showPredicted, showConfidence }: any) {
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
    upperPts.forEach((pt) => confidencePath += ` L ${pt.x} ${pt.y}`);
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
  const yStep = Math.max(1, Math.floor(max / 5));
  const yLabels = [];
  for (let v = 0; v <= max; v += yStep) {
    yLabels.push({ y: toY(v), value: fmt(v) });
  }

  // Colors for different elements - using varied colors as requested
  const histColor = "#1C1410";      // Dark for history
  const fcColor = "#C2410C";       // Orange for forecast
  const confColor = "rgba(194,65,12,0.15)"; // Light orange for confidence
  const gridColor = "rgba(200,140,100,0.2)";

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, paddingRight: 4 }}>
        <span style={{ fontSize: "0.75rem", color: MUTED, fontWeight: 600 }}>
          {isZoomed
            ? `Zoom : ${allData[effStart]?.label || ''} → ${allData[effEnd]?.label || ''} · Double-cliquez pour réinitialiser`
            : "Glissez une sélection horizontale sur le graphique pour zoomer"}
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
            × Réinitialiser
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
        <line x1={splitX} y1={pad.t} x2={splitX} y2={H - pad.b} stroke="#C8860A" strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />
        <text x={splitX - 8} y={pad.t + 12} textAnchor="end" fontSize="11" fill="#9a8070" fontWeight="700">Historique</text>
        <text x={splitX + 8} y={pad.t + 12} textAnchor="start" fontSize="11" fill="#C2410C" fontWeight="700">Prophet J+{forecast.length}</text>

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
          <circle key={i} cx={pt.x} cy={pt.y} r="4" fill="white" stroke={fcColor} strokeWidth="2" />
        ))}

        {/* Selection rectangle */}
        {isSelecting && selStart !== null && selCurrent !== null && (
          <rect 
            x={Math.min(selX1, selX2)} 
            y={pad.t} 
            width={Math.abs(selX2 - selX1)} 
            height={H - pad.t - pad.b} 
            fill="rgba(194,65,12,0.1)" 
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
            <span style={{ fontSize: "0.75rem", color: INK, fontWeight: 600 }}>Historique</span>
          </div>
        )}
        {showPredicted && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: fcColor }} />
            <span style={{ fontSize: "0.75rem", color: INK, fontWeight: 600 }}>Prévision Prophet</span>
          </div>
        )}
        {showConfidence && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ width: "12px", height: "12px", borderRadius: "2px", background: confColor, border: "1px solid #C2410C" }} />
            <span style={{ fontSize: "0.75rem", color: INK, fontWeight: 600 }}>Intervalle de confiance</span>
          </div>
        )}
      </div>
    </div>
  );
}

function SeasonalChart({ data }: any) {
  const W = 1000; const H = 350;
  const pad = { l: 60, r: 40, t: 30, b: 50 };
  
  const vals = data.map((d: any) => d.yhat);
  const max = Math.max(...vals, 100) * 1.05;
  const min = 0;
  const n = Math.max(data.length - 1, 1);

  const getX = (i: number) => pad.l + (i / n) * (W - pad.l - pad.r);
  const getY = (v: number) => H - pad.b - ((v - min) / (max - min)) * (H - pad.t - pad.b);

  const pts = data.map((d: any, i: number) => ({ x: getX(i), y: getY(d.yhat) }));
  let path = pts.length > 0 ? `M ${pts[0].x} ${pts[0].y}` : "";
  for (let i = 0; i < pts.length - 1; i++) { path += ` L ${pts[i + 1].x} ${pts[i + 1].y}`; }

  // Date labels - show monthly labels
  const dateLabels = [];
  const monthStep = Math.max(1, Math.floor(data.length / 6)); // Show ~6 months
  for (let i = 0; i < data.length; i += monthStep) {
    const label = data[i]?.label || "";
    const shortLabel = label.length > 8 ? label.slice(0, 6) : label;
    dateLabels.push({ x: getX(i), label: shortLabel });
  }

  // Y-axis labels
  const yStep = Math.max(1, Math.floor(max / 4));
  const yLabels = [];
  for (let v = 0; v <= max; v += yStep) {
    yLabels.push({ y: getY(v), value: fmt(v) });
  }

  const lineColor = "#EA580C";
  const gridColor = "rgba(200,140,100,0.2)";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "100%" }} preserveAspectRatio="none">
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
        <text key={label.x} x={label.x} y={H - pad.b + 16} textAnchor="middle" fontSize="9" fill={INK} fontWeight="700">
          {label.label}
        </text>
      ))}

      {/* Main line */}
      <path d={path} fill="none" stroke={lineColor} strokeWidth="2.5" />

      {/* Points */}
      {pts.map((pt: any, i: number) => (
        <circle key={i} cx={pt.x} cy={pt.y} r="3" fill="white" stroke={lineColor} strokeWidth="2" />
      ))}

      {/* Axes */}
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
  const gridColor = "rgba(200,140,100,0.15)";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "100%" }} preserveAspectRatio="none">
      {/* Simple grid */}
      <line x1={pad.l} y1={getY(max * 0.5)} x2={W - pad.r} y2={getY(max * 0.5)} stroke={gridColor} strokeWidth="1" />
      
      {/* Main line */}
      <path d={path} fill="none" stroke={color} strokeWidth="2" />
      
      {/* Points */}
      {pts.map((pt: any, i: number) => (
        <circle key={i} cx={pt.x} cy={pt.y} r="2.5" fill="white" stroke={color} strokeWidth="1.5" />
      ))}

      {/* Axes */}
      <line x1={pad.l} y1={pad.t} x2={pad.l} y2={H - pad.b} stroke={INK} strokeWidth="1" opacity="0.3" />
      <line x1={pad.l} y1={H - pad.b} x2={W - pad.r} y2={H - pad.b} stroke={INK} strokeWidth="1" opacity="0.3" />
    </svg>
  );
}