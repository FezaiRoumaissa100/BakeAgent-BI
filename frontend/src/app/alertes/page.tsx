"use client";

import React, { useEffect, useState } from "react";
import { fetchAlerts } from "@/lib/api";

const INK = "#1C1410";
const MUTED = "#9a8070";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string; desc: string }> = {
  RUPTURE: { label: "RUPTURE", color: "#E24B4A", bg: "#fef2f2", icon: "🔴", desc: "Stock < demande haute" },
  VIGILANCE: { label: "VIGILANCE", color: "#EF9F27", bg: "#fffbeb", icon: "🟠", desc: "Stock 60–90%" },
  NORMAL: { label: "NORMAL", color: "#639922", bg: "#f0fdf4", icon: "🟢", desc: "Stock 40–60%" },
  SURSTOCK: { label: "SURSTOCK", color: "#378ADD", bg: "#eff6ff", icon: "🔵", desc: "Stock > demande" },
  FERMÉ: { label: "FERMÉ", color: "#B4B2A9", bg: "#f5f5f4", icon: "⚪", desc: "Boutique fermée" },
};

function fmt(n: number, dec = 0) {
  return Number(n || 0).toLocaleString("fr-FR", {
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
    return <div style={{ padding: "40px", color: MUTED, fontSize: "0.9rem", fontWeight: 600 }}>Chargement du système d'alertes...</div>;
  }

  const kpis = data?.kpis || {};
  const days = data?.days || [];
  const statuts = kpis?.statuts || {};

  return (
    <div style={{ paddingBottom: "40px" }}>
      {/* ── HEADER DE LA PAGE ── */}
      <div style={{ padding: "32px 28px 16px" }}>
        <h1 style={{ fontSize: "2.2rem", fontWeight: 800, color: INK, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
          Alertes & Stock
        </h1>
        <p style={{ color: MUTED, fontSize: "0.85rem", marginTop: "8px" }}>
          Prévision estivale 2026, seuils de vigilance et recommandations de commande
        </p>
      </div>

      <div className="sw">
        <div style={{ background: "rgba(200,134,10,0.06)", borderLeft: "4px solid #C8860A", padding: "16px 20px", borderRadius: "0 12px 12px 0", fontSize: "0.75rem", color: "#5a3010", marginBottom: "16px" }}>
          ⚠️ <strong>Précision méthodologique :</strong> Ces alertes représentent un niveau de risque estimé à partir des prévisions de demande et de la politique de stock de référence (2 jours). Elles ne préjugent pas du stock physique réel en boutique.
        </div>
      </div>

      <div className="sw" style={{ marginBottom: "16px" }}>
        <div className="cc" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "24px", padding: "16px 24px" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: INK, textTransform: "uppercase", letterSpacing: "0.05em", borderRight: "1px solid #f2e9e1", paddingRight: "16px" }}>
            Période Estivale
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            {["Tout", "Juin", "Juillet", "Août", "Septembre"].map((m) => (
              <button
                key={m}
                onClick={() => setMois(m)}
                style={{
                  padding: "6px 14px",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  borderRadius: "8px",
                  border: mois === m ? "1px solid #1C1410" : "1px solid #e2d5c8",
                  background: mois === m ? "#1C1410" : "#fcfaf8",
                  color: mois === m ? "white" : INK,
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                {m}
              </button>
            ))}
          </div>

          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", gap: "24px", fontSize: "0.75rem", color: MUTED }}>
            <div>Articles prévus: <strong style={{ color: INK }}>{fmt(kpis.total_articles)}</strong></div>
            <div>CA prévu: <strong style={{ color: INK }}>{fmt(kpis.ca_total_prevu)} €</strong></div>
            <div>Risque Rupture: <strong style={{ color: "#E24B4A" }}>{fmt(kpis.ca_risque)} €</strong></div>
          </div>
        </div>
      </div>

      <div className="sec-title">Synthèse des Alertes</div>
      <div className="sw">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "12px" }}>
          {Object.keys(STATUS_CONFIG).map((key) => {
            const cfg = STATUS_CONFIG[key];
            const count = statuts[key] || 0;
            return (
              <div key={key} className="cc" style={{ borderTop: `4px solid ${cfg.color}`, textAlign: "center", padding: "16px" }}>
                <div style={{ fontSize: "1.6rem", marginBottom: "8px" }}>{cfg.icon}</div>
                <div style={{ fontSize: "0.75rem", fontWeight: 800, color: cfg.color, letterSpacing: "0.05em" }}>{cfg.label}</div>
                <div style={{ fontSize: "1.8rem", fontWeight: 800, color: INK, margin: "8px 0" }}>{count}</div>
                <div style={{ fontSize: "0.65rem", color: MUTED }}>{cfg.desc}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="sec-title">Vue d'ensemble : Niveaux de Risque</div>
      <div className="sw">
        <div className="cc">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
            <div>
              <div className="ct">Demande Prévue & Niveaux d'Alerte</div>
              <div className="cs">Quantité d'articles par jour</div>
            </div>
            <div style={{ display: "flex", gap: "12px", fontSize: "0.65rem", fontWeight: 700, color: MUTED }}>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#E24B4A" }} />Rupture</span>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#EF9F27" }} />Vigilance</span>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#639922" }} />Normal</span>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#378ADD" }} />Surstock</span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", gap: "2px", height: "180px", borderBottom: "1px solid #f2e9e1", paddingBottom: "12px", marginTop: "12px" }}>
            {days.map((d: any, i: number) => {
              const maxVal = Math.max(...days.map((x: any) => x.yhat), 1);
              const pct = Math.max(4, (d.yhat / maxVal) * 100);
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%", position: "relative" }} title={`${d.date_fr}: ${fmt(d.yhat)} art. (${d.statut})`}>
                  <div style={{ width: "100%", height: `${pct}%`, background: d.bar_color, borderRadius: "2px 2px 0 0", opacity: 0.85, transition: "opacity 0.2s" }} />
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.6rem", fontWeight: 700, color: MUTED, marginTop: "8px" }}>
            <span>{days[0]?.date_fr}</span>
            <span>{days[Math.floor(days.length / 2)]?.date_fr}</span>
            <span>{days[days.length - 1]?.date_fr}</span>
          </div>
        </div>
      </div>

      <div className="sec-title">Détail Opérationnel</div>
      <div className="sw">
        <div className="cc">
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "8px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #f2e9e1", color: MUTED, fontSize: "0.7rem", textTransform: "uppercase", textAlign: "right" }}>
                <th style={{ textAlign: "left", paddingBottom: "8px" }}>Date</th>
                <th style={{ textAlign: "left", paddingBottom: "8px" }}>Jour</th>
                <th style={{ paddingBottom: "8px" }}>Demande Prévue</th>
                <th style={{ paddingBottom: "8px" }}>CA Prévu</th>
                <th style={{ paddingBottom: "8px" }}>Ratio Stock / Demande</th>
                <th style={{ paddingBottom: "8px" }}>Commande Recommandée</th>
                <th style={{ paddingBottom: "8px" }}>Statut</th>
              </tr>
            </thead>
            <tbody>
              {days.slice(0, 30).map((row: any, i: number) => {
                const cfg = STATUS_CONFIG[row.statut] || STATUS_CONFIG["NORMAL"];
                return (
                  <tr key={i} style={{ borderBottom: "1px solid #fdfcfb" }}>
                    <td style={{ padding: "10px 0", fontSize: "0.8rem", fontWeight: 700, color: INK }}>{row.date_fr}</td>
                    <td style={{ padding: "10px 0", fontSize: "0.75rem", color: MUTED }}>{row.jour_semaine}</td>
                    <td style={{ padding: "10px 0", textAlign: "right", fontSize: "0.85rem", fontWeight: 800, color: INK }}>{fmt(row.yhat)}</td>
                    <td style={{ padding: "10px 0", textAlign: "right", fontSize: "0.75rem", color: MUTED }}>{fmt(row.ca_prevu)} €</td>
                    <td style={{ padding: "10px 0", textAlign: "right", fontSize: "0.75rem", fontWeight: 700, color: INK }}>{row.ratio_pct?.toFixed(1)}%</td>
                    <td style={{ padding: "10px 0", textAlign: "right", fontSize: "0.85rem", fontWeight: 800, color: "#C8860A" }}>{fmt(row.commande_recommandee)}</td>
                    <td style={{ padding: "10px 0", textAlign: "right" }}>
                      <span style={{ fontSize: "0.65rem", fontWeight: 800, background: cfg.bg, color: cfg.color, padding: "3px 8px", borderRadius: "12px", border: `1px solid ${cfg.color}30` }}>
                        {row.statut}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
