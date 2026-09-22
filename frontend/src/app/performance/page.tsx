"use client";

import React, { useEffect, useState } from "react";
import { fetchPerformance } from "@/lib/api";

const ORANGE = "#E8734A";
const INK = "#1C1410";
const MUTED = "#9a8070";
const PAL = [ORANGE, "#F0A882", "#e05c35", "#f5c4a8", "#FAD4C4", "#c45030"];

function fmt(n: number, dec = 0) {
  return Number(n || 0).toLocaleString("fr-FR", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
}

export default function PerformancePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"top" | "saison" | "cat">("top");

  // Filters state
  const [annee, setAnnee] = useState("2024 + 2025");
  const [saison, setSaison] = useState("Toutes");
  const [mois, setMois] = useState("Tous");
  const [categorie, setCategorie] = useState("Toutes");
  const [evenement, setEvenement] = useState("Tous");

  useEffect(() => {
    setLoading(true);
    fetchPerformance({ annee, saison, mois, categorie, evenement })
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [annee, saison, mois, categorie, evenement]);

  if (loading && !data) {
    return (
      <div style={{ padding: "40px", color: MUTED, fontSize: "0.9rem", fontWeight: 600 }}>
        Chargement de la performance...
      </div>
    );
  }

  const kpis = data?.kpis || {};
  const monthly = data?.monthly || {};
  const topProds = data?.top_products || {};
  const seasonality = data?.seasonality || {};
  const categories = data?.categories || [];
  const filters = data?.available_filters || {};

  return (
    <div style={{ paddingBottom: "40px" }}>
      
      {/* ── HEADER DE LA PAGE ── */}
      <div style={{ padding: "32px 28px 16px" }}>
        <h1 style={{ fontSize: "2.2rem", fontWeight: 800, color: INK, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
          Performance Générale
        </h1>
        <p style={{ color: MUTED, fontSize: "0.85rem", marginTop: "8px" }}>
          Analyse globale du chiffre d'affaires, saisonnalité et dynamique des catégories
        </p>
      </div>

      {/* ── BARRE DE FILTRES PROFESSIONNELLE ── */}
      <div className="sw" style={{ marginBottom: "16px" }}>
        <div className="cc" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "24px", padding: "16px 24px" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: ORANGE, textTransform: "uppercase", letterSpacing: "0.05em", borderRight: "1px solid #f2e9e1", paddingRight: "16px" }}>
            Filtres d'Analyse
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <label style={{ fontSize: "0.75rem", fontWeight: 600, color: MUTED }}>Année</label>
            <select value={annee} onChange={(e) => setAnnee(e.target.value)} style={selectStyle}>
              {filters.annees?.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <label style={{ fontSize: "0.75rem", fontWeight: 600, color: MUTED }}>Saison</label>
            <select value={saison} onChange={(e) => setSaison(e.target.value)} style={selectStyle}>
              {filters.saisons?.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <label style={{ fontSize: "0.75rem", fontWeight: 600, color: MUTED }}>Mois</label>
            <select value={mois} onChange={(e) => setMois(e.target.value)} style={selectStyle}>
              {filters.mois?.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <label style={{ fontSize: "0.75rem", fontWeight: 600, color: MUTED }}>Catégorie</label>
            <select value={categorie} onChange={(e) => setCategorie(e.target.value)} style={selectStyle}>
              {filters.categories?.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ── 5 CARTES KPI ── */}
      <div className="sec-title">Synthèse de la période</div>
      <div className="sw">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "12px", marginBottom: "12px" }}>
          <div className="cc">
            <div className="ct">Chiffre d'Affaires</div>
            <div className="cs">Total généré</div>
            <div style={{ fontSize: "1.6rem", fontWeight: 800, color: ORANGE }}>{fmt(kpis.total_ca / 1000, 1)} k€</div>
          </div>
          <div className="cc">
            <div className="ct">Nombre de Tickets</div>
            <div className="cs">Transactions clients</div>
            <div style={{ fontSize: "1.6rem", fontWeight: 800, color: INK }}>{fmt(kpis.nb_tickets)}</div>
          </div>
          <div className="cc">
            <div className="ct">Panier Moyen</div>
            <div className="cs">Par passage en caisse</div>
            <div style={{ fontSize: "1.6rem", fontWeight: 800, color: INK }}>{fmt(kpis.panier, 2)} €</div>
          </div>
          <div className="cc">
            <div className="ct">Jours Actifs</div>
            <div className="cs">Avec ventes enregistrées</div>
            <div style={{ fontSize: "1.6rem", fontWeight: 800, color: INK }}>{fmt(kpis.nb_jours)}</div>
          </div>
          <div className="cc">
            <div className="ct">Références</div>
            <div className="cs">Produits distincts vendus</div>
            <div style={{ fontSize: "1.6rem", fontWeight: 800, color: INK }}>{fmt(kpis.nb_produits)}</div>
          </div>
        </div>
      </div>

      {/* ── GRAPHIQUE ÉVOLUTION CA ── */}
      <div className="sec-title">Évolution Mensuelle du Chiffre d'Affaires</div>
      <div className="sw">
        <div className="cc">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
            <div>
              <div className="ct">Tendance & Saisonnalité</div>
              <div className="cs">Moyenne mensuelle : {fmt(monthly.moyenne)} € (± {fmt(monthly.ecart_type)} €)</div>
            </div>
            {monthly.ca_max && (
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: ORANGE, background: "rgba(232,115,74,0.1)", padding: "4px 10px", borderRadius: "6px" }}>
                Pic observé : {monthly.ca_max.date_str} ({fmt(monthly.ca_max.val)} €)
              </div>
            )}
          </div>
          
          <div style={{ height: "260px", width: "100%" }}>
            {monthly.series && monthly.series.length > 0 && (
              <MonthlyLineChart series={monthly.series} moyenne={monthly.moyenne} ecartType={monthly.ecart_type} />
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginTop: "24px", paddingTop: "20px", borderTop: "1px solid #f2e9e1" }}>
            <div style={{ fontSize: "0.75rem", color: INK }}>
              <span style={{ color: MUTED }}>Meilleur mois :</span> <strong style={{ marginLeft: 4 }}>{monthly.ca_max?.date_str}</strong> — {fmt(monthly.ca_max?.val)} €
            </div>
            <div style={{ fontSize: "0.75rem", color: INK }}>
              <span style={{ color: MUTED }}>Mois le plus faible :</span> <strong style={{ marginLeft: 4 }}>{monthly.ca_min?.date_str}</strong> — {fmt(monthly.ca_min?.val)} €
            </div>
            <div style={{ fontSize: "0.75rem", color: INK }}>
              <span style={{ color: MUTED }}>Amplitude saisonnière :</span> <strong style={{ marginLeft: 4 }}>{fmt(monthly.amplitude)} €</strong>
            </div>
          </div>
        </div>
      </div>

      {/* ── ONGLETS D'ANALYSE APPROFONDIE ── */}
      <div className="sec-title">Analyse Dimensionnelle</div>
      <div className="sw">
        {/* Tab Header */}
        <div style={{ display: "flex", gap: "24px", borderBottom: "2px solid #f2e9e1", paddingBottom: "12px", marginBottom: "16px" }}>
          {[
            { id: "top", label: "Top Produits" },
            { id: "saison", label: "Saisonnalité & Horaires" },
            { id: "cat", label: "Synthèse Catégories" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              style={{
                fontSize: "0.85rem",
                fontWeight: 700,
                color: activeTab === t.id ? ORANGE : MUTED,
                background: "none",
                border: "none",
                cursor: "pointer",
                position: "relative",
              }}
            >
              {t.label}
              {activeTab === t.id && (
                <div style={{ position: "absolute", bottom: "-14px", left: 0, right: 0, height: "2px", background: ORANGE }} />
              )}
            </button>
          ))}
        </div>

        {/* Tab 1: Top Produits */}
        {activeTab === "top" && (
          <div className="g2">
            <div className="cc">
              <div className="ct">Top 10 CA</div>
              <div className="cs">Produits générant le plus de revenus</div>
              <div className="prod-list">
                {topProds.by_ca?.slice(0, 10).map((p: any, i: number) => (
                  <div key={i} className="prod-row">
                    <div className="prod-nm" style={{ width: "160px" }}>
                      <div className="pdot" style={{ background: PAL[i % PAL.length] }} />
                      <span>{p.article}</span>
                    </div>
                    <div className="pbar-w" style={{ width: "100px" }}>
                      <div className="pbar" style={{ width: `${Math.min(p.part * 3, 100)}%`, background: PAL[i % PAL.length] }} />
                    </div>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: MUTED, width: "35px", textAlign: "right" }}>{p.part}%</span>
                    <span className="pval" style={{ flex: 1, textAlign: "right" }}>{fmt(p.total_revenue)} €</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="cc">
              <div className="ct">Top 10 Volume</div>
              <div className="cs">Produits les plus vendus en quantité</div>
              <div className="prod-list">
                {topProds.by_qte?.slice(0, 10).map((p: any, i: number) => (
                  <div key={i} className="prod-row">
                    <div className="prod-nm" style={{ flex: 1 }}>
                      <div className="pdot" style={{ background: "#C8860A" }} />
                      <span>{p.article}</span>
                    </div>
                    <span className="pval" style={{ background: "rgba(200,134,10,0.1)", color: "#C8860A", padding: "2px 8px", borderRadius: "6px" }}>
                      {fmt(p.quantity)} unités
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Saisonnalité */}
        {activeTab === "saison" && (
          <div className="g2">
            <div className="cc">
              <div className="ct">Performance par Jour de la Semaine</div>
              <div className="cs">Moyenne du chiffre d'affaires</div>
              <div className="prod-list" style={{ marginTop: "12px" }}>
                {seasonality.days?.map((d: any, i: number) => {
                  const maxMoy = Math.max(...seasonality.days.map((x: any) => x.ca_moyen), 1);
                  const pct = (d.ca_moyen / maxMoy) * 100;
                  return (
                    <div key={i} className="prod-row">
                      <div style={{ width: "80px", fontSize: "0.75rem", fontWeight: 700, color: INK }}>{d.day}</div>
                      <div className="pbar-w" style={{ flex: 1 }}>
                        <div className="pbar" style={{ width: `${pct}%`, background: ORANGE }} />
                      </div>
                      <span className="pval" style={{ width: "80px", textAlign: "right" }}>{fmt(d.ca_moyen)} €</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="cc">
              <div className="ct">Distribution Horaire</div>
              <div className="cs">Concentration du CA et Tickets</div>
              <div className="prod-list" style={{ marginTop: "12px" }}>
                {seasonality.hourly?.slice(0, 13).map((h: any, i: number) => (
                  <div key={i} className="prod-row">
                    <div style={{ width: "60px", fontSize: "0.75rem", fontWeight: 700, color: MUTED }}>{h.heure_label}</div>
                    <div className="pbar-w" style={{ flex: 1 }}>
                      <div className="pbar" style={{ width: `${Math.min(h.ca / 50, 100)}%`, background: "#C8860A" }} />
                    </div>
                    <span className="pval" style={{ width: "60px", textAlign: "right" }}>{fmt(h.ca)} €</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Catégories */}
        {activeTab === "cat" && (
          <div className="cc">
            <div className="ct">Poids des Catégories</div>
            <div className="cs">Répartition du CA et analyse des paniers</div>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "16px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #f2e9e1", color: MUTED, fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "right" }}>
                  <th style={{ textAlign: "left", paddingBottom: "8px" }}>Catégorie</th>
                  <th style={{ paddingBottom: "8px" }}>CA (€)</th>
                  <th style={{ paddingBottom: "8px" }}>Part (%)</th>
                  <th style={{ paddingBottom: "8px" }}>Panier Moyen</th>
                  <th style={{ paddingBottom: "8px" }}>Tickets</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c: any, i: number) => (
                  <tr key={i} style={{ borderBottom: "1px solid #fdfcfb" }}>
                    <td style={{ padding: "10px 0", fontSize: "0.8rem", fontWeight: 700, color: INK, display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: PAL[i % PAL.length] }} />
                      {c.category}
                    </td>
                    <td style={{ padding: "10px 0", textAlign: "right", fontSize: "0.85rem", fontWeight: 800, color: INK }}>{fmt(c.ca)} €</td>
                    <td style={{ padding: "10px 0", textAlign: "right", fontSize: "0.75rem", fontWeight: 700, color: MUTED }}>{c.part}%</td>
                    <td style={{ padding: "10px 0", textAlign: "right", fontSize: "0.75rem", color: INK }}>{fmt(c.panier, 2)} €</td>
                    <td style={{ padding: "10px 0", textAlign: "right", fontSize: "0.75rem", color: MUTED }}>{fmt(c.tickets)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const selectStyle = {
  fontSize: "0.75rem",
  fontWeight: 700,
  color: INK,
  background: "#fcfaf8",
  border: "1px solid #e2d5c8",
  borderRadius: "8px",
  padding: "6px 10px",
  outline: "none",
  cursor: "pointer",
};

// ── Custom SVG Monthly Chart with Mean and Bands ──
function MonthlyLineChart({
  series,
  moyenne,
  ecartType,
}: {
  series: Array<{ date: string; label: string; ca: number }>;
  moyenne: number;
  ecartType: number;
}) {
  const W = 800;
  const H = 220;
  const pad = 30;

  const vals = series.map((s) => s.ca);
  const max = Math.max(...vals, moyenne + ecartType) * 1.05;
  const min = 0;

  const getX = (i: number) => pad + (i / (series.length - 1)) * (W - pad * 2);
  const getY = (v: number) => H - pad - ((v - min) / (max - min)) * (H - pad * 2);

  const pts = series.map((s, i) => ({ x: getX(i), y: getY(s.ca) }));
  let path = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    path += ` C ${mx} ${pts[i].y}, ${mx} ${pts[i + 1].y}, ${pts[i + 1].x} ${pts[i + 1].y}`;
  }
  const area = `${path} L ${pts[pts.length - 1].x} ${H - pad} L ${pts[0].x} ${H - pad} Z`;

  const yMoy = getY(moyenne);
  const yUpper = getY(moyenne + ecartType);
  const yLower = getY(Math.max(0, moyenne - ecartType));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "100%" }} preserveAspectRatio="none">
      {/* Zone ± 1 sigma */}
      <rect x={pad} y={yUpper} width={W - pad * 2} height={Math.max(0, yLower - yUpper)} fill="rgba(232, 115, 74, 0.05)" />
      {/* Ligne moyenne */}
      <line x1={pad} y1={yMoy} x2={W - pad} y2={yMoy} stroke="#C8860A" strokeWidth="1" strokeDasharray="4 4" opacity="0.6" />

      {/* Courbe */}
      <path d={area} fill="url(#grad)" />
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(232, 115, 74, 0.2)" />
          <stop offset="100%" stopColor="rgba(232, 115, 74, 0.0)" />
        </linearGradient>
      </defs>
      <path d={path} fill="none" stroke="#E8734A" strokeWidth="3" strokeLinecap="round" />

      {/* Points */}
      {pts.map((pt, i) => (
        <circle key={i} cx={pt.x} cy={pt.y} r="4" fill="white" stroke="#E8734A" strokeWidth="2" />
      ))}

      {/* Labels X */}
      {series.map((s, i) => (
        <text key={i} x={getX(i)} y={H - 5} textAnchor="middle" fontSize="10" fill="#9a8070" fontWeight="600">
          {s.label}
        </text>
      ))}
    </svg>
  );
}
