"use client";

import { DailyKPIs, HourlyData } from "@/types/kpis";
import React from "react";

const ORANGE = "#E8734A";
const PEACH = "#F0A882";
const LIGHT = "#FAD4C4";
const INK = "#1C1410";
const MUTED = "#9a8070";
const GRID = "rgba(200,140,100,0.13)";
const PAL = [
  ORANGE,
  PEACH,
  "#e05c35",
  "#f5c4a8",
  LIGHT,
  "#c45030",
  "#fad8c0",
  "#d4724a",
  "#fbe8d8",
  "#b84028",
];

function fmt(n: number, dec = 0) {
  return Number(n || 0).toLocaleString("fr-FR", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
}

/* ──────────────────────────────────────────────────── 
   SPARKLINE BLANC (Reports card)
──────────────────────────────────────────────────── */
function Sparkline({
  data,
  height = 55,
}: {
  data: HourlyData[];
  height?: number;
}) {
  if (!data || data.length < 2) return null;
  const W = 260;
  const H = height;
  const pad = 2;
  const vals = data.map((d) => d.ca);
  const max = Math.max(...vals, 1);
  const pts = vals.map((v, i) => ({
    x: pad + (i / (vals.length - 1)) * (W - pad * 2),
    y: pad + (H - pad * 2) * (1 - v / max),
  }));
  let path = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const c1x = pts[i].x + (pts[i + 1].x - pts[i].x) * 0.5;
    const c1y = pts[i].y;
    const c2x = pts[i].x + (pts[i + 1].x - pts[i].x) * 0.5;
    const c2y = pts[i + 1].y;
    path += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${pts[i + 1].x} ${pts[i + 1].y}`;
  }
  const area = `${path} L ${pts[pts.length - 1].x} ${H} L ${pts[0].x} ${H} Z`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height }}
      preserveAspectRatio="none"
    >
      <path d={area} fill="rgba(255,255,255,0.12)" />
      <path
        d={path}
        fill="none"
        stroke="rgba(255,255,255,0.70)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ──────────────────────────────────────────────────── 
   GAUGE VITESSE (fig_g)
──────────────────────────────────────────────────── */
function VitesseGauge({ vitesse }: { vitesse: number }) {
  const vit_max = Math.max(vitesse * 1.7, 25);
  const pct = Math.min((vitesse / vit_max) * 100, 100);

  return (
    <div className="w-full flex flex-col items-center justify-end" style={{ height: 130 }}>
      <svg viewBox="0 0 200 115" className="w-full" style={{ height: 115 }}>
        {/* Background arc steps */}
        <path
          d="M 25 100 A 75 75 0 0 1 175 100"
          fill="none"
          stroke="#fdf0ea"
          strokeWidth="16"
          strokeLinecap="round"
        />
        <path
          d="M 25 100 A 75 75 0 0 1 175 100"
          fill="none"
          stroke="#fad8c8"
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={`${2.356 * 72} ${2.356 * 100}`}
        />
        {/* Value bar */}
        <path
          d="M 25 100 A 75 75 0 0 1 175 100"
          fill="none"
          stroke={ORANGE}
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={`${2.356 * pct} ${2.356 * 100}`}
        />
        {/* Threshold line */}
        <line
          x1="142"
          y1="46"
          x2="152"
          y2="38"
          stroke="#b84020"
          strokeWidth="2.5"
        />
      </svg>
    </div>
  );
}

/* ──────────────────────────────────────────────────── 
   TREEMAP PRODUITS (fig_tree)
──────────────────────────────────────────────────── */
function Treemap({
  products,
}: {
  products: Array<{ article: string; quantity?: number }>;
}) {
  const total = products.reduce((s, p) => s + (p.quantity || 0), 0) || 1;
  return (
    <div className="w-full flex flex-wrap gap-1 content-start overflow-hidden" style={{ height: 140 }}>
      {products.slice(0, 8).map((p, i) => {
        const pct = Math.max(10, ((p.quantity || 0) / total) * 100);
        return (
          <div
            key={i}
            className="flex items-center justify-center text-center rounded text-white font-semibold transition-all shadow-sm"
            style={{
              background: PAL[i % PAL.length],
              fontSize: ".64rem",
              padding: "4px 6px",
              flexBasis: `calc(${Math.min(pct * 1.7, 48)}% - 4px)`,
              flexGrow: 1,
              minHeight: "42px",
            }}
            title={`${p.article}: ${p.quantity} unités`}
          >
            <span className="truncate">{p.article.slice(0, 14)}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ──────────────────────────────────────────────────── 
   PLOTLY-STYLE BAR CHART (fig_hb, fig_qte, fig_tkt, fig_ca)
──────────────────────────────────────────────────── */
function PlotlyBarChart({
  data,
  valueKey,
  unit = "",
  height = 160,
}: {
  data: HourlyData[];
  valueKey: keyof HourlyData;
  unit?: string;
  height?: number;
}) {
  const vals = data.map((d) => Number(d[valueKey]) || 0);
  const max = Math.max(...vals, 1);

  return (
    <div style={{ height }} className="w-full flex flex-col justify-between pt-2">
      <div className="flex items-end gap-1.5 flex-1 w-full relative">
        {/* Horizontal grid lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-40">
          <div className="w-full border-b border-[#e2d5c8] border-dashed" />
          <div className="w-full border-b border-[#e2d5c8] border-dashed" />
          <div className="w-full border-b border-[#e2d5c8]" />
        </div>

        {data.map((d, i) => {
          const v = vals[i];
          const isMax = v === max;
          const pct = Math.max(3, (v / max) * 100);
          return (
            <div
              key={i}
              className="flex-1 flex flex-col items-center justify-end h-full group relative z-10 cursor-pointer"
            >
              {/* Tooltip */}
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-[#1C1410] text-white text-[9px] font-bold py-0.5 px-1.5 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-30 shadow">
                {d.heure} : {fmt(v)} {unit}
              </div>
              <div
                className="w-full rounded-t-sm transition-all"
                style={{
                  height: `${pct}%`,
                  background: isMax ? ORANGE : LIGHT,
                }}
              />
            </div>
          );
        })}
      </div>

      {/* X Axis */}
      <div className="flex justify-between mt-1.5 pt-1 border-t border-[#f0ece6] text-[8px] font-semibold" style={{ color: MUTED }}>
        {data
          .filter((_, i) => i === 0 || i === Math.floor(data.length / 2) || i === data.length - 1)
          .map((d, i) => (
            <span key={i}>{d.heure}</span>
          ))}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────── 
   PLOTLY-STYLE AREA LINE CHART (fig_pan, fig_cum)
──────────────────────────────────────────────────── */
function PlotlyAreaChart({
  data,
  valueKey,
  color = ORANGE,
  unit = "",
  height = 160,
}: {
  data: HourlyData[];
  valueKey: keyof HourlyData;
  color?: string;
  unit?: string;
  height?: number;
}) {
  if (!data || data.length < 2) return null;
  const W = 320;
  const H = height - 26;
  const pad = 6;
  const vals = data.map((d) => Number(d[valueKey]) || 0);
  const max = Math.max(...vals, 1);
  const pts = vals.map((v, i) => ({
    x: pad + (i / (vals.length - 1)) * (W - pad * 2),
    y: pad + (H - pad * 2) * (1 - v / max),
  }));

  let path = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    path += ` C ${mx} ${pts[i].y}, ${mx} ${pts[i + 1].y}, ${pts[i + 1].x} ${pts[i + 1].y}`;
  }
  const area = `${path} L ${pts[pts.length - 1].x} ${H} L ${pts[0].x} ${H} Z`;

  return (
    <div style={{ height }} className="w-full flex flex-col justify-between pt-2">
      <div className="relative flex-1 w-full">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none">
          <path
            d={area}
            fill={color === ORANGE ? "rgba(232,115,74,0.10)" : "rgba(240,168,130,0.10)"}
          />
          <path
            d={path}
            fill="none"
            stroke={color}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {pts.map((pt, i) => (
            <circle
              key={i}
              cx={pt.x}
              cy={pt.y}
              r="3"
              fill={color}
              stroke="white"
              strokeWidth="1.2"
            />
          ))}
        </svg>
      </div>

      <div className="flex justify-between mt-1.5 pt-1 border-t border-[#f0ece6] text-[8px] font-semibold" style={{ color: MUTED }}>
        {data
          .filter((_, i) => i === 0 || i === Math.floor(data.length / 2) || i === data.length - 1)
          .map((d, i) => (
            <span key={i}>{d.heure}</span>
          ))}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────── 
   HERO + 4 CARTES (Structure identique à app.py)
──────────────────────────────────────────────────── */
export function Hero({ kpis }: { kpis: DailyKPIs }) {
  const v_text = kpis.vitesse >= 20 ? "Forte" : kpis.vitesse <= 5 ? "Faible" : "Normale";
  const v_badge_bg =
    kpis.vitesse >= 20
      ? "rgba(232, 115, 74, 0.08)"
      : kpis.vitesse <= 5
      ? "rgba(154, 128, 112, 0.08)"
      : "rgba(122, 106, 90, 0.08)";
  const v_badge_color =
    kpis.vitesse >= 20 ? ORANGE : kpis.vitesse <= 5 ? MUTED : "#7a6a5a";

  const paire_texte = kpis.top_pairs[0]
    ? `${kpis.top_pairs[0].pa.slice(0, 12)} + ${kpis.top_pairs[0].pb.slice(0, 12)}`
    : "Aucune paire";
  const top_prod_name = kpis.top_qte[0]?.article || "Aucun";

  const delta = Number(kpis.delta_vs_moy || 0);
  const trend_text =
    delta >= 10
      ? `CA +${delta.toFixed(1)}% vs moyenne`
      : delta <= -10
      ? `CA ${delta.toFixed(1)}% vs moyenne`
      : `CA dans la normale (${delta > 0 ? "+" : ""}${delta.toFixed(1)}%)`;

  const top3 = kpis.top_qte.slice(0, 3);
  const mx_cnt = kpis.top_pairs[0]?.cnt || 1;

  return (
    <div className="outer">
      {/* ── HERO SECTION ── */}
      <div className="hero">
        <div className="hero-ov" />

        {/* NavBar */}
        <div className="hero-bar">
          <div className="logo-pill">
            <div className="logo-sq">🥐</div>
            Le Croisic
          </div>
        </div>

        {/* Titre + Boutons icônes */}
        <div className="hero-title-wrap">
          <div className="h-title">Vue du Jour</div>
          <div className="h-sub">
            {kpis.jour_str} &nbsp;·&nbsp; {kpis.date_str}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 22 }}>
            {/* Cloche d'alertes */}
            <div className="icon-btn">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <div className="icon-badge">{kpis.alerts_count}</div>
            </div>
            {/* Copilot IA */}
            <div className="icon-btn">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                <path d="M5 3v4" />
                <path d="M19 17v4" />
                <path d="M3 5h4" />
                <path d="M17 19h4" />
              </svg>
            </div>
          </div>
        </div>

        {/* Reports Card */}
        <div className="reports-card">
          <div className="rc-hdr">
            <span className="rc-title">Rapports</span>
            <span className="rc-badge">Journée</span>
          </div>
          <div className="rc-kpis">
            <div>
              <div className="rc-lbl">Chiffre d'affaires</div>
              <div className="rc-val">{fmt(kpis.ca_jour)} EUR</div>
            </div>
            <div>
              <div className="rc-lbl">Tickets</div>
              <div className="rc-val">{kpis.tickets}</div>
            </div>
          </div>
          <div className="rc-sub">
            Panier moy. {fmt(kpis.panier, 2)} EUR &nbsp;·&nbsp; Pic {String(kpis.peak_h).padStart(2, "0")}h
          </div>
          <Sparkline data={kpis.hourly_data} height={55} />
        </div>
      </div>

      {/* ── 4 CARTES DU BAS ── */}
      <div className="cards-row">
        {/* Carte 1 : État de la journée */}
        <div className="bc">
          <div className="bc-title">État de la journée</div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
            {/* Row 1 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "7px 10px",
                background: "rgba(232, 115, 74, 0.04)",
                borderRadius: 8,
              }}
            >
              <div>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={ORANGE}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              </div>
              <div style={{ fontSize: ".70rem", color: INK, lineHeight: 1.2 }}>
                <strong style={{ color: ORANGE }}>Activité {v_text.toLowerCase()}</strong>
                <br />
                <span style={{ color: MUTED }}>{Number(kpis.vitesse || 0).toFixed(1)} art/h</span>
              </div>
            </div>

            {/* Row 2 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "7px 10px",
                background: "rgba(232, 115, 74, 0.04)",
                borderRadius: 8,
              }}
            >
              <div>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={ORANGE}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
              </div>
              <div style={{ fontSize: ".70rem", color: INK, lineHeight: 1.2 }}>
                <strong style={{ color: ORANGE }}>Paire forte</strong>
                <br />
                <span style={{ color: MUTED }}>{paire_texte}</span>
              </div>
            </div>

            {/* Row 3 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "7px 10px",
                background: "rgba(232, 115, 74, 0.04)",
                borderRadius: 8,
              }}
            >
              <div>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={ORANGE}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </div>
              <div style={{ fontSize: ".70rem", color: INK, lineHeight: 1.2 }}>
                <strong style={{ color: ORANGE }}>Top Produit</strong>
                <br />
                <span style={{ color: MUTED }}>{top_prod_name.slice(0, 18)}</span>
              </div>
            </div>

            {/* Row 4 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "7px 10px",
                background: "rgba(232, 115, 74, 0.04)",
                borderRadius: 8,
              }}
            >
              <div>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={delta >= 0 ? ORANGE : MUTED}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline
                    points={
                      delta >= 0
                        ? "22 7 13.5 15.5 8.5 10.5 2 17"
                        : "22 17 13.5 8.5 8.5 13.5 2 7"
                    }
                  />
                  <polyline
                    points={
                      delta >= 0
                        ? "16 7 22 7 22 13"
                        : "16 17 22 17 22 11"
                    }
                  />
                </svg>
              </div>
              <div style={{ fontSize: ".70rem", color: INK, lineHeight: 1.2 }}>
                <strong style={{ color: ORANGE }}>Journée</strong>
                <br />
                <span style={{ color: MUTED }}>{trend_text}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Carte 2 : Vitesse des Ventes */}
        <div className="bc">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 2 }}>
            <div className="bc-title">Vitesse des Ventes</div>
            <div
              style={{
                background: v_badge_bg,
                color: v_badge_color,
                borderRadius: 99,
                padding: "3px 8px",
                fontSize: ".62rem",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              ↗ {v_text}
            </div>
          </div>
          <div style={{ marginBottom: 2 }}>
            <span className="bc-big">{Number(kpis.vitesse || 0).toFixed(1)}</span>
            <span style={{ fontSize: ".72rem", color: MUTED, marginLeft: 4, fontWeight: 600 }}>art / h</span>
            <div style={{ fontSize: ".66rem", color: MUTED, marginTop: 2 }}>Cadence de la journée</div>
          </div>
          <div style={{ flex: 1, display: "flex", alignItems: "flex-end" }}>
            <VitesseGauge vitesse={kpis.vitesse} />
          </div>
        </div>

        {/* Carte 3 : Top Produits */}
        <div className="bc">
          <div className="bc-title">Top Produits</div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <Treemap products={kpis.top_qte} />
          </div>
          <div className="leg-row">
            {top3.map((p, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: ".68rem",
                  color: "#5a4a3a",
                  fontWeight: 500,
                }}
              >
                <div
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: PAL[i],
                    flexShrink: 0,
                  }}
                />
                {p.article.slice(0, 14)} &nbsp;
                <strong>{fmt(p.quantity || 0)}</strong>
              </div>
            ))}
          </div>
        </div>

        {/* Carte 4 : Top Combinaisons */}
        <div className="bc">
          <div className="bc-title">Top Combinaisons</div>
          <div style={{ flex: 1, overflow: "hidden", marginTop: 6 }}>
            {kpis.top_pairs.slice(0, 5).map((p, i) => {
              const bw = Math.max(4, Math.round((p.cnt / mx_cnt) * 50));
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "5px 0",
                    borderBottom: "1px solid #f5f0ea",
                  }}
                >
                  <span
                    style={{
                      fontSize: ".70rem",
                      color: INK,
                      fontWeight: 500,
                      flex: 1,
                      minWidth: 0,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {p.pa.slice(0, 13)} + {p.pb.slice(0, 13)}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0, marginLeft: 6 }}>
                    <div
                      style={{
                        width: bw,
                        height: 4,
                        background: ORANGE,
                        borderRadius: 99,
                        opacity: 0.7,
                      }}
                    />
                    <span
                      style={{
                        fontSize: ".68rem",
                        fontWeight: 700,
                        color: "#c05030",
                        background: "#fdf0ea",
                        borderRadius: 4,
                        padding: "1px 5px",
                      }}
                    >
                      {p.cnt}x
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────── 
   SECTIONS ANALYTIQUES (Identique à app.py)
──────────────────────────────────────────────────── */
function ProdRows({
  products,
  col,
}: {
  products: Array<Record<string, any>>;
  col: string;
}) {
  const mv = products[0]?.[col] || 1;
  return (
    <div className="prod-list">
      {products.slice(0, 8).map((row, i) => {
        const pct = row[col] / mv;
        const bw = Math.max(3, Math.round(pct * 52));
        const c = PAL[i % PAL.length];
        const name = String(row.article).slice(0, 22);
        return (
          <div key={i} className="prod-row">
            <div className="prod-nm">
              <div className="pdot" style={{ background: c }} />
              <span>{name}</span>
            </div>
            <div className="pbar-w">
              <div className="pbar" style={{ width: bw, background: c }} />
            </div>
            <span className="pval">{fmt(row[col])}</span>
          </div>
        );
      })}
    </div>
  );
}

export function AnalyticsSections({ kpis }: { kpis: DailyKPIs }) {
  const catTotal = kpis.categories.reduce((s, c) => s + c.total_revenue, 0) || 1;
  const nb_total = Math.max(kpis.tickets, 1);
  const s1 = Math.max(15, Math.round((kpis.nb_mono / nb_total) * 55));
  const s2 = Math.max(8, Math.round((kpis.nb_multi / nb_total) * 30));
  const s3 = 20;

  return (
    <div style={{ paddingBottom: 24 }}>
      {/* ── Section 1 : Rythme de la journée ── */}
      <div className="sec-title">Rythme de la journée</div>
      <div className="sw">
        <div className="g3">
          <div className="cc">
            <div className="ct">Quantités par Heure</div>
            <div className="cs">Total : {fmt(kpis.qte_jour)} unités</div>
            <PlotlyBarChart data={kpis.hourly_data} valueKey="qte" unit="unités" />
          </div>
          <div className="cc">
            <div className="ct">Tickets par Heure</div>
            <div className="cs">Nombre de transactions</div>
            <PlotlyBarChart data={kpis.hourly_data} valueKey="tkt" unit="tickets" />
          </div>
          <div className="cc">
            <div className="ct">Panier Moyen par Heure</div>
            <div className="cs">Moy. journée : {fmt(kpis.panier, 2)} EUR</div>
            <PlotlyAreaChart data={kpis.hourly_data} valueKey="panier_h" color={PEACH} unit="EUR" />
          </div>
        </div>
      </div>

      {/* ── Section 2 : CA Horaire ── */}
      <div className="sec-title">Chiffre d'Affaires Horaire</div>
      <div className="sw">
        <div className="g2">
          <div className="cc">
            <div className="ct">CA Cumulé</div>
            <div className="cs">Progression sur la journée</div>
            <PlotlyAreaChart data={kpis.hourly_data} valueKey="ca_cum" color={ORANGE} unit="EUR" height={180} />
          </div>
          <div className="cc">
            <div className="ct">CA par Heure</div>
            <div className="cs">Pic d'activité : {String(kpis.peak_h).padStart(2, "0")}h</div>
            <PlotlyBarChart data={kpis.hourly_data} valueKey="ca" unit="EUR" height={180} />
          </div>
        </div>
      </div>

      {/* ── Section 3 : Top produits du jour ── */}
      <div className="sec-title">Top produits du jour</div>
      <div className="sw">
        <div className="g3">
          <div className="cc">
            <div className="ct">Plus vendus en quantité</div>
            <div className="cs">Unités</div>
            <ProdRows products={kpis.top_qte} col="quantity" />
          </div>
          <div className="cc">
            <div className="ct">Plus générateurs de CA</div>
            <div className="cs">EUR</div>
            <ProdRows products={kpis.top_ca} col="total_revenue" />
          </div>
          <div className="cc">
            <div className="ct">Présents dans le plus de tickets</div>
            <div className="cs">Tickets</div>
            <ProdRows products={kpis.top_tkt} col="nb_tkt" />
          </div>
        </div>
      </div>

      {/* ── Section 4 : Mix et catégories ── */}
      <div className="sec-title">Mix et catégories</div>
      <div className="sw">
        <div className="g2">
          <div className="cc">
            <div className="ct">Répartition par catégorie</div>
            <div className="cs">CA par famille de produits</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
              {kpis.categories.map((c, i) => {
                const pct = (c.total_revenue / catTotal) * 100;
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: PAL[i % PAL.length],
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: ".74rem",
                        fontWeight: 500,
                        color: INK,
                        flex: 1,
                        minWidth: 0,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {c.category}
                    </span>
                    <div style={{ width: 100, height: 6, background: "#f0ece6", borderRadius: 99, flexShrink: 0 }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: PAL[i % PAL.length], borderRadius: 99 }} />
                    </div>
                    <span style={{ fontSize: ".74rem", fontWeight: 700, color: "#5a4a3a", width: 36, textAlign: "right" }}>
                      {pct.toFixed(0)}%
                    </span>
                    <span style={{ fontSize: ".74rem", fontWeight: 700, color: MUTED, width: 70, textAlign: "right" }}>
                      {fmt(c.total_revenue)} €
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="cc">
            <div className="ct">Statut des Ventes</div>
            <div className="cs">Tickets du jour</div>
            <div
              style={{
                background: "#fdf5f0",
                borderRadius: 11,
                padding: "8px 12px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <span style={{ fontSize: ".82rem", fontWeight: 600, color: "#5a3820" }}>
                Tickets : <span style={{ fontSize: "1.05rem", fontWeight: 800, color: ORANGE }}>{kpis.tickets}</span>
              </span>
              <div
                style={{
                  width: 22,
                  height: 22,
                  background: ORANGE,
                  color: "white",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: ".75rem",
                  fontWeight: 700,
                }}
              >
                ↗
              </div>
            </div>
            <div style={{ display: "flex", gap: 5, marginBottom: 12 }}>
              <div style={{ height: 42, borderRadius: 10, background: ORANGE, flex: s1 }} />
              <div
                style={{
                  height: 42,
                  borderRadius: 10,
                  background: `linear-gradient(90deg, ${ORANGE}, ${PEACH})`,
                  opacity: 0.65,
                  flex: s2,
                }}
              />
              <div style={{ height: 42, borderRadius: 10, background: LIGHT, flex: s3 }} />
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: ".70rem", color: "#5a4a3a", fontWeight: 500 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: ORANGE }} />
                CA : {fmt(kpis.ca_jour)}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: ".70rem", color: "#5a4a3a", fontWeight: 500 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: PEACH }} />
                Multi : {kpis.nb_multi}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: ".70rem", color: "#5a4a3a", fontWeight: 500 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: LIGHT, border: `1px solid ${PEACH}` }} />
                Mono : {kpis.nb_mono}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="pf">
        <span>
          Boulangerie Le Croisic &nbsp;·&nbsp; POS &nbsp;·&nbsp; {fmt(kpis.total_lignes)} lignes &nbsp;·&nbsp; {kpis.date_str}
        </span>
        <span>Données historiques — pas le stock réel</span>
      </div>
    </div>
  );
}
