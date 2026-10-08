"use client";

import React, { useEffect, useMemo, useState } from "react";
import { colors } from "@/lib/theme";
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
import { tr, trData, locale } from "@/lib/i18n";

/* ──────────── Palette & helpers (couleurs FONCÉES, DISTINCTES & saturées) ──────────── */
const ORANGE = colors.accentDeep;
const PEACH = colors.accentDeep2;
const LIGHT = colors.amber;
const CREAM = colors.brown;
const INK = colors.ink;
const MUTED = colors.mutedDark;
const GRID = colors.grid;
const OK = colors.ok;
const WARN = colors.warn;
const ALERT = colors.alert;
/* 4 couleurs DISTINCTES pour les quadrants (pas de tons orange mélangés) */
// Onglet Fréquence masqué tant que le calcul du backend (semaines comptées) n'est pas corrigé.
const SHOW_FREQ_TAB = false;

const Q1 = colors.zoneTop; // ROUGE FONCÉ (top-right : STARS / BUNDLE / RÈGLES D'OR)
const Q2 = colors.zoneLeft; // ORANGE BRUN (top-left : HAUT POTENTIEL / CAISSE / PREMIUM / PRÉDICTIBLES)
const Q3 = colors.zoneRight; // VERT FORÊT (bottom-right : MOTEURS / PLACEMENT / COMPLÉMENTS / SURPRENANTES)
const Q4 = colors.zoneLow; // GRIS FONCÉ (bottom-left : FAIBLE IMPACT / À IGNORER / ACCESSOIRES / FAIBLES)
/* Palette MULTILIGNE / DONUT : très distinctes (rouge, vert, bleu, violet, orange, teal, rose) */
const PALETTE_DISTINCTE = [
  "var(--dk-red, #DC2626)", "var(--dk-green-dark, #166534)", "#2563EB", "#7C3AED", "#EA580C",
  "#0F766E", "#BE185D", "#4F46E5", "#CA8A04", "#65A30D",
];
const PAL = PALETTE_DISTINCTE;

function fmt(n: number, dec = 0) {
  return Number(n || 0).toLocaleString(locale(), {
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
  if (v >= 70) return "var(--dk-accent-deep, #C2410C)";
  if (v >= 40) return "#EA580C";
  if (v >= 20) return "#D97706";
  return "var(--dk-warn, #B45309)";
}
function statutColor(s: string) {
  const x = String(s).toLowerCase();
  if (x.includes("pha") || x.includes("dominant") || x.includes("quotidien")) return "var(--dk-accent-deep, #C2410C)";
  if (x.includes("regulier") || x.includes("croissance")) return "#EA580C";
  if (x.includes("cyclique") || x.includes("niche")) return "var(--dk-warn, #B45309)";
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
              {unit}
              {subKey && r[subKey] != null && <span style={{ color: MUTED, marginLeft: 4, fontSize: ".65rem" }}>{trData(r[subKey])}</span>}
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
        <circle cx="100" cy="100" r={R} fill="none" stroke="var(--dk-line, #f0ece6)" strokeWidth="26" />
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
              <title>{`${trData(d.label)}\n${((d.value / total) * 100).toFixed(1)}%\n${fmt(d.value)} ${tr("références", "products")}`}</title>
            </circle>
          );
        })}
        <text x="100" y="95" textAnchor="middle" style={{ fontSize: 22, fontWeight: 800, fill: INK }}>
          {fmt(total)}
        </text>
        <text x="100" y="114" textAnchor="middle" style={{ fontSize: 10, fontWeight: 700, fill: MUTED }}>
          {tr("TOTAL", "TOTAL")}
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
                {trData(String(d.label)).slice(0, 30)}
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
            {isZoomed ? tr(`Zoom : ${fmtX(effXMin)} → ${fmtX(effXMax)} · ${fmtY(effYMin)} → ${fmtY(effYMax)} · Double-clic pour réinitialiser`, `Zoom: ${fmtX(effXMin)} → ${fmtX(effXMax)} · ${fmtY(effYMin)} → ${fmtY(effYMax)} · Double-click to reset`) : tr("Glissez un rectangle sur le graphique pour zoomer", "Drag a rectangle on the chart to zoom")}
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
                stroke="var(--dk-line, #e6ddd2)"
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
                  fill="var(--dk-surface, white)"
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
                  stroke="var(--dk-ink, #1C1410)"
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
            background: "var(--dk-soft, #fdf7f2)",
            borderRadius: 12,
            border: "1px solid var(--dk-line, #ece3d9)",
          }}
        >
          <div style={{ fontSize: ".70rem", fontWeight: 800, color: INK, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <IconGrid size={12} color={ORANGE} /> {tr("Légende des zones", "Zone legend")}
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
              borderTop: "1px dashed var(--dk-line, #e6ddd2)",
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
            <span><strong style={{ color: INK }}>{tr("Astuce", "Tip")}</strong>{tr(" : survolez un point pour voir le nom du produit et ses valeurs détaillées.", ": hover over a point to see the product name and its detailed values.")}</span>
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
            ? tr(`Zoom : ${weeks[effStart]} → ${weeks[effEnd]} · Double-cliquez ou cliquez ici pour réinitialiser`, `Zoom: ${weeks[effStart]} → ${weeks[effEnd]} · Double-click or click here to reset`)
            : tr("Glissez une sélection horizontale sur le graphique pour zoomer", "Drag a horizontal selection on the chart to zoom")}
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
              stroke="var(--dk-line, #e6ddd2)"
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
                  <title>{tr(`${s.article}\nSemaine : ${p.week}\nTaux de pénétration : ${Number(p.rate).toFixed(1)}%`, `${s.article}\nWeek: ${p.week}\nPenetration rate: ${Number(p.rate).toFixed(1)}%`)}</title>
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
              {trData(c.category)}
            </span>
            <div style={{ flex: 1, height: 10, background: "var(--dk-line, #f0ece6)", borderRadius: 99 }}>
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
                {trData(r[labelKey])} : {fmt(v)} {unit}
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
          <span key={i}>{trData(r[labelKey])}</span>
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
    { key: "all", label: tr("Global", "Overall"), color: ORANGE },
    { key: "touristic", label: tr("Saison", "Season"), color: PEACH },
    { key: "event", label: tr("Événement", "Event"), color: "var(--dk-accent-deep, #c45030)" },
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
                    title={`${trData(r.day)} ${s.label}: ${v.toFixed(1)}`}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-1.5 pt-1 border-t border-[#f0ece6] text-[9px] font-semibold text-center" style={{ color: MUTED }}>
        {rows.map((r, i) => (
          <span key={i} style={{ flex: 1 }}>{tr(r.day.slice(0, 4), trData(r.day).slice(0, 3))}</span>
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
    { x: pad + 8, y: pad + 8, label: tr("Étoiles", "Stars"), sub: tr("forte fréquence · forte valeur", "high frequency · high value"), color: ORANGE, side: "tl", Icon: IconStar },
    { x: W / 2 + 8, y: pad + 8, label: tr("Opportunités", "Opportunities"), sub: tr("forte valeur · peu fréquent", "high value · infrequent"), color: WARN, side: "tr", Icon: IconSparkles },
    { x: pad + 8, y: H / 2 + 8, label: tr("Moteurs", "Drivers"), sub: tr("fréquence haute · valeur moyenne", "high frequency · medium value"), color: OK, side: "bl", Icon: IconBasket },
    { x: W / 2 + 8, y: H / 2 + 8, label: tr("À réévaluer", "To reassess"), sub: tr("faible des 2 côtés", "low on both axes"), color: MUTED, side: "br", Icon: IconSearchCircle },
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
                stroke="var(--dk-surface, white)"
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
  return <SimpleBar rows={rows} valueKey="count" unit={tr(`prod${unit}`, `prod${unit}`)} color={color} height={height} />;
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
            const fill = v === 0 ? "var(--dk-soft, #f7f2ec)" : isDiag ? "var(--dk-soft, #fbe8d8)" : ORANGE;
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
                  <title>{`${a} → ${b}\nLift: ${v.toFixed(2)}${v === 0 ? tr(" (pas de règle)", " (no rule)") : ""}`}</title>
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
              <rect x={lx} y={ly} width={lw} height={lh} fill="url(#lift-grad)" rx={3} stroke="var(--dk-line, #ece3d9)" />
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
                {tr("Vide = pas de règle", "Empty = no rule")}
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
        background: active ? ORANGE : "var(--dk-line, #f2ede6)",
        color: active ? "white" : "var(--dk-ink2, #5a4a3a)",
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
    { id: "pen", label: tr("Pénétration", "Penetration"), sub: tr("Présence dans les tickets", "Presence in transactions"), Icon: IconTarget, color: ORANGE },
    { id: "vel", label: tr("Vitesse de Vente", "Sales Velocity"), sub: tr("Cadence journalière & horaire", "Daily & hourly pace"), Icon: IconBolt, color: "var(--dk-accent-deep, #c45030)" },
    { id: "ticket", label: tr("Contribution Ticket", "Basket Contribution"), sub: tr("Rôle dans les paniers", "Role in baskets"), Icon: IconTicketPerc, color: PEACH },
    { id: "freq", label: tr("Fréquence d'Achat", "Purchase Frequency"), sub: tr("Régularité de réachat", "Repurchase regularity"), Icon: IconRepeat, color: "var(--dk-accent-deep, #d4724a)" },
    { id: "assoc", label: tr("Associations", "Associations"), sub: tr("Produits achetés ensemble", "Products bought together"), Icon: IconLink2, color: "var(--dk-accent-deep, #b84028)" },
  ] as const;

  return (
    <div style={{ paddingBottom: "48px" }}>
      {/* ── TITRE + DESCRIPTION ── */}
      <div style={{ marginBottom: "16px", padding: "0 28px" }}>
        <h1 style={{ fontSize:"1.8rem", fontWeight:800, color:INK,
                     letterSpacing:"-0.03em", lineHeight:1.1, margin:0 }}>
          {tr("Analyse ", "Product ")}<span style={{ color: ORANGE }}>{tr("Produits", "Analysis")}</span>
        </h1>
        <p style={{ color:MUTED, fontSize:"0.82rem", marginTop:"6px",
                    maxWidth:"640px", lineHeight:1.5 }}>
          {tr("Présence dans les tickets, vitesse de vente, contribution au panier, régularité et produits achetés ensemble.", "Presence in transactions, sales velocity, basket contribution, regularity and products bought together.")}
        </p>
      </div>

      {/* ── MINI KPIs + FILTRE ANNEE ── */}
      <div style={{ margin: "0 28px 12px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14,
                      padding:"14px 18px", borderRadius:"14px",
                      background:"var(--dk-surface, #fff)",
                      border:"1px solid var(--dk-line, rgba(200,140,100,0.18))",
                      boxShadow:"0 2px 12px rgba(0,0,0,0.06)" }}>
          <div>
            <div style={{ fontSize: ".62rem", color: MUTED, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 2 }}>
              {tr("Références", "Products")}
            </div>
            <div style={{ fontSize: "1.35rem", fontWeight: 800, color: INK }}>
              {tab === "pen" && penData ? fmt(penData.kpis?.total_articles) : tab === "freq" && freqData ? fmt(freqData.nb_produits) : "—"}
            </div>
          </div>
          <div>
            <div style={{ fontSize: ".62rem", color: MUTED, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 2 }}>
              {tab === "assoc" ? tr("Associations", "Associations") : tab === "vel" ? tr("Articles / jour (moy.)", "Items / day (avg.)") : tab === "ticket" ? tr("Paniers multi-articles", "Multi-item baskets") : tab === "pen" ? tr("Présence max", "Max presence") : "—"}
            </div>
            <div style={{ fontSize: "1.35rem", fontWeight: 800, color: ORANGE }}>
              {tab === "assoc" && assocData ? fmt(assocData.nb_total_regles) :
                tab === "ticket" && ticketData ? `${ticketData.stats?.pct_multi?.toFixed(0) || 0}%` :
                tab === "pen" && penData ? `${Number(penData.kpis?.pen_max || 0).toFixed(0)}%` :
                tab === "vel" && velData?.dow_velocity?.length ? `${fmt(velData.dow_velocity.reduce((s: number, d: any) => s + (d.all || 0), 0) / velData.dow_velocity.length, 0)}${tr("/j", "/d")}` : "—"}
            </div>
          </div>
          <div>
            <div style={{ fontSize: ".62rem", color: MUTED, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 4 }}>
              {tr("Période", "Period")}
            </div>
            {/* Filtre Année masqué : le backend ne l'applique pas encore (taux identiques). */}
            <div style={{ fontSize: "1rem", fontWeight: 800, color: INK, padding: "6px 0" }}>2024 – 2025</div>
          </div>
        </div>
      </div>

      {/* ── TABS Selector ── */}
      <div style={{ margin: "18px 28px 16px" }}>
        <div style={{ display: "flex", gap: 12, padding: 6, background: "var(--dk-soft, rgba(255,255,255,0.55))", borderRadius: 16, border: "1px solid var(--dk-line, #ece3d9)", overflowX: "auto" }}>
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
                  background: active ? "var(--dk-surface, white)" : "transparent",
                  boxShadow: active ? "0 4px 18px rgba(80,40,10,0.10)" : "none",
                  transition: "all 0.2s",
                }}
              >
                <div
                  style={{
                    width: 32, height: 32, borderRadius: 9,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: active ? `color-mix(in srgb, ${t.color} 8%, transparent)` : "var(--dk-page, #f2ede6)",
                    flexShrink: 0,
                  }}
                >
                  <Icon size={16} color={active ? t.color : MUTED} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", minWidth: 0 }}>
                  <span style={{ fontSize: ".82rem", fontWeight: 800, color: active ? INK : "var(--dk-ink2, #5a4a3a)", whiteSpace: "nowrap" }}>
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
          {tr("Analyse en cours…", "Analysing…")}
        </div>
      )}

      {/* ══════════════════════════════════════════════
          TAB 1: PÉNÉTRATION
          ══════════════════════════════════════════════ */}
      {tab === "pen" && penData && !loading && (
        <>
          {/* Filters bar */}
          <div className="cc" style={{ margin: "0 28px 14px", padding: "16px 20px", borderRadius:"14px",
          background: "var(--dk-soft, #FDF6EC)",
          border:"1px solid var(--dk-line, rgba(196,168,130,.25))",
          boxShadow:"0 4px 16px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <IconFilter size={16} color={ORANGE} />
                <span style={{ fontSize: ".78rem", fontWeight: 800, color: INK }}>{tr("Filtres", "Filters")}</span>
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
                  background: "var(--dk-surface, #fcfaf8)",
                  borderRadius: 10,
                  border: "1px solid var(--dk-line, #e8dccd)",
                }}
              >
                <IconSearch size={15} color={MUTED} />
                <input
                  type="text"
                  placeholder={tr("Rechercher un produit (ex: baguette)...", "Search for a product (e.g. baguette)...")}
                  value={searchPen}
                  onChange={(e) => setSearchPen(e.target.value)}
                  style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: ".78rem", fontWeight: 600, color: INK }}
                />
              </div>
              {/* Category chips */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", flex: "1 1 300px" }}>
                <span style={{ fontSize: ".68rem", fontWeight: 700, color: MUTED }}>{tr("Catégorie :", "Category:")}</span>
                <Chip
                  active={penCats.length === 0}
                  onClick={() => setPenCats([])}
                  label={tr("Toutes", "All")}
                />
                {(penData.available_categories || []).filter((c: string) => c !== "Toutes").slice(0, 8).map((c: string) => (
                  <Chip
                    key={c}
                    active={penCats.includes(c)}
                    onClick={() => setPenCats((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c])}
                    label={tr(c.slice(0, 14), trData(c))}
                  />
                ))}
              </div>
              {/* Statut chips */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: ".68rem", fontWeight: 700, color: MUTED }}>{tr("Statut :", "Status:")}</span>
                <Chip
                  active={penStatuts.length === 0}
                  onClick={() => setPenStatuts([])}
                  label={tr("Tous", "All")}
                />
                {(penData.available_statuts || []).filter((s: string) => s !== "Toutes" && s !== "Tous").map((s: string) => (
                  <Chip
                    key={s}
                    active={penStatuts.includes(s)}
                    onClick={() => setPenStatuts((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])}
                    label={tr(s.replace(/ *\([^)]*\) */g, "").slice(0, 14), trData(s.replace(/ *\([^)]*\) */g, "")))}
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
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: `color-mix(in srgb, ${ORANGE} 8%, transparent)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <IconBox size={15} color={ORANGE} />
                  </div>
                  <div style={{ fontSize: ".78rem", fontWeight: 700, color: INK }}>{tr("Total Références", "Total Products")}</div>
                </div>
                <div style={{ fontSize: "1.75rem", fontWeight: 800, color: INK, lineHeight: 1, marginTop: 10 }}>{fmt(penData.kpis?.total_articles)}</div>
                <div className="cs" style={{ marginTop: 4 }}>{tr("Analysées sur l'historique", "Analysed over the full history")}</div>
              </div>
              <div className="cc">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: `color-mix(in srgb, ${OK} 8%, transparent)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <IconTrendUp size={15} color={OK} />
                  </div>
                  <div style={{ fontSize: ".78rem", fontWeight: 700, color: INK }}>{tr("Pénétration Max", "Max Penetration")}</div>
                </div>
                <div style={{ fontSize: "1.75rem", fontWeight: 800, color: OK, lineHeight: 1, marginTop: 10 }}>{Number(penData.kpis?.pen_max || 0).toFixed(0)}%</div>
                <div className="cs" style={{ marginTop: 4 }}>{tr("Meilleur taux sur les tickets", "Best rate across transactions")}</div>
              </div>
              <div className="cc">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: `color-mix(in srgb, ${PEACH} 13%, transparent)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <IconScale size={15} color={ORANGE} />
                  </div>
                  <div style={{ fontSize: ".78rem", fontWeight: 700, color: INK }}>{tr("Pénétration Médiane", "Median Penetration")}</div>
                </div>
                <div style={{ fontSize: "1.75rem", fontWeight: 800, color: ORANGE, lineHeight: 1, marginTop: 10 }}>{Number(penData.kpis?.pen_median || 0).toFixed(1)}%</div>
                <div className="cs" style={{ marginTop: 4 }}>{tr("Taux central du catalogue", "Catalogue middle rate")}</div>
              </div>
              <div className="cc">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: `color-mix(in srgb, ${WARN} 8%, transparent)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <IconTrophy size={15} color={WARN} />
                  </div>
                  <div style={{ fontSize: ".78rem", fontWeight: 700, color: INK }}>{tr("Produits Phares", "Flagship Products")}</div>
                </div>
                <div style={{ fontSize: "1.75rem", fontWeight: 800, color: WARN, lineHeight: 1, marginTop: 10 }}>
                  {fmt(penData.kpis?.status_counts?.["Produit Phare (Dominant)"] || 0)}
                </div>
                <div className="cs" style={{ marginTop: 4 }}>{tr("Statuts dominants", "Dominant status")}</div>
              </div>
            </div>
          </div>

          {/* Row 1: Ranked bar + Scatter Pen × CA */}
          <div className="sec-title">
            <IconBar size={14} color={ORANGE} /> {tr("Classement & Pénétration × CA", "Ranking & Penetration × Revenue")}
          </div>
          <div className="sw">
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 0.7fr) minmax(0, 1.3fr)", gap: 12, marginBottom: 12 }}>
              <div className="cc" style={{ minHeight: 440 }}>
                <CardHeader
                  title={tr("Classement selon le taux de pénétration", "Ranking by penetration rate")}
                  sub={tr("Top 12 des références les plus présentes", "Top 12 most present products")}
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
                  title={tr("Présence × Chiffre d'affaires : où investir ?", "Presence × Revenue: where to invest?")}
                  sub={tr("Plus le point est haut et à droite, plus il est stratégique. Taille = quantités totales vendues.", "The higher and further right a point is, the more strategic it is. Size = total quantity sold.")}
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
                      { side: "tr", label: tr("Stars", "Stars"), sub: tr("À valoriser", "To promote"), color: Q1 },
                      { side: "tl", label: tr("Haut potentiel", "High potential"), sub: tr("Peu présent mais fort CA", "Rarely bought but high revenue"), color: Q2 },
                      { side: "br", label: tr("Moteurs volume", "Volume drivers"), sub: tr("Bonne fréquence", "Good frequency"), color: Q3 },
                      { side: "bl", label: tr("Faible impact", "Low impact"), sub: tr("À réévaluer", "To reassess"), color: Q4 },
                    ],
                  }}
                  topLabels={5}
                  xNiceUnit="%"
                  yNiceFormat={kFmt}
                  yNiceUnit=" €"
                  yCapPercentile={0.9}
                  height={400}
                  xLabel={tr("Taux de pénétration — fréquence dans les tickets", "Penetration rate — frequency in transactions")}
                  yLabel={tr("Chiffre d'affaires total (€)", "Total revenue (€)")}
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
                      <IconDonutPie size={14} color={ORANGE} /> {tr("Statuts & Évolution temporelle", "Statuses & Trend over time")}
                    </div>
                    <div className="sw">
                      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 0.55fr) minmax(0, 1.45fr)", gap: 12, marginBottom: 14 }}>
                        {!isSearchActive && (
                          <div className="cc">
                            <CardHeader
                              title={tr("Part des produits par statut", "Share of products by status")}
                              sub={tr("Classement des produits selon leur présence dans les tickets", "Products classified by their presence in transactions")}
                              icon={<IconDonutPie size={16} color={ORANGE} />}
                            />
                            <CategoryBars
                              cats={(() => {
                                const sc: Record<string, number> = penData.kpis?.status_counts || {};
                                const tot = Object.values(sc).reduce((a, b) => a + Number(b), 0) || 1;
                                return Object.entries(sc).map(([k, v]) => ({ category: k, taux_moyen: (Number(v) / tot) * 100, nb_articles: Number(v) }));
                              })()}
                              height={250}
                            />
                          </div>
                        )}
                        <div className="cc" style={{ gridColumn: isSearchActive ? "1 / -1" : undefined }}>
                          <CardHeader
                            title={tr("Évolution hebdomadaire du taux de pénétration", "Weekly penetration rate trend")}
                            sub={isSearchActive ? tr("Produits phares du catalogue (TOP 6) — conserve la tendance globale", "Catalogue flagship products (TOP 6) — keeps the overall trend") : tr("Survolez un point pour voir la date et la valeur exacte.", "Hover over a point to see the date and exact value.")}
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
                      <IconGrid size={14} color={ORANGE} /> {tr("Focus par Catégorie", "Focus by Category")}
                    </div>
                    <div className="sw">
                      <div className="g2">
                        <div className="cc">
                          <CardHeader
                            title={tr("Taux de pénétration moyen par catégorie", "Average penetration rate by category")}
                            sub={tr("Comparatif des familles de produits", "Comparison of product families")}
                            icon={<IconBox size={16} color={ORANGE} />}
                          />
                          <CategoryBars cats={(penData.category_summary || []).map((c: any) => ({ category: c.category, taux_moyen: c.taux_moyen, nb_articles: c.nb_articles }))} height={260} />
                        </div>
                        {/* Carte « Part du chiffre d'affaires par catégorie » masquée : le CA par catégorie
                            renvoyé par le backend est faux (plusieurs milliards d'euros). À réafficher après correction. */}
                      </div>
                    </div>
                  </>
                )}
              </>
            );
          })()}

          {/* Row 4: Zoom produit sélectionné + Recommandations */}
          <div className="sec-title">
            <IconPin size={14} color={ORANGE} /> {tr("Zoom Produit & Recommandations", "Product Zoom & Recommendations")}
          </div>
          <div className="sw">
            <div className="g2">
              <div className="cc">
                <CardHeader
                  title={tr("Évolution de la pénétration — produit sélectionné", "Penetration trend — selected product")}
                  sub={tr("Cliquez sur un produit dans le classement pour l'analyser", "Click a product in the ranking to analyse it")}
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
                        borderColor: penSelected === p.article ? ORANGE : "var(--dk-line, #e8dccd)",
                        background: penSelected === p.article ? `color-mix(in srgb, ${ORANGE} 8%, transparent)` : "var(--dk-surface, white)",
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
                  <div style={{ padding: 14, borderRadius: 12, background: "var(--dk-soft, #fdf7f2)" }}>
                    {(() => {
                      const trend = (penData.weekly_trend || []).find((w: any) => w.article === penSelected);
                      const p = (penData.items || []).find((x: any) => x.article === penSelected);
                      return (
                        <>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                            <div style={{ fontSize: ".95rem", fontWeight: 800, color: INK }}>{penSelected}</div>
                            <span style={{ fontSize: ".65rem", fontWeight: 700, padding: "3px 8px", borderRadius: 99, background: statutColor(p?.statut || ""), color: INK }}>
                              {trData(p?.statut) || "—"}
                            </span>
                          </div>
                          {trend ? (
                            <MultiLineChart series={[trend]} height={140} />
                          ) : (
                            <SimpleBar
                              rows={[{ label: tr("Pénét.", "Penet."), qte: p?.penetration_rate || 0 }, { label: tr("CA", "Rev."), qte: (p?.ca_total || 0) / 100 }]}
                              color={ORANGE}
                              height={140}
                            />
                          )}
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--dk-line, #f2ede6)" }}>
                            <div><div className="cs">{tr("Pénétration", "Penetration")}</div><div style={{ fontWeight: 800, color: ORANGE }}>{Number(p?.penetration_rate || 0).toFixed(1)}%</div></div>
                            <div><div className="cs">{tr("Tickets", "Transactions")}</div><div style={{ fontWeight: 800, color: INK }}>{fmt(p?.tickets_count)}</div></div>
                            <div><div className="cs">{tr("CA total", "Total revenue")}</div><div style={{ fontWeight: 800, color: INK }}>{fmt(p?.ca_total)} €</div></div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
              <div className="cc">
                <CardHeader
                  title={tr("Recommandations fondées sur la pénétration", "Penetration-based recommendations")}
                  sub={tr("Actions opérationnelles suggérées", "Suggested operational actions")}
                  icon={<IconSparkles size={16} color={ORANGE} />}
                />
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
                  {[
                    { title: tr("Mettre en avant les Produits Phares", "Promote the flagship products"), desc: tr(`${fmt(penData.kpis?.status_counts?.["Produit Phare (Dominant)"] || 0)} références — développer leur visibilité en caisse`, `${fmt(penData.kpis?.status_counts?.["Produit Phare (Dominant)"] || 0)} products — increase their visibility at the checkout`), color: ORANGE, Icon: IconStar },
                    { title: tr("Surveiller les produits en croissance", "Watch the growing products"), desc: tr("Double digit de croissance hebdo — proposer des pack promo croisés", "Double-digit weekly growth — offer cross-promotion packs"), color: PEACH, Icon: IconTrendUp },
                    { title: tr("Questionner les niches stables", "Review the stable niches"), desc: tr("Catégories à taux faible mais régulier — évaluer la place en rayon", "Categories with a low but steady rate — review their shelf space"), color: LIGHT, Icon: IconSearchCircle },
                    { title: tr("Désengager les sporadiques", "Phase out the sporadic products"), desc: tr("Produits apparaissant < 20% — réduction du linéaire ou arrêt", "Products appearing in < 20% — reduce shelf space or discontinue"), color: MUTED, Icon: IconAlert },
                  ].map((r, i) => {
                    const RIcon = r.Icon;
                    return (
                      <div key={i} style={{ display: "flex", gap: 10, padding: 10, borderRadius: 10, background: `color-mix(in srgb, ${r.color} 8%, transparent)`, borderLeft: `3px solid ${r.color}` }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, flexShrink: 0, marginTop: 1 }}>
                          <RIcon size={16} color={r.color} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: ".78rem", fontWeight: 800, color: INK, marginBottom: 2 }}>{r.title}</div>
                          <div style={{ fontSize: ".68rem", color: "var(--dk-ink2, #5a4a3a)", lineHeight: 1.35 }}>{r.desc}</div>
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
            <IconBolt size={14} color={ORANGE} /> {tr("Macro-Vélocité (par jour)", "Macro velocity (by day)")}
          </div>
          <div className="sw">
            <div>
              <div className="cc">
                <CardHeader
                  title={tr("Articles vendus selon le jour de la semaine", "Items sold by day of the week")}
                  sub={tr("Moyenne par jour d'ouverture", "Average per opening day")}
                  icon={<IconCalendarDays size={16} color={ORANGE} />}
                />
                <SimpleBar rows={velData.dow_velocity || []} labelKey="day" valueKey="all" unit={tr("u.", "u.")} color={ORANGE} height={240} />
              </div>
            </div>
          </div>

          <div className="sec-title">
            <IconClock size={14} color={ORANGE} /> {tr("Micro-Vélocité Horaire", "Hourly micro velocity")}
          </div>
          <div className="sw">
            <div className="g2">
              <div className="cc">
                <CardHeader
                  title={tr("Distribution horaire globale de la vitesse", "Overall hourly velocity distribution")}
                  sub={tr("Concentration des ventes selon l'heure", "Sales concentration by hour")}
                  icon={<IconBar size={16} color={ORANGE} />}
                />
                <SimpleBar rows={velData.hourly_distribution || []} labelKey="heure_label" valueKey="global_qte_per_hour" unit={tr("u.", "u.")} color={PEACH} height={200} />
              </div>
              <div className="cc">
                <CardHeader
                  title={tr("Top produits par vitesse journalière", "Top products by daily velocity")}
                  sub={tr("Articles avec le plus fort volume moyen", "Items with the highest average volume")}
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
            <IconAlert size={14} color={ORANGE} /> {tr("Alertes Horaire & Surveillance", "Hourly Alerts & Monitoring")}
          </div>
          <div className="sw">
            <div className="g2">
              <div className="cc">
                <CardHeader
                  title={tr("Produits fortement concentrés sur une plage horaire", "Products heavily concentrated in one time slot")}
                  sub={tr("Risque de rupture en période de pic", "Stock-out risk at peak times")}
                  icon={<IconAlert size={16} color={ALERT} />}
                />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginTop: 8 }}>
                  {(velData.macro_items || []).slice(0, 6).map((p: any, i: number) => (
                    <div key={i} style={{ padding: 10, borderRadius: 10, background: i < 2 ? `rgba(192,80,44,0.08)` : "var(--dk-soft, #fdf7f2)", border: "1px solid", borderColor: i < 2 ? "rgba(192,80,44,0.25)" : "var(--dk-line, #f2ede6)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                        <div className="pdot" style={{ background: i < 2 ? ALERT : ORANGE }} />
                        <span style={{ fontSize: ".74rem", fontWeight: 800, color: INK }}>{p.article.slice(0, 22)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".68rem", color: MUTED }}>
                        <span>{tr("Pic de vente", "Sales peak")}</span>
                        <span style={{ fontWeight: 700, color: i < 2 ? ALERT : ORANGE }}>{p.peak_hour != null ? `${String(p.peak_hour).padStart(2, "0")}h` : velData.hourly_distribution?.[i % (velData.hourly_distribution?.length || 1)]?.heure_label || "—"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="cc">
                <CardHeader
                  title={tr("Produits nécessitant une surveillance horaire", "Products needing hourly monitoring")}
                  sub={tr("Classement complet — préconisation de suivi", "Full ranking — monitoring advice")}
                  icon={<IconScale size={16} color={ORANGE} />}
                />
                <div style={{ marginTop: 8, overflow: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".72rem" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--dk-line, #f2e9e1)", color: MUTED, textTransform: "uppercase", textAlign: "right" }}>
                        <th style={{ textAlign: "left", padding: "8px 4px", fontSize: ".65rem", letterSpacing: ".06em" }}>{tr("Produit", "Product")}</th>
                        {Object.keys(velData.macro_items?.[0] || {}).filter((k) => k !== "article").slice(0, 4).map((k, i) => (
                          <th key={i} style={{ padding: "8px 4px", fontSize: ".65rem", letterSpacing: ".06em" }}>{({ daily_velocity: tr("Par jour", "Per day"), velocity_touristic: tr("En saison", "In season"), velocity_event: tr("Jour d'événement", "Event day"), stock_securite: tr("Stock de sécurité", "Safety stock") } as Record<string, string>)[k] || k}</th>
                        ))}
                        <th style={{ padding: "8px 4px", fontSize: ".65rem", letterSpacing: ".06em" }}>{tr("Priorité", "Priority")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(velData.macro_items || []).slice(0, 12).map((p: any, i: number) => {
                        const prio = i < 2 ? "HAUTE" : i < 5 ? "MOYENNE" : "BASSE";
                        const prioColor = prio === "HAUTE" ? ALERT : prio === "MOYENNE" ? WARN : OK;
                        return (
                          <tr key={i} style={{ borderBottom: "1px solid var(--dk-surface, #fdfcfb)" }}>
                            <td style={{ padding: "8px 4px", fontWeight: 700, color: INK }}>{p.article.slice(0, 22)}</td>
                            {Object.keys(p).filter((k) => k !== "article").slice(0, 4).map((k, j) => (
                              <td key={j} style={{ padding: "8px 4px", textAlign: "right", fontWeight: 600, color: INK }}>
                                {typeof p[k] === "number" ? Number(p[k]).toFixed(0) : String(p[k]).slice(0, 6)}
                              </td>
                            ))}
                            <td style={{ padding: "8px 4px", textAlign: "right" }}>
                              <span style={{ fontSize: ".62rem", fontWeight: 800, padding: "2px 7px", borderRadius: 99, background: `color-mix(in srgb, ${prioColor} 8%, transparent)`, color: prioColor }}>
                                {prio === "HAUTE" ? tr("HAUTE", "HIGH") : prio === "MOYENNE" ? tr("MOYENNE", "MEDIUM") : tr("BASSE", "LOW")}
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
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: `color-mix(in srgb, ${ORANGE} 8%, transparent)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <IconTicketPerc size={15} color={ORANGE} />
                  </div>
                  <div style={{ fontSize: ".78rem", fontWeight: 700, color: INK }}>{tr("Tickets Multi-Articles", "Multi-Item Transactions")}</div>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 10 }}>
                  <div style={{ fontSize: "1.9rem", fontWeight: 800, color: ORANGE, lineHeight: 1 }}>{fmt(ticketData.stats?.nb_multi)}</div>
                  <div style={{ fontSize: ".85rem", fontWeight: 700, color: MUTED }}>
                    ({Number(ticketData.stats?.pct_multi || 0).toFixed(1)}%)
                  </div>
                </div>
                <div className="cs" style={{ marginTop: 4 }}>{tr("Paniers à plusieurs références", "Baskets with several products")}</div>
              </div>
              <div className="cc">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: "var(--dk-page, #f2ede6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <IconBox size={15} color={MUTED} />
                  </div>
                  <div style={{ fontSize: ".78rem", fontWeight: 700, color: INK }}>{tr("Tickets Mono-Article", "Single-Item Transactions")}</div>
                </div>
                <div style={{ fontSize: "1.9rem", fontWeight: 800, color: INK, lineHeight: 1, marginTop: 10 }}>{fmt(ticketData.stats?.nb_mono)}</div>
                <div className="cs" style={{ marginTop: 4 }}>{tr("Paniers à article unique", "Single-item baskets")}</div>
              </div>
              <div className="cc">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: `color-mix(in srgb, ${PEACH} 13%, transparent)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <IconCash size={15} color={ORANGE} />
                  </div>
                  <div style={{ fontSize: ".78rem", fontWeight: 700, color: INK }}>{tr("Total Transactions", "Total Transactions")}</div>
                </div>
                <div style={{ fontSize: "1.9rem", fontWeight: 800, color: INK, lineHeight: 1, marginTop: 10 }}>{fmt(ticketData.stats?.nb_total)}</div>
                <div className="cs" style={{ marginTop: 4 }}>{tr("Base d'analyse complète", "Full analysis base")}</div>
              </div>
            </div>
          </div>

          <div className="sec-title">
            <IconTrophy size={14} color={ORANGE} /> {tr("Contribution & Positionnement", "Contribution & Positioning")}
          </div>
          <div className="sw">
            <div className="g2">
              <div className="cc">
                <CardHeader
                  title={tr("Produits contribuant le plus à la valeur médiane du ticket", "Products contributing most to the median basket value")}
                  sub={tr("Top 20 — contribution médiane en pourcentage du panier", "Top 20 — median contribution as a percentage of the basket")}
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
                  title={tr("Fréquence × Valeur ajoutée sur le ticket", "Frequency × Value added to the basket")}
                  sub={tr("Plus la bulle est grande, plus le CA du produit est élevé.", "The bigger the bubble, the higher the product revenue.")}
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
                      { side: "tr", label: tr("Gros contributeurs", "Big contributors"), sub: tr("Fréquents et à forte valeur", "Frequent and high value"), color: Q1 },
                      { side: "tl", label: tr("Occasionnels", "Occasional"), sub: tr("Peu fréquents, forte valeur", "Infrequent, high value"), color: Q2 },
                      { side: "br", label: tr("Compléments", "Complements"), sub: tr("Souvent présent", "Often present"), color: Q3 },
                      { side: "bl", label: tr("Accessoires", "Accessories"), sub: tr("Petit impact", "Small impact"), color: Q4 },
                    ],
                  }}
                  topLabels={6}
                  xNiceFormat={kFmt}
                  xNiceUnit={tr(" tickets", " transactions")}
                  yNiceUnit="%"
                  yCapPercentile={0.92}
                  xCapPercentile={0.95}
                  height={320}
                  xLabel={tr("Nombre de tickets multi-produits", "Number of multi-product transactions")}
                  yLabel={tr("Contribution médiane à la valeur du ticket (%)", "Median contribution to basket value (%)")}
                  legendWidth={180}
                />
              </div>
            </div>
          </div>

          {/* Sections « Stratégie & Synthèse » (donut des rôles, tuiles) et « Matrice de décision » (nuage illisible, doublon du précédent) retirées. */}

        </>
      )}

      {/* ══════════════════════════════════════════════
          TAB 4: FRÉQUENCE D'ACHAT
          ══════════════════════════════════════════════ */}
      {tab === "freq" && !loading && (
        <div className="sw">
          <div className="cc" style={{ padding: "20px 24px" }}>
            <div className="ct">{tr("Fréquence d'achat : onglet temporairement masqué", "Purchase frequency: tab temporarily hidden")}</div>
            <div className="cs" style={{ marginTop: 6, lineHeight: 1.5 }}>
              {tr("Le calcul du backend compte aussi les semaines futures (146 au lieu de 105), ce qui fausse tous les chiffres de cet onglet. Il sera réaffiché une fois le calcul corrigé.", "The backend calculation also counts future weeks (146 instead of 105), which skews every figure in this tab. It will be shown again once the calculation is fixed.")}
            </div>
          </div>
        </div>
      )}
      {SHOW_FREQ_TAB && tab === "freq" && freqData && !loading && (
        <>
          <div className="sw">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 14 }}>
              <div className="cc">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: `color-mix(in srgb, ${ORANGE} 8%, transparent)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <IconCalendarDays size={15} color={ORANGE} />
                  </div>
                  <div style={{ fontSize: ".78rem", fontWeight: 700, color: INK }}>{tr("Semaines d'activité", "Active weeks")}</div>
                </div>
                <div style={{ fontSize: "1.9rem", fontWeight: 800, color: INK, lineHeight: 1, marginTop: 10 }}>{fmt(freqData.total_semaines)}</div>
                <div className="cs" style={{ marginTop: 4 }}>{tr("Période d'analyse disponible", "Available analysis period")}</div>
              </div>
              <div className="cc">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: `color-mix(in srgb, ${PEACH} 13%, transparent)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <IconBox size={15} color={ORANGE} />
                  </div>
                  <div style={{ fontSize: ".78rem", fontWeight: 700, color: INK }}>{tr("Total Références", "Total Products")}</div>
                </div>
                <div style={{ fontSize: "1.9rem", fontWeight: 800, color: ORANGE, lineHeight: 1, marginTop: 10 }}>{fmt(freqData.nb_produits)}</div>
                <div className="cs" style={{ marginTop: 4 }}>{tr("Produits avec historique", "Products with history")}</div>
              </div>
              <div className="cc">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: `color-mix(in srgb, ${OK} 8%, transparent)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <IconStar size={15} color={OK} />
                  </div>
                  <div style={{ fontSize: ".78rem", fontWeight: 700, color: INK }}>{tr("Produits Quotidiens", "Daily Products")}</div>
                </div>
                <div style={{ fontSize: "1.9rem", fontWeight: 800, color: OK, lineHeight: 1, marginTop: 10 }}>
                  {fmt((freqData.status_distribution || {})["Quotidien"] || 0)}
                </div>
                <div className="cs" style={{ marginTop: 4 }}>{tr("Présents toutes les semaines", "Present every week")}</div>
              </div>
            </div>
          </div>

          <div className="sec-title">
            <IconRepeat size={14} color={ORANGE} /> {tr("Fréquence & Statuts", "Frequency & Statuses")}
          </div>
          <div className="sw">
            <div className="g2">
              <div className="cc">
                <CardHeader
                  title={tr("Produits les plus fréquemment réachetés", "Most frequently repurchased products")}
                  sub={tr("Top 20 par taux de présence hebdo", "Top 20 by weekly presence rate")}
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
                  title={tr("Répartition des produits selon leur fréquence d'achat", "Products by purchase frequency")}
                  sub={tr("Classes de régularité", "Regularity classes")}
                  icon={<IconDonutPie size={16} color={ORANGE} />}
                />
                <Donut data={freqData.status_distribution || {}} height={250} />
              </div>
            </div>
          </div>

          <div className="sec-title">
            <IconGrid size={14} color={ORANGE} /> {tr("Catégories & Distribution", "Categories & Distribution")}
          </div>
          <div className="sw">
            <div className="g2">
              <div className="cc">
                <CardHeader
                  title={tr("Fréquence d'achat moyenne par catégorie", "Average purchase frequency by category")}
                  sub={tr("Comparatif des familles", "Family comparison")}
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
                  title={tr("Distribution de la fréquence de réachat", "Repurchase frequency distribution")}
                  sub={tr("Histogramme des taux sur toutes les références", "Histogram of rates across all products")}
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
                      <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: "var(--dk-soft, #fdf7f2)", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                        <div>
                          <div className="cs">{tr("Fréquence max", "Max frequency")}</div>
                          <div style={{ fontWeight: 800, color: OK }}>{(sortedVals[sortedVals.length - 1] || 0).toFixed(0)}%</div>
                        </div>
                        <div>
                          <div className="cs">{tr("Fréquence médiane", "Median frequency")}</div>
                          <div style={{ fontWeight: 800, color: ORANGE }}>
                            {med.toFixed(0)}%
                          </div>
                        </div>
                        <div>
                          <div className="cs">{tr("Quotidiens (100%)", "Daily (100%)")}</div>
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

          {/* Graphique « Top 8 produits quotidiens » retiré : ses courbes étaient dessinées
              avec une formule (sinus), pas calculées à partir des ventes. */}
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
                <span style={{ fontSize: ".78rem", fontWeight: 800, color: INK }}>{tr("Paramètres des associations", "Association settings")}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <label style={{ fontSize: ".68rem", fontWeight: 700, color: MUTED }}>{tr("Tri :", "Sort:")}</label>
                <select
                  value={assocSort}
                  onChange={(e) => setAssocSort(e.target.value)}
                  style={{ fontSize: ".72rem", fontWeight: 700, padding: "6px 12px", borderRadius: 10, border: "1px solid var(--dk-line, #e2d5c8)", background: "var(--dk-surface, #fcfaf8)", outline: "none", color: INK }}
                >
                  <option value="Lift ↓">{tr("Force du lien ↓", "Link strength ↓")}</option>
                  <option value="Confiance ↓">{tr("Probabilité d'achat ↓", "Purchase probability ↓")}</option>
                  <option value="Support ↓">{tr("Fréquence de la paire ↓", "Pair frequency ↓")}</option>
                </select>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <label style={{ fontSize: ".68rem", fontWeight: 700, color: MUTED }}>{tr("Nb règles :", "No. of rules:")}</label>
                <select
                  value={String(assocTopN)}
                  onChange={(e) => setAssocTopN(Number(e.target.value))}
                  style={{ fontSize: ".72rem", fontWeight: 700, padding: "6px 12px", borderRadius: 10, border: "1px solid var(--dk-line, #e2d5c8)", background: "var(--dk-surface, #fcfaf8)", outline: "none", color: INK }}
                >
                  <option value="15">Top 15</option>
                  <option value="25">Top 25</option>
                  <option value="50">Top 50</option>
                  <option value="100">Top 100</option>
                </select>
              </div>
              <div style={{ marginLeft: "auto", display: "flex", gap: 14 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: ".60rem", color: MUTED, textTransform: "uppercase", letterSpacing: ".08em" }}>{tr("Fréquence min", "Min frequency")}</div>
                  <div style={{ fontSize: ".82rem", fontWeight: 800, color: INK }}>1%</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: ".60rem", color: MUTED, textTransform: "uppercase", letterSpacing: ".08em" }}>{tr("Probabilité min", "Min probability")}</div>
                  <div style={{ fontSize: ".82rem", fontWeight: 800, color: INK }}>30%</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: ".60rem", color: MUTED, textTransform: "uppercase", letterSpacing: ".08em" }}>{tr("Force min", "Min strength")}</div>
                  <div style={{ fontSize: ".82rem", fontWeight: 800, color: ORANGE }}>1.2×</div>
                </div>
              </div>
            </div>
          </div>

          {/* KPIs */}
          <div className="sw">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 14 }}>
              {[
                { lbl: tr("Associations trouvées", "Associations found"), val: fmt(assocData.nb_total_regles), sub: tr("Après filtres", "After filters"), icon: IconLink2, color: ORANGE },
                { lbl: tr("Lien le plus fort", "Strongest link"), val: `${Math.max(...(assocData.rules || []).map((r: any) => Number(r.lift) || 0), 1).toFixed(2)}×`, sub: tr("Fois plus souvent que le hasard", "Times more often than chance"), icon: IconBolt, color: "var(--dk-accent-deep, #c45030)" },
                { lbl: tr("Probabilité max", "Max probability"), val: `${Math.max(...(assocData.rules || []).map((r: any) => Number(r.confidence) || 0), 0).toFixed(1)}%`, sub: tr("Clients du 1er produit qui prennent le 2e", "Customers of the 1st product who also take the 2nd"), icon: IconTrendUp, color: OK },
                { lbl: tr("Paire la plus fréquente", "Most frequent pair"), val: `${Math.max(...(assocData.rules || []).map((r: any) => Number(r.support) || 0), 0).toFixed(1)}%`, sub: tr("Part des tickets qui la contiennent", "Share of transactions containing it"), icon: IconDonutPie, color: WARN },
              ].map((k, i) => {
                const Ic = k.icon;
                return (
                  <div key={i} className="cc">
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 8, background: `color-mix(in srgb, ${k.color} 8%, transparent)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
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
            <IconScatter size={14} color={ORANGE} /> {tr("Quelles paires mettre en avant ?", "Which pairs to promote?")}
          </div>
          <div className="sw">
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 0.7fr)", gap: 12, marginBottom: 12 }}>
              <div className="cc" style={{ minHeight: 440 }}>
                <CardHeader
                  title={tr("Paires à promouvoir en priorité", "Pairs to promote first")}
                  sub={tr("En haut à droite : paires fréquentes et probables, à proposer en offre groupée. Taille = force du lien.", "Top right: frequent and likely pairs, to offer as a bundle. Size = link strength.")}
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
                      { side: "tr", label: tr("Offre groupée", "Bundle offer"), sub: tr("Créer un lot à prix spécial", "Create a bundle at a special price"), color: Q1 },
                      { side: "tl", label: tr("Suggestion en caisse", "Checkout suggestion"), sub: tr("Proposer au moment de payer", "Suggest it at payment"), color: Q2 },
                      { side: "br", label: tr("Placement en rayon", "Shelf placement"), sub: tr("Rapprocher les deux produits", "Place the two products closer"), color: Q3 },
                      { side: "bl", label: tr("À ignorer", "To ignore"), sub: tr("Impact trop faible", "Impact too low"), color: Q4 },
                    ],
                  }}
                  topLabels={6}
                  xNiceUnit="%"
                  yNiceUnit="%"
                  xCapPercentile={0.95}
                  yCapPercentile={0.95}
                  height={400}
                  xLabel={tr("Fréquence : % des tickets qui contiennent la paire", "Frequency: % of transactions containing the pair")}
                  yLabel={tr("Probabilité : % des clients du 1er produit qui prennent le 2e", "Probability: % of customers of the 1st product who also take the 2nd")}
                  legendWidth={200}
                />
              </div>
              <div className="cc" style={{ minHeight: 440 }}>
                <CardHeader
                  title={tr("Les 12 liens les plus forts", "The 12 strongest links")}
                  sub={tr(`${(assocData.rules || []).length} règles totales après filtres`, `${(assocData.rules || []).length} rules in total after filters`)}
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

          {/* Histogramme et matrice du Lift retirés : difficiles à lire, ils répétaient la liste ci-dessus. */}

          <div className="sec-title">
            <IconGrid size={14} color={ORANGE} /> {tr("Toutes les associations", "All associations")}
          </div>
          <div className="sw">
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 12, marginBottom: 12 }}>
              <div className="cc" style={{ minHeight: 420 }}>
                <CardHeader
                  title={tr("Tableau des associations", "Associations table")}
                  sub={tr("Fréquence · probabilité · force du lien", "Frequency · probability · link strength")}
                  icon={<IconGrid size={16} color={ORANGE} />}
                />
                <div style={{ maxHeight: 260, overflow: "auto", marginTop: 4 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".70rem" }}>
                    <thead style={{ position: "sticky", top: 0, background: "var(--dk-surface, white)" }}>
                      <tr style={{ borderBottom: "1px solid var(--dk-line, #f2e9e1)", color: MUTED, textTransform: "uppercase", textAlign: "right" }}>
                        <th style={{ textAlign: "left", padding: "8px 6px", fontSize: ".62rem", letterSpacing: ".06em" }}>{tr("Si le client prend… → il prend aussi", "If the customer takes… → they also take")}</th>
                        <th style={{ padding: "8px 6px", fontSize: ".62rem", letterSpacing: ".06em" }}>{tr("Fréquence", "Frequency")}</th>
                        <th style={{ padding: "8px 6px", fontSize: ".62rem", letterSpacing: ".06em" }}>{tr("Probabilité", "Probability")}</th>
                        <th style={{ padding: "8px 6px", fontSize: ".62rem", letterSpacing: ".06em" }}>{tr("Force", "Strength")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(assocData.rules || []).slice(0, 50).map((r: any, i: number) => {
                        const lvl = Number(r.lift) >= 3 ? ORANGE : Number(r.lift) >= 2 ? PEACH : Number(r.confidence) >= 50 ? LIGHT : MUTED;
                        return (
                          <tr key={i} style={{ borderBottom: "1px solid var(--dk-surface, #fdfcfb)" }}>
                            <td style={{ padding: "7px 6px", minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ background: "var(--dk-page, #f2ede6)", padding: "2px 7px", borderRadius: 6, fontSize: ".68rem", fontWeight: 700, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 110 }}>
                                  {r.antecedent.slice(0, 20)}
                                </span>
                                <span style={{ color: MUTED, fontSize: ".65rem" }}>→</span>
                                <span style={{ background: `color-mix(in srgb, ${ORANGE} 7%, transparent)`, color: "var(--dk-accent-deep, #b84028)", padding: "2px 7px", borderRadius: 6, fontSize: ".68rem", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 110 }}>
                                  {r.consequent.slice(0, 20)}
                                </span>
                              </div>
                            </td>
                            <td style={{ padding: "7px 6px", textAlign: "right", fontWeight: 600, color: INK }}>{Number(r.support).toFixed(1)}%</td>
                            <td style={{ padding: "7px 6px", textAlign: "right", fontWeight: 700, color: INK }}>{Number(r.confidence).toFixed(1)}%</td>
                            <td style={{ padding: "7px 6px", textAlign: "right" }}>
                              <span style={{ fontWeight: 800, fontSize: ".72rem", color: lvl, background: `color-mix(in srgb, ${lvl} 8%, transparent)`, padding: "2px 6px", borderRadius: 6 }}>
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
            <IconSparkles size={14} color={ORANGE} /> {tr("Synthèse & Plan d'action", "Summary & Action plan")}
          </div>
          <div className="sw">
            <div>
              <div className="cc">
                <CardHeader
                  title={tr("Que faire de ces associations ?", "What to do with these associations?")}
                  sub={tr("Suggestions basées sur les associations détectées", "Suggestions based on the detected associations")}
                  icon={<IconSparkles size={16} color={ORANGE} />}
                />
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
                  {[
                    { title: tr("Offre groupée : les liens les plus forts", "Bundle offer: the strongest links"), desc: tr(`${(assocData.rules || []).filter((r: any) => r.lift >= 3).length} paires achetées au moins 3 fois plus souvent que par hasard — proposer un prix pour le lot`, `${(assocData.rules || []).filter((r: any) => r.lift >= 3).length} pairs bought at least 3 times more often than by chance — offer a bundle price`), color: ORANGE, Icon: IconTarget },
                    { title: tr("Placement côte à côte", "Side-by-side placement"), desc: tr(`${(assocData.rules || []).filter((r: any) => r.confidence >= 60).length} paires où plus de 60 % des clients du premier produit prennent le second — les rapprocher en boutique`, `${(assocData.rules || []).filter((r: any) => r.confidence >= 60).length} pairs where over 60% of customers of the first product also take the second — place them closer in the shop`), color: PEACH, Icon: IconMapPin },
                    { title: tr("Suggestion en caisse", "Checkout suggestion"), desc: `${(assocData.rules || []).slice(0, 5).map((r: any) => r.consequent).filter((x: string, i: number, arr: string[]) => arr.indexOf(x) === i).slice(0, 3).join(" · ")}${tr(" : à proposer au moment de payer", ": suggest at payment")}`, color: WARN, Icon: IconCart },
                    { title: tr("Signalétique", "Signage"), desc: tr("Pour les paires les plus fréquentes : une étiquette « souvent acheté avec… » près du produit", "For the most frequent pairs: a “often bought with…” label next to the product"), color: OK, Icon: IconLink2 },
                  ].map((r, i) => {
                    const RIcon = r.Icon;
                    return (
                      <div key={i} style={{ display: "flex", gap: 10, padding: 10, borderRadius: 10, background: `color-mix(in srgb, ${r.color} 8%, transparent)`, borderLeft: `3px solid ${r.color}` }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, flexShrink: 0, marginTop: 1 }}>
                          <RIcon size={16} color={r.color} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: ".78rem", fontWeight: 800, color: INK, marginBottom: 2 }}>{r.title}</div>
                          <div style={{ fontSize: ".68rem", color: "var(--dk-ink2, #5a4a3a)", lineHeight: 1.4 }}>{r.desc}</div>
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
