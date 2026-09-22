"use client";

import React, { useEffect, useState } from "react";
import {
  fetchPenetration,
  fetchVelocity,
  fetchTicketContribution,
  fetchFrequency,
  fetchAssociations,
} from "@/lib/api";

const ORANGE = "#E8734A";
const INK = "#1C1410";
const MUTED = "#9a8070";
const PAL = [ORANGE, "#F0A882", "#e05c35", "#f5c4a8", "#c45030", "#fad8c0", "#d4724a"];

function fmt(n: number, dec = 0) {
  return Number(n || 0).toLocaleString("fr-FR", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
}

export default function ProduitsPage() {
  const [tab, setTab] = useState<"pen" | "vel" | "ticket" | "freq" | "assoc">("pen");
  const [loading, setLoading] = useState(false);

  // Sub-states
  const [penData, setPenData] = useState<any>(null);
  const [searchPen, setSearchPen] = useState("");
  const [velData, setVelData] = useState<any>(null);
  const [ticketData, setTicketData] = useState<any>(null);
  const [freqData, setFreqData] = useState<any>(null);
  const [assocData, setAssocData] = useState<any>(null);
  const [assocSort, setAssocSort] = useState("Lift ↓");

  // Load active tab data
  useEffect(() => {
    setLoading(true);
    if (tab === "pen") {
      fetchPenetration({ search: searchPen }).then((res) => { setPenData(res); setLoading(false); });
    } else if (tab === "vel") {
      fetchVelocity().then((res) => { setVelData(res); setLoading(false); });
    } else if (tab === "ticket") {
      fetchTicketContribution().then((res) => { setTicketData(res); setLoading(false); });
    } else if (tab === "freq") {
      fetchFrequency().then((res) => { setFreqData(res); setLoading(false); });
    } else if (tab === "assoc") {
      fetchAssociations(assocSort, 25).then((res) => { setAssocData(res); setLoading(false); });
    }
  }, [tab, searchPen, assocSort]);

  return (
    <div style={{ paddingBottom: "40px" }}>
      {/* ── Page Header ── */}
      <div style={{ padding: "32px 28px 16px" }}>
        <h1 style={{ fontSize: "2.2rem", fontWeight: 800, color: INK, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
          Analyse Produits
        </h1>
        <p style={{ color: MUTED, fontSize: "0.85rem", marginTop: "8px" }}>
          Pénétration, vélocité, contribution ticket, réachat et associations Apriori
        </p>
      </div>

      {/* ── 5 Tabs Selector Bar ── */}
      <div className="sw" style={{ marginBottom: "16px" }}>
        <div style={{ display: "flex", gap: "16px", borderBottom: "2px solid #f2e9e1", paddingBottom: "12px", overflowX: "auto" }}>
          {[
            { id: "pen", label: "🎯 Pénétration", sub: "Présence dans les tickets" },
            { id: "vel", label: "⚡ Vitesse de Vente", sub: "Cadence journalière & horaire" },
            { id: "ticket", label: "🧾 Contribution Ticket", sub: "Rôle dans les paniers" },
            { id: "freq", label: "🔄 Fréquence d'Achat", sub: "Régularité de réachat" },
            { id: "assoc", label: "🔗 Associations", sub: "Paires & règles Apriori" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                padding: "8px 12px",
                background: tab === t.id ? "white" : "transparent",
                border: tab === t.id ? "1px solid #f2e9e1" : "1px solid transparent",
                borderRadius: "12px",
                boxShadow: tab === t.id ? "0 4px 12px rgba(80,40,10,0.06)" : "none",
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              <span style={{ fontSize: "0.85rem", fontWeight: 800, color: tab === t.id ? ORANGE : INK }}>{t.label}</span>
              <span style={{ fontSize: "0.65rem", color: MUTED }}>{t.sub}</span>
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="sw" style={{ padding: "40px 28px", color: MUTED, fontSize: "0.9rem", fontWeight: 600 }}>
          Analyse en cours...
        </div>
      )}

      {/* ── Tab 1: Pénétration ── */}
      {tab === "pen" && penData && !loading && (
        <>
          <div className="sec-title">Taux de Pénétration (Tickets)</div>
          <div className="sw">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "16px" }}>
              <div className="cc"><div className="ct">Total Références</div><div style={{ fontSize: "1.6rem", fontWeight: 800, color: INK }}>{penData.kpis?.total_articles}</div></div>
              <div className="cc"><div className="ct">Pénétration Max</div><div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#639922" }}>{penData.kpis?.pen_max}%</div></div>
              <div className="cc"><div className="ct">Pénétration Médiane</div><div style={{ fontSize: "1.6rem", fontWeight: 800, color: ORANGE }}>{penData.kpis?.pen_median}%</div></div>
              <div className="cc"><div className="ct">Statut Phare</div><div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#C8860A" }}>{penData.kpis?.status_counts?.["Produit Phare (Dominant)"] || 0}</div></div>
            </div>

            <div className="cc" style={{ marginBottom: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ fontSize: "1rem" }}>🔍</span>
                <input
                  type="text"
                  placeholder="Rechercher un produit (ex: baguette)..."
                  value={searchPen}
                  onChange={(e) => setSearchPen(e.target.value)}
                  style={{ flex: 1, border: "none", outline: "none", fontSize: "0.85rem", fontWeight: 600, color: INK }}
                />
              </div>
            </div>

            <div className="cc">
              <div className="ct">Classement par Pénétration</div>
              <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "16px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #f2e9e1", color: MUTED, fontSize: "0.7rem", textTransform: "uppercase", textAlign: "right" }}>
                    <th style={{ textAlign: "left", paddingBottom: "8px" }}>Produit</th>
                    <th style={{ paddingBottom: "8px" }}>Catégorie</th>
                    <th style={{ paddingBottom: "8px" }}>Pénétration</th>
                    <th style={{ paddingBottom: "8px" }}>Tickets</th>
                    <th style={{ paddingBottom: "8px" }}>Statut Stratégique</th>
                  </tr>
                </thead>
                <tbody>
                  {penData.items?.slice(0, 30).map((p: any, i: number) => (
                    <tr key={i} style={{ borderBottom: "1px solid #fdfcfb" }}>
                      <td style={{ padding: "10px 0", fontSize: "0.8rem", fontWeight: 700, color: INK }}>{p.article}</td>
                      <td style={{ padding: "10px 0", textAlign: "right", fontSize: "0.75rem", color: MUTED }}>{p.category}</td>
                      <td style={{ padding: "10px 0", textAlign: "right", fontSize: "0.85rem", fontWeight: 800, color: ORANGE }}>{Number(p.penetration_rate || 0).toFixed(1)}%</td>
                      <td style={{ padding: "10px 0", textAlign: "right", fontSize: "0.75rem", fontWeight: 700, color: INK }}>{fmt(p.tickets_count)}</td>
                      <td style={{ padding: "10px 0", textAlign: "right" }}>
                        <span style={{ fontSize: "0.65rem", fontWeight: 700, background: "#f2ede6", padding: "3px 8px", borderRadius: "12px", color: INK }}>{p.statut}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Tab 2: Vitesse ── */}
      {tab === "vel" && velData && !loading && (
        <>
          <div className="sec-title">Vitesse de Vente & Cadence</div>
          <div className="sw">
            <div className="g2">
              <div className="cc">
                <div className="ct">Vitesse par Jour de la Semaine</div>
                <div className="cs">Articles / jour</div>
                <div className="prod-list" style={{ marginTop: "12px" }}>
                  {velData.dow_velocity?.map((d: any, i: number) => (
                    <div key={i} className="prod-row">
                      <div style={{ width: "80px", fontSize: "0.75rem", fontWeight: 700, color: INK }}>{d.day}</div>
                      <div className="pbar-w" style={{ flex: 1 }}>
                        <div className="pbar" style={{ width: `${Math.min(d.all / 10, 100)}%`, background: ORANGE }} />
                      </div>
                      <span className="pval" style={{ width: "80px", textAlign: "right", color: INK }}>{d.all} art/j</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="cc">
                <div className="ct">Distribution Horaire Globale</div>
                <div className="cs">Micro-vélocité par heure</div>
                <div className="prod-list" style={{ marginTop: "12px" }}>
                  {velData.hourly_distribution?.map((h: any, i: number) => (
                    <div key={i} className="prod-row">
                      <div style={{ width: "60px", fontSize: "0.75rem", fontWeight: 700, color: MUTED }}>{h.label}</div>
                      <div className="pbar-w" style={{ flex: 1 }}>
                        <div className="pbar" style={{ width: `${Math.min(h.qte / 300, 100)}%`, background: "#C8860A" }} />
                      </div>
                      <span className="pval" style={{ width: "60px", textAlign: "right" }}>{fmt(h.qte)} u.</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Tab 3: Contribution au Ticket ── */}
      {tab === "ticket" && ticketData && !loading && (
        <>
          <div className="sec-title">Contribution au Ticket Moyen</div>
          <div className="sw">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "16px" }}>
              <div className="cc"><div className="ct">Tickets Multi-Articles</div><div style={{ fontSize: "1.6rem", fontWeight: 800, color: ORANGE }}>{fmt(ticketData.stats?.nb_multi)}</div><div className="cs">Part : {ticketData.stats?.pct_multi?.toFixed(1)}%</div></div>
              <div className="cc"><div className="ct">Tickets Mono-Article</div><div style={{ fontSize: "1.6rem", fontWeight: 800, color: INK }}>{fmt(ticketData.stats?.nb_mono)}</div></div>
              <div className="cc"><div className="ct">Total Transactions</div><div style={{ fontSize: "1.6rem", fontWeight: 800, color: INK }}>{fmt(ticketData.stats?.nb_total)}</div></div>
            </div>

            <div className="cc">
              <div className="ct">Top 20 Contribution Médiane</div>
              <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "16px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #f2e9e1", color: MUTED, fontSize: "0.7rem", textTransform: "uppercase", textAlign: "right" }}>
                    <th style={{ textAlign: "left", paddingBottom: "8px" }}>Produit</th>
                    <th style={{ paddingBottom: "8px" }}>Contribution Médiane</th>
                    <th style={{ paddingBottom: "8px" }}>Tickets Multi</th>
                    <th style={{ paddingBottom: "8px" }}>CA Total</th>
                  </tr>
                </thead>
                <tbody>
                  {ticketData.top20?.map((p: any, i: number) => (
                    <tr key={i} style={{ borderBottom: "1px solid #fdfcfb" }}>
                      <td style={{ padding: "10px 0", fontSize: "0.8rem", fontWeight: 700, color: INK }}>{p.article}</td>
                      <td style={{ padding: "10px 0", textAlign: "right", fontSize: "0.85rem", fontWeight: 800, color: ORANGE }}>{Number(p.contribution_med || 0).toFixed(1)}%</td>
                      <td style={{ padding: "10px 0", textAlign: "right", fontSize: "0.75rem", fontWeight: 700, color: MUTED }}>{fmt(p.nb_tickets_multi)}</td>
                      <td style={{ padding: "10px 0", textAlign: "right", fontSize: "0.75rem", fontWeight: 700, color: INK }}>{fmt(p.ca_total)} €</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Tab 4: Fréquence d'Achat ── */}
      {tab === "freq" && freqData && !loading && (
        <>
          <div className="sec-title">Régularité & Fréquence de Réachat</div>
          <div className="sw">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px", marginBottom: "16px" }}>
              <div className="cc"><div className="ct">Semaines d'Activité</div><div style={{ fontSize: "1.6rem", fontWeight: 800, color: INK }}>{freqData.total_semaines}</div></div>
              <div className="cc"><div className="ct">Total Références</div><div style={{ fontSize: "1.6rem", fontWeight: 800, color: ORANGE }}>{freqData.nb_produits}</div></div>
            </div>

            <div className="cc">
              <div className="ct">Distribution de la Fréquence Hebdomadaire</div>
              <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "16px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #f2e9e1", color: MUTED, fontSize: "0.7rem", textTransform: "uppercase", textAlign: "right" }}>
                    <th style={{ textAlign: "left", paddingBottom: "8px" }}>Produit</th>
                    <th style={{ paddingBottom: "8px" }}>Semaines Actives</th>
                    <th style={{ paddingBottom: "8px" }}>Fréquence</th>
                    <th style={{ paddingBottom: "8px" }}>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {freqData.items?.slice(0, 30).map((p: any, i: number) => (
                    <tr key={i} style={{ borderBottom: "1px solid #fdfcfb" }}>
                      <td style={{ padding: "10px 0", fontSize: "0.8rem", fontWeight: 700, color: INK }}>{p.article}</td>
                      <td style={{ padding: "10px 0", textAlign: "right", fontSize: "0.8rem", fontWeight: 700, color: INK }}>{p.semaines_actives}</td>
                      <td style={{ padding: "10px 0", textAlign: "right", fontSize: "0.85rem", fontWeight: 800, color: ORANGE }}>{Number(p.repurchase_freq || 0).toFixed(1)}%</td>
                      <td style={{ padding: "10px 0", textAlign: "right" }}>
                        <span style={{ fontSize: "0.65rem", fontWeight: 700, background: "#f2ede6", padding: "3px 8px", borderRadius: "12px", color: INK }}>{p.statut}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Tab 5: Associations ── */}
      {tab === "assoc" && assocData && !loading && (
        <>
          <div className="sec-title">Associations & Règles Apriori</div>
          <div className="sw">
            <div className="cc" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div>
                <div className="ct">Règles Historiques d'Association</div>
                <div className="cs" style={{ marginBottom: 0 }}>{assocData.nb_total_regles} règles avec Support ≥ 1% et Lift ≥ 1.2</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <label style={{ fontSize: "0.75rem", fontWeight: 700, color: MUTED }}>Trier par :</label>
                <select
                  value={assocSort}
                  onChange={(e) => setAssocSort(e.target.value)}
                  style={{ fontSize: "0.75rem", fontWeight: 700, padding: "6px 12px", borderRadius: "8px", border: "1px solid #e2d5c8", background: "#fcfaf8", outline: "none" }}
                >
                  <option value="Lift ↓">Lift ↓</option>
                  <option value="Confiance ↓">Confiance ↓</option>
                  <option value="Support ↓">Support ↓</option>
                </select>
              </div>
            </div>

            <div className="g2">
              {assocData.rules?.map((r: any, i: number) => (
                <div key={i} className="cc" style={{ borderLeft: `4px solid ${r.lift >= 3 ? ORANGE : "#F0A882"}`, padding: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
                    <span style={{ fontSize: "0.65rem", fontWeight: 700, color: MUTED, textTransform: "uppercase" }}>Règle #{i + 1}</span>
                    <span style={{ fontSize: "0.7rem", fontWeight: 800, background: "rgba(232,115,74,0.1)", color: ORANGE, padding: "2px 8px", borderRadius: "6px" }}>Lift : {Number(r.lift || 0).toFixed(2)}×</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "0.8rem", fontWeight: 800, color: INK, marginBottom: "16px" }}>
                    <span style={{ background: "#f2ede6", padding: "4px 8px", borderRadius: "6px" }}>{r.antecedent}</span>
                    <span style={{ color: MUTED }}>➔</span>
                    <span style={{ background: "rgba(232,115,74,0.08)", color: "#b84028", padding: "4px 8px", borderRadius: "6px" }}>{r.consequent}</span>
                  </div>
                  <div style={{ display: "flex", gap: "24px", fontSize: "0.7rem", color: MUTED, borderTop: "1px solid #f2e9e1", paddingTop: "12px" }}>
                    <span>Support: <strong style={{ color: INK }}>{Number(r.support || 0).toFixed(1)}%</strong></span>
                    <span>Confiance: <strong style={{ color: INK }}>{Number(r.confidence || 0).toFixed(1)}%</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
