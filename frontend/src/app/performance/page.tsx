"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ExpertNote } from "@/components/Expert";
import { colors } from "@/lib/theme";
import { fetchPerformance } from "@/lib/api";
import { tr, trData, locale } from "@/lib/i18n";
import {
  IconTrendUp, IconTrophy, IconCalendar, IconTag, IconFilter,
  IconCash, IconTicket, IconCart, IconCalendarDays, IconBox,
  IconClock, IconGrid, IconArrowMaxUp, IconArrowMinDown,
  IconBar, IconPin, IconSparkline, IconScale, IconBarsGrouped,
  ink, muted, stroke, strokeAlt
} from "@/components/Icons";
import { ChartAssistantButton } from "@/components/ChartAssistantButton";
import { useChat } from "@/contexts/ChatContext";

/* ════════════════════════════════════════════════
   PALETTE (identique Vue du Jour + tons chauds)
   ════════════════════════════════════════════════ */
const ORANGE = stroke;                 // "#2E7D4F"
const PEACH = strokeAlt;               // "#8DC05A"
const LIGHT = colors.accentPale;
const INK = ink;                       // "#1E2420"
const MUTED = muted;                   // "#6E756F"
const C1 = colors.beige;                  // beige foncé
const C2 = colors.gold;                  // doré
const C3 = colors.amberLight;                  // ambre
const PANIER = colors.green;
const TICKETS = colors.blue;
const PAPER = colors.paper;               // fond crème carte (opaque)
const PAPER_2 = colors.paper2;
const PALETTE: string[] = ["#2E7D4F", "#8DC05A", "#A0694A", "#D4A52A", "#B5527A", "#4A78A8", "#7A5AA0", "#E0A85C", "#6F9A64", "#3F7F8C", "#C0392B", "#9AA59C"];

// « 2025-12-01 » → « décembre 2025 »
function monthLabel(s?: string) {
  if (!s) return "";
  const d = new Date(s.length === 7 ? s + "-01" : s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString(locale(), { month: "long", year: "numeric" });
}

function fmt(n: number, dec = 0) {
  return Number(n || 0).toLocaleString(locale(), {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
}

/* ════════════════════════════════════════════════
   COMPOSANTS GRAPHIQUES SVG CUSTOM
   ════════════════════════════════════════════════ */

function EvolutionLineChart({
  series, moyenne, ecartType, caMax, caMin,
}: {
  series: Array<{ date: string; label: string; ca: number }>;
  moyenne: number;
  ecartType: number;
  caMax: { date_str: string; val: number };
  caMin: { date_str: string; val: number };
}) {
  const W = 1100, H = 480, padL = 64, padR = 40, padT = 52, padB = 80;
  const vals = series.map((s) => s.ca);
  const max = Math.max(...vals, moyenne + ecartType) * 1.08;
  const min = 0;
  const xW = W - padL - padR, yH = H - padT - padB;
  const n = Math.max(series.length - 1, 1);

  const [zoomStart, setZoomStart] = useState<number | null>(null);
  const [zoomEnd, setZoomEnd] = useState<number | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selStart, setSelStart] = useState<number | null>(null);
  const [selCurrent, setSelCurrent] = useState<number | null>(null);

  const effStart = zoomStart ?? 0;
  const effEnd = zoomEnd ?? n;
  const effN = Math.max(effEnd - effStart, 1);

  const getX = (i: number) => padL + ((i - effStart) / effN) * xW;
  const getY = (v: number) => padT + yH - ((v - min) / (max - min)) * yH;

  const svgRef = React.useRef<SVGSVGElement | null>(null);

  const clientXToIdx = (clientX: number): number | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const relX = ((clientX - rect.left) / rect.width) * W;
    if (relX < padL || relX > W - padR) return null;
    const raw = ((relX - padL) / xW) * effN + effStart;
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
    if (isSelecting) handleMouseUp();
  };

  const resetZoom = () => {
    setZoomStart(null);
    setZoomEnd(null);
  };

  const visibleSeries = series.filter((_, i) => i >= effStart && i <= effEnd);
  const visibleVals = visibleSeries.map(s => s.ca);
  const iMaxVisible = visibleVals.length > 0 ? effStart + visibleVals.indexOf(Math.max(...visibleVals)) : -1;
  const iMinVisible = visibleVals.length > 0 ? effStart + visibleVals.indexOf(Math.min(...visibleVals)) : -1;

  const pts = visibleSeries.map((s, idx) => {
    const i = effStart + idx;
    return { x: getX(i), y: getY(s.ca), s, i };
  });

  let path = "";
  let area = "";
  if (pts.length > 0) {
    path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2;
      path += ` C ${mx} ${pts[i].y}, ${mx} ${pts[i + 1].y}, ${pts[i + 1].x} ${pts[i + 1].y}`;
    }
    area = `${path} L ${pts[pts.length - 1].x} ${padT + yH} L ${pts[0].x} ${padT + yH} Z`;
  }

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => min + t * (max - min));

  const isZoomed = zoomStart !== null && zoomEnd !== null;
  const selX1 = selStart !== null && selCurrent !== null ? getX(Math.min(selStart, selCurrent)) : 0;
  const selX2 = selStart !== null && selCurrent !== null ? getX(Math.max(selStart, selCurrent)) : 0;

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, paddingRight: 6, paddingLeft: 4 }}>
        <span style={{ fontSize: ".72rem", color: MUTED, fontWeight: 600 }}>
          {isZoomed
            ? tr(`Zoom : ${series[effStart].label} → ${series[effEnd].label} · Double-cliquez ou cliquez ici pour réinitialiser`,
                 `Zoom: ${series[effStart].label} → ${series[effEnd].label} · Double-click or click here to reset`)
            : tr("Glissez une sélection horizontale sur le graphique pour zoomer", "Drag a horizontal selection on the chart to zoom in")}
        </span>
        {isZoomed && (
          <button
            onClick={resetZoom}
            onDoubleClick={resetZoom}
            style={{
              fontSize: ".68rem",
              background: "transparent",
              border: `1px solid ${ORANGE}`,
              color: ORANGE,
              padding: "3px 10px",
              borderRadius: 999,
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            {tr("× Réinitialiser zoom", "× Reset zoom")}
          </button>
        )}
      </div>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", flex: 1, minHeight: 0 }} preserveAspectRatio="xMidYMid meet"
        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave} onDoubleClick={resetZoom}>
        <defs>
          <linearGradient id="ev_area2" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={ORANGE} stopOpacity="0.16" />
            <stop offset="100%" stopColor={ORANGE} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <rect x={padL} y={padT} width={xW} height={yH} fill="transparent" onDoubleClick={resetZoom} />
        <rect x={padL} y={getY(Math.min(max, moyenne + ecartType))} width={xW}
              height={getY(Math.max(0, moyenne - ecartType)) - getY(moyenne + ecartType)}
              fill={PEACH} fillOpacity="0.12" rx={4} />
        <line x1={padL} x2={W - padR} y1={getY(moyenne - ecartType)} y2={getY(moyenne - ecartType)}
              stroke={C1} strokeWidth="1.2" strokeDasharray="4 4" opacity="0.8"/>
        <line x1={padL} x2={W - padR} y1={getY(moyenne)} y2={getY(moyenne)}
              stroke={ORANGE} strokeWidth="2" strokeDasharray="8 5" opacity="0.95"/>
        <text x={W - padR - 10} y={getY(moyenne) - 8} textAnchor="end"
              fontSize="13" fill={ORANGE} fontWeight="800">{tr("Moyenne", "Average")} {fmt(moyenne)} €</text>
        <line x1={padL} x2={W - padR} y1={getY(moyenne + ecartType)} y2={getY(moyenne + ecartType)}
              stroke={C1} strokeWidth="1.2" strokeDasharray="4 4" opacity="0.8"/>
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={getY(v)} y2={getY(v)} stroke="var(--dk-line, #ECEDE7)" strokeWidth="1"/>
            <text x={padL - 12} y={getY(v) + 4} textAnchor="end"
                  fontSize="13" fill={MUTED} fontWeight="700">
              {fmt(v / 1000, v > 10000 ? 0 : 1)}k€
            </text>
          </g>
        ))}
        {area && <path d={area} fill="url(#ev_area2)" />}
        {path && <path d={path} fill="none" stroke={ORANGE} strokeWidth="3.6" strokeLinecap="round"/>}
        {iMaxVisible >= 0 && (() => {
          const pt = pts.find(p => p.i === iMaxVisible);
          if (!pt) return null;
          const s = series[iMaxVisible];
          return (
            <g>
              <line x1={pt.x} x2={pt.x} y1={pt.y} y2={pt.y - 56} stroke={ORANGE} strokeWidth="1.4" strokeDasharray="3 3"/>
              <rect x={pt.x - 62} y={pt.y - 88} width="124" height="30" rx="8"
                    fill="var(--dk-surface, #fff)" stroke={ORANGE} strokeWidth="1.3" style={{ filter: "drop-shadow(0 4px 8px rgba(46,125,79,0.18))" }}/>
              <text x={pt.x} y={pt.y - 68} textAnchor="middle" fontSize="12" fill={ORANGE} fontWeight="800">
                MAX · {fmt(s.ca)} €
              </text>
            </g>
          );
        })()}
        {iMinVisible >= 0 && (() => {
          const pt = pts.find(p => p.i === iMinVisible);
          if (!pt) return null;
          const s = series[iMinVisible];
          return (
            <g>
              <line x1={pt.x} x2={pt.x} y1={pt.y} y2={pt.y + 42} stroke={C1} strokeWidth="1.4" strokeDasharray="3 3"/>
              <rect x={pt.x - 62} y={pt.y + 48} width="124" height="30" rx="8"
                    fill="var(--dk-surface, #fff)" stroke={C1} strokeWidth="1.3" style={{ filter: "drop-shadow(0 4px 8px var(--dk-line, rgba(140,160,140,0.18)))" }}/>
              <text x={pt.x} y={pt.y + 68} textAnchor="middle" fontSize="12" fill={C1} fontWeight="800">
                MIN · {fmt(s.ca)} €
              </text>
            </g>
          );
        })()}
        {pts.map(({ x, y, s, i }) => (
          <circle key={i} cx={x} cy={y} r={12} fill="transparent" stroke="transparent" style={{ cursor: "pointer" }}>
            <title>{tr(`${s.label}\nChiffre d'Affaires : ${fmt(s.ca)} €`, `${s.label}\nRevenue: ${fmt(s.ca)} €`)}</title>
          </circle>
        ))}
        {isSelecting && selStart !== null && selCurrent !== null && (
          <rect
            x={Math.min(selX1, selX2)}
            y={padT}
            width={Math.abs(selX2 - selX1)}
            height={yH}
            fill={ORANGE}
            fillOpacity={0.12}
            stroke={ORANGE}
            strokeWidth={1.5}
            strokeDasharray="4 3"
            pointerEvents="none"
          />
        )}
      </svg>
    </div>
  );
}

function Comp2425BarChart({ data, yPrec, yDer }: { data: Array<{ mois: string; ca_prec: number; ca_der: number }>; yPrec: number; yDer: number }) {
  const W = 1100, H = 400, padL = 60, padR = 40, padT = 30, padB = 64;
  const max = Math.max(...data.flatMap(d => [d.ca_prec, d.ca_der]), 1) * 1.1;
  const n = data.length;
  const groupW = (W - padL - padR) / n;
  const barW = (groupW * 0.38);
  const getY = (v: number) => padT + (H - padT - padB) * (1 - v / max);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "100%" }} preserveAspectRatio="xMidYMid meet">
      {[0.25, 0.5, 0.75, 1].map((t, i) => {
        const v = t * max, y = getY(v);
        return (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="var(--dk-line, #ECEDE7)"/>
            <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="10" fill={MUTED} fontWeight="600">
              {fmt(v / 1000, v > 10000 ? 0 : 1)}k
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const gx = padL + i * groupW;
        const x24 = gx + groupW * 0.12;
        const x25 = x24 + barW + groupW * 0.06;
        const y24 = getY(d.ca_prec), y25 = getY(d.ca_der);
        return (
          <g key={i}>
            <rect x={x24} y={y24} width={barW} height={getY(0) - y24} rx={3} fill={C1} fillOpacity="0.88"/>
            <rect x={x25} y={y25} width={barW} height={getY(0) - y25} rx={3} fill={ORANGE} fillOpacity="0.92"/>
            <text x={gx + groupW / 2} y={H - padB + 18} textAnchor="middle"
                  fontSize="11" fill={INK} fontWeight="700">{trData(d.mois)}</text>
          </g>
        );
      })}
      <g transform={`translate(${W - padR - 180}, 6)`}>
        <rect x="0" y="0" width="12" height="12" rx="3" fill={C1}/>
        <text x="18" y="10" fontSize="11" fill={INK} fontWeight="700">{yPrec}</text>
        <rect x="80" y="0" width="12" height="12" rx="3" fill={ORANGE}/>
        <text x="98" y="10" fontSize="11" fill={INK} fontWeight="700">{yDer}</text>
      </g>
    </svg>
  );
}

function TopNHBar({ data, n }: { data: Array<{ article: string; total_revenue: number; part: number }>; n: number }) {
  const items = data.slice(0, n);
  const vmax = Math.max(...items.map(i => i.total_revenue), 1);
  // Graduations « rondes » (ex. 0 · 50 K€ · 100 K€ · 150 K€) et échelle qui commence à 0
  const raw = vmax / 4;
  const p10 = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * p10).find(s => s >= raw) || raw;
  const top = Math.ceil(vmax / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(v);
  const eur = (v: number) => (v >= 1000 ? `${fmt(v / 1000, v % 1000 ? 1 : 0)} K€` : `${fmt(v, 0)} €`);
  const NAME_W = 210, VAL_W = 150;

  return (
    <div style={{ width: "100%" }}>
      {/* axe en haut */}
      <div style={{ display: "flex", alignItems: "flex-end", marginBottom: 6 }}>
        <div style={{ width: NAME_W, flexShrink: 0 }} />
        <div style={{ position: "relative", flex: 1, height: 18 }}>
          {ticks.map((v, i) => (
            <span key={i} style={{ position: "absolute", left: `${(v / top) * 100}%`, bottom: 0,
                                   transform: i === 0 ? "none" : i === ticks.length - 1 ? "translateX(-100%)" : "translateX(-50%)",
                                   fontSize: ".68rem", fontWeight: 600, color: MUTED, whiteSpace: "nowrap" }}>{eur(v)}</span>
          ))}
        </div>
        <div style={{ width: VAL_W, flexShrink: 0 }} />
      </div>
      {items.map((it, i) => (
        <div key={i} title={`${it.article} : ${fmt(it.total_revenue, 0)} € (${fmt(it.part, 1)} % du chiffre d'affaires)`}
             style={{ display: "flex", alignItems: "center", height: 34 }}>
          <div style={{ width: NAME_W, flexShrink: 0, paddingRight: 12, textAlign: "right", fontSize: ".76rem", fontWeight: 700, color: INK,
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {it.article}
          </div>
          <div style={{ position: "relative", flex: 1, height: "100%" }}>
            {ticks.map((v, k) => (
              <div key={k} style={{ position: "absolute", left: `${(v / top) * 100}%`, top: 0, bottom: 0, width: 1,
                                    background: k === 0 ? "rgba(80,100,85,0.35)" : "var(--dk-line, #ECEDE7)" }} />
            ))}
            <div style={{ position: "absolute", left: 0, top: "18%", height: "64%", width: `${(it.total_revenue / top) * 100}%`,
                          background: ORANGE, opacity: i < 3 ? 0.95 : 0.6, borderRadius: "0 4px 4px 0" }} />
          </div>
          <div style={{ width: VAL_W, flexShrink: 0, paddingLeft: 12, fontSize: ".76rem", color: INK, whiteSpace: "nowrap" }}>
            <b>{eur(it.total_revenue)}</b> <span style={{ color: MUTED }}>· {fmt(it.part, 1)} %</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function DonutTopN({ data, n, centerLabel }: {
  data: Array<{ article: string; total_revenue: number; part: number }>; n: number; centerLabel: string;
}) {
  const items = data.slice(0, n);
  const total = items.reduce((s, it) => s + it.total_revenue, 0) || 1;
  const W = 500, H = 500, cx = W / 2, cy = H / 2, R = 160, r = 95;
  let ang = -Math.PI / 2;
  const arcs = items.map((it, i) => {
    const a = (it.total_revenue / total) * Math.PI * 2;
    const start = ang, end = ang + a;
    ang = end;
    const largeArc = a > Math.PI ? 1 : 0;
    const x1 = cx + R * Math.cos(start), y1 = cy + R * Math.sin(start);
    const x2 = cx + R * Math.cos(end), y2 = cy + R * Math.sin(end);
    const x3 = cx + r * Math.cos(end), y3 = cy + r * Math.sin(end);
    const x4 = cx + r * Math.cos(start), y4 = cy + r * Math.sin(start);
    const d = `M ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${r} ${r} 0 ${largeArc} 0 ${x4} ${y4} Z`;
    return { d, color: PALETTE[i % PALETTE.length], part: (it.total_revenue / total) * 100, label: it.article };
  });

  return (
    <div style={{ display: "flex", gap: "24px", alignItems: "center", height: "100%" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "50%", maxWidth: "380px" }} preserveAspectRatio="xMidYMid meet">
        {arcs.map((a, i) => (
          <path key={i} d={a.d} fill={a.color} stroke="var(--dk-surface, #fff)" strokeWidth="2"/>
        ))}
        <text x={cx} y={cy - 8} textAnchor="middle" fontSize="15" fill={MUTED} fontWeight="600">{tr(`CA Top ${n}`, `Top ${n} revenue`)}</text>
        <text x={cx} y={cy + 22} textAnchor="middle" fontSize="28" fill={INK} fontWeight="800">{centerLabel}</text>
      </svg>
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: `1fr 1fr`, gap: "4px 16px", fontSize: "0.78rem" }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "10px", height: "10px", borderRadius: "2px", background: PALETTE[i % PALETTE.length], flexShrink: 0 }}/>
            <span style={{ flex: 1, color: INK, fontWeight: 600, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
              {it.article.length > 18 ? it.article.slice(0, 18) + "…" : it.article}
            </span>
            <span style={{ color: MUTED, fontWeight: 700 }}>{((it.total_revenue / total) * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DayOfWeekBars({ days, mode }: {
  days: Array<{ day: string; ca_total: number; ca_moyen: number }>; mode: "total" | "moyen";
}) {
  const valFn = (d: any) => mode === "total" ? d.ca_total : d.ca_moyen;
  const max = Math.max(...days.map(valFn), 1);
  const mean = days.reduce((s, d) => s + valFn(d), 0) / days.length;
  const W = 560, H = 320, padL = 40, padR = 20, padT = 20, padB = 60;
  const bw = (W - padL - padR) / days.length * 0.7;
  const getY = (v: number) => padT + (H - padT - padB) * (1 - v / max);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "100%" }} preserveAspectRatio="xMidYMid meet">
      {[0.25, 0.5, 0.75, 1].map((t, i) => {
        const v = t * max, y = getY(v);
        return (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="var(--dk-line, #ECEDE7)"/>
            <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="10" fill={MUTED} fontWeight="600">
              {fmt(mode === "total" ? v/1000 : v, 0)}{mode === "total" ? "k" : ""}
            </text>
          </g>
        );
      })}
      {days.map((d, i) => {
        const v = valFn(d);
        const color = v === max ? ORANGE : (v >= mean ? C2 : C3);
        const gx = padL + i * ((W - padL - padR) / days.length) + ((W - padL - padR) / days.length - bw) / 2;
        return (
          <g key={i}>
            <rect x={gx} y={getY(v)} width={bw} height={getY(0) - getY(v)} rx={4} fill={color} fillOpacity="0.9"/>
            <text x={gx + bw / 2} y={getY(v) - 6} textAnchor="middle"
                  fontSize="10.5" fill={color} fontWeight="800">
              {mode === "total" ? `${fmt(v / 1000, 1)}k€` : `${fmt(v)} €`}
            </text>
            <text x={gx + bw / 2} y={H - padB + 20} textAnchor="middle"
                  fontSize="11.5" fill={INK} fontWeight="700">{trData(d.day)}</text>
          </g>
        );
      })}
      <text x={padL} y={H - padB + 44} fontSize="10" fill={MUTED} fontWeight="700">
        {mode === "total"
          ? tr("CA cumulé sur la période (€)", "Cumulative revenue over the period (€)")
          : tr("CA moyen par jour ouvert (€/j)", "Average revenue per open day (€/d)")}
      </text>
    </svg>
  );
}

function HourlyDual({ data }: { data: Array<{ hour: number; heure_label: string; ca: number; tickets: number }> }) {
  // Une seule échelle (chiffre d'affaires) ; le nombre de tickets est écrit au-dessus de chaque barre
  // au lieu d'un second axe, plus difficile à lire.
  const W = 780, H = 320, padL = 44, padR = 16, padT = 26, padB = 50;
  const maxCA = Math.max(...data.map(d => d.ca), 1) * 1.12;
  const n = Math.max(data.length, 1);
  const groupW = (W - padL - padR) / n;
  const bw = groupW * 0.62;
  const getYca = (v: number) => padT + (H - padT - padB) * (1 - v / maxCA);
  const peak = data.reduce((m, d) => (d.ca > m.ca ? d : m), data[0] || { ca: 0, hour: -1 } as any);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "100%" }} preserveAspectRatio="xMidYMid meet">
      {[0.25, 0.5, 0.75, 1].map((t, i) => {
        const v = t * maxCA, y = getYca(v);
        return (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="var(--dk-line, #ECEDE7)"/>
            <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="10" fill={MUTED} fontWeight="700">
              {fmt(v / 1000, v > 10000 ? 0 : 1)}k€
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const gx = padL + i * groupW + (groupW - bw) / 2;
        const isPeak = d.hour === peak?.hour;
        return (
          <g key={i}>
            <title>{tr(`${d.heure_label} : ${fmt(d.ca)} € · ${fmt(d.tickets)} tickets`, `${d.heure_label}: ${fmt(d.ca)} € · ${fmt(d.tickets)} transactions`)}</title>
            <rect x={gx} y={getYca(d.ca)} width={bw} height={getYca(0) - getYca(d.ca)}
                  rx={3} fill={isPeak ? ORANGE : C2} fillOpacity={isPeak ? 0.95 : 0.6}/>
            <text x={gx + bw / 2} y={getYca(d.ca) - 6} textAnchor="middle" fontSize="9.5" fill={MUTED} fontWeight="700">
              {fmt(d.tickets)}
            </text>
            <text x={gx + bw / 2} y={H - padB + 20} textAnchor="middle"
                  fontSize="10.5" fill={INK} fontWeight="700">{d.heure_label}</text>
          </g>
        );
      })}
      <g transform={`translate(${padL + 10}, ${H - 8})`}>
        <rect x="0" y="-10" width="12" height="12" rx="3" fill={C2} fillOpacity="0.6"/>
        <text x="18" y="0" fontSize="10.5" fill={INK} fontWeight="700">{tr("Chiffre d'affaires (€)", "Revenue (€)")}</text>
        <rect x="190" y="-10" width="12" height="12" rx="3" fill={ORANGE}/>
        <text x="208" y="0" fontSize="10.5" fill={INK} fontWeight="700">{tr("Heure de pointe", "Peak hour")}</text>
        <text x="330" y="0" fontSize="10.5" fill={MUTED} fontWeight="700">{tr("Chiffre au-dessus : nombre de tickets", "Number above: transactions")}</text>
      </g>
    </svg>
  );
}

function TreemapCats({ data }: { data: Array<{ category: string; ca: number; part: number; panier: number }> }) {
  const total = data.reduce((s, d) => s + d.ca, 0) || 1;
  const W = 1100, H = 600;
  const PAD = 6;
  const sorted = [...data].sort((a, b) => b.ca - a.ca);
  const remaining = sorted.map((d, i) => ({
    ...d, color: PALETTE[i % PALETTE.length],
    area: (d.ca / total) * (W - PAD * 2) * (H - PAD * 2),
  }));
  let x = PAD, y = PAD;
  let availW = W - PAD * 2;
  let availH = H - PAD * 2;
  const boxes: Array<{ x: number; y: number; w: number; h: number; d: any; color: string }> = [];
  let idx = 0;
  const GAP = 4;

  const worstAspect = (items: typeof remaining, width: number, rowArea: number) => {
    const rh = rowArea / width;
    let mx = 0;
    for (const it of items) {
      const w = it.area / rh;
      const aspect = Math.max(w / rh, rh / w);
      if (aspect > mx) mx = aspect;
    }
    return mx;
  };

  while (idx < remaining.length) {
    const row: typeof remaining = [];
    let rowArea = 0;
    let prevAspect = Infinity;
    while (idx < remaining.length) {
      const candidate = remaining[idx];
      const testArea = rowArea + candidate.area;
      const testRow = [...row, candidate];
      const testAspect = worstAspect(testRow, availW, testArea);
      if (row.length === 0 || testAspect <= prevAspect) {
        row.push(candidate);
        rowArea = testArea;
        prevAspect = testAspect;
        idx++;
      } else {
        break;
      }
    }
    if (row.length === 0) break;
    const rowH = rowArea / availW;
    const clippedH = Math.min(rowH, availH);
    let cx = x;
    const effArea = clippedH * availW;
    const scale = effArea / rowArea;
    for (const it of row) {
      const boxArea = it.area * scale;
      const bw = boxArea / clippedH - GAP;
      boxes.push({
        x: cx,
        y: y + (row.length > 1 ? 0 : Math.max(0, (availH - clippedH) / 2)),
        w: Math.max(10, bw),
        h: Math.max(10, clippedH - GAP),
        d: it,
        color: it.color,
      });
      cx += bw + GAP;
    }
    y += clippedH + GAP;
    availH -= clippedH + GAP;
    if (boxes.length > 50) break;
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "100%" }} preserveAspectRatio="xMidYMid meet">
      {boxes.map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={10}
                fill={b.color} fillOpacity={0.2 + (b.d.part / 100) * 0.5}
                stroke={b.color} strokeWidth="1.6" strokeOpacity="0.55"/>
          <text x={b.x + b.w / 2} y={b.y + b.h / 2 - 14} textAnchor="middle"
                fontSize={Math.min(16, b.h * 0.24, b.w * 0.11)} fill={INK} fontWeight="800">
            {trData(b.d.category)}
          </text>
          <text x={b.x + b.w / 2} y={b.y + b.h / 2 + 6} textAnchor="middle"
                fontSize={Math.min(14, b.h * 0.2)} fill={INK} fontWeight="700">
            {fmt(b.d.ca / 1000, b.d.ca > 10000 ? 0 : 1)}k€
          </text>
          <text x={b.x + b.w / 2} y={b.y + b.h / 2 + 26} textAnchor="middle"
                fontSize={Math.min(12, b.h * 0.18)} fill={MUTED} fontWeight="700">
            {b.d.part}% · {tr("PM", "Avg. basket")} {fmt(b.d.panier, 2)}€
          </text>
        </g>
      ))}
    </svg>
  );
}

function CatHBar({ data, field, labelFn }: {
  data: Array<{ category: string; ca: number; part: number; panier: number; tickets: number; produits: number }>;
  field: "ca" | "panier";
  labelFn: (val: number, row: any) => string;
}) {
  const max = Math.max(...data.map(d => d[field] as number), 1);
  const H = Math.max(460, data.length * 64 + 80);
  const W = 900, padL = 220, padR = 140, padT = 24, padB = 24;
  const rowH = (H - padT - padB) / data.length;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H }} preserveAspectRatio="xMidYMid meet">
      {[0.25, 0.5, 0.75, 1].map((t, i) => {
        const v = t * max;
        const x = padL + t * (W - padL - padR);
        return <line key={i} x1={x} x2={x} y1={padT} y2={H - padB} stroke="var(--dk-line, #ECEDE7)"/>;
      })}
      {data.map((it, i) => {
        const color = PALETTE[i % PALETTE.length];
        const y = padT + i * rowH;
        const w = ((it[field] as number) / max) * (W - padL - padR);
        return (
          <g key={i}>
            <text x={padL - 10} y={y + rowH * 0.62} textAnchor="end"
                  fontSize="12.5" fill={INK} fontWeight="700">{trData(it.category)}</text>
            <rect x={padL} y={y + rowH * 0.18} width={w} height={rowH * 0.64}
                  rx={5} fill={color} fillOpacity="0.88"/>
            <text x={padL + w + 10} y={y + rowH * 0.66}
                  fontSize="11.5" fill={color} fontWeight="800">
              {labelFn(it[field] as number, it)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ════════════════════════════════════════════════
   PAGE PRINCIPALE
   ════════════════════════════════════════════════ */
type TabId = "evolution" | "top" | "saison" | "categories";

export default function PerformancePage() {
  // Assistant IA : bouton « poser une question sur ce graphique » sur chaque carte
  const { openChat } = useChat();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [annee, setAnnee] = useState<string>("Toutes");
  const [saison, setSaison] = useState<string>("Toutes");
  const [mois, setMois] = useState<string>("Tous");
  const [categorie, setCategorie] = useState<string>("Toutes");
  const [evenement, setEvenement] = useState<string>("Tous");
  const [activeTab, setActiveTab] = useState<TabId>("evolution");
  const [topN, setTopN] = useState(10);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPerformance({ annee, saison, mois, categorie, evenement })
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [annee, saison, mois, categorie, evenement]);

  const kpis = useMemo(() => {
    const r = data?.kpis || {};
    return {
      total_ca: r.total_ca ?? r.ca_total ?? 0,
      nb_tickets: r.nb_tickets ?? r.tickets ?? 0,
      panier: r.panier ?? 0,
      nb_jours: r.nb_jours ?? r.jours_actifs ?? 0,
      nb_produits: r.nb_produits ?? r.references ?? 0,
    };
  }, [data]);

  // Comparaison avec l'année précédente (mêmes filtres), quand une année est choisie
  const n1 = data?.kpis_n1 || null;
  // Sans année choisie : comparaison des deux dernières années présentes (mêmes filtres)
  const pa = data?.kpis_par_annee || {};
  const paYears = Object.keys(pa).sort();
  const yDerK = paYears[paYears.length - 1], yPrecK = paYears[paYears.length - 2];
  const y25 = yDerK ? pa[yDerK] : undefined, y24 = yPrecK ? pa[yPrecK] : undefined;
  const vsN1 = (cur: number, prev?: number, key?: "total_ca" | "nb_tickets" | "panier") => {
    if (n1 && prev) {
      const d = ((cur - prev) / prev) * 100;
      return tr(`${d >= 0 ? "▲ +" : "▼ "}${fmt(d, 1)} % vs ${n1.annee}`, `${d >= 0 ? "▲ +" : "▼ "}${fmt(d, 1)}% vs ${n1.annee}`);
    }
    if (annee === "Toutes" && key && y25 && y24 && y24[key]) {
      const d = ((y25[key] - y24[key]) / y24[key]) * 100;
      return tr(`${yDerK} vs ${yPrecK} : ${d >= 0 ? "▲ +" : "▼ "}${fmt(d, 1)} %`, `${yDerK} vs ${yPrecK}: ${d >= 0 ? "▲ +" : "▼ "}${fmt(d, 1)}%`);
    }
    return null;
  };

  const filters = useMemo(() => {
    const f = data?.available_filters || {};
    return {
      annees: f.annees?.length ? f.annees : ["Toutes"],
      saisons: f.saisons?.length ? f.saisons : ["Toutes"],
      mois: f.mois?.length ? f.mois : ["Tous"],
      categories: f.categories?.length ? f.categories : ["Toutes"],
      evenements: f.evenements?.length ? f.evenements : ["Tous"],
    };
  }, [data]);

  const monthly = data?.monthly || {};
  const topProds = data?.top_products || {};
  const seasonality = data?.seasonality || {};
  const categories: any[] = data?.categories || [];

  const pareto = useMemo(() => {
    const top = topProds?.by_ca || [];
    const first80 = top.filter((p: any) => (p.cumul || p.part) <= 80.5);
    const cumulFirst = first80.reduce((s: number, p: any) => s + (p.part || 0), 0);
    const paretoOk = first80.length > 0 && first80.length <= Math.max(1, Math.floor(topN * 0.3));
    return {
      top80: first80, cumulFirst, paretoOk,
      total: top.slice(0, topN).reduce((s: number, p: any) => s + (p.part || 0), 0),
    };
  }, [topProds, topN]);

  const saisonInsights = useMemo(() => {
    const days = seasonality?.days || [];
    if (!days.length) return null;
    const best = days.reduce((a: any, b: any) => a.ca_moyen > b.ca_moyen ? a : b);
    const worst = days.reduce((a: any, b: any) => a.ca_moyen < b.ca_moyen ? a : b);
    const ratio = best.ca_moyen / Math.max(worst.ca_moyen || 1, 1);
    return { best, worst, ratio };
  }, [seasonality]);

  if (loading && !data) {
    return (
      <div style={{ padding: "40px", color: MUTED, fontSize: "0.9rem", fontWeight: 600, display:"flex", alignItems:"center", gap:"10px"}}>
        <IconSparkline size={20} /> {tr("Chargement de l'analyse commerciale...", "Loading sales analysis...")}
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: "40px" }}>

      {/* ══════════════════════════════════════════════
          TITRE DE PAGE + DESCRIPTION
          ══════════════════════════════════════════════ */}
      <div style={{ marginBottom: "20px", padding: "0 28px" }}>
        <h1 style={{ fontSize:"1.8rem", fontWeight:800, color:INK,
                     letterSpacing:"-0.03em", lineHeight:1.1, margin:0 }}>
          {tr("Performance", "Overall")} <span style={{ color: ORANGE }}>{tr("Générale", "Performance")}</span>
        </h1>
        <p style={{ color:MUTED, fontSize:"0.82rem", marginTop:"6px",
                    maxWidth:"640px", lineHeight:1.5 }}>
          {tr("Analyse globale du chiffre d'affaires, performance des produits, saisonnalité et dynamique des catégories.",
              "Overall analysis of revenue, product performance, seasonality and category trends.")}
        </p>
      </div>

      {/* ══════ FILTRES — Fond normal, dans la page ══════ */}
      <div className="sw" style={{ marginBottom: "8px" }}>
        <div style={{ display:"flex", flexWrap:"wrap", alignItems:"stretch", gap:"14px",
                      padding:"14px 18px", borderRadius:"14px",
                      background:"var(--dk-surface, #fff)",
                      border:"1px solid var(--dk-line, rgba(120,140,120,0.18))",
                      boxShadow:"0 2px 12px rgba(0,0,0,0.06)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"10px",
                        fontSize:"0.72rem", fontWeight:800,
                        color: ORANGE, textTransform:"uppercase", letterSpacing:"0.06em",
                        borderRight:`1px solid var(--dk-line, rgba(140,160,140,.35))`,
                        paddingRight:"16px", flexShrink:0}}>
            <IconFilter size={16} />
            {tr("Filtres d'Analyse", "Analysis Filters")}
          </div>

          {[
            { label: tr("Année", "Year"), icon: <IconCalendarDays size={14} />, val: annee, set: setAnnee, opts: filters.annees },
            { label: tr("Saison", "Season"), icon: <IconCalendar size={14} />, val: saison, set: setSaison, opts: filters.saisons },
            { label: tr("Mois", "Month"), icon: <IconTag size={14} />, val: mois, set: setMois, opts: filters.mois },
            { label: tr("Catégorie", "Category"), icon: <IconGrid size={14} />, val: categorie, set: setCategorie, opts: filters.categories },
            { label: tr("Événement", "Event"), icon: <IconPin size={14} />, val: evenement, set: setEvenement, opts: filters.evenements },
          ].map((f) => (
            <div key={f.label} style={{ display:"flex", alignItems:"center", gap:"8px" }}>
              <label style={{ display:"inline-flex", alignItems:"center", gap:"5px",
                              fontSize:"0.72rem", fontWeight:700, color:"var(--dk-ink2, #3F4A42)" }}>
                {f.icon}
                {f.label}
              </label>
              <select value={f.val} onChange={(e)=>f.set(e.target.value)} style={opaqueSelect}>
                {f.opts.map((opt: string) => <option key={opt} value={opt}>{trData(opt)}</option>)}
              </select>
            </div>
          ))}
        </div>

        {(() => {
          const pills: Array<{ icon: React.ReactNode; text: string }> = [];
          if (annee && annee !== "2024 + 2025" && annee !== "Toutes")
            pills.push({ icon:<IconCalendarDays size={12} />, text:trData(annee) });
          if (saison && saison !== "Toutes")
            pills.push({ icon:<IconCalendar size={12} />, text:trData(saison) });
          if (mois && mois !== "Tous")
            pills.push({ icon:<IconTag size={12} />, text:trData(mois) });
          if (categorie && categorie !== "Toutes")
            pills.push({ icon:<IconGrid size={12} />, text:trData(categorie) });
          if (evenement && evenement !== "Tous")
            pills.push({ icon:<IconPin size={12} />, text:trData(evenement) });
          if (!pills.length) return null;
          return (
            <div style={{ marginTop:"10px", display:"flex", flexWrap:"wrap", gap:"6px" }}>
              {pills.map((p, i) => (
                <span key={i} style={{ display:"inline-flex", alignItems:"center", gap:"6px",
                  background:"var(--dk-surface, #fff)", border:"1px solid var(--dk-line, rgba(140,160,140,.3))",
                  borderRadius:"999px", padding:"3px 10px",
                  fontSize:"0.72rem", fontWeight:700, color:"var(--dk-ink2, #3F4A42)",
                  boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
                  <span style={{ color: ORANGE }}>{p.icon}</span>{p.text}
                </span>
              ))}
            </div>
          );
        })()}
      </div>

      {/* ══════════════════════════════════════════════
          KPIs — Style Vue du Jour (cc, sw, ct, cs)
          ══════════════════════════════════════════════ */}
      <div className="sec-title" style={{ display:"flex", alignItems:"center", gap:"9px"}}>
        <IconBarsGrouped size={16} /> {tr("Chiffres clés", "Key figures")}
      </div>
      <div className="sw">
        <div style={{ display:"grid", gridTemplateColumns:"repeat(5, 1fr)", gap:"12px" }}>
          {[
            { icon: <IconCash size={16}/>, lbl:tr("CA Total", "Total Revenue"), sub: vsN1(kpis.total_ca, n1?.total_ca, "total_ca") || tr("chiffre d'affaires", "revenue"), val:`${fmt(kpis.total_ca/1000,1)} k€`, accent: ORANGE },
            { icon: <IconTicket size={16}/>, lbl:tr("Tickets", "Transactions"), sub: vsN1(kpis.nb_tickets, n1?.nb_tickets, "nb_tickets") || tr("transactions clients", "customer transactions"), val: fmt(kpis.nb_tickets), accent: C2 },
            { icon: <IconCart size={16}/>, lbl:tr("Panier Moyen", "Average Basket"), sub: vsN1(kpis.panier, n1?.panier, "panier") || tr("par visite", "per visit"), val:`${fmt(kpis.panier,2)} €`, accent: C3 },
            { icon: <IconCalendarDays size={16}/>, lbl:tr("Jours Actifs", "Active Days"), sub:tr("jours avec ventes", "days with sales"), val: fmt(kpis.nb_jours), accent: PANIER },
            { icon: <IconBox size={16}/>, lbl:tr("Références", "Products"), sub:tr("produits vendus", "products sold"), val: fmt(kpis.nb_produits), accent: TICKETS },
          ].map((k) => (
            <div key={k.lbl} className="cc" style={{
              borderBottom: `3px solid ${k.accent}`,
              borderRadius: "12px 12px 14px 14px",
              position:"relative", overflow:"hidden",
            }}>
              <div style={{ display:"flex", alignItems:"center", gap:"7px", marginBottom:"6px"}}>
                <div style={{ width:"22px", height:"22px", borderRadius:"6px",
                              background:`color-mix(in srgb, ${k.accent} 9%, transparent)`, display:"flex",
                              alignItems:"center", justifyContent:"center",
                              color: k.accent }}>{k.icon}</div>
                <div style={{ fontSize:"0.70rem", color: k.accent, textTransform:"uppercase",
                              letterSpacing:"0.05em", fontWeight:700 }}>{k.lbl}</div>
              </div>
              <div style={{ fontSize:"1.75rem", fontWeight:800, color:INK, lineHeight:1 }}>{k.val}</div>
              <div style={{ fontSize:"0.73rem", color:MUTED, marginTop:"4px" }}>{k.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          4 ONGLETS (icônes SVG + pas emojis)
          ══════════════════════════════════════════════ */}
      <div style={{ padding:"16px 20px 0" }}>
        <div style={{ display:"flex", gap:"4px", borderBottom:"2px solid var(--dk-line, rgba(140,160,140,.22))", paddingBottom:0 }}>
          {([
            { id:"evolution", iconSvg:<IconTrendUp size={16}/>, label:tr("Évolution du CA", "Revenue Trend") },
            { id:"top",       iconSvg:<IconTrophy size={16}/>, label:tr("Top Produits", "Top Products") },
            { id:"saison",    iconSvg:<IconCalendar size={16}/>, label:tr("Saisonnalité", "Seasonality") },
            { id:"categories",iconSvg:<IconTag size={16}/>,    label:tr("Catégories", "Categories") },
          ] as const).map((t) => (
            <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{
              display:"inline-flex", alignItems:"center", gap:"8px",
              fontSize:"0.9rem", fontWeight: activeTab===t.id ? 800 : 600,
              color: activeTab===t.id ? "var(--dk-ink2, #3F4A42)" : MUTED,
              background: activeTab===t.id ? "rgba(46,125,79,0.08)" : "transparent",
              border:"none",
              borderBottom: activeTab===t.id ? `2px solid ${ORANGE}` : "2px solid transparent",
              marginBottom:"-2px",
              padding:"10px 20px",
              borderRadius:"8px 8px 0 0",
              cursor:"pointer",
              transition:"all .2s",
            }}>
              <span style={{ color: activeTab===t.id ? ORANGE : MUTED, display:"flex", alignItems:"center"}}>
                {t.iconSvg}
              </span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ──────────────────────────────────────────────
          TAB 1 · ÉVOLUTION DU CA
          ────────────────────────────────────────────── */}
      {activeTab === "evolution" && (
        <div className="sw" style={{ paddingTop:"14px" }}>
          <div className="sec-title" style={{ display:"flex", alignItems:"center", gap:"9px"}}>
            <IconTrendUp size={16} /> {tr("Évolution Mensuelle du Chiffre d'Affaires", "Monthly Revenue Trend")}
          </div>
          <div className="cc" style={{ padding:"20px 24px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start",
                          marginBottom:"12px", flexWrap:"wrap", gap:"10px" }}>
              <div>
                <ChartAssistantButton chartType="evolution_ca" chartData={{ series: monthly.series, moyenne: monthly.moyenne, ecartType: monthly.ecart_type, caMax: monthly.ca_max, caMin: monthly.ca_min }} chartName="EvolutionLineChart"
                  userQuestion="Explique ce graphique d'évolution du chiffre d'affaires" position="top-right" onOpenChat={openChat} />
                <div className="ct">{tr("Chiffre d'affaires mois par mois", "Revenue month by month")}</div>
                <div className="cs">{tr("Moyenne mensuelle :", "Monthly average:")} {fmt(monthly.moyenne)} € · {tr("fourchette habituelle :", "usual range:")} {fmt(Math.max(0, monthly.moyenne - monthly.ecart_type))} – {fmt(monthly.moyenne + monthly.ecart_type)} €</div>
              </div>
              <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>
                <LegendPill color={ORANGE} label={tr("Moyenne", "Average")}/>
                <LegendPill color={PEACH} label={tr("Fourchette habituelle", "Usual range")}/>
                <LegendPill color={C2} label={tr("CA mensuel", "Monthly revenue")}/>
              </div>
            </div>
            <div style={{ height:"520px", width:"100%", marginTop:"20px" }}>
              {monthly.series && <EvolutionLineChart
                series={monthly.series} moyenne={monthly.moyenne} ecartType={monthly.ecart_type}
                caMax={monthly.ca_max} caMin={monthly.ca_min} />}
            </div>
            {monthly.series?.length > 0 && (() => {
              const hi = monthly.series.filter((m: any) => m.ca > monthly.moyenne + monthly.ecart_type);
              const lo = monthly.series.filter((m: any) => m.ca < monthly.moyenne - monthly.ecart_type);
              const names = (arr: any[]) => arr.map((m: any) => m.label).join(", ");
              return (
                <Takeaway>
                  {tr(
                    `${hi.length} mois au-dessus de la fourchette habituelle${hi.length ? ` (${names(hi)})` : ""} et ${lo.length} en dessous${lo.length ? ` (${names(lo)})` : ""} : l'été et les fêtes portent l'année.`,
                    `${hi.length} months above the usual range${hi.length ? ` (${names(hi)})` : ""} and ${lo.length} below${lo.length ? ` (${names(lo)})` : ""}: summer and the holidays drive the year.`
                  )}
                </Takeaway>
              );
            })()}
            <ExpertNote>
              Fourchette habituelle = moyenne mensuelle ± 1 écart-type (σ = {fmt(monthly.ecart_type || 0)} €, μ = {fmt(monthly.moyenne || 0)} €), calculée sur les mois filtrés. Panier moyen = CA / COUNT(DISTINCT (date_id, ticket_number)). Comparaison : kpis_n1 (année − 1, mêmes filtres) ou kpis_par_annee (2025 vs 2024).
            </ExpertNote>

            <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:"12px",
                          marginTop:"24px", paddingTop:"20px", borderTop:"1px solid var(--dk-line, #ECEDE7)" }}>
              <InsightBox icon={<IconArrowMaxUp size={16} color={ORANGE}/>} color={ORANGE}
                title={tr("Meilleur mois", "Best month")}
                strong={`${monthLabel(monthly.ca_max?.date_str)} — ${fmt(monthly.ca_max?.val)} €`}/>
              <InsightBox icon={<IconArrowMinDown size={16} color={C1}/>} color={C1}
                title={tr("Mois le plus faible", "Weakest month")}
                strong={`${monthLabel(monthly.ca_min?.date_str)} — ${fmt(monthly.ca_min?.val)} €`}/>
              <InsightBox icon={<IconScale size={16} color={C3}/>} color={C3}
                title={tr("Écart entre meilleur et plus faible mois", "Gap between best and weakest month")}
                strong={`${fmt(monthly.amplitude)} € — ratio ${Number(monthly.ratio_amp||0).toFixed(1)}×`}/>
            </div>
          </div>

          {annee === "Toutes" && monthly.comp_24_25?.length > 0 && monthly.comp_annees && (
            <>
              <div className="sec-title" style={{ display:"flex", alignItems:"center", gap:"9px"}}>
                <IconBarsGrouped size={16} /> {tr(`Comparaison ${monthly.comp_annees.prec} vs ${monthly.comp_annees.der} — Mois par Mois`, `${monthly.comp_annees.prec} vs ${monthly.comp_annees.der} Comparison — Month by Month`)}
              </div>
              <div className="cc" style={{ padding:"20px 24px" }}>
                <ChartAssistantButton chartType="comparison_2024_2025" chartData={{ data: monthly.comp_24_25, annees: monthly.comp_annees }} chartName="Comp2425BarChart"
                  userQuestion="Explique ce graphique comparant le CA des deux années" position="top-right" onOpenChat={openChat} />
                <div className="ct">{tr("Évolution année N vs N−1", "Year N vs year N−1")}</div>
                <div className="cs">{tr("Barres groupées par mois — 12 mois alignés", "Bars grouped by month — 12 months side by side")}</div>
                <div style={{ height:"400px", width:"100%", marginTop:"20px" }}>
                  <Comp2425BarChart data={monthly.comp_24_25} yPrec={monthly.comp_annees.prec} yDer={monthly.comp_annees.der}/>
                </div>
                {(() => {
                  const c = monthly.comp_24_25 || [];
                  const yp = monthly.comp_annees.prec, yd = monthly.comp_annees.der;
                  // On ne compare que les mois présents dans les deux années
                  const both = c.filter((m: any) => m.ca_prec > 0 && m.ca_der > 0);
                  const up = both.filter((m: any) => m.ca_der > m.ca_prec).length;
                  const tp = both.reduce((a: number, m: any) => a + m.ca_prec, 0), td = both.reduce((a: number, m: any) => a + m.ca_der, 0);
                  const d = tp ? ((td - tp) / tp) * 100 : 0;
                  const big = [...both].sort((a: any, b: any) => Math.abs(b.ca_der - b.ca_prec) - Math.abs(a.ca_der - a.ca_prec))[0];
                  const dBig = big && big.ca_prec ? ((big.ca_der - big.ca_prec) / big.ca_prec) * 100 : 0;
                  return (
                    <Takeaway>
                      {tr(
                        `${yd} dépasse ${yp} sur ${up} mois sur ${both.length} comparables (${d >= 0 ? "+" : ""}${fmt(d, 1)} % au total sur ces mois).${big ? ` Le plus grand écart est en ${big.mois} (${dBig >= 0 ? "+" : ""}${fmt(dBig, 0)} %).` : ""}`,
                        `${yd} beats ${yp} in ${up} of ${both.length} comparable months (${d >= 0 ? "+" : ""}${fmt(d, 1)}% overall on those months).${big ? ` The largest gap is in ${trData(big.mois)} (${dBig >= 0 ? "+" : ""}${fmt(dBig, 0)}%).` : ""}`
                      )}
                    </Takeaway>
                  );
                })()}
              </div>
            </>
          )}
        </div>
      )}

      {/* ──────────────────────────────────────────────
          TAB 2 · TOP PRODUITS
          ────────────────────────────────────────────── */}
      {activeTab === "top" && (
        <div className="sw" style={{ paddingTop:"14px" }}>
          <div className="sec-title" style={{ display:"flex", alignItems:"center", gap:"9px"}}>
            <IconTrophy size={16} /> {tr("Classement des Produits par Chiffre d'Affaires", "Product Ranking by Revenue")}
          </div>

          <div style={{ display:"flex", alignItems:"center", gap:"16px", margin:"0 4px 18px",
                        padding:"12px 20px", borderRadius:"12px",
                        background: PAPER_2, border:"1px solid var(--dk-line, #E3E4DD)"}}>
            <IconBar size={18} color={ORANGE} />
            <span style={{ fontSize:"0.8rem", fontWeight:800, color:"var(--dk-ink2, #3F4A42)", whiteSpace:"nowrap" }}>
              {tr("Nombre de produits à afficher", "Number of products to show")}
            </span>
            <input type="range" min={5} max={20} step={1} value={topN}
                   onChange={(e)=>setTopN(parseInt(e.target.value))}
                   style={{ flex:1, accentColor: ORANGE }} />
            <span style={{ fontSize:"1rem", fontWeight:800, color: ORANGE,
                           background:"var(--dk-surface, #fff)", padding:"2px 10px", borderRadius:"8px",
                           border:`1.5px solid ${ORANGE}`, minWidth:"36px", textAlign:"center" }}>
              {topN}
            </span>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr", gap:"16px" }}>
            <div className="cc" style={{ padding:"20px 24px" }}>
              <ChartAssistantButton chartType="top_products_revenue" chartData={{ items: (topProds.by_ca || []).slice(0, topN), n: topN }} chartName="TopNHBar"
                userQuestion="Explique ce graphique des top produits par revenu" position="top-right" onOpenChat={openChat} />
              <div className="ct">{tr(`Les ${topN} produits qui rapportent le plus`, `The ${topN} top-earning products`)}</div>
              <div className="cs">{tr("Chiffre d'affaires de chaque produit (axe en euros, à partir de 0) et sa part du total", "Each product's revenue (axis in euros, from 0) and its share of the total")}</div>
              <div style={{ marginTop:"8px" }}>
                {topProds.by_ca?.length > 0 && <TopNHBar data={topProds.by_ca} n={topN}/>}
              </div>
            </div>
          </div>

          <InsightBox
            icon={<IconPin size={16} color={C3}/>} color={C3}
            title={tr(`Les ${topN} premiers produits réalisent ${fmt(pareto.total, 1)} % du chiffre d'affaires`,
                     `The top ${topN} products generate ${fmt(pareto.total, 1)} % of revenue`)}
            strong={pareto.paretoOk ? tr("Forte concentration", "High concentration") : tr("Concentration modérée", "Moderate concentration")}
            asRow
          />
        </div>
      )}

      {/* ──────────────────────────────────────────────
          TAB 3 · SAISONNALITÉ
          ────────────────────────────────────────────── */}
      {activeTab === "saison" && (
        <div className="sw" style={{ paddingTop:"14px" }}>
          <div className="sec-title" style={{ display:"flex", alignItems:"center", gap:"9px"}}>
            <IconCalendar size={16} /> {tr("Saisonnalité — CA par Jour de la Semaine", "Seasonality — Revenue by Day of the Week")}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr", gap:"16px" }}>
            <div className="cc" style={{ padding:"20px 24px" }}>
              <ChartAssistantButton chartType="day_of_week_bars" chartData={{ days: seasonality.days, mode: "moyen" }} chartName="DayOfWeekBars"
                userQuestion="Explique ce graphique du CA moyen par jour de la semaine" position="top-right" onOpenChat={openChat} />
              <div className="ct">{tr("Chiffre d'affaires moyen par jour d'ouverture", "Average revenue per opening day")}</div>
              <div className="cs">{tr("Certains jours sont fermés une partie de l'année : la moyenne par jour ouvert permet de comparer les jours entre eux",
                                      "Some days are closed part of the year: the average per open day makes the days comparable")}</div>
              <div style={{ height:"320px", width:"100%", marginTop:"10px" }}>
                {seasonality.days?.length > 0 && <DayOfWeekBars days={seasonality.days} mode="moyen"/>}
              </div>
            </div>
          </div>

          {saisonInsights && (
            <InsightBox
              icon={<IconCalendarDays size={16} color={C1}/>} color={C1}
              title={tr(`Meilleur jour : ${saisonInsights.best.day} (${fmt(saisonInsights.best.ca_moyen)} €/j en moyenne) · Jour le plus faible : ${saisonInsights.worst.day} (${fmt(saisonInsights.worst.ca_moyen)} €/j)`,
                         `Best day: ${trData(saisonInsights.best.day)} (${fmt(saisonInsights.best.ca_moyen)} €/d on average) · Weakest day: ${trData(saisonInsights.worst.day)} (${fmt(saisonInsights.worst.ca_moyen)} €/d)`)}
              strong={tr(`Ratio de variabilité : ${saisonInsights.ratio.toFixed(1)}×`, `Variability ratio: ${saisonInsights.ratio.toFixed(1)}×`)}
              asRow
            />
          )}

          {seasonality.hourly?.length > 0 && (
            <>
              <div className="sec-title" style={{ display:"flex", alignItems:"center", gap:"9px"}}>
                <IconClock size={16} /> {tr("Distribution Horaire des Ventes", "Hourly Sales Distribution")}
              </div>
              <div className="cc" style={{ padding:"20px 24px" }}>
                <ChartAssistantButton chartType="hourly_dual" chartData={{ data: seasonality.hourly }} chartName="HourlyDual"
                  userQuestion="Explique ce graphique du CA et des tickets par heure" position="top-right" onOpenChat={openChat} />
                <div className="ct">{tr("Chiffre d'affaires et tickets par heure", "Revenue and transactions by hour")}</div>
                <div className="cs">{tr("Une seule échelle : chiffre d'affaires par heure ; le nombre de tickets est indiqué au-dessus de chaque barre", "One scale: revenue by hour; the number of transactions is shown above each bar")}</div>
                <div style={{ height:"320px", width:"100%", marginTop:"12px" }}>
                  <HourlyDual data={seasonality.hourly}/>
                </div>
                {seasonality.hourly?.length > 0 && (() => {
                  const h = seasonality.hourly;
                  const tot = h.reduce((a: number, x: any) => a + x.ca, 0) || 1;
                  const pk = h.reduce((m: any, x: any) => (x.ca > m.ca ? x : m), h[0]);
                  const matin = h.filter((x: any) => x.hour < 13).reduce((a: number, x: any) => a + x.ca, 0);
                  return (
                    <Takeaway>
                      {tr(
                        `Pic à ${pk.heure_label} (${fmt((pk.ca / tot) * 100, 0)} % du chiffre d'affaires) ; ${fmt((matin / tot) * 100, 0)} % des ventes se font avant 13 h.`,
                        `Peak at ${pk.heure_label} (${fmt((pk.ca / tot) * 100, 0)}% of revenue); ${fmt((matin / tot) * 100, 0)}% of sales happen before 1 pm.`
                      )}
                    </Takeaway>
                  );
                })()}
              </div>
            </>
          )}
        </div>
      )}

      {/* ──────────────────────────────────────────────
          TAB 4 · CATÉGORIES
          ────────────────────────────────────────────── */}
      {activeTab === "categories" && (
        <div className="sw" style={{ paddingTop:"14px" }}>
          <div className="sec-title" style={{ display:"flex", alignItems:"center", gap:"9px"}}>
            <IconTag size={16} /> {tr("Performance par Catégorie de Produits", "Performance by Product Category")}
          </div>

          {/* Treemap des catégories retiré : il répétait le graphique et le tableau ci-dessous. */}
          {categories.length > 0 && (
            <div style={{ display:"grid", gridTemplateColumns:"1fr", gap:"32px", marginBottom:"40px" }}>
              <div className="cc" style={{ padding:"28px 32px" }}>
                <ChartAssistantButton chartType="category_performance_hbar" chartData={{ data: categories, field: "ca" }} chartName="CategoryPerformanceHBar"
                  userQuestion="Explique la répartition du chiffre d'affaires par catégorie" position="top-right" onOpenChat={openChat} />
                <div className="ct">{tr("Chiffre d'affaires par catégorie", "Revenue by category")}</div>
                <div className="cs">{tr("Montant et part du total", "Amount and share of total")}</div>
                <div style={{ marginTop:"20px" }}>
                  <CatHBar data={categories} field="ca"
                    labelFn={(_v, r) => `${fmt(r.part, 1)} %`} />
                </div>
                {categories[0] && (
                  <Takeaway>
                    {tr(
                      `${categories[0].category} fait ${fmt(categories[0].part, 0)} % du chiffre d'affaires${categories[1] ? `, devant ${categories[1].category} (${fmt(categories[1].part, 0)} %)` : ""}.`,
                      `${trData(categories[0].category)} makes ${fmt(categories[0].part, 0)}% of revenue${categories[1] ? `, ahead of ${trData(categories[1].category)} (${fmt(categories[1].part, 0)}%)` : ""}.`
                    )}
                  </Takeaway>
                )}
              </div>
            </div>
          )}

          {categories.length > 0 && (
            <>
              <div className="sec-title" style={{ display:"flex", alignItems:"center", gap:"9px"}}>
                <IconBarsGrouped size={16} /> {tr("Tableau Récapitulatif des Catégories", "Category Summary Table")}
              </div>
              <div className="cc" style={{ padding:"20px 32px 32px", marginTop:"14px" }}>
                <ChartAssistantButton chartType="category_summary_table" chartData={{ categories }} chartName="CategorySummaryTable"
                  userQuestion="Explique le tableau récapitulatif des catégories" position="top-right" onOpenChat={openChat} />
                <div style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"separate", borderSpacing:0, marginTop:"8px" }}>
                    <thead>
                      <tr style={{ borderBottom:"1px solid var(--dk-line, #ECEDE7)", color:MUTED,
                                  fontSize:"0.68rem", textTransform:"uppercase",
                                  letterSpacing:"0.05em", textAlign:"right", fontWeight:800 }}>
                        <th style={{ textAlign:"left", padding:"14px 8px"}}>{tr("Catégorie", "Category")}</th>
                        <th style={{ padding:"14px 8px", minWidth:"200px"}}>{tr("Chiffre d'affaires", "Revenue")}</th>
                        <th style={{ padding:"14px 8px", minWidth:"160px"}}>{tr("Part du total", "Share of total")}</th>
                        <th style={{ padding:"14px 8px"}}>{tr("Tickets", "Transactions")}</th>
                        <th style={{ padding:"14px 8px"}} title={tr("Montant moyen dépensé dans la catégorie par ticket qui la contient", "Average amount spent in the category per transaction that includes it")}>{tr("Dépense / ticket", "Spend / transaction")}</th>
                        <th style={{ padding:"14px 8px"}}>{tr("Produits", "Products")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const maxCa = Math.max(...categories.map(c=>c.ca), 1);
                        return categories.map((c, i) => {
                          const caPct = (c.ca / maxCa) * 100;
                          const partPct = Math.min(c.part, 100);
                          return (
                            <tr key={i} style={{ borderBottom:"1px solid var(--dk-surface, #FCFCFA)" }}>
                              <td style={{ padding:"13px 8px", fontSize:"0.82rem", fontWeight:800,
                                           color:INK, textAlign:"left",
                                           display:"flex", alignItems:"center", gap:"10px" }}>
                                <div style={{ width:"9px", height:"9px", borderRadius:"50%",
                                              background: PALETTE[i % PALETTE.length],
                                              boxShadow:`0 0 0 2px ${PALETTE[i % PALETTE.length]}25` }}/>
                                {trData(c.category)}
                              </td>
                              <td style={{ padding:"13px 8px" }}>
                                <div style={{ display:"flex", alignItems:"center", gap:"8px"}}>
                                  <div style={{ flex:1, height:"14px", borderRadius:"4px",
                                                background:"var(--dk-soft, #F5F6F1)", overflow:"hidden" }}>
                                    <div style={{
                                      width:`${caPct}%`, height:"100%",
                                      background:`linear-gradient(90deg, color-mix(in srgb, ${ORANGE} 33%, transparent), color-mix(in srgb, ${ORANGE} 80%, transparent))` }}/>
                                  </div>
                                  <span style={{ fontSize:"0.78rem", fontWeight:800, color:INK,
                                                 whiteSpace:"nowrap", width:"72px", textAlign:"right" }}>
                                    {fmt(c.ca)} €
                                  </span>
                                </div>
                              </td>
                              <td style={{ padding:"13px 8px" }}>
                                <div style={{ display:"flex", alignItems:"center", gap:"8px"}}>
                                  <div style={{ flex:1, height:"14px", borderRadius:"4px",
                                                background:"var(--dk-soft, #F5F6F1)", overflow:"hidden" }}>
                                    <div style={{ width:`${partPct}%`, height:"100%",
                                                  background:`linear-gradient(90deg, ${C1}55, ${C3}aa)` }}/>
                                  </div>
                                  <span style={{ fontSize:"0.78rem", fontWeight:800, color:MUTED,
                                                 whiteSpace:"nowrap", width:"42px", textAlign:"right" }}>
                                    {fmt(c.part, 1)} %
                                  </span>
                                </div>
                              </td>
                              <td style={{ padding:"13px 8px", textAlign:"right",
                                           fontSize:"0.78rem", fontWeight:600, color:INK }}>
                                {fmt(c.tickets)}
                              </td>
                              <td style={{ padding:"13px 8px", textAlign:"right",
                                           fontSize:"0.78rem", fontWeight:600, color:INK }}>
                                {fmt(c.panier, 2)} €
                              </td>
                              <td style={{ padding:"13px 8px", textAlign:"right",
                                           fontSize:"0.78rem", fontWeight:600, color:MUTED }}>
                                {fmt(c.produits)}
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════
   SOUS-COMPOSANTS UI
   ════════════════════════════════════════════════ */

const opaqueSelect: React.CSSProperties = {
  fontSize:"0.78rem",
  fontWeight:700,
  color: INK,                 // texte SOMBRE (opaque, lisible)
  background: "var(--dk-surface, #fff)",         // fond BLANC OPAQUE (pas transparent)
  border:"1px solid var(--dk-line, rgba(140,160,140,.35))",
  borderRadius:"8px",
  padding:"7px 10px",
  outline:"none",
  cursor:"pointer",
  minWidth:"110px",
  boxShadow:"inset 0 1px 2px rgba(0,0,0,0.03)",
  transition:"all .15s",
};

function LegendPill({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:"6px",
                   background:`color-mix(in srgb, ${color} 8%, transparent)`, border:`1px solid color-mix(in srgb, ${color} 33%, transparent)`,
                   borderRadius:"999px", padding:"3px 10px",
                   fontSize:"0.72rem", fontWeight:700, color }}>
      <span style={{ width:"6px", height:"6px", borderRadius:"50%", background:color }}/>
      {label}
    </span>
  );
}

// Phrase qui dit ce qu'il faut retenir du graphique (calculée à partir des données)
function Takeaway({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 10, fontSize: ".8rem", color: INK, lineHeight: 1.45, borderLeft: `3px solid ${ORANGE}`, paddingLeft: 10 }}>
      {children}
    </div>
  );
}

function InsightBox({ icon, color, title, strong, asRow = false }: {
  icon: React.ReactNode; color: string; title: string; strong?: string; asRow?: boolean;
}) {
  const style: React.CSSProperties = asRow ? {
    marginTop:"16px", padding:"14px 18px", borderRadius:"12px",
    borderTop:`4px solid ${color}`,
    background: PAPER,
    border:`1px solid var(--dk-line, rgba(140,160,140,.30))`,
    borderLeft:`4px solid ${color}`,
    display:"flex", alignItems:"center", justifyContent:"space-between",
    gap:"12px", flexWrap:"wrap",
  } : {
    padding:"14px 18px", borderRadius:"12px",
    background: PAPER,
    border:`1px solid color-mix(in srgb, ${color} 27%, transparent)`,
    borderLeft:`4px solid ${color}`,
  };
  return (
    <div style={style}>
      <div style={{ fontSize:"0.85rem", color:"var(--dk-ink2, #3F4A42)", lineHeight:1.45,
                    display:"flex", alignItems:"flex-start", gap:"8px" }}>
        <span style={{ flexShrink:0, marginTop:"1px"}}>{icon}</span>
        <span>
          <strong style={{ fontWeight:800 }}>{title}</strong>
          {strong && !asRow && (
            <div style={{ marginTop:"4px", fontWeight:700, color }}>{strong}</div>
          )}
        </span>
      </div>
      {asRow && strong && (
        <span style={{ fontSize:"0.82rem", fontWeight:800, color, whiteSpace:"nowrap" }}>
          {strong}
        </span>
      )}
    </div>
  );
}
