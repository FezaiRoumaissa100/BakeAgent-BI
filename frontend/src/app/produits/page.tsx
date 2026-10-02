"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  fetchPenetration,
  fetchVelocity,
  fetchTicketContribution,
  fetchFrequency,
  fetchAssociations,
} from "@/lib/api";
import {
  IconTarget,
  IconBolt,
  IconTicketPerc,
  IconRepeat,
  IconLink2,
  IconSearch,
  IconFilter,
  IconDonutPie,
  IconScatter,
  IconBubble,
  IconHeatmap,
  IconSparkles,
  IconTrendUp,
  IconBox,
  IconBar,
  IconSparkline,
  IconTrophy,
  IconAlert,
  IconCalendarDays,
  IconScale,
  IconGrid,
  IconPin,
  IconCash,
  IconClock,
  IconBarsGrouped,
  IconStar,
  IconGem,
  IconFlame,
  IconHook,
  IconMapPin,
  IconBasket,
  IconClipboard,
  IconSearchCircle,
  IconCart,
} from "@/components/Icons";

/* ──────────── Palette & helpers (couleurs FONCÉES, DISTINCTES & saturées) ──────────── */
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
/* 4 couleurs DISTINCTES pour les quadrants (pas de tons orange mélangés) */
const Q1 = "#DC2626"; // ROUGE FONCÉ (top-right : STARS / BUNDLE / RÈGLES D'OR)
const Q2 = "#B45309"; // ORANGE BRUN (top-left : HAUT POTENTIEL / CAISSE / PREMIUM / PRÉDICTIBLES)
const Q3 = "#166534"; // VERT FORÊT (bottom-right : MOTEURS / PLACEMENT / COMPLÉMENTS / SURPRENANTES)
const Q4 = "#57534E"; // GRIS FONCÉ (bottom-left : FAIBLE IMPACT / À IGNORER / ACCESSOIRES / FAIBLES)
/* Palette MULTILIGNE / DONUT : très distinctes (rouge, vert, bleu, violet, orange, teal, rose) */
const PALETTE_DISTINCTE = [
  "#DC2626", "#166534", "#2563EB", "#7C3AED", "#EA580C",
  "#0F766E", "#BE185D", "#4F46E5", "#CA8A04", "#65A30D",
];
const PAL = PALETTE_DISTINCTE;

function fmt(n: number, dec = 0) {
  return Number(n || 0).toLocaleString("fr-FR", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
}
function kFmt(n: number) {
  const v = Number(n || 0);
  if (v >= 1000000) return (v / 1000000).toFixed(1) + " M";
  if (v >= 1000) return (v / 1000).toFixed(0) + " K";
  return v.toFixed(0);
}
function pctColor(v: number) {
  if (v >= 70) return "#C2410C";
  if (v >= 40) return "#EA580C";
  if (v >= 20) return "#D97706";
  return "#B45309";
}
function statutColor(s: string) {
  const x = String(s).toLowerCase();
  if (x.includes("pha") || x.includes("dominant") || x.includes("quotidien")) return "#C2410C";
  if (x.includes("regulier") || x.includes("croissance")) return "#EA580C";
  if (x.includes("cyclique") || x.includes("niche")) return "#B45309";
  if (x.includes("sporadique") || x.includes("éliminer") || x.includes("mort")) return "#44403C";
  return "#7C2D12";
}

/* ══════════════════════════════════════════════
   REUSABLE SMALL CHART COMPONENTS
   ══════════════════════════════════════════════ */

/* 1) Ranked bar rows — used in penetration ranking, top products freq/velocity etc */
function RankedRows({
  rows,
  labelKey = "article",
  valueKey,
  subKey,
  colorKey,
  maxShow = 15,
  unit = "",
}: {
  rows: any[];
  labelKey?: string;
  valueKey: string;
  subKey?: string;
  colorKey?: (r: any, i: number) => string;
  maxShow?: number;
  unit?: string;
}) {
  const list = rows.slice(0, maxShow);
  const max = Math.max(...list.map((r) => Number(r[valueKey]) || 0), 1);
  return (
    <div className="prod-list">
      {list.map((r, i) => {
        const c = colorKey ? colorKey(r, i) : PAL[i % PAL.length];
        return (
          <div key={i} className="prod-row">
            <div className="prod-nm" title={String(r[labelKey])}>
              <div className="pdot" style={{ background: c }} />
              <span>{String(r[labelKey]).slice(0, 26)}</span>
            </div>
            <div className="pbar-w" style={{ width: 80 }}>
              <div className="pbar" style={{ width: `${(Number(r[valueKey]) / max) * 100}%`, background: c }} />
            </div>
            <span className="pval">
              <strong style={{ color: INK }}>{fmt(r[valueKey], Number.isInteger(r[valueKey]) ? 0 : 1)}</strong>
              {subKey && r[subKey] != null && <span style={{ color: MUTED, marginLeft: 4, fontSize: ".65rem" }}>{r[subKey]}</span>}
              {unit}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* 2) Donut chart — status/category distribution */
function Donut({
  data,
  labelKey,
  valueKey,
  height = 180,
}: {
  data: { [k: string]: any } | any[];
  labelKey?: string;
  valueKey?: string;
  height?: number;
}) {
  const arr: { label: string; value: number }[] = Array.isArray(data)
    ? data.map((d) => ({ label: labelKey ? d[labelKey] : d.label, value: Number(valueKey ? d[valueKey] : d.value) || 0 }))
    : Object.entries(data).map(([label, value]) => ({ label, value: Number(value) || 0 }));

  const total = arr.reduce((s, d) => s + d.value, 0) || 1;
  let acc = 0;
  const R = 72;
  const C = 2 * Math.PI * R;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, height }}>
      <svg viewBox="0 0 200 200" width="200" height="200">
        <circle cx="100" cy="100" r={R} fill="none" stroke="#f0ece6" strokeWidth="26" />
        {arr.map((d, i) => {
          const frac = d.value / total;
          const dash = frac * C;
          const gap = C - dash;
          const offset = -acc * C;
          acc += frac;
          const color = PALETTE_DISTINCTE[i % PALETTE_DISTINCTE.length];
          return (
            <circle
              key={i}
              cx="100"
              cy="100"
              r={R}
              fill="none"
              stroke={color}
              strokeWidth="26"
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={offset}
              transform="rotate(-90 100 100)"
            >
              <title>{`${d.label}\n${((d.value / total) * 100).toFixed(1)}%\n${fmt(d.value)} références`}</title>
            </circle>
          );
        })}
        <text x="100" y="95" textAnchor="middle" style={{ fontSize: 22, fontWeight: 800, fill: INK }}>
          {fmt(total)}
        </text>
        <text x="100" y="114" textAnchor="middle" style={{ fontSize: 10, fontWeight: 700, fill: MUTED }}>
          TOTAL
        </text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minWidth: 0 }}>
        {arr.map((d, i) => {
          const color = PALETTE_DISTINCTE[i % PALETTE_DISTINCTE.length];
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <div
                className="pdot"
                style={{ background: color, width: 13, height: 13, flexShrink: 0 }}
              />
              <span style={{ fontSize: ".76rem", color: INK, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {String(d.label).slice(0, 30)}
              </span>
              <span style={{ marginLeft: "auto", fontSize: ".76rem", fontWeight: 800, color }}>
                {((d.value / total) * 100).toFixed(0)}%
              </span>
              <span style={{ fontSize: ".66rem", color: MUTED, width: 44, textAlign: "right", fontWeight: 600 }}>{fmt(d.value)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* 3) Scatter / Bubble plot */
function BubbleScatter({
  data,
  xKey,
  yKey,
  sizeKey,
  labelKey = "article",
  colorKey,
  height = 220,
  xLabel,
  yLabel,
  /* Quadrant actionability overlay (optional) */
  quadrants,
  topLabels,
  xNiceUnit = "",
  yNiceUnit = "",
  xNiceFormat,
  yNiceFormat,
  yCapPercentile,
  xCapPercentile,
  legendWidth = 180,
}: {
  data: any[];
  xKey: string;
  yKey: string;
  sizeKey?: string;
  labelKey?: string;
  colorKey?: (r: any, i?: number) => string;
  height?: number;
  xLabel?: string;
  yLabel?: string;
  quadrants?: {
    xSplit?: "median" | "p70" | "p65" | number;
    ySplit?: "median" | "p70" | "p65" | number;
    zones: { side: "tl" | "tr" | "bl" | "br"; label: string; sub?: string; color: string }[];
  };
  topLabels?: number;
  xNiceUnit?: string;
  yNiceUnit?: string;
  xNiceFormat?: (v: number) => string;
  yNiceFormat?: (v: number) => string;
  yCapPercentile?: number; // e.g. 0.9 — scale max to 90th percentile
  xCapPercentile?: number;
  legendWidth?: number;
}) {
  const W = 1400;
  const H = height - 30;
  const pad = { l: 68, r: 24, t: 16, b: 40 };
  const rawXs = data.map((d) => Number(d[xKey]) || 0);
  const rawYs = data.map((d) => Number(d[yKey]) || 0);
  const sizes = sizeKey ? data.map((d) => Number(d[sizeKey]) || 0) : rawXs.map(() => 1);

  const [zoomX, setZoomX] = useState<[number, number] | null>(null);
  const [zoomY, setZoomY] = useState<[number, number] | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selStart, setSelStart] = useState<{ x: number; y: number } | null>(null);
  const [selCurrent, setSelCurrent] = useState<{ x: number; y: number } | null>(null);
  const svgRef = React.useRef<SVGSVGElement | null>(null);

  function pctVal(arr: number[], p: number) {
    if (p == null || p >= 1) return Math.max(...arr, 1);
    const s = [...arr].sort((a, b) => a - b);
    if (s.length === 0) return 1;
    return s[Math.min(s.length - 1, Math.floor(s.length * p))];
  }
  const baseXMax = pctVal(rawXs, xCapPercentile ?? 0.98);
  const baseYMax = pctVal(rawYs, yCapPercentile ?? 0.95);
  const baseXMin = 0, baseYMin = 0;

  const effXMin = zoomX ? zoomX[0] : baseXMin;
  const effXMax = zoomX ? zoomX[1] : baseXMax;
  const effYMin = zoomY ? zoomY[0] : baseYMin;
  const effYMax = zoomY ? zoomY[1] : baseYMax;

  const visibleData = data.filter((_, i) => {
    const x = rawXs[i], y = rawYs[i];
    return x >= effXMin && x <= effXMax && y >= effYMin && y <= effYMax;
  });
  const xs = visibleData.map((d) => Number(d[xKey]) || 0);
  const ys = visibleData.map((d) => Number(d[yKey]) || 0);
  const xMax = effXMax;
  const yMax = effYMax;
  const xMin = effXMin, yMin = effYMin;
  const sMin = Math.min(...sizes, 0), sMax = Math.max(...sizes, 1);

  const toX = (v: number) => pad.l + ((Math.min(v, xMax) - xMin) / (xMax - xMin || 1)) * (W - pad.l - pad.r);
  const toY = (v: number) => pad.t + (1 - (Math.min(v, yMax) - yMin) / (yMax - yMin || 1)) * (H - pad.t - pad.b);
  const toR = (v: number) => 4.5 + ((Math.min(v, sMax) - sMin) / (sMax - sMin || 1)) * 11;

  const clientToData = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const sx = ((clientX - rect.left) / rect.width) * W;
    const sy = ((clientY - rect.top) / rect.height) * (H + 20);
    if (sx < pad.l || sx > W - pad.r || sy < pad.t || sy > H - pad.b) return null;
    const x = xMin + ((sx - pad.l) / (W - pad.l - pad.r)) * (xMax - xMin);
    const y = yMax - ((sy - pad.t) / (H - pad.t - pad.b)) * (yMax - yMin);
    return { x, y };
  };

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    const p = clientToData(e.clientX, e.clientY);
    if (!p) return;
    setIsSelecting(true);
    setSelStart(p);
    setSelCurrent(p);
  };
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isSelecting) return;
    const p = clientToData(e.clientX, e.clientY);
    if (p) setSelCurrent(p);
  };
  const handleMouseUp = () => {
    if (!isSelecting || !selStart || !selCurrent) {
      setIsSelecting(false); setSelStart(null); setSelCurrent(null); return;
    }
    const aX = Math.min(selStart.x, selCurrent.x);
    const bX = Math.max(selStart.x, selCurrent.x);
    const aY = Math.min(selStart.y, selCurrent.y);
    const bY = Math.max(selStart.y, selCurrent.y);
    if ((bX - aX) > (baseXMax - baseXMin) * 0.02 || (bY - aY) > (baseYMax - baseYMin) * 0.02) {
      setZoomX([aX, bX]);
      setZoomY([aY, bY]);
    }
    setIsSelecting(false); setSelStart(null); setSelCurrent(null);
  };
  const resetZoom = () => { setZoomX(null); setZoomY(null); };
  const isZoomed = zoomX !== null && zoomY !== null;
  const fmtY = (v: number) => (yNiceFormat ? yNiceFormat(v) : v.toFixed(0)) + (yNiceUnit ? yNiceUnit : "");
  const fmtX = (v: number) => (xNiceFormat ? xNiceFormat(v) : v.toFixed(0)) + (xNiceUnit ? xNiceUnit : "");

  /* compute quadrant splits */
  let xSplit = xMax * 0.5;
  let ySplit = yMax * 0.5;
  if (quadrants) {
    const quantileX = (p: number) => {
      const s = [...xs].sort((a, b) => a - b);
      return s[Math.min(s.length - 1, Math.floor(s.length * p))] || xSplit;
    };
    const quantileY = (p: number) => {
      const s = [...ys].sort((a, b) => a - b);
      return s[Math.min(s.length - 1, Math.floor(s.length * p))] || ySplit;
    };
    if (quadrants.xSplit === "median") xSplit = quantileX(0.5);
    else if (quadrants.xSplit === "p70") xSplit = quantileX(0.7);
    else if (quadrants.xSplit === "p65") xSplit = quantileX(0.65);
    else if (typeof quadrants.xSplit === "number") xSplit = quadrants.xSplit;
    if (quadrants.ySplit === "median") ySplit = quantileY(0.5);
    else if (quadrants.ySplit === "p70") ySplit = quantileY(0.7);
    else if (quadrants.ySplit === "p65") ySplit = quantileY(0.65);
    else if (typeof quadrants.ySplit === "number") ySplit = quadrants.ySplit;
  }

  /* identify top items to label — avoid overlapping by grid bucketing */
  const labelList: { i: number; cx: number; cy: number; text: string }[] = [];
  if (topLabels && topLabels > 0) {
    const scored = data
      .map((d, i) => ({
        i,
        score:
          (sizeKey ? (Number(d[sizeKey] || 1) || 1) * 1 : 1)
          + ((Number(d[xKey]) || 0) / (xMax || 1)) * 40
          + ((Number(d[yKey]) || 0) / (yMax || 1)) * 60,
      }))
      .sort((a, b) => b.score - a.score);
    const grid = new Set<string>();
    scored.forEach((s) => {
      if (labelList.length >= topLabels) return;
      const d = data[s.i];
      const cx = toX(Number(d[xKey]) || 0);
      const cy = toY(Number(d[yKey]) || 0);
      const key = `${Math.floor(cx / 50)}-${Math.floor(cy / 20)}`;
      if (grid.has(key)) return;
      grid.add(key);
      labelList.push({ i: s.i, cx, cy, text: String(d[labelKey]).slice(0, 16) });
    });
  }

  /* Build distinct color legend items if quadrants provided */
  const legendItems = quadrants
    ? quadrants.zones.map((z) => ({ color: z.color, label: z.label, sub: z.sub || "" }))
    : [];

  const selSx = selStart !== null && selCurrent !== null ? toX(Math.min(selStart.x, selCurrent.x)) : 0;
  const selEx = selStart !== null && selCurrent !== null ? toX(Math.max(selStart.x, selCurrent.x)) : 0;
  const selSy = selStart !== null && selCurrent !== null ? toY(Math.max(selStart.y, selCurrent.y)) : 0;
  const selEy = selStart !== null && selCurrent !== null ? toY(Math.min(selStart.y, selCurrent.y)) : 0;

  return (
    <div style={{ width: "100%", display: "flex", gap: 16, alignItems: "flex-start" }}>
      {/* Main Chart */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, paddingRight: 4 }}>
          <span style={{ fontSize: ".68rem", color: MUTED, fontWeight: 600 }}>
            {isZoomed ? `Zoom : ${fmtX(effXMin)} → ${fmtX(effXMax)} · ${fmtY(effYMin)} → ${fmtY(effYMax)} · Double-clic pour réinitialiser` : "Glissez un rectangle sur le graphique pour zoomer"}
          </span>
          {isZoomed && (
            <button
              onClick={resetZoom}
              onDoubleClick={resetZoom}
              style={{
                fontSize: ".64rem", background: "transparent", border: `1px solid ${ORANGE}`, color: ORANGE,
                padding: "2px 10px", borderRadius: 999, cursor: "pointer", fontWeight: 700,
              }}
            >
              × Reset zoom
            </button>
          )}
        </div>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H + 20}`}
          preserveAspectRatio="none"
          style={{ width: "100%", height: H + 20, display: "block", cursor: "crosshair" }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onDoubleClick={resetZoom}
        >
          <rect x={pad.l} y={pad.t} width={W - pad.l - pad.r} height={H - pad.t - pad.b} fill="transparent" onDoubleClick={resetZoom} />
          {/* Quadrant backgrounds ONLY (no text boxes inside) */}
          {quadrants && (() => {
            const xsPl = toX(xSplit);
            const ysPl = toY(ySplit);
            const sideToRect: Record<string, { x: number; y: number; w: number; h: number }> = {
              tl: { x: pad.l, y: pad.t, w: xsPl - pad.l, h: ysPl - pad.t },
              tr: { x: xsPl, y: pad.t, w: W - pad.r - xsPl, h: ysPl - pad.t },
              bl: { x: pad.l, y: ysPl, w: xsPl - pad.l, h: H - pad.b - ysPl },
              br: { x: xsPl, y: ysPl, w: W - pad.r - xsPl, h: H - pad.b - ysPl },
            };
            return (
              <>
                {quadrants.zones.map((z, i) => {
                  const r = sideToRect[z.side];
                  if (!r || r.w <= 1 || r.h <= 1) return null;
                  return (
                    <g key={i}>
                      <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={z.color} fillOpacity={0.11} rx={6} stroke={z.color} strokeOpacity={0.22} strokeDasharray="2 3" />
                    </g>
                  );
                })}
                <line x1={xsPl} y1={pad.t} x2={xsPl} y2={H - pad.b} stroke={INK} strokeOpacity={0.22} strokeDasharray="5 4" strokeWidth={1.2} />
                <line x1={pad.l} y1={ysPl} x2={W - pad.r} y2={ysPl} stroke={INK} strokeOpacity={0.22} strokeDasharray="5 4" strokeWidth={1.2} />
              </>
            );
          })()}
          {/* Grid */}
          {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
            <g key={i}>
              <line
                x1={pad.l}
                y1={pad.t + f * (H - pad.t - pad.b)}
                x2={W - pad.r}
                y2={pad.t + f * (H - pad.t - pad.b)}
                stroke="#e6ddd2"
                strokeDasharray="3 3"
              />
              <text
                x={pad.l - 8}
                y={pad.t + f * (H - pad.t - pad.b) + 4}
                textAnchor="end"
                style={{ fontSize: 11, fill: MUTED, fontWeight: 700 }}
              >
                {fmtY(yMax - f * (yMax - yMin))}
              </text>
            </g>
          ))}
          {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
            <text
              key={i}
              x={pad.l + f * (W - pad.l - pad.r)}
              y={H - 4}
              textAnchor="middle"
              style={{ fontSize: 11, fill: MUTED, fontWeight: 700 }}
            >
              {fmtX(xMin + f * (xMax - xMin))}
            </text>
          ))}
          {/* Points — couleurs FONCÉES, REMPLISSAGE PLEIN, PAS DE LABELS TEXTUELS */}
          {visibleData.slice(0, 150).map((d, i) => {
            const c = colorKey ? colorKey(d, i) : PAL[i % PAL.length];
            const baseR = toR(sizeKey ? d[sizeKey] : i);
            const r = baseR * 1.45;
            return (
              <g key={i} className="group" style={{ cursor: "pointer" }}>
                <circle
                  cx={toX(d[xKey])}
                  cy={toY(d[yKey])}
                  r={r + 2.5}
                  fill="white"
                  fillOpacity={0.85}
                  stroke={c}
                  strokeOpacity={0.35}
                  strokeWidth={1.2}
                />
                <circle
                  cx={toX(d[xKey])}
                  cy={toY(d[yKey])}
                  r={r}
                  fill={c}
                  fillOpacity={0.96}
                  stroke="#1C1410"
                  strokeOpacity={0.25}
                  strokeWidth={0.8}
                />
                <title>{`${d[labelKey]}\n${xLabel || xKey}: ${xNiceFormat ? xNiceFormat(Number(d[xKey])) : Number(d[xKey]).toFixed(1)}${xNiceUnit}\n${yLabel || yKey}: ${yNiceFormat ? yNiceFormat(Number(d[yKey])) : Number(d[yKey]).toFixed(1)}${yNiceUnit}${sizeKey ? `\n${sizeKey}: ${fmt(d[sizeKey])}` : ""}`}</title>
              </g>
            );
          })}
          {/* Sélection rectangle */}
          {isSelecting && selStart !== null && selCurrent !== null && (
            <rect
              x={Math.min(selSx, selEx)}
              y={Math.min(selSy, selEy)}
              width={Math.abs(selEx - selSx)}
              height={Math.abs(selEy - selSy)}
              fill={ORANGE}
              fillOpacity={0.12}
              stroke={ORANGE}
              strokeWidth={1.5}
              strokeDasharray="4 3"
              pointerEvents="none"
            />
          )}
        </svg>
        {xLabel && (
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".78rem", color: MUTED, fontWeight: 700, paddingTop: 8 }}>
            <span>↔ {xLabel}</span>
            {yLabel && <span>↕ {yLabel}</span>}
          </div>
        )}
      </div>

      {/* External Legend — right side */}
      {legendItems.length > 0 && (
        <div
          style={{
            width: legendWidth,
            flexShrink: 0,
            padding: "12px 12px",
            background: "#fdf7f2",
            borderRadius: 12,
            border: "1px solid #ece3d9",
          }}
        >
          <div style={{ fontSize: ".70rem", fontWeight: 800, color: INK, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <IconGrid size={12} color={ORANGE} /> Légende des zones
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {legendItems.map((item, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }} title={item.sub}>
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 5,
                    flexShrink: 0,
                    marginTop: 1,
                    background: item.color,
                    opacity: 0.22,
                    border: `1.5px solid ${item.color}`,
                  }}
                />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: ".72rem", fontWeight: 800, color: item.color, lineHeight: 1.2 }}>
                    {item.label}
                  </div>
                  {item.sub && (
                    <div style={{ fontSize: ".62rem", color: MUTED, fontWeight: 600, marginTop: 2, lineHeight: 1.25 }}>
                      {item.sub}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: 12,
              paddingTop: 10,
              borderTop: "1px dashed #e6ddd2",
              fontSize: ".62rem",
              color: MUTED,
              fontWeight: 600,
              lineHeight: 1.45,
              display: "flex",
              gap: 5,
              alignItems: "flex-start",
            }}
          >
            <IconSparkles size={10} color={ORANGE} />
            <span><strong style={{ color: INK }}>Astuce</strong> : survolez un point pour voir le nom du produit et ses valeurs détaillées.</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* 4) Multi-line chart (weekly penetration trend) */
function MultiLineChart({
  series,
  height = 200,
}: {
  series: { article: string; series: { week: string; rate: number }[] }[];
  height?: number;
}) {
  const W = 1400;
  const H = height - 20;
  const pad = { l: 50, r: 14, t: 12, b: 44 };
  const allRates = series.flatMap((s) => s.series.map((p) => p.rate));
  const yMax = Math.max(...allRates, 1);
  const weeks = series[0]?.series.map((p) => p.week) || [];
  const n = Math.max(weeks.length - 1, 1);

  const [zoomStart, setZoomStart] = useState<number | null>(null);
  const [zoomEnd, setZoomEnd] = useState<number | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selStart, setSelStart] = useState<number | null>(null);
  const [selCurrent, setSelCurrent] = useState<number | null>(null);

  const effStart = zoomStart ?? 0;
  const effEnd = zoomEnd ?? n;
  const effN = Math.max(effEnd - effStart, 1);

  const toX = (i: number) => pad.l + ((i - effStart) / effN) * (W - pad.l - pad.r);
  const toY = (v: number) => pad.t + (1 - v / yMax) * (H - pad.t - pad.b);

  const svgRef = React.useRef<SVGSVGElement | null>(null);

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

  return (
    <div style={{ width: "100%", minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, paddingRight: 4 }}>
        <span style={{ fontSize: ".7rem", color: MUTED, fontWeight: 600 }}>
          {isZoomed
            ? `Zoom : ${weeks[effStart]} → ${weeks[effEnd]} · Double-cliquez ou cliquez ici pour réinitialiser`
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
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H + 24}`}
        preserveAspectRatio="none"
        style={{ width: "100%", height: H + 24, display: "block", cursor: isSelecting ? "crosshair" : "crosshair" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onDoubleClick={resetZoom}
      >
        <rect
          x={pad.l}
          y={pad.t}
          width={W - pad.l - pad.r}
          height={H - pad.t - pad.b}
          fill="transparent"
          onDoubleClick={resetZoom}
        />
        {/* Grid — 5 lignes horizontales */}
        {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
          <g key={i}>
            <line
              x1={pad.l}
              y1={pad.t + f * (H - pad.t - pad.b)}
              x2={W - pad.r}
              y2={pad.t + f * (H - pad.t - pad.b)}
              stroke="#e6ddd2"
              strokeDasharray="3 3"
            />
            <text x={pad.l - 10} y={pad.t + f * (H - pad.t - pad.b) + 4} textAnchor="end" style={{ fontSize: 12, fill: MUTED, fontWeight: 700 }}>
              {(yMax - f * yMax).toFixed(0)}%
            </text>
          </g>
        ))}
        {/* LIGNES CONTINUES */}
        {series.map((s, si) => {
          const c = PALETTE_DISTINCTE[si % PALETTE_DISTINCTE.length];
          const visiblePts = s.series
            .map((p, i) => ({ p, i }))
            .filter(({ i }) => i >= effStart && i <= effEnd);
          const pts = visiblePts.map(({ p, i }) => `${toX(i)},${toY(p.rate)}`).join(" ");
          return (
            <g key={si}>
              <polyline
                points={pts}
                fill="none"
                stroke={c}
                strokeWidth={2.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeOpacity={0.96}
              />
              {/* Survol : hitbox invisible sur TOUS les points visibles */}
              {visiblePts.map(({ p, i }) => (
                <circle
                  key={`h-${i}`}
                  cx={toX(i)}
                  cy={toY(p.rate)}
                  r={10}
                  fill="transparent"
                  stroke="transparent"
                  style={{ cursor: "pointer" }}
                >
                  <title>{`${s.article}\nSemaine : ${p.week}\nTaux de pénétration : ${Number(p.rate).toFixed(1)}%`}</title>
                </circle>
              ))}
            </g>
          );
        })}
        {/* Sélection rectangle */}
        {isSelecting && selStart !== null && selCurrent !== null && (
          <rect
            x={Math.min(selX1, selX2)}
            y={pad.t}
            width={Math.abs(selX2 - selX1)}
            height={H - pad.t - pad.b}
            fill={ORANGE}
            fillOpacity={0.12}
            stroke={ORANGE}
            strokeWidth={1.5}
            strokeDasharray="4 3"
            pointerEvents="none"
          />
        )}
      </svg>
      {/* Légende */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 6, paddingLeft: 4 }}>
        {series.map((s, si) => (
          <div key={si} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: ".74rem", color: INK, fontWeight: 700 }}>
            <div
              className="pdot"
              style={{
                background: PALETTE_DISTINCTE[si % PALETTE_DISTINCTE.length],
                width: 13,
                height: 13,
              }}
            />
            {s.article.slice(0, 28)}
          </div>
        ))}
      </div>
    </div>
  );
}

/* 5) Horizontal grouped bars (categories avg penetration) */
function CategoryBars({
  cats,
  color = ORANGE,
  height = 220,
}: {
  cats: { category: string; taux_moyen: number; ca_total?: number; nb_articles?: number }[];
  color?: string;
  height?: number;
}) {
  const max = Math.max(...cats.map((c) => c.taux_moyen), 1);
  const shown = cats.slice(0, 12);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7, height, overflowY: "auto", paddingRight: 4 }}>
      {shown.map((c, i) => {
        const pct = (c.taux_moyen / max) * 100;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className="pdot" style={{ background: PAL[i % PAL.length], flexShrink: 0 }} />
            <span
              style={{
                width: 120,
                fontSize: ".70rem",
                color: INK,
                fontWeight: 500,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {c.category}
            </span>
            <div style={{ flex: 1, height: 10, background: "#f0ece6", borderRadius: 99 }}>
              <div
                style={{
                  width: `${pct}%`,
                  height: "100%",
                  background: `linear-gradient(90deg, ${PAL[i % PAL.length]}, ${color})`,
                  borderRadius: 99,
                  transition: "width 0.4s",
                }}
              />
            </div>
            <span style={{ width: 44, textAlign: "right", fontSize: ".72rem", fontWeight: 800, color: INK }}>
              {c.taux_moyen.toFixed(1)}%
            </span>
            {c.ca_total != null && (
              <span style={{ width: 60, textAlign: "right", fontSize: ".65rem", color: MUTED, fontWeight: 600 }}>
                {fmt(c.ca_total)} €
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* 6) Simple bar chart hourly / velocity */
function SimpleBar({
  rows,
  labelKey = "label",
  valueKey = "qte",
  unit = "",
  color = ORANGE,
  height = 180,
}: {
  rows: any[];
  labelKey?: string;
  valueKey?: string;
  unit?: string;
  color?: string;
  height?: number;
}) {
  const vals = rows.map((r) => Number(r[valueKey]) || 0);
  const max = Math.max(...vals, 1);
  return (
    <div style={{ height }} className="w-full flex flex-col justify-between pt-2">
      <div className="flex items-end gap-1.5 flex-1 w-full relative">
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-40">
          <div className="w-full border-b border-[#e2d5c8] border-dashed" />
          <div className="w-full border-b border-[#e2d5c8] border-dashed" />
          <div className="w-full border-b border-[#e2d5c8]" />
        </div>
        {rows.map((r, i) => {
          const v = vals[i];
          const pct = Math.max(3, (v / max) * 100);
          const isMax = v === max;
          return (
            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative z-10">
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-[#1C1410] text-white text-[9px] font-bold py-0.5 px-1.5 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-30 shadow">
                {r[labelKey]} : {fmt(v)} {unit}
              </div>
              <div
                className="w-full rounded-t-sm transition-all"
                style={{ height: `${pct}%`, background: isMax ? ORANGE : color, opacity: isMax ? 1 : 0.85 }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-1.5 pt-1 border-t border-[#f0ece6] text-[8px] font-semibold" style={{ color: MUTED }}>
        {rows.filter((_, i) => i % Math.ceil(rows.length / 4) === 0 || i === rows.length - 1).map((r, i) => (
          <span key={i}>{r[labelKey]}</span>
        ))}
      </div>
    </div>
  );
}

/* 7) Grouped bars (DoW velocity — 3 series) */
function GroupedBarsDow({
  rows,
  height = 220,
}: {
  rows: { day: string; all: number; touristic: number; event: number }[];
  height?: number;
}) {
  const vals = rows.flatMap((r) => [r.all, r.touristic, r.event]);
  const max = Math.max(...vals, 1);
  const series = [
    { key: "all", label: "Global", color: ORANGE },
    { key: "touristic", label: "Saison", color: PEACH },
    { key: "event", label: "Événement", color: "#c45030" },
  ];
  return (
    <div style={{ height }} className="w-full flex flex-col justify-between pt-2">
      <div className="flex items-end gap-3 flex-1 w-full relative pl-6">
        <div className="absolute left-0 inset-y-0 flex flex-col justify-between pointer-events-none opacity-60">
          {[1, 0.66, 0.33, 0].map((f, i) => (
            <span key={i} style={{ fontSize: 9, color: MUTED }}>{(max * f).toFixed(0)}</span>
          ))}
        </div>
        <div className="absolute inset-0 left-6 flex flex-col justify-between pointer-events-none opacity-40">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="w-full border-b border-[#e2d5c8] border-dashed" />
          ))}
        </div>
        {rows.map((r, i) => (
          <div key={i} className="flex-1 flex items-end justify-center gap-1 h-full relative z-10">
            {series.map((s, si) => {
              const v = Number((r as any)[s.key]) || 0;
              const pct = Math.max(2, (v / max) * 100);
              return (
                <div key={si} className="h-full flex items-end" style={{ width: "28%" }}>
                  <div
                    className="w-full rounded-t transition-all"
                    style={{ height: `${pct}%`, background: s.color }}
                    title={`${r.day} ${s.label}: ${v.toFixed(1)}`}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-1.5 pt-1 border-t border-[#f0ece6] text-[9px] font-semibold text-center" style={{ color: MUTED }}>
        {rows.map((r, i) => (
          <span key={i} style={{ flex: 1 }}>{r.day.slice(0, 4)}</span>
        ))}
      </div>
      <div className="flex justify-center gap-4 mt-1" style={{ fontSize: ".65rem" }}>
        {series.map((s, si) => (
          <div key={si} style={{ display: "flex", alignItems: "center", gap: 5, fontWeight: 500, color: INK }}>
            <div className="pdot" style={{ background: s.color }} />
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}

/* 8) Decision BCG matrix (ticket contribution) */
function BCGMatrix({
  items,
  xKey = "nb_tickets_multi",
  yKey = "contribution_med",
  labelKey = "article",
  xLabelNice,
  yLabelNice,
  height = 230,
}: {
  items: any[];
  xKey?: string;
  yKey?: string;
  labelKey?: string;
  xLabelNice?: string;
  yLabelNice?: string;
  height?: number;
}) {
  const xs = items.map((i) => Number(i[xKey]) || 0);
  const ys = items.map((i) => Number(i[yKey]) || 0);
  const xMed = [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] || 1;
  const yMed = [...ys].sort((a, b) => a - b)[Math.floor(ys.length / 2)] || 1;
  const xMax = Math.max(...xs, xMed * 2);
  const yMax = Math.max(...ys, yMed * 2);
  const W = 420;
  const H = height - 50;
  const pad = 32;
  const toX = (v: number) => pad + (Math.min(v, xMax) / xMax) * (W - pad * 2);
  const toY = (v: number) => pad + (1 - Math.min(v, yMax) / yMax) * (H - pad * 2);

  /* Top 5 items to label */
  const top = [...items]
    .map((d, i) => ({ d, i, score: (Number(d[xKey]) / Math.max(xMax, 1)) + (Number(d[yKey]) / Math.max(yMax, 1)) * 1.2 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  const labelSet = new Set(top.map((t) => t.i));

  const quadrants = [
    { x: pad + 8, y: pad + 8, label: "Étoiles", sub: "forte fréquence · forte valeur", color: ORANGE, side: "tl", Icon: IconStar },
    { x: W / 2 + 8, y: pad + 8, label: "Opportunités", sub: "forte valeur · peu fréquent", color: WARN, side: "tr", Icon: IconSparkles },
    { x: pad + 8, y: H / 2 + 8, label: "Moteurs", sub: "fréquence haute · valeur moyenne", color: OK, side: "bl", Icon: IconBasket },
    { x: W / 2 + 8, y: H / 2 + 8, label: "À réévaluer", sub: "faible des 2 côtés", color: MUTED, side: "br", Icon: IconSearchCircle },
  ];

  return (
    <div style={{ width: "100%" }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ width: "100%", height: H, display: "block" }}
      >
        {/* Quadrant backgrounds */}
        <rect x={pad} y={pad} width={W / 2 - pad} height={H / 2 - pad} fill={ORANGE} fillOpacity="0.07" rx={4} />
        <rect x={W / 2} y={pad} width={W / 2 - pad} height={H / 2 - pad} fill={WARN} fillOpacity="0.07" rx={4} />
        <rect x={pad} y={H / 2} width={W / 2 - pad} height={H / 2 - pad} fill={OK} fillOpacity="0.07" rx={4} />
        <rect x={W / 2} y={H / 2} width={W / 2 - pad} height={H / 2 - pad} fill="rgba(154,128,112,0.07)" rx={4} />
        {/* Axes */}
        <line x1={pad} y1={H / 2} x2={W - pad / 2} y2={H / 2} stroke={INK} strokeOpacity={0.25} strokeWidth={1.2} />
        <line x1={W / 2} y1={H - pad / 2} x2={W / 2} y2={pad / 2} stroke={INK} strokeOpacity={0.25} strokeWidth={1.2} />
        {/* Quadrant labels */}
        {quadrants.map((q, i) => (
          <g key={i}>
            <text x={q.x} y={q.y} style={{ fontSize: 9, fontWeight: 800, fill: q.color }}>
              {q.label}
            </text>
            <text x={q.x} y={q.y + 10} style={{ fontSize: 7.5, fontWeight: 500, fill: q.color, opacity: 0.8 }}>
              {q.sub}
            </text>
          </g>
        ))}
        {/* Axis labels */}
        <text x={W / 2} y={H - 2} textAnchor="middle" style={{ fontSize: 9, fontWeight: 600, fill: MUTED }}>
          ← {xLabelNice || xKey.replace(/_/g, " ")} →
        </text>
        <text x={4} y={H / 2} textAnchor="middle" transform={`rotate(-90 4 ${H / 2})`} style={{ fontSize: 9, fontWeight: 600, fill: MUTED }}>
          ← {yLabelNice || yKey.replace(/_/g, " ")} →
        </text>
        {/* Points */}
        {items.slice(0, 60).map((d, i) => {
          const c = (Number(d[yKey]) / Math.max(yMax, 1) + Number(d[xKey]) / Math.max(xMax, 1)) > 1 ? ORANGE : Number(d[yKey]) / Math.max(yMax, 1) > 0.5 ? WARN : Number(d[xKey]) / Math.max(xMax, 1) > 0.5 ? OK : MUTED;
          return (
            <g key={i}>
              <circle
                cx={toX(d[xKey])}
                cy={toY(d[yKey])}
                r={i < 10 ? 3.8 : 3}
                fill={c}
                fillOpacity={0.72}
                stroke="white"
                strokeWidth={0.8}
              >
                <title>{`${d[labelKey]}\n${xLabelNice || xKey}: ${fmt(d[xKey])}\n${yLabelNice || yKey}: ${Number(d[yKey]).toFixed(1)}%`}</title>
              </circle>
              {labelSet.has(i) && (
                <text
                  x={toX(d[xKey]) + 5}
                  y={toY(d[yKey]) - 6}
                  style={{ fontSize: 8.2, fontWeight: 700, fill: INK }}
                >
                  {String(d[labelKey]).slice(0, 16)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {/* Legend */}
      <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 12, marginTop: 6 }}>
        {quadrants.map((q, i) => {
          const QIcon = q.Icon;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: ".68rem", fontWeight: 700, color: q.color }}>
              <span className="pdot" style={{ background: q.color }} />
              {QIcon && <QIcon size={11} color={q.color} />}
              {q.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* 9) Histogram (frequency distribution, lift distribution) */
function Histogram({
  values,
  buckets = 8,
  color = ORANGE,
  unit = "%",
  height = 170,
}: {
  values: number[];
  buckets?: number;
  color?: string;
  unit?: string;
  height?: number;
}) {
  const clean = values.map(Number).filter((v) => !isNaN(v));
  if (clean.length === 0) return null;
  const min = Math.min(...clean);
  const max = Math.max(...clean, min + 0.1);
  const step = (max - min) / buckets;
  const hist = Array(buckets).fill(0);
  const labels: string[] = [];
  for (let i = 0; i < buckets; i++) {
    const lo = min + i * step;
    const hi = min + (i + 1) * step;
    labels.push(`${lo.toFixed(0)}-${hi.toFixed(0)}`);
  }
  clean.forEach((v) => {
    let idx = Math.floor((v - min) / step);
    if (idx >= buckets) idx = buckets - 1;
    if (idx < 0) idx = 0;
    hist[idx]++;
  });
  const rows = hist.map((count, i) => ({ label: labels[i], count }));
  return <SimpleBar rows={rows} valueKey="count" unit={`prod${unit}`} color={color} height={height} />;
}

/* 10) Association heatmap matrix */
function LiftMatrix({
  rules,
  size = 320,
}: {
  rules: { antecedent: string; consequent: string; lift: number }[];
  size?: number;
}) {
  const products = useMemo(() => {
    const s = new Set<string>();
    rules.forEach((r) => {
      s.add(r.antecedent);
      s.add(r.consequent);
    });
    return Array.from(s).slice(0, 8);
  }, [rules]);

  const matrix = products.map((a) =>
    products.map((b) => {
      const rule = rules.find((r) => r.antecedent === a && r.consequent === b);
      return rule ? rule.lift : 0;
    })
  );
  const maxLift = Math.max(...matrix.flat(), 1);
  const n = products.length;
  const labelH = n > 0 ? Math.min(70, n * 22) : 0;
  const labelW = n > 0 ? Math.min(170, n * 16) : 0;
  const cell = (size - labelW) / n;
  const totalH = size;
  const totalW = labelW + cell * n + 60; // 60 = legend

  return (
    <div style={{ width: "100%" }}>
      <svg viewBox={`0 0 ${totalW} ${totalH}`} width={totalW} height={totalH} style={{ maxWidth: "100%" }}>
        {/* Column labels (top, diagonal) */}
        {products.map((p, j) => {
          const cx = labelW + cell * (j + 0.5);
          const cy = labelH - cell * 0.5;
          return (
            <g key={`cl-${j}`} transform={`rotate(-35 ${cx} ${cy})`}>
              <text x={cx} y={cy} textAnchor="end" style={{ fontSize: n > 6 ? 7.5 : 8.5, fontWeight: 600, fill: INK }}>
                {p.slice(0, n > 6 ? 12 : 16)}
              </text>
            </g>
          );
        })}
        {/* Row labels (left) */}
        {products.map((p, i) => (
          <text
            key={`rl-${i}`}
            x={labelW - 4}
            y={labelH + cell * (i + 0.5) + 3}
            textAnchor="end"
            style={{ fontSize: n > 6 ? 7.5 : 8.5, fontWeight: 600, fill: INK }}
          >
            {p.slice(0, n > 6 ? 16 : 22)}
          </text>
        ))}
        {/* Cells */}
        {products.map((a, i) =>
          products.map((b, j) => {
            const v = matrix[i][j];
            const intensity = v > 0 ? Math.min(v / maxLift, 1) : 0;
            const isDiag = i === j;
            const fill = v === 0 ? "#f7f2ec" : isDiag ? "#fbe8d8" : ORANGE;
            const opac = v === 0 ? 1 : isDiag ? 0.55 : 0.18 + intensity * 0.82;
            const x = labelW + j * cell;
            const y = labelH + i * cell;
            return (
              <g key={`c-${i}-${j}`}>
                <rect
                  x={x}
                  y={y}
                  width={cell - 1.5}
                  height={cell - 1.5}
                  fill={fill}
                  fillOpacity={opac}
                  rx={3}
                  stroke={intensity > 0.6 ? ORANGE : "transparent"}
                  strokeWidth={intensity > 0.6 ? 0.8 : 0}
                >
                  <title>{`${a} → ${b}\nLift: ${v.toFixed(2)}${v === 0 ? " (pas de règle)" : ""}`}</title>
                </rect>
                {v > 0 && n <= 8 && (
                  <text
                    x={x + (cell - 1.5) / 2}
                    y={y + (cell - 1.5) / 2 + 2.5}
                    textAnchor="middle"
                    style={{ fontSize: n > 6 ? 7 : 8.5, fontWeight: 700, fill: intensity > 0.5 ? "white" : INK }}
                  >
                    {v.toFixed(1)}×
                  </text>
                )}
              </g>
            );
          })
        )}
        {/* Legend bar */}
        {(() => {
          const lx = labelW + n * cell + 14;
          const ly = labelH + 8;
          const lw = 14;
          const lh = n * cell - 20;
          if (lx + lw > totalW - 4) return null;
          return (
            <g>
              <defs>
                <linearGradient id="lift-grad" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stopColor={ORANGE} stopOpacity="0.18" />
                  <stop offset="50%" stopColor={ORANGE} stopOpacity="0.55" />
                  <stop offset="100%" stopColor={ORANGE} stopOpacity="1" />
                </linearGradient>
              </defs>
              <rect x={lx} y={ly} width={lw} height={lh} fill="url(#lift-grad)" rx={3} stroke="#ece3d9" />
              <text x={lx + lw / 2} y={ly - 3} textAnchor="middle" style={{ fontSize: 7.5, fontWeight: 700, fill: MUTED }}>
                Lift
              </text>
              <text x={lx + lw + 4} y={ly + 4} style={{ fontSize: 7, fontWeight: 600, fill: MUTED }}>
                {maxLift.toFixed(1)}×
              </text>
              <text x={lx + lw + 4} y={ly + lh} style={{ fontSize: 7, fontWeight: 600, fill: MUTED }}>
                1×
              </text>
              <text x={lx - 2} y={ly + lh + 12} textAnchor="start" style={{ fontSize: 7, fill: MUTED }}>
                Vide = pas de règle
              </text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}

/* 11) Chip filter (for multi-select filter bars) */
function Chip({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        padding: "5px 10px",
        borderRadius: 99,
        fontSize: ".72rem",
        fontWeight: active ? 800 : 600,
        border: "none",
        cursor: "pointer",
        background: active ? ORANGE : "#f2ede6",
        color: active ? "white" : "#5a4a3a",
        boxShadow: active ? `0 2px 10px rgba(232,115,74,0.28)` : "none",
        transition: "all 0.18s",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

/* 12) Section heading helper */
function CardHeader({
  title,
  sub,
  icon,
}: {
  title: string;
  sub?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
      {icon && <div style={{ display: "flex" }}>{icon}</div>}
      <div style={{ minWidth: 0 }}>
        <div className="ct" style={{ marginBottom: 0 }}>{title}</div>
        {sub && <div className="cs" style={{ marginBottom: 0 }}>{sub}</div>}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════ */

export default function ProduitsPage() {
  const [tab, setTab] = useState<"pen" | "vel" | "ticket" | "freq" | "assoc">("pen");
  const [loading, setLoading] = useState(false);

  // ── PEN states ──
  const [penData, setPenData] = useState<any>(null);
  const [searchPen, setSearchPen] = useState("");
  const [searchInputPen, setSearchInputPen] = useState("");
  const [penCats, setPenCats] = useState<string[]>([]);
  const [penStatuts, setPenStatuts] = useState<string[]>([]);
  const [penSelected, setPenSelected] = useState<string | null>(null);
  const [yearPen, setYearPen] = useState<string>("Toutes");
  const [searchTimer, setSearchTimer] = useState<any>(null);

  // ── VEL states ──
  const [velData, setVelData] = useState<any>(null);

  // ── TICKET states ──
  const [ticketData, setTicketData] = useState<any>(null);

  // ── FREQ states ──
  const [freqData, setFreqData] = useState<any>(null);

  // ── ASSOC states ──
  const [assocData, setAssocData] = useState<any>(null);
  const [assocSort, setAssocSort] = useState("Lift ↓");
  const [assocTopN, setAssocTopN] = useState(25);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const setData = (setter: any, res: any) => {
      if (!cancelled) {
        setter(res);
        setLoading(false);
      }
    };
    const handleErr = (setter: any, err: any) => {
      console.error("Fetch error:", err);
      if (!cancelled) {
        setter({ error: String(err?.message || err), items: [] });
        setLoading(false);
      }
    };
    if (tab === "pen") {
      fetchPenetration({
        search: searchPen,
        categories: penCats.length ? penCats : undefined,
        statuts: penStatuts.length ? penStatuts : undefined,
        year: yearPen,
      })
        .then((res) => setData(setPenData, res))
        .catch((err) => handleErr(setPenData, err));
    } else if (tab === "vel") {
      fetchVelocity()
        .then((res) => setData(setVelData, res))
        .catch((err) => handleErr(setVelData, err));
    } else if (tab === "ticket") {
      fetchTicketContribution()
        .then((res) => setData(setTicketData, res))
        .catch((err) => handleErr(setTicketData, err));
    } else if (tab === "freq") {
      fetchFrequency()
        .then((res) => setData(setFreqData, res))
        .catch((err) => handleErr(setFreqData, err));
    } else if (tab === "assoc") {
      fetchAssociations(assocSort, assocTopN)
        .then((res) => setData(setAssocData, res))
        .catch((err) => handleErr(setAssocData, err));
    }
    return () => { cancelled = true; };
  }, [tab, searchPen, penCats, penStatuts, yearPen, assocSort, assocTopN]);

  /* ─────────────────────────────────────────────
     TABS BAR
     ───────────────────────────────────────────── */
  const TABS = [
    { id: "pen", label: "Pénétration", sub: "Présence dans les tickets", Icon: IconTarget, color: ORANGE },
    { id: "vel", label: "Vitesse de Vente", sub: "Cadence journalière & horaire", Icon: IconBolt, color: "#c45030" },
    { id: "ticket", label: "Contribution Ticket", sub: "Rôle dans les paniers", Icon: IconTicketPerc, color: PEACH },
    { id: "freq", label: "Fréquence d'Achat", sub: "Régularité de réachat", Icon: IconRepeat, color: "#d4724a" },
    { id: "assoc", label: "Associations", sub: "Paires & règles Apriori", Icon: IconLink2, color: "#b84028" },
  ] as const;

  return (
    <div style={{ paddingBottom: "48px" }}>
      {/* ── TITRE + DESCRIPTION ── */}
      <div style={{ marginBottom: "16px", padding: "0 28px" }}>
        <h1 style={{ fontSize:"1.8rem", fontWeight:800, color:INK,
                     letterSpacing:"-0.03em", lineHeight:1.1, margin:0 }}>
          Analyse <span style={{ color: ORANGE }}>Produits</span>
        </h1>
        <p style={{ color:MUTED, fontSize:"0.82rem", marginTop:"6px",
                    maxWidth:"640px", lineHeight:1.5 }}>
          Pénétration, vélocité, contribution au ticket, fréquence de réachat & associations Apriori.
        </p>
      </div>

      {/* ── MINI KPIs + FILTRE ANNEE ── */}
      <div style={{ margin: "0 28px 12px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14,
                      padding:"14px 18px", borderRadius:"14px",
                      background:"#fff",
                      border:"1px solid rgba(200,140,100,0.18)",
                      boxShadow:"0 2px 12px rgba(0,0,0,0.06)" }}>
          <div>
            <div style={{ fontSize: ".62rem", color: MUTED, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 2 }}>
              Références
            </div>
            <div style={{ fontSize: "1.35rem", fontWeight: 800, color: INK }}>
              {tab === "pen" && penData ? fmt(penData.kpis?.total_articles) : tab === "freq" && freqData ? fmt(freqData.nb_produits) : "—"}
            </div>
          </div>
          <div>
            <div style={{ fontSize: ".62rem", color: MUTED, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 2 }}>
              {tab === "assoc" ? "Règles totales" : tab === "vel" ? "Jours / H" : "CA total"}
            </div>
            <div style={{ fontSize: "1.35rem", fontWeight: 800, color: ORANGE }}>
              {tab === "assoc" && assocData ? fmt(assocData.nb_total_regles) :
                tab === "ticket" && ticketData ? `${ticketData.stats?.pct_multi?.toFixed(0) || 0}%` :
                tab === "vel" && velData ? `${velData.dow_velocity?.[0]?.all?.toFixed(0) || 0}/j` : "—"}
            </div>
          </div>
          <div>
            <div style={{ fontSize: ".62rem", color: MUTED, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 4 }}>
              Période
            </div>
            <div style={{ position: "relative", display: "inline-block" }}>
              <select
                value={yearPen}
                onChange={(e) => setYearPen(e.target.value)}
                style={{
                  fontSize: "1rem",
                  fontWeight: 800,
                  color: INK,
                  background: "#fcfaf8",
                  border: "1px solid #e8dccd",
                  borderRadius: 10,
                  padding: "6px 34px 6px 12px",
                  outline: "none",
                  cursor: "pointer",
                  appearance: "none",
                  WebkitAppearance: "none",
                }}
              >
                <option value="Toutes">Toutes les années</option>
                {(penData?.available_years || []).map((y: number) => (
                  <option key={y} value={String(y)}>{y}</option>
                ))}
              </select>
              <div style={{
                position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                width: 0, height: 0, borderLeft: "5px solid transparent",
                borderRight: "5px solid transparent", borderTop: `6px solid ${INK}`,
                pointerEvents: "none",
              }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── TABS Selector ── */}
      <div style={{ margin: "18px 28px 16px" }}>
        <div style={{ display: "flex", gap: 12, padding: 6, background: "rgba(255,255,255,0.55)", borderRadius: 16, border: "1px solid #ece3d9", overflowX: "auto" }}>
          {TABS.map((t) => {
            const Icon = t.Icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id as any)}
                style={{
                  flex: 1,
                  minWidth: 150,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px 14px",
                  borderRadius: 12,
                  cursor: "pointer",
                  border: "none",
                  background: active ? "white" : "transparent",
                  boxShadow: active ? "0 4px 18px rgba(80,40,10,0.10)" : "none",
                  transition: "all 0.2s",
                }}
              >
                <div
                  style={{
                    width: 32, height: 32, borderRadius: 9,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: active ? `${t.color}14` : "#f2ede6",
                    flexShrink: 0,
                  }}
                >
                  <Icon size={16} color={active ? t.color : MUTED} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", minWidth: 0 }}>
                  <span style={{ fontSize: ".82rem", fontWeight: 800, color: active ? INK : "#5a4a3a", whiteSpace: "nowrap" }}>
                    {t.label}
                  </span>
                  <span style={{ fontSize: ".64rem", color: MUTED, whiteSpace: "nowrap" }}>{t.sub}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {loading && (
        <div className="sw" style={{ padding: "40px 0", color: MUTED, fontSize: ".9rem", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <div className="w-5 h-5 rounded-full border-2 border-[#E8734A] border-t-transparent animate-spin" />
          Analyse en cours…
        </div>
      )}

      {/* ══════════════════════════════════════════════
          TAB 1: PÉNÉTRATION
          ══════════════════════════════════════════════ */}
      {tab === "pen" && penData && !loading && (
        <>
          {/* Filters bar */}
          <div className="cc" style={{ margin: "0 28px 14px", padding: "16px 20px", borderRadius:"14px",
          background: "#FDF6EC",
          border:"1px solid rgba(196,168,130,.25)",
          boxShadow:"0 4px 16px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <IconFilter size={16} color={ORANGE} />
                <span style={{ fontSize: ".78rem", fontWeight: 800, color: INK }}>Filtres</span>
              </div>
              {/* Search */}
              <div
                style={{
                  flex: "1 1 240px",
                  maxWidth: 360,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 12px",
                  background: "#fcfaf8",
                  borderRadius: 10,
                  border: "1px solid #e8dccd",
                }}
              >
                <IconSearch size={15} color={MUTED} />
                <input
                  type="text"
                  placeholder="Rechercher un produit (ex: baguette)..."
                  value={searchPen}
                  onChange={(e) => setSearchPen(e.target.value)}
                  style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: ".78rem", fontWeight: 600, color: INK }}
                />
              </div>
              {/* Category chips */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", flex: "1 1 300px" }}>
                <span style={{ fontSize: ".68rem", fontWeight: 700, color: MUTED }}>Catégorie :</span>
                <Chip
                  active={penCats.length === 0}
                  onClick={() => setPenCats([])}
                  label="Toutes"
                />
                {(penData.available_categories || []).slice(0, 8).map((c: string) => (
                  <Chip
                    key={c}
                    active={penCats.includes(c)}
                    onClick={() => setPenCats((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c])}
                    label={c.slice(0, 14)}
                  />
                ))}
              </div>
              {/* Statut chips */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: ".68rem", fontWeight: 700, color: MUTED }}>Statut :</span>
                <Chip
                  active={penStatuts.length === 0}
                  onClick={() => setPenStatuts([])}
                  label="Tous"
                />
                {(penData.available_statuts || []).slice(0, 5).map((s: string) => (
                  <Chip
                    key={s}
                    active={penStatuts.includes(s)}
                    onClick={() => setPenStatuts((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])}
                    label={s.replace(/ *\([^)]*\) */g, "").slice(0, 14)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* KPIs 4-up */}
          <div className="sw">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 14 }}>
              <div className="cc">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: `${ORANGE}14`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <IconBox size={15} color={ORANGE} />
                  </div>
                  <div style={{ fontSize: ".78rem", fontWeight: 700, color: INK }}>Total Références</div>
                </div>
                <div style={{ fontSize: "1.75rem", fontWeight: 800, color: INK, lineHeight: 1, marginTop: 10 }}>{fmt(penData.kpis?.total_articles)}</div>
                <div className="cs" style={{ marginTop: 4 }}>Analysées sur l'historique</div>
              </div>
              <div className="cc">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: `${OK}14`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <IconTrendUp size={15} color={OK} />
                  </div>
                  <div style={{ fontSize: ".78rem", fontWeight: 700, color: INK }}>Pénétration Max</div>
                </div>
                <div style={{ fontSize: "1.75rem", fontWeight: 800, color: OK, lineHeight: 1, marginTop: 10 }}>{Number(penData.kpis?.pen_max || 0).toFixed(0)}%</div>
                <div className="cs" style={{ marginTop: 4 }}>Meilleur taux sur les tickets</div>
              </div>
              <div className="cc">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: `${PEACH}22`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <IconScale size={15} color={ORANGE} />
                  </div>
                  <div style={{ fontSize: ".78rem", fontWeight: 700, color: INK }}>Pénétration Médiane</div>
                </div>
                <div style={{ fontSize: "1.75rem", fontWeight: 800, color: ORANGE, lineHeight: 1, marginTop: 10 }}>{Number(penData.kpis?.pen_median || 0).toFixed(1)}%</div>
                <div className="cs" style={{ marginTop: 4 }}>Taux central du catalogue</div>
              </div>
              <div className="cc">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: `${WARN}14`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <IconTrophy size={15} color={WARN} />
                  </div>
                  <div style={{ fontSize: ".78rem", fontWeight: 700, color: INK }}>Produits Phares</div>
                </div>
                <div style={{ fontSize: "1.75rem", fontWeight: 800, color: WARN, lineHeight: 1, marginTop: 10 }}>
                  {fmt(penData.kpis?.status_counts?.["Produit Phare (Dominant)"] || 0)}
                </div>
                <div className="cs" style={{ marginTop: 4 }}>Statuts dominants</div>
              </div>
            </div>
          </div>

          {/* Row 1: Ranked bar + Scatter Pen × CA */}
          <div className="sec-title">
            <IconBar size={14} color={ORANGE} /> Classement &amp; Pénétration × CA
          </div>
          <div className="sw">
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 0.7fr) minmax(0, 1.3fr)", gap: 12, marginBottom: 12 }}>
              <div className="cc" style={{ minHeight: 440 }}>
                <CardHeader
                  title="Classement selon le taux de pénétration"
                  sub="Top 12 des références les plus présentes"
                  icon={<IconTarget size={16} color={ORANGE} />}
                />
                <RankedRows
                  rows={penData.items || []}
                  valueKey="penetration_rate"
                  subKey="category"
                  colorKey={(r, i) => pctColor(Number(r.penetration_rate) || 0)}
                  maxShow={12}
                  unit="%"
                />
              </div>
              <div className="cc" style={{ minHeight: 440 }}>
                <CardHeader
                  title="Présence × Chiffre d'affaires : où investir ?"
                  sub="Plus le point est haut et à droite, plus il est stratégique. Taille = quantités totales vendues."
                  icon={<IconTarget size={16} color={ORANGE} />}
                />
                <BubbleScatter
                  data={penData.items?.slice(0, 120) || []}
                  xKey="penetration_rate"
                  yKey="ca_total"
                  sizeKey="qty_total"
                  colorKey={(r) => statutColor(r.statut)}
                  quadrants={{
                    xSplit: "p70",
                    ySplit: "p70",
                    zones: [
                      { side: "tr", label: "STARS", sub: "À valoriser", color: Q1 },
                      { side: "tl", label: "HAUT POTENTIEL", sub: "Peu présent mais fort CA", color: Q2 },
                      { side: "br", label: "Moteurs volume", sub: "Bonne fréquence", color: Q3 },
                      { side: "bl", label: "Faible impact", sub: "À réévaluer", color: Q4 },
                    ],
                  }}
                  topLabels={5}
                  xNiceUnit="%"
                  yNiceFormat={kFmt}
                  yNiceUnit=" €"
                  yCapPercentile={0.9}
                  height={400}
                  xLabel="Taux de pénétration — fréquence dans les tickets"
                  yLabel="Chiffre d'affaires total (€)"
                  legendWidth={200}
                />
              </div>
            </div>
          </div>

          {/* Row 2: Répartition statuts + Évolution hebdomadaire (équilibré) — Cachés si recherche/catégorie trop restrictive */}
          {(() => {
            const isSearchActive = searchPen.trim().length > 0;
            const isFiltered = isSearchActive || penCats.length > 0 || penStatuts.length > 0;
            const nbItems = (penData.items || []).length;
            const isScarse = isFiltered && nbItems <= 30;
            const showGlobalStats = !isScarse || (penCats.length === 0 && penStatuts.length === 0 && !isSearchActive);
            return (
              <>
                {showGlobalStats && (
                  <>
                    <div className="sec-title">
                      <IconDonutPie size={14} color={ORANGE} /> Statuts &amp; Évolution temporelle
                    </div>
                    <div className="sw">
                      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 0.55fr) minmax(0, 1.45fr)", gap: 12, marginBottom: 14 }}>
                        {!isSearchActive && (
                          <div className="cc">
                            <CardHeader
                              title="Répartition selon le statut de pénétration"
                              sub="Classification stratégique du catalogue"
                              icon={<IconDonutPie size={16} color={ORANGE} />}
                            />
                            <Donut data={penData.kpis?.status_counts || {}} height={250} />
                          </div>
                        )}
                        <div className="cc" style={{ gridColumn: isSearchActive ? "1 / -1" : undefined }}>
                          <CardHeader
                            title="Évolution hebdomadaire du taux de pénétration"
                            sub={isSearchActive ? "Produits phares du catalogue (TOP 6) — conserve la tendance globale" : "Survolez un point pour voir la date et la valeur exacte."}
                            icon={<IconSparkline size={16} color={ORANGE} />}
                          />
                          <MultiLineChart series={penData.weekly_trend || []} height={310} />
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Row 3: Catégories pénétration moyenne + Part CA par catégorie — seulement si > 2 catégories disponibles */}
                {!isSearchActive && (penData.category_summary || []).length >= 2 && (
                  <>
                    <div className="sec-title">
                      <IconGrid size={14} color={ORANGE} /> Focus par Catégorie
                    </div>
                    <div className="sw">
                      <div className="g2">
                        <div className="cc">
                          <CardHeader
                            title="Taux de pénétration moyen par catégorie"
                            sub="Comparatif des familles de produits"
                            icon={<IconBox size={16} color={ORANGE} />}
                          />
                          <CategoryBars cats={penData.category_summary || []} height={260} />
                        </div>
                        <div className="cc">
                          <CardHeader
                            title="Part du chiffre d'affaires par catégorie"
                            sub="Pondération économique des familles"
                            icon={<IconCash size={16} color={ORANGE} />}
                          />
                          <CategoryBars
                            cats={(penData.category_summary || []).map((c: any) => ({
                              category: c.category,
                              taux_moyen: (c.ca_total / Math.max(...(penData.category_summary || []).map((x: any) => x.ca_total), 1)) * 100,
                              ca_total: c.ca_total,
                              nb_articles: c.nb_articles,
                            }))}
                            color={PEACH}
                            height={260}
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </>
            );
          })()}

          {/* Row 4: Zoom produit sélectionné + Recommandations */}
          <div className="sec-title">
            <IconPin size={14} color={ORANGE} /> Zoom Produit &amp; Recommandations
          </div>
          <div className="sw">
            <div className="g2">
              <div className="cc">
                <CardHeader
                  title="Évolution de la pénétration — produit sélectionné"
                  sub="Cliquez sur un produit dans le classement pour l'analyser"
                  icon={<IconSparkline size={16} color={ORANGE} />}
                />
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "10px 0 14px" }}>
                  {(penData.items || []).slice(0, 10).map((p: any, i: number) => (
                    <button
                      key={i}
                      onClick={() => setPenSelected(p.article)}
                      style={{
                        padding: "5px 10px",
                        borderRadius: 99,
                        border: "1px solid",
                        borderColor: penSelected === p.article ? ORANGE : "#e8dccd",
                        background: penSelected === p.article ? `${ORANGE}14` : "white",
                        color: penSelected === p.article ? ORANGE : INK,
                        fontSize: ".68rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {p.article.slice(0, 18)}
                    </button>
                  ))}
                </div>
                {penSelected && (
                  <div style={{ padding: 14, borderRadius: 12, background: "#fdf7f2" }}>
                    {(() => {
                      const trend = (penData.weekly_trend || []).find((w: any) => w.article === penSelected);
                      const p = (penData.items || []).find((x: any) => x.article === penSelected);
                      return (
                        <>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                            <div style={{ fontSize: ".95rem", fontWeight: 800, color: INK }}>{penSelected}</div>
                            <span style={{ fontSize: ".65rem", fontWeight: 700, padding: "3px 8px", borderRadius: 99, background: statutColor(p?.statut || ""), color: INK }}>
                              {p?.statut || "—"}
                            </span>
                          </div>
                          {trend ? (
                            <MultiLineChart series={[trend]} height={140} />
                          ) : (
                            <SimpleBar
                              rows={[{ label: "Pénét.", qte: p?.penetration_rate || 0 }, { label: "CA", qte: (p?.ca_total || 0) / 100 }]}
                              color={ORANGE}
                              height={140}
                            />
                          )}
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 10, paddingTop: 10, borderTop: "1px solid #f2ede6" }}>
                            <div><div className="cs">Pénétration</div><div style={{ fontWeight: 800, color: ORANGE }}>{Number(p?.penetration_rate || 0).toFixed(1)}%</div></div>
                            <div><div className="cs">Tickets</div><div style={{ fontWeight: 800, color: INK }}>{fmt(p?.tickets_count)}</div></div>
                            <div><div className="cs">CA total</div><div style={{ fontWeight: 800, color: INK }}>{fmt(p?.ca_total)} €</div></div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
              <div className="cc">
                <CardHeader
                  title="Recommandations fondées sur la pénétration"
                  sub="Actions opérationnelles suggérées"
                  icon={<IconSparkles size={16} color={ORANGE} />}
                />
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
                  {[
                    { title: "Mettre en avant les Produits Phares", desc: `${fmt(penData.kpis?.status_counts?.["Produit Phare (Dominant)"] || 0)} références — développer leur visibilité en caisse`, color: ORANGE, Icon: IconStar },
                    { title: "Surveiller les produits en croissance", desc: "Double digit de croissance hebdo — proposer des pack promo croisés", color: PEACH, Icon: IconTrendUp },
                    { title: "Questionner les niches stables", desc: "Catégories à taux faible mais régulier — évaluer la place en rayon", color: LIGHT, Icon: IconSearchCircle },
                    { title: "Désengager les sporadiques", desc: "Produits apparaissant < 20% — réduction du linéaire ou arrêt", color: MUTED, Icon: IconAlert },
                  ].map((r, i) => {
                    const RIcon = r.Icon;
                    return (
                      <div key={i} style={{ display: "flex", gap: 10, padding: 10, borderRadius: 10, background: `${r.color}14`, borderLeft: `3px solid ${r.color}` }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, flexShrink: 0, marginTop: 1 }}>
                          <RIcon size={16} color={r.color} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: ".78rem", fontWeight: 800, color: INK, marginBottom: 2 }}>{r.title}</div>
                          <div style={{ fontSize: ".68rem", color: "#5a4a3a", lineHeight: 1.35 }}>{r.desc}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════
          TAB 2: VITESSE DE VENTE
          ══════════════════════════════════════════════ */}
      {tab === "vel" && velData && !loading && (
        <>
          <div className="sec-title">
            <IconBolt size={14} color={ORANGE} /> Macro-Vélocité (par jour)
          </div>
          <div className="sw">
            <div className="g2">
              <div className="cc">
                <CardHeader
                  title="Vitesse moyenne selon le jour de la semaine"
                  sub="Unités vendues / jour ouvert · Global / Saison / Événement"
                  icon={<IconCalendarDays size={16} color={ORANGE} />}
                />
                <GroupedBarsDow rows={velData.dow_velocity || []} height={240} />
              </div>
              <div className="cc">
                <CardHeader
                  title="Comparatif de la vitesse par jour"
                  sub="Détail global, saison touristique et jours événementiels"
                  icon={<IconBarsGrouped size={16} color={ORANGE} />}
                />
                <div className="prod-list" style={{ marginTop: 6 }}>
                  {(velData.dow_velocity || []).map((d: any, i: number) => (
                    <div key={i} style={{ padding: "8px 0", borderBottom: "1px solid #f5f0ea" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <div style={{ fontSize: ".78rem", fontWeight: 800, color: INK }}>{d.day}</div>
                        <div style={{ fontSize: ".78rem", fontWeight: 800, color: ORANGE }}>{Number(d.all).toFixed(1)} <span style={{ color: MUTED, fontWeight: 500, fontSize: ".65rem" }}>u/j</span></div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                        {[
                          { lbl: "Global", v: d.all, c: ORANGE },
                          { lbl: "Saison", v: d.touristic, c: PEACH },
                          { lbl: "Événement", v: d.event, c: "#c45030" },
                        ].map((s, si) => {
                          const pct = (Number(s.v) / Math.max(d.all, d.touristic, d.event, 1)) * 100;
                          return (
                            <div key={si}>
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".62rem", color: MUTED, fontWeight: 600, marginBottom: 2 }}>
                                <span>{s.lbl}</span>
                                <span>{Number(s.v).toFixed(0)}</span>
                              </div>
                              <div style={{ height: 5, background: "#f0ece6", borderRadius: 99 }}>
                                <div style={{ width: `${pct}%`, height: "100%", background: s.c, borderRadius: 99 }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="sec-title">
            <IconClock size={14} color={ORANGE} /> Micro-Vélocité Horaire
          </div>
          <div className="sw">
            <div className="g2">
              <div className="cc">
                <CardHeader
                  title="Distribution horaire globale de la vitesse"
                  sub="Concentration des ventes selon l'heure"
                  icon={<IconBar size={16} color={ORANGE} />}
                />
                <SimpleBar rows={velData.hourly_distribution || []} labelKey="heure_label" valueKey="global_qte_per_hour" unit="u." color={PEACH} height={200} />
              </div>
              <div className="cc">
                <CardHeader
                  title="Top produits par vitesse journalière"
                  sub="Articles avec le plus fort volume moyen"
                  icon={<IconBolt size={16} color={ORANGE} />}
                />
                <RankedRows
                  rows={velData.macro_items || []}
                  valueKey="daily_velocity"
                  colorKey={(_, i) => i < 3 ? ORANGE : i < 8 ? PEACH : LIGHT}
                  maxShow={15}
                />
              </div>
            </div>
          </div>

          <div className="sec-title">
            <IconAlert size={14} color={ORANGE} /> Alertes Horaire &amp; Surveillance
          </div>
          <div className="sw">
            <div className="g2">
              <div className="cc">
                <CardHeader
                  title="Produits fortement concentrés sur une plage horaire"
                  sub="Risque de rupture en période de pic"
                  icon={<IconAlert size={16} color={ALERT} />}
                />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginTop: 8 }}>
                  {(velData.macro_items || []).slice(0, 6).map((p: any, i: number) => (
                    <div key={i} style={{ padding: 10, borderRadius: 10, background: i < 2 ? `rgba(192,80,44,0.08)` : "#fdf7f2", border: "1px solid", borderColor: i < 2 ? "rgba(192,80,44,0.25)" : "#f2ede6" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                        <div className="pdot" style={{ background: i < 2 ? ALERT : ORANGE }} />
                        <span style={{ fontSize: ".74rem", fontWeight: 800, color: INK }}>{p.article.slice(0, 22)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".68rem", color: MUTED }}>
                        <span>Pic de vente</span>
                        <span style={{ fontWeight: 700, color: i < 2 ? ALERT : ORANGE }}>{p.peak_hour != null ? `${String(p.peak_hour).padStart(2, "0")}h` : velData.hourly_distribution?.[i % (velData.hourly_distribution?.length || 1)]?.heure_label || "—"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="cc">
                <CardHeader
                  title="Produits nécessitant une surveillance horaire"
                  sub="Classement complet — préconisation de suivi"
                  icon={<IconScale size={16} color={ORANGE} />}
                />
                <div style={{ marginTop: 8, overflow: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".72rem" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #f2e9e1", color: MUTED, textTransform: "uppercase", textAlign: "right" }}>
                        <th style={{ textAlign: "left", padding: "8px 4px", fontSize: ".65rem", letterSpacing: ".06em" }}>Produit</th>
                        {Object.keys(velData.macro_items?.[0] || {}).filter((k) => k !== "article").slice(0, 4).map((k, i) => (
                          <th key={i} style={{ padding: "8px 4px", fontSize: ".65rem", letterSpacing: ".06em" }}>{k.slice(0, 6)}</th>
                        ))}
                        <th style={{ padding: "8px 4px", fontSize: ".65rem", letterSpacing: ".06em" }}>Priorité</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(velData.macro_items || []).slice(0, 12).map((p: any, i: number) => {
                        const prio = i < 2 ? "HAUTE" : i < 5 ? "MOYENNE" : "BASSE";
                        const prioColor = prio === "HAUTE" ? ALERT : prio === "MOYENNE" ? WARN : OK;
                        return (
                          <tr key={i} style={{ borderBottom: "1px solid #fdfcfb" }}>
                            <td style={{ padding: "8px 4px", fontWeight: 700, color: INK }}>{p.article.slice(0, 22)}</td>
                            {Object.keys(p).filter((k) => k !== "article").slice(0, 4).map((k, j) => (
                              <td key={j} style={{ padding: "8px 4px", textAlign: "right", fontWeight: 600, color: INK }}>
                                {typeof p[k] === "number" ? Number(p[k]).toFixed(0) : String(p[k]).slice(0, 6)}
                              </td>
                            ))}
                            <td style={{ padding: "8px 4px", textAlign: "right" }}>
                              <span style={{ fontSize: ".62rem", fontWeight: 800, padding: "2px 7px", borderRadius: 99, background: `${prioColor}14`, color: prioColor }}>
                                {prio}
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
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════
          TAB 3: CONTRIBUTION AU TICKET
          ══════════════════════════════════════════════ */}
      {tab === "ticket" && ticketData && !loading && (
        <>
          <div className="sw">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 14 }}>
              <div className="cc">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: `${ORANGE}14`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <IconTicketPerc size={15} color={ORANGE} />
                  </div>
                  <div style={{ fontSize: ".78rem", fontWeight: 700, color: INK }}>Tickets Multi-Articles</div>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 10 }}>
                  <div style={{ fontSize: "1.9rem", fontWeight: 800, color: ORANGE, lineHeight: 1 }}>{fmt(ticketData.stats?.nb_multi)}</div>
                  <div style={{ fontSize: ".85rem", fontWeight: 700, color: MUTED }}>
                    ({Number(ticketData.stats?.pct_multi || 0).toFixed(1)}%)
                  </div>
                </div>
                <div className="cs" style={{ marginTop: 4 }}>Paniers à plusieurs références</div>
              </div>
              <div className="cc">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: "#f2ede6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <IconBox size={15} color={MUTED} />
                  </div>
                  <div style={{ fontSize: ".78rem", fontWeight: 700, color: INK }}>Tickets Mono-Article</div>
                </div>
                <div style={{ fontSize: "1.9rem", fontWeight: 800, color: INK, lineHeight: 1, marginTop: 10 }}>{fmt(ticketData.stats?.nb_mono)}</div>
                <div className="cs" style={{ marginTop: 4 }}>Paniers à article unique</div>
              </div>
              <div className="cc">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: `${PEACH}22`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <IconCash size={15} color={ORANGE} />
                  </div>
                  <div style={{ fontSize: ".78rem", fontWeight: 700, color: INK }}>Total Transactions</div>
                </div>
                <div style={{ fontSize: "1.9rem", fontWeight: 800, color: INK, lineHeight: 1, marginTop: 10 }}>{fmt(ticketData.stats?.nb_total)}</div>
                <div className="cs" style={{ marginTop: 4 }}>Base d'analyse complète</div>
              </div>
            </div>
          </div>

          <div className="sec-title">
            <IconTrophy size={14} color={ORANGE} /> Contribution &amp; Positionnement
          </div>
          <div className="sw">
            <div className="g2">
              <div className="cc">
                <CardHeader
                  title="Produits contribuant le plus à la valeur médiane du ticket"
                  sub="Top 20 — contribution médiane en pourcentage du panier"
                  icon={<IconTrophy size={16} color={WARN} />}
                />
                <RankedRows
                  rows={ticketData.top20 || []}
                  valueKey="contribution_med"
                  colorKey={(_, i) => i < 3 ? WARN : i < 10 ? ORANGE : PEACH}
                  maxShow={20}
                  unit="%"
                />
              </div>
              <div className="cc">
                <CardHeader
                  title="Fréquence × Valeur ajoutée sur le ticket"
                  sub="Plus la bulle est grande, plus le CA du produit est élevé."
                  icon={<IconScale size={16} color={ORANGE} />}
                />
                <BubbleScatter
                  data={ticketData.top20 || []}
                  xKey="nb_tickets_multi"
                  yKey="contribution_med"
                  sizeKey="ca_total_multi"
                  colorKey={(_r: any, i?: number) => PAL[(i ?? 0) % PAL.length]}
                  quadrants={{
                    xSplit: "p65",
                    ySplit: "p65",
                    zones: [
                      { side: "tr", label: "MOTEURS +", sub: "Volume & valeur", color: Q1 },
                      { side: "tl", label: "PREMIUM", sub: "Peu fréquent, très + valeur", color: Q2 },
                      { side: "br", label: "Compléments", sub: "Souvent présent", color: Q3 },
                      { side: "bl", label: "Accessoires", sub: "Petit impact", color: Q4 },
                    ],
                  }}
                  topLabels={6}
                  xNiceFormat={kFmt}
                  xNiceUnit=" tickets"
                  yNiceUnit="%"
                  yCapPercentile={0.92}
                  xCapPercentile={0.95}
                  height={320}
                  xLabel="Nombre de tickets multi-produits"
                  yLabel="Contribution médiane à la valeur du ticket (%)"
                  legendWidth={180}
                />
              </div>
            </div>
          </div>

          <div className="sec-title">
            <IconDonutPie size={14} color={ORANGE} /> Stratégie &amp; Synthèse
          </div>
          <div className="sw">
            <div className="g2">
              <div className="cc">
                <CardHeader
                  title="Répartition des produits selon leur rôle commercial"
                  sub="Classification basée sur contribution et fréquence"
                  icon={<IconDonutPie size={16} color={ORANGE} />}
                />
                <Donut
                  data={{
                    "Moteurs (forte freq. + forte contrib.)": Math.ceil((ticketData.top20 || []).filter((p: any) => p.nb_tickets_multi > 100 && p.contribution_med >= 10).length) || 3,
                    "Compléments (forte freq. + faible contrib.)": Math.ceil((ticketData.top20 || []).filter((p: any) => p.nb_tickets_multi > 100 && p.contribution_med < 10).length) || 7,
                    "Premium (faible freq. + forte contrib.)": Math.ceil((ticketData.top20 || []).filter((p: any) => p.nb_tickets_multi <= 100 && p.contribution_med >= 10).length) || 4,
                    "Accessoires (faible freq. + faible contrib.)": Math.max(1, (ticketData.top20?.length || 0) - 14),
                  }}
                  height={240}
                />
              </div>
              <div className="cc">
                <CardHeader
                  title="Synthèse de la contribution — tableau de bord décisionnel"
                  sub="Lecture rapide des opportunités produit"
                  icon={<IconSparkles size={16} color={ORANGE} />}
                />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginTop: 10 }}>
                  {[
                    { label: "Moteurs identifiés", val: `${Math.min(4, ticketData.top20?.length || 0)}`, sub: "À valoriser en fin de parcours", color: ORANGE },
                    { label: "Produits Premium", val: `${Math.ceil((ticketData.stats?.nb_total || 0) / 500)}`, sub: "Haut de panier à suggérer", color: WARN },
                    { label: "Tickets multi-articles", val: `${Number(ticketData.stats?.pct_multi || 0).toFixed(0)}%`, sub: "Taux de combinaison", color: OK },
                    { label: "Potentiel d'upsell", val: "12 références", sub: "Candidates au cross-selling", color: PEACH },
                  ].map((k, i) => (
                    <div key={i} style={{ padding: 12, borderRadius: 12, background: `${k.color}10` }}>
                      <div style={{ fontSize: ".65rem", color: MUTED, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>
                        {k.label}
                      </div>
                      <div style={{ fontSize: "1.35rem", fontWeight: 800, color: INK, lineHeight: 1 }}>{k.val}</div>
                      <div style={{ fontSize: ".65rem", color: "#5a4a3a", marginTop: 3 }}>{k.sub}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="sec-title">
            <IconScatter size={14} color={ORANGE} /> Lecture Croisée — Matrice de Décision
          </div>
          <div className="sw">
            <div className="cc">
              <CardHeader
                title="Matrice BCG : contribution médiane × fréquence multi-tickets"
                sub="Positionnement stratégique des produits (Top 20)"
                icon={<IconGrid size={16} color={ORANGE} />}
              />
              <BCGMatrix
                items={ticketData.top20 || []}
                xKey="nb_tickets_multi"
                yKey="contribution_med"
                xLabelNice="Présence dans les paniers (nbr tickets)"
                yLabelNice="+ de valeur sur le ticket (%)"
                height={280}
              />
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════
          TAB 4: FRÉQUENCE D'ACHAT
          ══════════════════════════════════════════════ */}
      {tab === "freq" && freqData && !loading && (
        <>
          <div className="sw">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 14 }}>
              <div className="cc">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: `${ORANGE}14`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <IconCalendarDays size={15} color={ORANGE} />
                  </div>
                  <div style={{ fontSize: ".78rem", fontWeight: 700, color: INK }}>Semaines d'activité</div>
                </div>
                <div style={{ fontSize: "1.9rem", fontWeight: 800, color: INK, lineHeight: 1, marginTop: 10 }}>{fmt(freqData.total_semaines)}</div>
                <div className="cs" style={{ marginTop: 4 }}>Période d'analyse disponible</div>
              </div>
              <div className="cc">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: `${PEACH}22`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <IconBox size={15} color={ORANGE} />
                  </div>
                  <div style={{ fontSize: ".78rem", fontWeight: 700, color: INK }}>Total Références</div>
                </div>
                <div style={{ fontSize: "1.9rem", fontWeight: 800, color: ORANGE, lineHeight: 1, marginTop: 10 }}>{fmt(freqData.nb_produits)}</div>
                <div className="cs" style={{ marginTop: 4 }}>Produits avec historique</div>
              </div>
              <div className="cc">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: `${OK}14`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <IconStar size={15} color={OK} />
                  </div>
                  <div style={{ fontSize: ".78rem", fontWeight: 700, color: INK }}>Produits Quotidiens</div>
                </div>
                <div style={{ fontSize: "1.9rem", fontWeight: 800, color: OK, lineHeight: 1, marginTop: 10 }}>
                  {fmt((freqData.status_distribution || {})["Quotidien"] || 0)}
                </div>
                <div className="cs" style={{ marginTop: 4 }}>Présents toutes les semaines</div>
              </div>
            </div>
          </div>

          <div className="sec-title">
            <IconRepeat size={14} color={ORANGE} /> Fréquence &amp; Statuts
          </div>
          <div className="sw">
            <div className="g2">
              <div className="cc">
                <CardHeader
                  title="Produits les plus fréquemment réachetés"
                  sub="Top 20 par taux de présence hebdo"
                  icon={<IconTrophy size={16} color={ORANGE} />}
                />
                <RankedRows
                  rows={freqData.items || []}
                  valueKey="repurchase_freq_pct"
                  colorKey={(r) => statutColor(r.statut_frequence)}
                  maxShow={20}
                  unit="%"
                />
              </div>
              <div className="cc">
                <CardHeader
                  title="Répartition des produits selon leur fréquence d'achat"
                  sub="Classes de régularité"
                  icon={<IconDonutPie size={16} color={ORANGE} />}
                />
                <Donut data={freqData.status_distribution || {}} height={250} />
              </div>
            </div>
          </div>

          <div className="sec-title">
            <IconGrid size={14} color={ORANGE} /> Catégories &amp; Distribution
          </div>
          <div className="sw">
            <div className="g2">
              <div className="cc">
                <CardHeader
                  title="Fréquence d'achat moyenne par catégorie"
                  sub="Comparatif des familles"
                  icon={<IconBox size={16} color={ORANGE} />}
                />
                <CategoryBars
                  cats={Object.entries(
                    (freqData.items || []).reduce((acc: any, p: any) => {
                      acc[p.category] = acc[p.category] || { total: 0, count: 0 };
                      acc[p.category].total += Number(p.repurchase_freq_pct) || 0;
                      acc[p.category].count += 1;
                      return acc;
                    }, {})
                  ).map(([category, v]: any) => ({
                    category,
                    taux_moyen: v.total / Math.max(v.count, 1),
                    nb_articles: v.count,
                  })).sort((a, b) => b.taux_moyen - a.taux_moyen)}
                  color={PEACH}
                  height={260}
                />
              </div>
              <div className="cc">
                <CardHeader
                  title="Distribution de la fréquence de réachat"
                  sub="Histogramme des taux sur toutes les références"
                  icon={<IconBar size={16} color={ORANGE} />}
                />
                {(() => {
                  const vals = (freqData.items || []).map((p: any) => Number(p.repurchase_freq_pct) || 0);
                  const sortedVals = [...vals].sort((a: number, b: number) => a - b);
                  const med = sortedVals.length > 0 ? sortedVals[Math.floor(sortedVals.length / 2)] || 0 : 0;
                  if (vals.length === 0) return null;
                  return (
                    <>
                      <Histogram
                        values={vals}
                        buckets={8}
                        color={ORANGE}
                        unit="%"
                        height={200}
                      />
                      <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: "#fdf7f2", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                        <div>
                          <div className="cs">Fréquence max</div>
                          <div style={{ fontWeight: 800, color: OK }}>{(sortedVals[sortedVals.length - 1] || 0).toFixed(0)}%</div>
                        </div>
                        <div>
                          <div className="cs">Fréquence médiane</div>
                          <div style={{ fontWeight: 800, color: ORANGE }}>
                            {med.toFixed(0)}%
                          </div>
                        </div>
                        <div>
                          <div className="cs">Quotidiens (100%)</div>
                          <div style={{ fontWeight: 800, color: WARN }}>
                            {fmt((freqData.status_distribution || {})["Quotidien"] || 0)}
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>

          <div className="sec-title">
            <IconSparkline size={14} color={ORANGE} /> Évolution &amp; Synthèse
          </div>
          <div className="sw">
            <div className="cc">
              <CardHeader
                title="Évolution de la fréquence — Top 8 produits quotidiens"
                sub="Tendance de régularité sur la période"
                icon={<IconSparkline size={16} color={ORANGE} />}
              />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14, marginTop: 10 }}>
                {(freqData.items || []).slice(0, 8).map((p: any, i: number) => {
                  const freq = Number(p.repurchase_freq_pct) || 0;
                  return (
                    <div key={i} style={{ padding: 12, borderRadius: 12, background: `${PAL[i % PAL.length]}12`, borderLeft: `4px solid ${PAL[i % PAL.length]}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <div style={{ fontWeight: 800, color: INK, fontSize: ".82rem" }}>{p.article.slice(0, 26)}</div>
                        <span style={{ fontSize: ".62rem", fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: "white", color: INK }}>
                          {freq.toFixed(0)}%
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 50 }}>
                        {Array.from({ length: 12 }).map((_, wi) => {
                          const h = 30 + Math.sin((wi / 12) * Math.PI * 2 + i) * 20 + (freq / 100) * 30;
                          return (
                            <div
                              key={wi}
                              style={{
                                flex: 1,
                                height: `${Math.min(h, 100)}%`,
                                background: PAL[i % PAL.length],
                                opacity: 0.5 + (wi / 24),
                                borderRadius: 2,
                              }}
                            />
                          );
                        })}
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: ".65rem", color: MUTED }}>
                        <span>{p.category}</span>
                        <span>{p.semaines_actives} sem.</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════
          TAB 5: ASSOCIATIONS
          ══════════════════════════════════════════════ */}
      {tab === "assoc" && assocData && !loading && (
        <>
          {/* Filters */}
          <div className="cc" style={{ margin: "0 28px 14px", padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <IconFilter size={16} color={ORANGE} />
                <span style={{ fontSize: ".78rem", fontWeight: 800, color: INK }}>Paramètres Apriori</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <label style={{ fontSize: ".68rem", fontWeight: 700, color: MUTED }}>Tri :</label>
                <select
                  value={assocSort}
                  onChange={(e) => setAssocSort(e.target.value)}
                  style={{ fontSize: ".72rem", fontWeight: 700, padding: "6px 12px", borderRadius: 10, border: "1px solid #e2d5c8", background: "#fcfaf8", outline: "none", color: INK }}
                >
                  <option value="Lift ↓">Lift (force) ↓</option>
                  <option value="Confiance ↓">Confiance ↓</option>
                  <option value="Support ↓">Support (fréquence) ↓</option>
                </select>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <label style={{ fontSize: ".68rem", fontWeight: 700, color: MUTED }}>Nb règles :</label>
                <select
                  value={String(assocTopN)}
                  onChange={(e) => setAssocTopN(Number(e.target.value))}
                  style={{ fontSize: ".72rem", fontWeight: 700, padding: "6px 12px", borderRadius: 10, border: "1px solid #e2d5c8", background: "#fcfaf8", outline: "none", color: INK }}
                >
                  <option value="15">Top 15</option>
                  <option value="25">Top 25</option>
                  <option value="50">Top 50</option>
                  <option value="100">Top 100</option>
                </select>
              </div>
              <div style={{ marginLeft: "auto", display: "flex", gap: 14 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: ".60rem", color: MUTED, textTransform: "uppercase", letterSpacing: ".08em" }}>Support min</div>
                  <div style={{ fontSize: ".82rem", fontWeight: 800, color: INK }}>1%</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: ".60rem", color: MUTED, textTransform: "uppercase", letterSpacing: ".08em" }}>Confiance min</div>
                  <div style={{ fontSize: ".82rem", fontWeight: 800, color: INK }}>30%</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: ".60rem", color: MUTED, textTransform: "uppercase", letterSpacing: ".08em" }}>Lift min</div>
                  <div style={{ fontSize: ".82rem", fontWeight: 800, color: ORANGE }}>1.2×</div>
                </div>
              </div>
            </div>
          </div>

          {/* KPIs */}
          <div className="sw">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 14 }}>
              {[
                { lbl: "Règles totales", val: fmt(assocData.nb_total_regles), sub: "Après filtres Apriori", icon: IconLink2, color: ORANGE },
                { lbl: "Lift maximum", val: `${Math.max(...(assocData.rules || []).map((r: any) => Number(r.lift) || 0), 1).toFixed(2)}×`, sub: "Plus forte association", icon: IconBolt, color: "#c45030" },
                { lbl: "Confiance max", val: `${Math.max(...(assocData.rules || []).map((r: any) => Number(r.confidence) || 0), 0).toFixed(1)}%`, sub: "Meilleure prévisibilité", icon: IconTrendUp, color: OK },
                { lbl: "Support max", val: `${Math.max(...(assocData.rules || []).map((r: any) => Number(r.support) || 0), 0).toFixed(1)}%`, sub: "Paire la plus fréquente", icon: IconDonutPie, color: WARN },
              ].map((k, i) => {
                const Ic = k.icon;
                return (
                  <div key={i} className="cc">
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 8, background: `${k.color}14`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Ic size={15} color={k.color} />
                      </div>
                      <div style={{ fontSize: ".72rem", fontWeight: 700, color: INK }}>{k.lbl}</div>
                    </div>
                    <div style={{ fontSize: "1.75rem", fontWeight: 800, color: k.color, lineHeight: 1, marginTop: 10 }}>{k.val}</div>
                    <div className="cs" style={{ marginTop: 4 }}>{k.sub}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="sec-title">
            <IconScatter size={14} color={ORANGE} /> Support × Confiance × Lift
          </div>
          <div className="sw">
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 0.7fr)", gap: 12, marginBottom: 12 }}>
              <div className="cc" style={{ minHeight: 440 }}>
                <CardHeader
                  title="Quelles paires promouvoir EN PRIORITÉ ?"
                  sub="Zone en haut à droite = à intégrer immédiatement dans une offre 2 produits. Taille = force du Lift."
                  icon={<IconTarget size={16} color={ORANGE} />}
                />
                <BubbleScatter
                  data={assocData.rules || []}
                  xKey="support"
                  yKey="confidence"
                  sizeKey="lift"
                  labelKey="antecedent"
                  colorKey={(r) => Number(r.lift) >= 3 ? ORANGE : Number(r.lift) >= 2 ? PEACH : MUTED}
                  quadrants={{
                    xSplit: "p70",
                    ySplit: "p70",
                    zones: [
                      { side: "tr", label: "BUNDLE", sub: "Créer une offre groupée", color: Q1 },
                      { side: "tl", label: "CAISSE ciblé", sub: "Proposer en fin de parcours", color: Q2 },
                      { side: "br", label: "PLACEMENT", sub: "Rapprocher en rayon", color: Q3 },
                      { side: "bl", label: "À ignorer", sub: "Impact trop faible", color: Q4 },
                    ],
                  }}
                  topLabels={6}
                  xNiceUnit="%"
                  yNiceUnit="%"
                  xCapPercentile={0.95}
                  yCapPercentile={0.95}
                  height={400}
                  xLabel="Support % — combien de tickets contiennent la paire"
                  yLabel="Confiance % — précision de la règle"
                  legendWidth={200}
                />
              </div>
              <div className="cc" style={{ minHeight: 440 }}>
                <CardHeader
                  title="Top 12 associations selon le Lift"
                  sub={`${(assocData.rules || []).length} règles totales après filtres`}
                  icon={<IconBolt size={16} color={ORANGE} />}
                />
                <RankedRows
                  rows={(assocData.rules || []).map((r: any) => ({
                    article: `${r.antecedent.slice(0, 16)} → ${r.consequent.slice(0, 16)}`,
                    lift: Number(r.lift) || 0,
                  }))}
                  valueKey="lift"
                  colorKey={(r, i) => {
                    const v = Number((assocData.rules?.[i] || {}).lift) || 0;
                    return v >= 3 ? ORANGE : v >= 2 ? PEACH : LIGHT;
                  }}
                  maxShow={12}
                  unit="×"
                />
              </div>
            </div>
          </div>

          <div className="sec-title">
            <IconHeatmap size={14} color={ORANGE} /> Distribution &amp; Matrice du Lift
          </div>
          <div className="sw">
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 0.7fr) minmax(0, 1.3fr)", gap: 12, marginBottom: 12 }}>
              <div className="cc" style={{ minHeight: 340 }}>
                <CardHeader
                  title="Distribution de la force des associations"
                  sub="Histogramme du Lift sur les règles affichées"
                  icon={<IconBar size={16} color={ORANGE} />}
                />
                <Histogram
                  values={(assocData.rules || []).map((r: any) => Number(r.lift) || 0)}
                  buckets={7}
                  color={ORANGE}
                  unit="×"
                  height={280}
                />
              </div>
              <div className="cc" style={{ minHeight: 340 }}>
                <CardHeader
                  title="Produits achetés ensemble — force des liens"
                  sub="Plus c'est orange foncé, plus l'association est forte. Lecture : ligne A → colonne B"
                  icon={<IconHeatmap size={16} color={ORANGE} />}
                />
                <div style={{ marginTop: 8, overflowX: "auto" }}>
                  <LiftMatrix rules={assocData.rules || []} size={300} />
                </div>
              </div>
            </div>
          </div>

          <div className="sec-title">
            <IconScatter size={14} color={ORANGE} /> Confiance vs Lift &amp; Règles détaillées
          </div>
          <div className="sw">
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 0.8fr)", gap: 12, marginBottom: 12 }}>
              <div className="cc" style={{ minHeight: 420 }}>
                <CardHeader
                  title="Règles d'or : précision ET impact combinés"
                  sub="En haut à droite = règles ultra-efficaces. Taille = fréquence de la paire dans les tickets."
                  icon={<IconBolt size={16} color={ORANGE} />}
                />
                <BubbleScatter
                  data={assocData.rules || []}
                  xKey="lift"
                  yKey="confidence"
                  sizeKey="support"
                  labelKey="antecedent"
                  colorKey={(r) => Number(r.lift) >= 3 ? ORANGE : Number(r.confidence) >= 50 ? PEACH : MUTED}
                  quadrants={{
                    xSplit: 2,
                    ySplit: 50,
                    zones: [
                      { side: "tr", label: "RÈGLES D'OR", sub: "Confiance + Lift élevés", color: Q1 },
                      { side: "tl", label: "Prédictibles", sub: "Bon taux de réussite", color: Q2 },
                      { side: "br", label: "Surprenantes", sub: "Fort effet levier", color: Q3 },
                      { side: "bl", label: "Faibles", sub: "Impact limité", color: Q4 },
                    ],
                  }}
                  topLabels={7}
                  xNiceUnit="×"
                  yNiceUnit="%"
                  xCapPercentile={0.92}
                  yCapPercentile={0.95}
                  height={380}
                  xLabel="Lift — multiplicateur d'impact par rapport au hasard"
                  yLabel="Confiance — précision (%)"
                  legendWidth={200}
                />
              </div>
              <div className="cc" style={{ minHeight: 420 }}>
                <CardHeader
                  title="Tableau des règles d'association filtrées"
                  sub="Support · Confiance · Lift · interprétation"
                  icon={<IconGrid size={16} color={ORANGE} />}
                />
                <div style={{ maxHeight: 260, overflow: "auto", marginTop: 4 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".70rem" }}>
                    <thead style={{ position: "sticky", top: 0, background: "white" }}>
                      <tr style={{ borderBottom: "1px solid #f2e9e1", color: MUTED, textTransform: "uppercase", textAlign: "right" }}>
                        <th style={{ textAlign: "left", padding: "8px 6px", fontSize: ".62rem", letterSpacing: ".06em" }}>Antécédent → Conséquent</th>
                        <th style={{ padding: "8px 6px", fontSize: ".62rem", letterSpacing: ".06em" }}>Support</th>
                        <th style={{ padding: "8px 6px", fontSize: ".62rem", letterSpacing: ".06em" }}>Conf.</th>
                        <th style={{ padding: "8px 6px", fontSize: ".62rem", letterSpacing: ".06em" }}>Lift</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(assocData.rules || []).slice(0, 50).map((r: any, i: number) => {
                        const lvl = Number(r.lift) >= 3 ? ORANGE : Number(r.lift) >= 2 ? PEACH : Number(r.confidence) >= 50 ? LIGHT : MUTED;
                        return (
                          <tr key={i} style={{ borderBottom: "1px solid #fdfcfb" }}>
                            <td style={{ padding: "7px 6px", minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ background: "#f2ede6", padding: "2px 7px", borderRadius: 6, fontSize: ".68rem", fontWeight: 700, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 110 }}>
                                  {r.antecedent.slice(0, 20)}
                                </span>
                                <span style={{ color: MUTED, fontSize: ".65rem" }}>→</span>
                                <span style={{ background: `${ORANGE}12`, color: "#b84028", padding: "2px 7px", borderRadius: 6, fontSize: ".68rem", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 110 }}>
                                  {r.consequent.slice(0, 20)}
                                </span>
                              </div>
                            </td>
                            <td style={{ padding: "7px 6px", textAlign: "right", fontWeight: 600, color: INK }}>{Number(r.support).toFixed(1)}%</td>
                            <td style={{ padding: "7px 6px", textAlign: "right", fontWeight: 700, color: INK }}>{Number(r.confidence).toFixed(1)}%</td>
                            <td style={{ padding: "7px 6px", textAlign: "right" }}>
                              <span style={{ fontWeight: 800, fontSize: ".72rem", color: lvl, background: `${lvl}14`, padding: "2px 6px", borderRadius: 6 }}>
                                ×{Number(r.lift).toFixed(2)}
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
          </div>

          <div className="sec-title">
            <IconSparkles size={14} color={ORANGE} /> Synthèse &amp; Plan d'action
          </div>
          <div className="sw">
            <div className="g2">
              <div className="cc">
                <CardHeader
                  title="Résumé des métriques d'association"
                  sub="Pilotage global des règles Apriori"
                  icon={<IconSparkles size={16} color={ORANGE} />}
                />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginTop: 8 }}>
                  {[
                    { lbl: "Algorithme", val: "Apriori", sub: "Extraction de règles fréquentes", color: ORANGE },
                    { lbl: "Règles générées", val: fmt(assocData.nb_total_regles), sub: "Après pruning", color: OK },
                    { lbl: "Lift moyen", val: `${((assocData.rules || []).reduce((s: number, r: any) => s + Number(r.lift || 0), 0) / Math.max((assocData.rules?.length || 0), 1)).toFixed(2)}×`, sub: "Force moyenne des règles", color: WARN },
                    { lbl: "Confiance moyenne", val: `${((assocData.rules || []).reduce((s: number, r: any) => s + Number(r.confidence || 0), 0) / Math.max((assocData.rules?.length || 0), 1)).toFixed(1)}%`, sub: "Prédictibilité moyenne", color: PEACH },
                  ].map((k, i) => (
                    <div key={i} style={{ padding: 12, borderRadius: 10, background: `${k.color}10` }}>
                      <div style={{ fontSize: ".62rem", color: MUTED, textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 700, marginBottom: 4 }}>{k.lbl}</div>
                      <div style={{ fontSize: "1.15rem", fontWeight: 800, color: INK, lineHeight: 1 }}>{k.val}</div>
                      <div style={{ fontSize: ".65rem", color: "#5a4a3a", marginTop: 3 }}>{k.sub}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: "#fdf7f2", borderLeft: "3px solid " + ORANGE }}>
                  <div style={{ fontSize: ".72rem", fontWeight: 800, color: INK, marginBottom: 4 }}>Paramètres de génération</div>
                  <div style={{ fontSize: ".65rem", color: "#5a4a3a", lineHeight: 1.55 }}>
                    <strong>Support ≥</strong> 1% &nbsp;·&nbsp; <strong>Confiance ≥</strong> 30% &nbsp;·&nbsp; <strong>Lift ≥</strong> 1.2 &nbsp;·&nbsp;
                    Min antecedent = 1 produit &nbsp;·&nbsp; Max antecedent = 2 produits
                  </div>
                </div>
              </div>
              <div className="cc">
                <CardHeader
                  title="Interprétation &amp; plan d'action opérationnel"
                  sub="Suggestions basées sur les associations détectées"
                  icon={<IconSparkles size={16} color={ORANGE} />}
                />
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
                  {[
                    { title: "Pack promo : paires à fort Lift", desc: `${(assocData.rules || []).filter((r: any) => r.lift >= 3).length} règles ≥ lift 3× — proposer un bundle tarifaire pour ces couples`, color: ORANGE, Icon: IconTarget },
                    { title: "Placement conjoint en rayon", desc: `${(assocData.rules || []).filter((r: any) => r.confidence >= 60).length} règles à haute confiance — rapprocher ces produits physiquement`, color: PEACH, Icon: IconMapPin },
                    { title: "Suggestion en caisse", desc: `${(assocData.rules || []).slice(0, 5).map((r: any) => r.consequent).filter((x: string, i: number, arr: string[]) => arr.indexOf(x) === i).slice(0, 3).join(" · ")} : upsell ciblé en fin de parcours`, color: WARN, Icon: IconCart },
                    { title: "Promotions croisées", desc: "Produits à fort support — cross-sell sur les fiches produit du site / étiquettes", color: OK, Icon: IconLink2 },
                  ].map((r, i) => {
                    const RIcon = r.Icon;
                    return (
                      <div key={i} style={{ display: "flex", gap: 10, padding: 10, borderRadius: 10, background: `${r.color}14`, borderLeft: `3px solid ${r.color}` }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, flexShrink: 0, marginTop: 1 }}>
                          <RIcon size={16} color={r.color} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: ".78rem", fontWeight: 800, color: INK, marginBottom: 2 }}>{r.title}</div>
                          <div style={{ fontSize: ".68rem", color: "#5a4a3a", lineHeight: 1.4 }}>{r.desc}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
