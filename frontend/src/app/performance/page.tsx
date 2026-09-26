"use client";

import React, { useEffect, useMemo, useState } from "react";
import { fetchPerformance } from "@/lib/api";
import {
  IconTrendUp, IconTrophy, IconCalendar, IconTag, IconFilter,
  IconCash, IconTicket, IconCart, IconCalendarDays, IconBox,
  IconClock, IconGrid, IconArrowMaxUp, IconArrowMinDown,
  IconBar, IconPin, IconSparkline, IconScale, IconBarsGrouped,
  ink, muted, stroke, strokeAlt
} from "@/components/Icons";

/* ════════════════════════════════════════════════
   PALETTE (identique Vue du Jour + tons chauds)
   ════════════════════════════════════════════════ */
const ORANGE = stroke;                 // "#E8734A"
const PEACH = strokeAlt;               // "#F0A882"
const LIGHT = "#FAD4C4";
const INK = ink;                       // "#1C1410"
const MUTED = muted;                   // "#9a8070"
const C1 = "#C4A882";                  // beige foncé
const C2 = "#C8860A";                  // doré
const C3 = "#E6A817";                  // ambre
const PANIER = "#27AE60";
const TICKETS = "#3498DB";
const PAPER = "#FDF6EC";               // fond crème carte (opaque)
const PAPER_2 = "#FBF2E7";
const PALETTE: string[] = [C1, C2, C3, "#27AE60", "#3498DB", "#8E44AD", "#E74C3C", "#1ABC9C", "#F39C12", "#2ECC71", "#9B59B6", "#16A085"];

function fmt(n: number, dec = 0) {
  return Number(n || 0).toLocaleString("fr-FR", {
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
            ? `Zoom : ${series[effStart].label} → ${series[effEnd].label} · Double-cliquez ou cliquez ici pour réinitialiser`
            : "Glissez une sélection horizontale sur le graphique pour zoomer"}
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
            × Réinitialiser zoom
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
              fontSize="13" fill={ORANGE} fontWeight="800">μ Moyenne {fmt(moyenne)} €</text>
        <line x1={padL} x2={W - padR} y1={getY(moyenne + ecartType)} y2={getY(moyenne + ecartType)}
              stroke={C1} strokeWidth="1.2" strokeDasharray="4 4" opacity="0.8"/>
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={getY(v)} y2={getY(v)} stroke="#f2e9e1" strokeWidth="1"/>
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
                    fill="#fff" stroke={ORANGE} strokeWidth="1.3" style={{ filter: "drop-shadow(0 4px 8px rgba(232,115,74,0.18))" }}/>
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
                    fill="#fff" stroke={C1} strokeWidth="1.3" style={{ filter: "drop-shadow(0 4px 8px rgba(196,168,130,0.18))" }}/>
              <text x={pt.x} y={pt.y + 68} textAnchor="middle" fontSize="12" fill={C1} fontWeight="800">
                MIN · {fmt(s.ca)} €
              </text>
            </g>
          );
        })()}
        {pts.map(({ x, y, s, i }) => (
          <circle key={i} cx={x} cy={y} r={12} fill="transparent" stroke="transparent" style={{ cursor: "pointer" }}>
            <title>{`${s.label}\nChiffre d'Affaires : ${fmt(s.ca)} €`}</title>
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

function Comp2425BarChart({ data }: { data: Array<{ mois: string; ca_2024: number; ca_2025: number }> }) {
  const W = 1100, H = 400, padL = 60, padR = 40, padT = 30, padB = 64;
  const max = Math.max(...data.flatMap(d => [d.ca_2024, d.ca_2025]), 1) * 1.1;
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
            <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="#f2e9e1"/>
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
        const y24 = getY(d.ca_2024), y25 = getY(d.ca_2025);
        return (
          <g key={i}>
            <rect x={x24} y={y24} width={barW} height={getY(0) - y24} rx={3} fill={C1} fillOpacity="0.88"/>
            <rect x={x25} y={y25} width={barW} height={getY(0) - y25} rx={3} fill={ORANGE} fillOpacity="0.92"/>
            <text x={gx + groupW / 2} y={H - padB + 18} textAnchor="middle"
                  fontSize="11" fill={INK} fontWeight="700">{d.mois}</text>
          </g>
        );
      })}
      <g transform={`translate(${W - padR - 180}, 6)`}>
        <rect x="0" y="0" width="12" height="12" rx="3" fill={C1}/>
        <text x="18" y="10" fontSize="11" fill={INK} fontWeight="700">2024</text>
        <rect x="80" y="0" width="12" height="12" rx="3" fill={ORANGE}/>
        <text x="98" y="10" fontSize="11" fill={INK} fontWeight="700">2025</text>
      </g>
    </svg>
  );
}

function TopNHBar({ data, n }: { data: Array<{ article: string; total_revenue: number; part: number }>; n: number }) {
  const items = data.slice(0, n);
  const max = Math.max(...items.map(i => i.total_revenue), 1);
  const H = Math.max(320, items.length * 34 + 40);
  const W = 760, padL = 220, padR = 90, padT = 10, padB = 10;
  const rowH = (H - padT - padB) / items.length;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H, maxHeight: "70vh" }} preserveAspectRatio="xMidYMid meet">
      {[0.25, 0.5, 0.75, 1].map((t, i) => {
        const v = t * max;
        const x = padL + t * (W - padL - padR);
        return (
          <g key={i}>
            <line x1={x} x2={x} y1={padT} y2={H - padB} stroke="#f8f3ee"/>
            <text x={x} y={H - padB + 14} textAnchor="middle" fontSize="10" fill={MUTED} fontWeight="600">
              {fmt(v / 1000, v > 10000 ? 0 : 1)}k€
            </text>
          </g>
        );
      })}
      {items.map((it, i) => {
        const color = i < 3 ? ORANGE : (i < Math.floor(n * 0.6) ? C2 : C3);
        const y = padT + i * rowH;
        const w = (it.total_revenue / max) * (W - padL - padR);
        return (
          <g key={i}>
            <text x={padL - 10} y={y + rowH * 0.64} textAnchor="end"
                  fontSize="11.5" fill={INK} fontWeight="700">
              {it.article.length > 26 ? it.article.slice(0, 26) + "…" : it.article}
            </text>
            <rect x={padL} y={y + rowH * 0.14} width={w} height={rowH * 0.72}
                  rx={4} fill={color} fillOpacity="0.9"/>
            <text x={padL + w + 8} y={y + rowH * 0.68}
                  fontSize="10.5" fill={color} fontWeight="800">{it.part}%</text>
          </g>
        );
      })}
    </svg>
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
          <path key={i} d={a.d} fill={a.color} stroke="#fff" strokeWidth="2"/>
        ))}
        <text x={cx} y={cy - 8} textAnchor="middle" fontSize="15" fill={MUTED} fontWeight="600">CA Top {n}</text>
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
            <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="#f2e9e1"/>
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
                  fontSize="11.5" fill={INK} fontWeight="700">{d.day}</text>
          </g>
        );
      })}
      <text x={padL} y={H - padB + 44} fontSize="10" fill={MUTED} fontWeight="700">
        {mode === "total" ? "CA cumulé sur la période (€)" : "CA moyen par jour ouvert (€/j)"}
      </text>
    </svg>
  );
}

function HourlyDual({ data }: { data: Array<{ hour: number; heure_label: string; ca: number; tickets: number }> }) {
  const W = 780, H = 320, padL = 44, padR = 50, padT = 20, padB = 50;
  const maxCA = Math.max(...data.map(d => d.ca), 1) * 1.1;
  const maxTk = Math.max(...data.map(d => d.tickets), 1) * 1.15;
  const n = data.length;
  const bw = (W - padL - padR) / n * 0.62;
  const getYca = (v: number) => padT + (H - padT - padB) * (1 - v / maxCA);
  const getYtk = (v: number) => padT + (H - padT - padB) * (1 - v / maxTk);
  const groupW = (W - padL - padR) / n;

  const pts = data.map((d, i) => {
    const gx = padL + i * groupW + groupW / 2;
    return { x: gx, y: getYtk(d.tickets), t: d.tickets };
  });
  let lpath = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    lpath += ` C ${mx} ${pts[i].y}, ${mx} ${pts[i + 1].y}, ${pts[i + 1].x} ${pts[i + 1].y}`;
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "100%" }} preserveAspectRatio="xMidYMid meet">
      {[0.25, 0.5, 0.75, 1].map((t, i) => {
        const v = t * maxCA, y = getYca(v);
        return (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="#f2e9e1"/>
            <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="10" fill={C2} fontWeight="700">
              {fmt(v / 1000, v > 10000 ? 0 : 1)}k€
            </text>
          </g>
        );
      })}
      {[0, 0.5, 1].map((t, i) => {
        const v = t * maxTk;
        return (
          <text key={i} x={W - padR + 6} y={getYtk(v) + 3} textAnchor="start" fontSize="10" fill={C1} fontWeight="700">
            {fmt(v)}
          </text>
        );
      })}
      {data.map((d, i) => {
        const gx = padL + i * groupW + (groupW - bw) / 2;
        return (
          <g key={i}>
            <rect x={gx} y={getYca(d.ca)} width={bw} height={getYca(0) - getYca(d.ca)}
                  rx={3} fill={C2} fillOpacity="0.8"/>
            <text x={gx + bw / 2} y={H - padB + 20} textAnchor="middle"
                  fontSize="10.5" fill={INK} fontWeight="700">{d.heure_label}</text>
          </g>
        );
      })}
      <path d={lpath} fill="none" stroke={ORANGE} strokeWidth="2.6" strokeLinecap="round"/>
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="4.2" fill="#fff" stroke={ORANGE} strokeWidth="2"/>
      ))}
      <g transform={`translate(${padL + 10}, ${H - 8})`}>
        <rect x="0" y="-10" width="12" height="12" rx="3" fill={C2}/>
        <text x="18" y="0" fontSize="10.5" fill={INK} fontWeight="700">CA (€) — axe gauche</text>
        <line x1="220" y1="-4" x2="248" y2="-4" stroke={ORANGE} strokeWidth="2.5"/>
        <circle cx="250" cy="-4" r="4" fill="#fff" stroke={ORANGE} strokeWidth="2"/>
        <text x="258" y="0" fontSize="10.5" fill={INK} fontWeight="700">Tickets — axe droit</text>
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
            {b.d.category}
          </text>
          <text x={b.x + b.w / 2} y={b.y + b.h / 2 + 6} textAnchor="middle"
                fontSize={Math.min(14, b.h * 0.2)} fill={INK} fontWeight="700">
            {fmt(b.d.ca / 1000, b.d.ca > 10000 ? 0 : 1)}k€
          </text>
          <text x={b.x + b.w / 2} y={b.y + b.h / 2 + 26} textAnchor="middle"
                fontSize={Math.min(12, b.h * 0.18)} fill={MUTED} fontWeight="700">
            {b.d.part}% · PM {fmt(b.d.panier, 2)}€
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
        return <line key={i} x1={x} x2={x} y1={padT} y2={H - padB} stroke="#f8f3ee"/>;
      })}
      {data.map((it, i) => {
        const color = PALETTE[i % PALETTE.length];
        const y = padT + i * rowH;
        const w = ((it[field] as number) / max) * (W - padL - padR);
        return (
          <g key={i}>
            <text x={padL - 10} y={y + rowH * 0.62} textAnchor="end"
                  fontSize="12.5" fill={INK} fontWeight="700">{it.category}</text>
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
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [annee, setAnnee] = useState<string>("2024 + 2025");
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
        <IconSparkline size={20} /> Chargement de l'analyse commerciale...
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
          Performance <span style={{ color: ORANGE }}>Générale</span>
        </h1>
        <p style={{ color:MUTED, fontSize:"0.82rem", marginTop:"6px",
                    maxWidth:"640px", lineHeight:1.5 }}>
          Analyse globale du chiffre d'affaires, performance des produits, saisonnalité et dynamique des catégories.
        </p>
      </div>

      {/* ══════ FILTRES — Fond normal, dans la page ══════ */}
      <div className="sw" style={{ marginBottom: "8px" }}>
        <div style={{ display:"flex", flexWrap:"wrap", alignItems:"stretch", gap:"14px",
                      padding:"14px 18px", borderRadius:"14px",
                      background:"#fff",
                      border:"1px solid rgba(200,140,100,0.18)",
                      boxShadow:"0 2px 12px rgba(0,0,0,0.06)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"10px",
                        fontSize:"0.72rem", fontWeight:800,
                        color: ORANGE, textTransform:"uppercase", letterSpacing:"0.06em",
                        borderRight:`1px solid rgba(196,168,130,.35)`,
                        paddingRight:"16px", flexShrink:0}}>
            <IconFilter size={16} />
            Filtres d'Analyse
          </div>

          {[
            { label: "Année", icon: <IconCalendarDays size={14} />, val: annee, set: setAnnee, opts: filters.annees },
            { label: "Saison", icon: <IconCalendar size={14} />, val: saison, set: setSaison, opts: filters.saisons },
            { label: "Mois", icon: <IconTag size={14} />, val: mois, set: setMois, opts: filters.mois },
            { label: "Catégorie", icon: <IconGrid size={14} />, val: categorie, set: setCategorie, opts: filters.categories },
            { label: "Événement", icon: <IconPin size={14} />, val: evenement, set: setEvenement, opts: filters.evenements },
          ].map((f) => (
            <div key={f.label} style={{ display:"flex", alignItems:"center", gap:"8px" }}>
              <label style={{ display:"inline-flex", alignItems:"center", gap:"5px",
                              fontSize:"0.72rem", fontWeight:700, color:"#5C4033" }}>
                {f.icon}
                {f.label}
              </label>
              <select value={f.val} onChange={(e)=>f.set(e.target.value)} style={opaqueSelect}>
                {f.opts.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
          ))}
        </div>

        {(() => {
          const pills: Array<{ icon: React.ReactNode; text: string }> = [];
          if (annee && annee !== "2024 + 2025" && annee !== "Toutes")
            pills.push({ icon:<IconCalendarDays size={12} />, text:`${annee}` });
          if (saison && saison !== "Toutes")
            pills.push({ icon:<IconCalendar size={12} />, text:`${saison}` });
          if (mois && mois !== "Tous")
            pills.push({ icon:<IconTag size={12} />, text:`${mois}` });
          if (categorie && categorie !== "Toutes")
            pills.push({ icon:<IconGrid size={12} />, text:`${categorie}` });
          if (evenement && evenement !== "Tous")
            pills.push({ icon:<IconPin size={12} />, text:`${evenement}` });
          if (!pills.length) return null;
          return (
            <div style={{ marginTop:"10px", display:"flex", flexWrap:"wrap", gap:"6px" }}>
              {pills.map((p, i) => (
                <span key={i} style={{ display:"inline-flex", alignItems:"center", gap:"6px",
                  background:"#fff", border:"1px solid rgba(196,168,130,.3)",
                  borderRadius:"999px", padding:"3px 10px",
                  fontSize:"0.72rem", fontWeight:700, color:"#5C4033",
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
        <IconBarsGrouped size={16} /> Indicateurs Clés de Performance
      </div>
      <div className="sw">
        <div style={{ display:"grid", gridTemplateColumns:"repeat(5, 1fr)", gap:"12px" }}>
          {[
            { icon: <IconCash size={16}/>, lbl:"CA Total", sub:"chiffre d'affaires", val:`${fmt(kpis.total_ca/1000,1)} k€`, accent: ORANGE },
            { icon: <IconTicket size={16}/>, lbl:"Tickets", sub:"transactions clients", val: fmt(kpis.nb_tickets), accent: C2 },
            { icon: <IconCart size={16}/>, lbl:"Panier Moyen", sub:"par visite", val:`${fmt(kpis.panier,2)} €`, accent: C3 },
            { icon: <IconCalendarDays size={16}/>, lbl:"Jours Actifs", sub:"jours avec ventes", val: fmt(kpis.nb_jours), accent: PANIER },
            { icon: <IconBox size={16}/>, lbl:"Références", sub:"produits vendus", val: fmt(kpis.nb_produits), accent: TICKETS },
          ].map((k) => (
            <div key={k.lbl} className="cc" style={{
              borderBottom: `3px solid ${k.accent}`,
              borderRadius: "12px 12px 14px 14px",
              position:"relative", overflow:"hidden",
            }}>
              <div style={{ display:"flex", alignItems:"center", gap:"7px", marginBottom:"6px"}}>
                <div style={{ width:"22px", height:"22px", borderRadius:"6px",
                              background:`${k.accent}18`, display:"flex",
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
        <div style={{ display:"flex", gap:"4px", borderBottom:"2px solid rgba(196,168,130,.22)", paddingBottom:0 }}>
          {([
            { id:"evolution", iconSvg:<IconTrendUp size={16}/>, label:"Évolution du CA" },
            { id:"top",       iconSvg:<IconTrophy size={16}/>, label:"Top Produits" },
            { id:"saison",    iconSvg:<IconCalendar size={16}/>, label:"Saisonnalité" },
            { id:"categories",iconSvg:<IconTag size={16}/>,    label:"Catégories" },
          ] as const).map((t) => (
            <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{
              display:"inline-flex", alignItems:"center", gap:"8px",
              fontSize:"0.9rem", fontWeight: activeTab===t.id ? 800 : 600,
              color: activeTab===t.id ? "#5C4033" : MUTED,
              background: activeTab===t.id ? "rgba(232,115,74,0.08)" : "transparent",
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
            <IconTrendUp size={16} /> Évolution Mensuelle du Chiffre d'Affaires
          </div>
          <div className="cc" style={{ padding:"20px 24px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start",
                          marginBottom:"12px", flexWrap:"wrap", gap:"10px" }}>
              <div>
                <div className="ct">Courbe, Moyenne & Écart-Type</div>
                <div className="cs">Moyenne mensuelle μ : {fmt(monthly.moyenne)} € (± {fmt(monthly.ecart_type)} € σ)</div>
              </div>
              <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>
                <LegendPill color={C1} label="μ − σ"/>
                <LegendPill color={ORANGE} label="μ Moyenne"/>
                <LegendPill color={C1} label="μ + σ"/>
                <LegendPill color={C2} label="CA mensuel"/>
              </div>
            </div>
            <div style={{ height:"520px", width:"100%", marginTop:"20px" }}>
              {monthly.series && <EvolutionLineChart
                series={monthly.series} moyenne={monthly.moyenne} ecartType={monthly.ecart_type}
                caMax={monthly.ca_max} caMin={monthly.ca_min} />}
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:"12px",
                          marginTop:"24px", paddingTop:"20px", borderTop:"1px solid #f2e9e1" }}>
              <InsightBox icon={<IconArrowMaxUp size={16} color={ORANGE}/>} color={ORANGE}
                title="Meilleur mois"
                strong={`${monthly.ca_max?.date_str} — ${fmt(monthly.ca_max?.val)} €`}/>
              <InsightBox icon={<IconArrowMinDown size={16} color={C1}/>} color={C1}
                title="Mois le plus faible"
                strong={`${monthly.ca_min?.date_str} — ${fmt(monthly.ca_min?.val)} €`}/>
              <InsightBox icon={<IconScale size={16} color={C3}/>} color={C3}
                title="Amplitude saisonnière"
                strong={`${fmt(monthly.amplitude)} € — ratio ${Number(monthly.ratio_amp||0).toFixed(1)}×`}/>
            </div>
          </div>

          {annee === "2024 + 2025" && monthly.comp_24_25?.length > 0 && (
            <>
              <div className="sec-title" style={{ display:"flex", alignItems:"center", gap:"9px"}}>
                <IconBarsGrouped size={16} /> Comparaison 2024 vs 2025 — Mois par Mois
              </div>
              <div className="cc" style={{ padding:"20px 24px" }}>
                <div className="ct">Évolution année N vs N−1</div>
                <div className="cs">Barres groupées par mois — 12 mois alignés</div>
                <div style={{ height:"400px", width:"100%", marginTop:"20px" }}>
                  <Comp2425BarChart data={monthly.comp_24_25}/>
                </div>
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
            <IconTrophy size={16} /> Classement des Produits par Chiffre d'Affaires
          </div>

          <div style={{ display:"flex", alignItems:"center", gap:"16px", margin:"0 4px 18px",
                        padding:"12px 20px", borderRadius:"12px",
                        background: PAPER_2, border:"1px solid #f2e3cd"}}>
            <IconBar size={18} color={ORANGE} />
            <span style={{ fontSize:"0.8rem", fontWeight:800, color:"#5C4033", whiteSpace:"nowrap" }}>
              Nombre de produits à afficher
            </span>
            <input type="range" min={5} max={20} step={1} value={topN}
                   onChange={(e)=>setTopN(parseInt(e.target.value))}
                   style={{ flex:1, accentColor: ORANGE }} />
            <span style={{ fontSize:"1rem", fontWeight:800, color: ORANGE,
                           background:"#fff", padding:"2px 10px", borderRadius:"8px",
                           border:`1.5px solid ${ORANGE}`, minWidth:"36px", textAlign:"center" }}>
              {topN}
            </span>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"3fr 2fr", gap:"16px" }}>
            <div className="cc" style={{ padding:"20px 24px" }}>
              <div className="ct">Top {topN} CA — classement détaillé</div>
              <div className="cs">3 niveaux de couleurs : Top 3 · Milieu · Bas de classement</div>
              <div style={{ marginTop:"8px" }}>
                {topProds.by_ca?.length > 0 && <TopNHBar data={topProds.by_ca} n={topN}/>}
              </div>
            </div>
            <div className="cc" style={{ padding:"20px 24px" }}>
              <div className="ct">Répartition du CA — Top {topN}</div>
              <div className="cs">Donut 50% · Légende & pourcentages</div>
              <div style={{ marginTop:"16px", height:"100%", minHeight:"380px" }}>
                {topProds.by_ca?.length > 0 && <DonutTopN
                  data={topProds.by_ca} n={topN}
                  centerLabel={`${fmt(kpis.total_ca/1000, 0)}k€`}/>}
              </div>
            </div>
          </div>

          <InsightBox
            icon={<IconPin size={16} color={C3}/>} color={C3}
            title={`Règle de Pareto (80/20) : Les ${pareto.top80.length} premiers produits génèrent ${pareto.cumulFirst.toFixed(1)}% du CA sur les Top ${topN} (${pareto.total.toFixed(1)}% du CA total filtré)`}
            strong={pareto.paretoOk ? "Loi 80/20 validée." : "Concentration modérée."}
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
            <IconCalendar size={16} /> Saisonnalité — CA par Jour de la Semaine
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px" }}>
            <div className="cc" style={{ padding:"20px 24px" }}>
              <div className="ct">CA Cumulé par Jour</div>
              <div className="cs">Somme totale du CA sur la période filtrée</div>
              <div style={{ height:"320px", width:"100%", marginTop:"10px" }}>
                {seasonality.days?.length > 0 && <DayOfWeekBars days={seasonality.days} mode="total"/>}
              </div>
            </div>
            <div className="cc" style={{ padding:"20px 24px" }}>
              <div className="ct">CA Moyen par Jour (normalisé)</div>
              <div className="cs">CA par jour ouvert · comparaison équitable</div>
              <div style={{ height:"320px", width:"100%", marginTop:"10px" }}>
                {seasonality.days?.length > 0 && <DayOfWeekBars days={seasonality.days} mode="moyen"/>}
              </div>
            </div>
          </div>

          {saisonInsights && (
            <InsightBox
              icon={<IconCalendarDays size={16} color={C1}/>} color={C1}
              title={`Meilleur jour : ${saisonInsights.best.day} (${fmt(saisonInsights.best.ca_moyen)} €/j en moyenne) · Jour le plus faible : ${saisonInsights.worst.day} (${fmt(saisonInsights.worst.ca_moyen)} €/j)`}
              strong={`Ratio de variabilité : ${saisonInsights.ratio.toFixed(1)}×`}
              asRow
            />
          )}

          {seasonality.hourly?.length > 0 && (
            <>
              <div className="sec-title" style={{ display:"flex", alignItems:"center", gap:"9px"}}>
                <IconClock size={16} /> Distribution Horaire des Ventes
              </div>
              <div className="cc" style={{ padding:"20px 24px" }}>
                <div className="ct">Double axe : CA (barres) & Tickets (ligne)</div>
                <div className="cs">Corrélation entre pics d'affluence et CA horaire</div>
                <div style={{ height:"320px", width:"100%", marginTop:"12px" }}>
                  <HourlyDual data={seasonality.hourly}/>
                </div>
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
            <IconTag size={16} /> Performance par Catégorie de Produits
          </div>

          {categories.length > 0 && (
            <div className="cc" style={{ padding:"30px 36px", marginBottom:"40px" }}>
              <div className="ct" style={{ display:"flex", alignItems:"center", gap:"8px"}}>
                <IconGrid size={16} color={ORANGE}/> Treemap — Poids des Catégories
              </div>
              <div className="cs">Surface proportionnelle au CA · Teinte = Part · Centre = Panier Moyen</div>
              <div style={{ height:"620px", width:"100%", marginTop:"28px" }}>
                <TreemapCats data={categories}/>
              </div>
            </div>
          )}

          {categories.length > 0 && (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"32px", marginBottom:"40px" }}>
              <div className="cc" style={{ padding:"28px 32px" }}>
                <div className="ct">CA par Catégorie</div>
                <div className="cs">Chiffre d'affaires total · Part % en label</div>
                <div style={{ marginTop:"20px" }}>
                  <CatHBar data={categories} field="ca"
                    labelFn={(_v, r) => `${r.part}%`} />
                </div>
              </div>
              <div className="cc" style={{ padding:"28px 32px" }}>
                <div className="ct">Panier Moyen par Catégorie</div>
                <div className="cs">Ticket moyen de la catégorie</div>
                <div style={{ marginTop:"20px" }}>
                  <CatHBar data={categories} field="panier"
                    labelFn={(v) => `${fmt(v,2)} €`} />
                </div>
              </div>
            </div>
          )}

          {categories.length > 0 && (
            <>
              <div className="sec-title" style={{ display:"flex", alignItems:"center", gap:"9px"}}>
                <IconBarsGrouped size={16} /> Tableau Récapitulatif des Catégories
              </div>
              <div className="cc" style={{ padding:"20px 32px 32px", marginTop:"14px" }}>
                <div style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"separate", borderSpacing:0, marginTop:"8px" }}>
                    <thead>
                      <tr style={{ borderBottom:"1px solid #f2e9e1", color:MUTED,
                                  fontSize:"0.68rem", textTransform:"uppercase",
                                  letterSpacing:"0.05em", textAlign:"right", fontWeight:800 }}>
                        <th style={{ textAlign:"left", padding:"14px 8px"}}>Catégorie</th>
                        <th style={{ padding:"14px 8px", minWidth:"200px"}}>CA (€) · bar</th>
                        <th style={{ padding:"14px 8px", minWidth:"160px"}}>Part (%) · bar</th>
                        <th style={{ padding:"14px 8px"}}>Panier moy.</th>
                        <th style={{ padding:"14px 8px"}}>Tickets</th>
                        <th style={{ padding:"14px 8px"}}>Produits</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const maxCa = Math.max(...categories.map(c=>c.ca), 1);
                        return categories.map((c, i) => {
                          const caPct = (c.ca / maxCa) * 100;
                          const partPct = Math.min(c.part, 100);
                          return (
                            <tr key={i} style={{ borderBottom:"1px solid #fdfcfb" }}>
                              <td style={{ padding:"13px 8px", fontSize:"0.82rem", fontWeight:800,
                                           color:INK, textAlign:"left",
                                           display:"flex", alignItems:"center", gap:"10px" }}>
                                <div style={{ width:"9px", height:"9px", borderRadius:"50%",
                                              background: PALETTE[i % PALETTE.length],
                                              boxShadow:`0 0 0 2px ${PALETTE[i % PALETTE.length]}25` }}/>
                                {c.category}
                              </td>
                              <td style={{ padding:"13px 8px" }}>
                                <div style={{ display:"flex", alignItems:"center", gap:"8px"}}>
                                  <div style={{ flex:1, height:"14px", borderRadius:"4px",
                                                background:"#fbf5ec", overflow:"hidden" }}>
                                    <div style={{
                                      width:`${caPct}%`, height:"100%",
                                      background:`linear-gradient(90deg, ${ORANGE}55, ${ORANGE}cc)` }}/>
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
                                                background:"#fbf5ec", overflow:"hidden" }}>
                                    <div style={{ width:`${partPct}%`, height:"100%",
                                                  background:`linear-gradient(90deg, ${C1}55, ${C3}aa)` }}/>
                                  </div>
                                  <span style={{ fontSize:"0.78rem", fontWeight:800, color:MUTED,
                                                 whiteSpace:"nowrap", width:"42px", textAlign:"right" }}>
                                    {c.part}%
                                  </span>
                                </div>
                              </td>
                              <td style={{ padding:"13px 8px", textAlign:"right",
                                           fontSize:"0.78rem", fontWeight:700, color:INK }}>
                                {fmt(c.panier, 2)} €
                              </td>
                              <td style={{ padding:"13px 8px", textAlign:"right",
                                           fontSize:"0.78rem", fontWeight:600, color:INK }}>
                                {fmt(c.tickets)}
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
  background: "#fff",         // fond BLANC OPAQUE (pas transparent)
  border:"1px solid rgba(196,168,130,.35)",
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
                   background:`${color}15`, border:`1px solid ${color}55`,
                   borderRadius:"999px", padding:"3px 10px",
                   fontSize:"0.72rem", fontWeight:700, color }}>
      <span style={{ width:"6px", height:"6px", borderRadius:"50%", background:color }}/>
      {label}
    </span>
  );
}

function InsightBox({ icon, color, title, strong, asRow = false }: {
  icon: React.ReactNode; color: string; title: string; strong?: string; asRow?: boolean;
}) {
  const style: React.CSSProperties = asRow ? {
    marginTop:"16px", padding:"14px 18px", borderRadius:"12px",
    borderTop:`4px solid ${color}`,
    background: PAPER,
    border:`1px solid rgba(196,168,130,.30)`,
    borderLeft:`4px solid ${color}`,
    display:"flex", alignItems:"center", justifyContent:"space-between",
    gap:"12px", flexWrap:"wrap",
  } : {
    padding:"14px 18px", borderRadius:"12px",
    background: PAPER,
    border:`1px solid ${color}44`,
    borderLeft:`4px solid ${color}`,
  };
  return (
    <div style={style}>
      <div style={{ fontSize:"0.85rem", color:"#5C4033", lineHeight:1.45,
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
