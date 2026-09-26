"use client";

import React, { useEffect, useState } from "react";
import { fetchAlerts } from "@/lib/api";
import {
  IconPackage,
  IconShoppingCart,
  IconEuro,
  IconAlertTriangle,
  IconCircleDot,
  IconCheckCircle,
  IconXCircle,
  IconRobot,
  IconFilter,
  IconCalendarDays,
  IconTarget,
  IconBolt,
  IconActivity,
} from "@/components/Icons";

const INK = "#1C1410";
const MUTED = "#9a8070";
const ORANGE = "#C2410C";
const OK = "#15803D";
const WARN = "#B45309";
const ALERT = "#991B1B";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode; desc: string }> = {
  RUPTURE: { label: "RUPTURE", color: "#E24B4A", bg: "#fef2f2", icon: <IconXCircle size={24} color="#E24B4A" />, desc: "Stock < demande haute" },
  VIGILANCE: { label: "VIGILANCE", color: "#EF9F27", bg: "#fffbeb", icon: <IconAlertTriangle size={24} color="#EF9F27" />, desc: "Stock 60–90%" },
  NORMAL: { label: "NORMAL", color: "#639922", bg: "#f0fdf4", icon: <IconCheckCircle size={24} color="#639922" />, desc: "Stock 40–60%" },
  SURSTOCK: { label: "SURSTOCK", color: "#378ADD", bg: "#eff6ff", icon: <IconCircleDot size={24} color="#378ADD" />, desc: "Stock > demande" },
  FERMÉ: { label: "FERMÉ", color: "#B4B2A9", bg: "#f5f5f4", icon: <IconActivity size={24} color="#B4B2A9" />, desc: "Boutique fermée" },
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
      {/* ── TITRE + DESCRIPTION ── */}
      <div style={{ marginBottom: "16px", padding: "0 28px" }}>
        <h1 style={{ fontSize:"1.8rem", fontWeight:800, color:INK,
                     letterSpacing:"-0.03em", lineHeight:1.1, margin:0 }}>
          Alertes & <span style={{ color: ORANGE }}>Stock</span>
        </h1>
        <p style={{ color:MUTED, fontSize:"0.82rem", marginTop:"6px",
                    maxWidth:"640px", lineHeight:1.5 }}>
          Prévision estivale 2026, seuils de vigilance et recommandations de commande.
        </p>
      </div>

      {/* ── MINI KPIs ── */}
      <div style={{ margin: "0 28px 12px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14,
                      padding:"14px 18px", borderRadius:"14px",
                      background:"#fff",
                      border:"1px solid rgba(200,140,100,0.18)",
                      boxShadow:"0 2px 12px rgba(0,0,0,0.06)" }}>
          <div>
            <div style={{ fontSize: ".62rem", color: MUTED, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 2 }}>
              Articles prévus
            </div>
            <div style={{ fontSize: "1.35rem", fontWeight: 800, color: INK }}>
              {fmt(kpis.total_articles)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: ".62rem", color: MUTED, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 2 }}>
              CA prévu
            </div>
            <div style={{ fontSize: "1.35rem", fontWeight: 800, color: ORANGE }}>
              {fmt(kpis.ca_total_prevu)} €
            </div>
          </div>
          <div>
            <div style={{ fontSize: ".62rem", color: MUTED, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 2 }}>
              Impact financier
            </div>
            <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#E24B4A" }}>
              {fmt(kpis.ca_risque)} €
            </div>
          </div>
        </div>
      </div>

      <div className="sw">
        <div style={{ background: "rgba(200,134,10,0.06)", borderLeft: "4px solid #C8860A", padding: "16px 20px", borderRadius: "0 12px 12px 0", fontSize: "0.75rem", color: "#5a3010", marginBottom: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
          <IconAlertTriangle size={16} color="#C8860A" />
          <strong>Précision méthodologique :</strong> Ces alertes représentent un niveau de risque estimé à partir des prévisions de demande et de la politique de stock de référence (2 jours). Elles ne préjugent pas du stock physique réel en boutique.
        </div>
      </div>

      {/* ── ARTICLES PRÉVUS AVEC ALERTES ── */}
      <div className="sec-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <IconPackage size={18} color={ORANGE} />
        Articles Prévis avec Alertes
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
                  <div style={{ fontSize: "0.75rem", fontWeight: 800, color: cfg.color, letterSpacing: "0.05em" }}>{cfg.label}</div>
                  <div style={{ fontSize: "1.8rem", fontWeight: 800, color: INK, margin: "8px 0" }}>{count}</div>
                  <div style={{ fontSize: "0.65rem", color: MUTED }}>{cfg.desc}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="sw" style={{ marginBottom: "16px" }}>
        <div className="cc" style={{ 
          padding:"16px 20px", borderRadius:"14px",
          background: "#FDF6EC",
          border:"1px solid rgba(196,168,130,.25)",
          boxShadow:"0 4px 16px rgba(0,0,0,0.15)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.75rem", fontWeight: 700, color: INK, textTransform: "uppercase", letterSpacing: "0.05em", borderRight: "1px solid #f2e9e1", paddingRight: "16px" }}>
            <IconCalendarDays size={16} color={ORANGE} />
            Période
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
        </div>
      </div>

      <div className="sec-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <IconActivity size={18} color={ORANGE} />
        Demande Prévue & Niveaux de Risque
      </div>
      <div className="sw">
        <div className="cc">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
            <div>
              <div className="ct">Demande Prévue et Niveaux d'Alerte</div>
              <div className="cs">Quantité d'articles par jour</div>
            </div>
            <div style={{ display: "flex", gap: "12px", fontSize: "0.65rem", fontWeight: 700, color: MUTED }}>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><IconXCircle size={12} color="#E24B4A" />Rupture</span>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><IconAlertTriangle size={12} color="#EF9F27" />Vigilance</span>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><IconCheckCircle size={12} color="#639922" />Normal</span>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><IconCircleDot size={12} color="#378ADD" />Surstock</span>
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

      <div className="sec-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <IconBolt size={18} color={ORANGE} />
        Détail Opérationnel
      </div>
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

      {/* ── AGENT ZONE ── */}
      <div className="sec-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <IconRobot size={18} color={ORANGE} />
        Assistant Intelligent
      </div>
      <div className="sw">
        <div className="cc">
          <div style={{ 
            background: "linear-gradient(135deg, #FFF5F5, #FFE8E8)", 
            border: "2px solid #E24B4A", 
            borderRadius: "14px", 
            padding: "20px",
            marginBottom: "16px"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
              <IconAlertTriangle size={24} color="#E24B4A" />
              <h4 style={{ color: "#E24B4A", margin: 0, fontSize: "1rem", fontWeight: 700 }}>Risques identifiés</h4>
            </div>
            <ul style={{ color: "#555", lineHeight: "1.8", margin: 0, paddingLeft: "20px" }}>
              <li><strong>{statuts['RUPTURE']} jours</strong> à risque de rupture stock</li>
              <li>CA à risque : <strong>{fmt(kpis.ca_risque)} €</strong> ({((kpis.ca_risque / kpis.ca_total_prevu) * 100).toFixed(1)}% du CA prévu)</li>
              <li>Pic absolu prévu le <strong>{kpis.pic_date}</strong> → <strong>{fmt(kpis.pic_val)} articles</strong></li>
            </ul>
          </div>

          <div style={{ 
            background: "linear-gradient(135deg, #F0FFF5, #E0FFE8)", 
            border: "2px solid #27AE60", 
            borderRadius: "14px", 
            padding: "20px"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
              <IconCheckCircle size={24} color="#27AE60" />
              <h4 style={{ color: "#27AE60", margin: 0, fontSize: "1rem", fontWeight: 700 }}>Actions recommandées</h4>
            </div>
            <ul style={{ color: "#555", lineHeight: "1.8", margin: 0, paddingLeft: "20px" }}>
              <li>Il est recommandé de renforcer les commandes <strong>48h avant</strong> les jours de pic</li>
              <li>Le système suggère d'anticiper <strong>Juillet–Août</strong> (saison touristique)</li>
              <li>Les données indiquent une vigilance possible pour activer les offres groupées</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
