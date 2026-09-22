"use client";

import React, { useEffect, useState } from "react";
import { fetchForecast } from "@/lib/api";

const ORANGE = "#E8734A";
const INK = "#1C1410";
const MUTED = "#9a8070";

function fmt(n: number, dec = 0) {
  return Number(n || 0).toLocaleString("fr-FR", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
}

export default function PrevisionsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchForecast()
      .then((res) => { setData(res); setLoading(false); })
      .catch((err) => { console.error(err); setLoading(false); });
  }, []);

  if (loading && !data) {
    return <div style={{ padding: "40px", color: MUTED, fontSize: "0.9rem", fontWeight: 600 }}>Chargement des prévisions...</div>;
  }

  const metrics = data?.metrics || {};
  const forecast14 = data?.forecast_14j || [];
  const history = data?.history || [];

  return (
    <div style={{ paddingBottom: "40px" }}>
      {/* ── HEADER DE LA PAGE ── */}
      <div style={{ padding: "32px 28px 16px" }}>
        <h1 style={{ fontSize: "2.2rem", fontWeight: 800, color: INK, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
          Prévisions de Demande
        </h1>
        <p style={{ color: MUTED, fontSize: "0.85rem", marginTop: "8px" }}>
          Modélisation de séries temporelles (Prophet) à horizon 14 jours
        </p>
      </div>

      <div className="sw">
        <div style={{ background: "rgba(200,134,10,0.06)", borderLeft: "4px solid #C8860A", padding: "16px 20px", borderRadius: "0 12px 12px 0", fontSize: "0.75rem", color: "#5a3010", marginBottom: "24px" }}>
          <strong style={{ display: "block", marginBottom: "4px" }}>Note de prudence réglementaire :</strong>
          Les prévisions représentent les valeurs estimées par le modèle à partir des données historiques. Elles ne constituent pas une mesure du stock réel ou des invendus physiques.
        </div>
      </div>

      <div className="sec-title">Indicateurs de Modélisation</div>
      <div className="sw">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
          <div className="cc"><div className="ct">Horizon</div><div className="cs">Fenêtre glissante</div><div style={{ fontSize: "1.6rem", fontWeight: 800, color: INK }}>14 Jours</div></div>
          <div className="cc"><div className="ct">Volume Prévu (14j)</div><div className="cs">Articles estimés cumulés</div><div style={{ fontSize: "1.6rem", fontWeight: 800, color: ORANGE }}>{fmt(metrics.total_prevision_14j)}</div></div>
          <div className="cc"><div className="ct">Moyenne Historique</div><div className="cs">Articles par jour</div><div style={{ fontSize: "1.6rem", fontWeight: 800, color: INK }}>{fmt(metrics.moy_jour_historique)}</div></div>
          <div className="cc"><div className="ct">Précision (MDAPE)</div><div className="cs">Validation croisée</div><div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#639922" }}>{metrics.mdape_cv}%</div></div>
        </div>
      </div>

      <div className="sec-title">Calendrier des Prévisions (J+1 à J+14)</div>
      <div className="sw">
        <div className="cc">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "12px", paddingTop: "8px" }}>
            {forecast14.map((day: any, i: number) => {
              const isFerme = day.is_ferme === 1;
              return (
                <div key={i} style={{ padding: "12px", borderRadius: "12px", border: isFerme ? "1px dashed #e2d5c8" : "1px solid rgba(232,115,74,0.3)", background: isFerme ? "#fcfaf8" : "#fffcfb", textAlign: "center", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.6rem", fontWeight: 700, color: MUTED, textTransform: "uppercase" }}>
                    <span>{day.horizon}</span>
                    <span>{day.jour_semaine?.slice(0, 3)}</span>
                  </div>
                  <div style={{ fontSize: "0.75rem", fontWeight: 800, color: INK }}>{day.date_fr}</div>
                  {isFerme ? (
                    <div style={{ margin: "12px 0", fontSize: "0.8rem", fontWeight: 700, color: MUTED }}>FERMÉ</div>
                  ) : (
                    <div style={{ margin: "8px 0" }}>
                      <div style={{ fontSize: "1.3rem", fontWeight: 800, color: ORANGE }}>{fmt(day.yhat)}</div>
                      <div style={{ fontSize: "0.6rem", fontWeight: 600, color: MUTED, marginTop: "2px" }}>[{day.yhat_lower} – {day.yhat_upper}]</div>
                    </div>
                  )}
                  <div style={{ fontSize: "0.6rem", fontWeight: 700, color: MUTED }}>{isFerme ? "Repos" : "Articles"}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="sec-title">Projection Historique & Horizon</div>
      <div className="sw">
        <div className="cc">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
            <div>
              <div className="ct">Historique Récent et Prévision</div>
              <div className="cs">Continuité entre observations (60 jours) et prévisions (14 jours)</div>
            </div>
            <div style={{ display: "flex", gap: "16px", fontSize: "0.7rem", fontWeight: 700 }}>
              <span style={{ display: "flex", alignItems: "center", gap: "6px", color: INK }}><div style={{ width: "8px", height: "8px", borderRadius: "50%", background: INK }} />Historique</span>
              <span style={{ display: "flex", alignItems: "center", gap: "6px", color: ORANGE }}><div style={{ width: "8px", height: "8px", borderRadius: "50%", background: ORANGE }} />Prévision Prophet</span>
            </div>
          </div>
          
          <div style={{ height: "260px", width: "100%", marginTop: "12px" }}>
            {history.length > 0 && forecast14.length > 0 && <ForecastChart history={history} forecast={forecast14} />}
          </div>
        </div>
      </div>

      <div className="sec-title">Détail Numérique</div>
      <div className="sw">
        <div className="cc">
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "8px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #f2e9e1", color: MUTED, fontSize: "0.7rem", textTransform: "uppercase", textAlign: "right" }}>
                <th style={{ textAlign: "left", paddingBottom: "8px" }}>Horizon / Date</th>
                <th style={{ textAlign: "left", paddingBottom: "8px" }}>Jour</th>
                <th style={{ paddingBottom: "8px" }}>Demande (u.)</th>
                <th style={{ paddingBottom: "8px" }}>Borne Basse</th>
                <th style={{ paddingBottom: "8px" }}>Borne Haute</th>
                <th style={{ paddingBottom: "8px" }}>Statut</th>
              </tr>
            </thead>
            <tbody>
              {forecast14.map((r: any, i: number) => (
                <tr key={i} style={{ borderBottom: "1px solid #fdfcfb" }}>
                  <td style={{ padding: "10px 0", fontSize: "0.8rem", fontWeight: 700, color: INK }}>{r.horizon} <span style={{ color: MUTED, fontWeight: 500, marginLeft: "8px" }}>{r.date_fr}</span></td>
                  <td style={{ padding: "10px 0", fontSize: "0.75rem", color: MUTED }}>{r.jour_semaine}</td>
                  <td style={{ padding: "10px 0", textAlign: "right", fontSize: "0.85rem", fontWeight: 800, color: r.is_ferme ? MUTED : ORANGE }}>{r.is_ferme ? 0 : fmt(r.yhat)}</td>
                  <td style={{ padding: "10px 0", textAlign: "right", fontSize: "0.75rem", color: MUTED }}>{fmt(r.yhat_lower)}</td>
                  <td style={{ padding: "10px 0", textAlign: "right", fontSize: "0.75rem", color: MUTED }}>{fmt(r.yhat_upper)}</td>
                  <td style={{ padding: "10px 0", textAlign: "right" }}>
                    <span style={{ fontSize: "0.65rem", fontWeight: 700, background: r.is_ferme ? "#f2ede6" : "rgba(99,153,34,0.1)", color: r.is_ferme ? MUTED : "#639922", padding: "3px 8px", borderRadius: "12px" }}>
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

// ── SVG Combined Chart for History & 14-Day Forecast ──
function ForecastChart({ history, forecast }: { history: any[]; forecast: any[] }) {
  const W = 800; const H = 220; const pad = 30;
  const allVals = [...history.map((h) => h.y), ...forecast.map((f) => f.yhat_upper)];
  const max = Math.max(...allVals, 100) * 1.05;
  const min = 0;
  const totalPts = history.length + forecast.length;
  const getX = (i: number) => pad + (i / (totalPts - 1)) * (W - pad * 2);
  const getY = (v: number) => H - pad - ((v - min) / (max - min)) * (H - pad * 2);

  const histPts = history.map((h, i) => ({ x: getX(i), y: getY(h.y) }));
  let histPath = `M ${histPts[0].x} ${histPts[0].y}`;
  for (let i = 0; i < histPts.length - 1; i++) { histPath += ` L ${histPts[i + 1].x} ${histPts[i + 1].y}`; }

  const fcPts = [histPts[history.length - 1], ...forecast.map((f, i) => ({ x: getX(history.length + i), y: getY(f.yhat) }))];
  let fcPath = `M ${fcPts[0].x} ${fcPts[0].y}`;
  for (let i = 0; i < fcPts.length - 1; i++) { fcPath += ` L ${fcPts[i + 1].x} ${fcPts[i + 1].y}`; }

  const splitX = getX(history.length - 1);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "100%" }} preserveAspectRatio="none">
      <line x1={splitX} y1={pad} x2={splitX} y2={H - pad} stroke="#C8860A" strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />
      <text x={splitX - 8} y={pad + 12} textAnchor="end" fontSize="10" fill="#9a8070" fontWeight="700">Historique</text>
      <text x={splitX + 8} y={pad + 12} textAnchor="start" fontSize="10" fill="#E8734A" fontWeight="700">Prophet J+14</text>

      <path d={histPath} fill="none" stroke="#1C1410" strokeWidth="2" opacity="0.6" />
      <path d={fcPath} fill="none" stroke="#E8734A" strokeWidth="3" />

      {fcPts.slice(1).map((pt, i) => (
        <circle key={i} cx={pt.x} cy={pt.y} r="4" fill="white" stroke="#E8734A" strokeWidth="2" />
      ))}
    </svg>
  );
}
