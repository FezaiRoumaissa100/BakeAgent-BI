"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { colors, categoryPalette } from "@/lib/theme";
import { ExpertNote } from "@/components/Expert";
import { RetainProvider, RetainCard, Takeaway, Details } from "@/components/Ui";
import {
  fetchPenetration,
  fetchVelocity,
  fetchTicketContribution,
  fetchFrequency,
  fetchAssociations,
  fetchMatrix,
  fetchDataPeriod,
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
import { ChartAssistantButton } from "@/components/ChartAssistantButton";
import { useChat } from "@/contexts/ChatContext";
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
const SHOW_FREQ_TAB = true; // calcul corrigé : seules les semaines de la période des ventes sont comptées

const Q1 = colors.zoneTop; // ROUGE FONCÉ (top-right : STARS / BUNDLE / RÈGLES D'OR)
const Q2 = colors.zoneLeft; // ORANGE BRUN (top-left : HAUT POTENTIEL / CAISSE / PREMIUM / PRÉDICTIBLES)
const Q3 = colors.zoneRight; // VERT FORÊT (bottom-right : MOTEURS / PLACEMENT / COMPLÉMENTS / SURPRENANTES)
const Q4 = colors.zoneLow; // GRIS FONCÉ (bottom-left : FAIBLE IMPACT / À IGNORER / ACCESSOIRES / FAIBLES)
/* Palette MULTILIGNE / DONUT : très distinctes (rouge, vert, bleu, violet, orange, teal, rose) */
const PALETTE_DISTINCTE = categoryPalette;
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
  if (v >= 70) return "var(--dk-accent-deep, #256B42)";
  if (v >= 40) return "#3E8E5E";
  if (v >= 20) return "#D4A52A";
  return "var(--dk-warn, #B7791F)";
}
function statutColor(s: string) {
  const x = String(s).toLowerCase();
  if (x.includes("leader") || x.includes("cœur") || x.includes("coeur") || x.includes("pha") || x.includes("dominant") || x.includes("quotidien")) return "var(--dk-accent-deep, #256B42)";
  if (x.includes("régulier") || x.includes("regulier") || x.includes("croissance")) return "#3E8E5E";
  if (x.includes("cyclique") || x.includes("niche")) return "var(--dk-warn, #B7791F)";
  if (x.includes("sporadique") || x.includes("éliminer") || x.includes("mort")) return "#44403C";
  return "#1F5E3A";
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
              {labelKey === "article" ? <ProdName name={String(r[labelKey])} /> : <span>{String(r[labelKey])}</span>}
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
        <circle cx="100" cy="100" r={R} fill="none" stroke="var(--dk-line, #ECEDE7)" strokeWidth="26" />
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

  // Sans zoom, tous les points restent visibles : ceux qui dépassent l'échelle sont placés
  // au bord (contour pointillé + nom), au lieu de disparaître du graphique.
  const isZoomedView = !!(zoomX || zoomY);
  const visibleData = isZoomedView
    ? data.filter((_, i) => {
        const x = rawXs[i], y = rawYs[i];
        return x >= effXMin && x <= effXMax && y >= effYMin && y <= effYMax;
      })
    : data;
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
                stroke="var(--dk-line, #E2E5DD)"
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
            const horsEchelle = Number(d[xKey]) > xMax || Number(d[yKey]) > yMax;
            return (
              <g key={i} className="group" style={{ cursor: "pointer" }}>
                {horsEchelle && (
                  <>
                    <circle cx={toX(d[xKey])} cy={toY(d[yKey])} r={r + 5} fill="none" stroke={c} strokeWidth={1.4} strokeDasharray="3 2" />
                    <text
                      x={toX(d[xKey]) - r - 7}
                      y={toY(d[yKey]) + 4}
                      textAnchor="end"
                      style={{ fontSize: 10, fontWeight: 800, fill: "var(--dk-ink, #1E2420)" }}
                    >
                      {String(d[labelKey] || "").slice(0, 18)} ↗
                    </text>
                  </>
                )}
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
                  stroke="var(--dk-ink, #1E2420)"
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
            background: "var(--dk-soft, #F7F8F4)",
            borderRadius: 12,
            border: "1px solid var(--dk-line, #E6E8E1)",
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
              borderTop: "1px dashed var(--dk-line, #E2E5DD)",
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
              stroke="var(--dk-line, #E2E5DD)"
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
                  <title>{tr(`${s.article}\nSemaine : ${p.week}\nPrésent dans ${Number(p.rate).toFixed(1)} % des tickets`, `${s.article}\nWeek: ${p.week}\nIn ${Number(p.rate).toFixed(1)}% of transactions`)}</title>
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
            <div style={{ flex: 1, height: 10, background: "var(--dk-line, #ECEDE7)", borderRadius: 99 }}>
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
          <div className="w-full border-b border-[#E3E4DD] border-dashed" />
          <div className="w-full border-b border-[#E3E4DD] border-dashed" />
          <div className="w-full border-b border-[#E3E4DD]" />
        </div>
        {rows.map((r, i) => {
          const v = vals[i];
          const pct = Math.max(3, (v / max) * 100);
          const isMax = v === max;
          return (
            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative z-10">
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-[#1E2420] text-white text-[9px] font-bold py-0.5 px-1.5 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-30 shadow">
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
      <div className="flex justify-between mt-1.5 pt-1 border-t border-[#ECEDE7] text-[8px] font-semibold" style={{ color: MUTED }}>
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
    { key: "event", label: tr("Événement", "Event"), color: "var(--dk-accent-deep, #2A7148)" },
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
            <div key={i} className="w-full border-b border-[#E3E4DD] border-dashed" />
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
      <div className="flex justify-between mt-1.5 pt-1 border-t border-[#ECEDE7] text-[9px] font-semibold text-center" style={{ color: MUTED }}>
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
        <rect x={W / 2} y={H / 2} width={W / 2 - pad} height={H / 2 - pad} fill="rgba(110,117,111,0.07)" rx={4} />
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
            const fill = v === 0 ? "var(--dk-soft, #F1F2EC)" : isDiag ? "var(--dk-soft, #E4F0E6)" : ORANGE;
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
              <rect x={lx} y={ly} width={lw} height={lh} fill="url(#lift-grad)" rx={3} stroke="var(--dk-line, #E6E8E1)" />
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
        background: active ? ORANGE : "var(--dk-line, #F1F1EC)",
        color: active ? "white" : "var(--dk-ink2, #4A524C)",
        boxShadow: active ? `0 2px 10px rgba(46,125,79,0.28)` : "none",
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

/* Matrice de décision en 2 × 2 (cahier des charges).
   Chaque case : icône, nombre de produits, part du CA (barre), action, et un nuage de bulles
   (une bulle par produit, taille = chiffre d'affaires). La case « forte » de chaque axe est la plus colorée. */
function MatrixGrid({ items, quadrants, seuils, active, onSelect, colors: col, labelsEn }: any) {
  const openP = useOpenProduct();
  const MAXB = 16;
  const layout = [
    { key: "Niche", row: 1, c: 1, Icon: IconGem, glow: "100% 0%" },
    { key: "Star", row: 1, c: 2, Icon: IconStar, glow: "100% 0%" },
    { key: "Dormant", row: 2, c: 1, Icon: IconBox, glow: "0% 100%" },
    { key: "Trafic", row: 2, c: 2, Icon: IconBasket, glow: "100% 100%" },
  ];
  const maxCa = Math.max(1, ...items.map((i: any) => i.ca_total || 0));
  const byQuad = (k: string) => items.filter((i: any) => i.quadrant === k).sort((a: any, b: any) => b.ca_total - a.ca_total);
  const short = (n: string) => n.replace("TRADITIONAL ", "TRAD. ").replace("PAIN AU CHOCOLAT", "PAIN CHOC.").replace("FORMULE ", "F. ");

  return (
    <div style={{ display: "grid", gridTemplateColumns: "42px 1fr", gridTemplateRows: "auto 34px", gap: 0, marginTop: 14 }}>
      {/* Axe vertical : flèche dégradée */}
      <div style={{ gridColumn: 1, gridRow: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "6px 0" }}>
        <span style={{ fontSize: ".62rem", fontWeight: 800, color: INK }}>{tr("forte", "high")}</span>
        <div style={{ flex: 1, width: 4, borderRadius: 4, margin: "6px 0", background: `linear-gradient(to top, var(--dk-line, #E2E5DD), ${ORANGE})`, position: "relative" }}>
          <span style={{ position: "absolute", top: -6, left: -4, width: 0, height: 0, borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderBottom: `8px solid ${ORANGE}` }} />
        </div>
        <span style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", fontSize: ".66rem", fontWeight: 800, color: MUTED, letterSpacing: ".08em", textTransform: "uppercase", margin: "4px 0" }}>
          {tr("Vitesse de vente", "Sales velocity")}
        </span>
        <span style={{ fontSize: ".62rem", fontWeight: 800, color: MUTED, marginTop: 6 }}>{tr("faible", "low")}</span>
      </div>

      {/* La matrice */}
      <div style={{ gridColumn: 2, gridRow: 1, position: "relative", display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", borderRadius: 20, overflow: "hidden", border: "1px solid var(--dk-line, #E3E4DD)", boxShadow: "0 10px 30px rgba(30,40,32,0.08)" }}>
        {layout.map(({ key, row, c, Icon, glow }) => {
          const list = byQuad(key);
          const d = quadrants[key] || {};
          const color = col[key];
          const isActive = active === key;
          const dim = active !== "Tous" && !isActive;
          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              style={{
                gridColumn: c, gridRow: row, textAlign: "left", cursor: "pointer", border: "none",
                borderRight: c === 1 ? "1px solid var(--dk-line, #E3E4DD)" : "none",
                borderBottom: row === 1 ? "1px solid var(--dk-line, #E3E4DD)" : "none",
                padding: "18px 20px 16px", minHeight: 260, position: "relative",
                background: `radial-gradient(120% 120% at ${glow}, color-mix(in srgb, ${color} ${key === "Star" ? 22 : 13}%, var(--dk-surface, #fff)) 0%, var(--dk-surface, #fff) 70%)`,
                opacity: dim ? 0.45 : 1, transition: "opacity .2s, box-shadow .2s",
                boxShadow: isActive ? `inset 0 0 0 3px ${color}` : "none",
                display: "flex", flexDirection: "column", gap: 10,
              }}
            >
              {/* En-tête */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 11, background: color, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 12px color-mix(in srgb, ${color} 35%, transparent)` }}>
                  <Icon size={18} color="#fff" />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "1rem", fontWeight: 800, color: INK, lineHeight: 1.1 }}>{tr(d.label || key, labelsEn[key]?.label || key)}</div>
                  <div style={{ fontSize: ".72rem", color: MUTED, fontWeight: 600, marginTop: 2 }}>{tr(d.action || "", labelsEn[key]?.action || "")}</div>
                </div>
                <div style={{ marginLeft: "auto", textAlign: "right" }}>
                  <div style={{ fontSize: "2rem", fontWeight: 800, color, lineHeight: 1 }}>{fmt(d.nb || 0)}</div>
                  <div style={{ fontSize: ".62rem", color: MUTED, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em" }}>{tr("produits", "products")}</div>
                </div>
              </div>

              {/* Part du chiffre d'affaires */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".7rem", fontWeight: 700, color: INK, marginBottom: 4 }}>
                  <span>{tr("Part du chiffre d'affaires", "Share of revenue")}</span>
                  <span style={{ color }}>{fmt(d.part_ca || 0, 0)} %</span>
                </div>
                <div style={{ height: 8, borderRadius: 99, background: "color-mix(in srgb, var(--dk-ink, #1E2420) 7%, transparent)", overflow: "hidden" }}>
                  <div style={{ width: `${Math.min(100, d.part_ca || 0)}%`, height: "100%", borderRadius: 99, background: `linear-gradient(90deg, color-mix(in srgb, ${color} 55%, transparent), ${color})` }} />
                </div>
              </div>

              {/* Nuage de bulles : une bulle par produit, taille = chiffre d'affaires */}
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 4 }}>
                {list.slice(0, MAXB).map((p: any, i: number) => {
                  const size = Math.round(26 + 70 * Math.sqrt((p.ca_total || 0) / maxCa));
                  const showName = size >= 44;
                  return (
                    <div
                      key={i}
                      title={tr(
                        `${p.article}\n${fmt(p.penetration_rate, 1)} % des tickets · ${fmt(p.daily_velocity, 0)} articles / jour de vente\n${fmt(p.ca_total)} € de CA${p.alerte_horaire ? `\n${p.alerte_horaire}` : ""}`,
                        `${p.article}\n${fmt(p.penetration_rate, 1)}% of transactions · ${fmt(p.daily_velocity, 0)} items / selling day\n${fmt(p.ca_total)} € revenue${p.alerte_horaire ? `\n${p.alerte_horaire.replace("Remplir avant", "Restock before")}` : ""}`
                      )}
                      onClick={(e) => { e.stopPropagation(); openP(p.article); }}
                      style={{
                        cursor: "pointer",
                        width: size, height: size, borderRadius: "50%", flexShrink: 0, position: "relative",
                        background: `radial-gradient(circle at 30% 30%, color-mix(in srgb, ${color} 55%, #fff), ${color})`,
                        opacity: 0.55 + 0.45 * Math.sqrt((p.ca_total || 0) / maxCa),
                        display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center",
                        color: "#fff", fontSize: Math.max(8, Math.min(11, size / 7.5)), fontWeight: 800, lineHeight: 1.05, padding: 4,
                        boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
                      }}
                    >
                      {showName ? short(p.article) : ""}
                      {p.alerte_horaire && (
                        <span style={{ position: "absolute", top: -3, right: -3, width: 16, height: 16, borderRadius: "50%", background: "#fff", color: ALERT, fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }}>⏰</span>
                      )}
                    </div>
                  );
                })}
                {list.length > MAXB && (
                  <div style={{ fontSize: ".72rem", fontWeight: 800, color, padding: "4px 10px", borderRadius: 99, border: `1px dashed ${color}` }}>
                    +{list.length - MAXB}
                  </div>
                )}
              </div>
            </button>
          );
        })}

        {/* Croisement des moyennes */}
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", background: "var(--dk-surface, #fff)", border: "1px solid var(--dk-line, #E3E4DD)", borderRadius: 99, padding: "4px 10px", fontSize: ".62rem", fontWeight: 800, color: MUTED, whiteSpace: "nowrap", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", pointerEvents: "none" }}>
          {tr(`moyennes : ${fmt(seuils.penetration_moyenne || 0, 1)} % · ${fmt(seuils.vitesse_moyenne || 0, 1)} art./j`, `averages: ${fmt(seuils.penetration_moyenne || 0, 1)}% · ${fmt(seuils.vitesse_moyenne || 0, 1)} items/d`)}
        </div>
      </div>

      {/* Axe horizontal */}
      <div style={{ gridColumn: 2, gridRow: 2, display: "flex", alignItems: "center", gap: 10, padding: "0 4px" }}>
        <span style={{ fontSize: ".62rem", fontWeight: 800, color: MUTED }}>{tr("faible", "low")}</span>
        <div style={{ flex: 1, height: 4, borderRadius: 4, background: `linear-gradient(to right, var(--dk-line, #E2E5DD), ${ORANGE})`, position: "relative" }}>
          <span style={{ position: "absolute", right: -6, top: -4, width: 0, height: 0, borderTop: "6px solid transparent", borderBottom: "6px solid transparent", borderLeft: `8px solid ${ORANGE}` }} />
          <span style={{ position: "absolute", left: "50%", top: 8, transform: "translateX(-50%)", fontSize: ".66rem", fontWeight: 800, color: MUTED, letterSpacing: ".08em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
            {tr("Présence dans les tickets", "Presence in transactions")}
          </span>
        </div>
        <span style={{ fontSize: ".62rem", fontWeight: 800, color: INK }}>{tr("forte", "high")}</span>
      </div>
      <div style={{ gridColumn: 2, fontSize: ".7rem", color: MUTED, marginTop: 14 }}>
        {tr("Une bulle = un produit ; plus elle est grande, plus il rapporte. Survolez une bulle pour ses chiffres. ⏰ = ventes concentrées sur une heure : remplir le rayon avant. Cliquez sur une case pour filtrer la fiche ci-dessous.", "One bubble = one product; the bigger, the more revenue. Hover a bubble for its figures. ⏰ = sales concentrated in one hour: restock beforehand. Click a box to filter the sheet below.")}
      </div>
    </div>
  );
}

// Phrase qui dit ce qu'il faut retenir du graphique (calculée à partir des données)
/* Présence × Chiffre d'affaires : axes à graduations ×10 (les produits vont de quelques euros à 150 000 €),
   bandes de fond = statuts du cahier des charges (Niche < 10 %, Régulier, Cœur ≥ 30 %, Leader ≥ 50 %). */
const STATUT_PEN = [
  { key: "Niche / À surveiller", short: "Niche", en: "Niche", from: 0, to: 10, color: "#8A7B6E" },
  { key: "Produit Régulier", short: "Régulier", en: "Regular", from: 10, to: 30, color: "#D4A52A" },
  { key: "Produit Cœur (Core)", short: "Cœur", en: "Core", from: 30, to: 50, color: "#3E8E5E" },
  { key: "Leader (Indispensable)", short: "Leader", en: "Leader", from: 50, to: 100, color: "#9F1239" },
];
const penStatutColor = (s: string) => (STATUT_PEN.find((x) => x.key === s) || STATUT_PEN[0]).color;

function PresenceCaChart({ items, height = 400 }: { items: any[]; height?: number }) {
  const [hover, setHover] = useState<any>(null);
  const openP = useOpenProduct();
  const pts = (items || []).filter((d) => d.penetration_rate > 0 && d.ca_total > 0);
  if (!pts.length) {
    return <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: MUTED, fontSize: ".85rem" }}>
      {tr("Aucun produit ne correspond à ces filtres.", "No product matches these filters.")}
    </div>;
  }
  const W = 820, H = height, L = 64, R = 24, T = 34, B = 46;
  const pw = W - L - R, ph = H - T - B;
  const lg = Math.log10;
  const xMinP = Math.min(...pts.map((d) => d.penetration_rate));
  const xMin = Math.pow(10, Math.floor(lg(xMinP)));
  const xMax = 100;
  const yMinV = Math.min(...pts.map((d) => d.ca_total)), yMaxV = Math.max(...pts.map((d) => d.ca_total));
  const yMin = Math.pow(10, Math.floor(lg(yMinV)));
  const yMax = Math.pow(10, Math.ceil(lg(yMaxV)));
  const X = (v: number) => L + ((lg(Math.max(v, xMin)) - lg(xMin)) / (lg(xMax) - lg(xMin))) * pw;
  const Y = (v: number) => T + ph - ((lg(Math.max(v, yMin)) - lg(yMin)) / (lg(yMax) - lg(yMin))) * ph;
  const qMax = Math.max(...pts.map((d) => d.qty_total || 0), 1);
  const rad = (q: number) => 3.5 + Math.sqrt((q || 0) / qMax) * 13;
  const xTicks: number[] = [];
  for (let e = Math.round(lg(xMin)); e <= 2; e++) xTicks.push(Math.pow(10, e));
  const yTicks: number[] = [];
  for (let e = Math.round(lg(yMin)); e <= Math.round(lg(yMax)); e++) yTicks.push(Math.pow(10, e));
  const dec = (v: number) => Math.max(0, Math.ceil(-Math.log10(v)));
  const pctLbl = (v: number) => (v >= 1 ? `${fmt(v, 0)} %` : `${fmt(v, dec(v))} %`);
  const euroLbl = (v: number) => (v >= 1000 ? `${kFmt(v)} €` : v >= 1 ? `${fmt(v, 0)} €` : `${fmt(v, dec(v))} €`);

  // Étiquettes : les plus gros chiffres d'affaires et les plus présents, sans chevauchement
  const byCa = [...pts].sort((a, b) => b.ca_total - a.ca_total);
  const byPen = [...pts].sort((a, b) => b.penetration_rate - a.penetration_rate);
  const cand: any[] = [];
  [...byCa.slice(0, 8), ...byPen.slice(0, 4)].forEach((d) => { if (!cand.includes(d)) cand.push(d); });
  const boxes: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const labels: { d: any; x: number; y: number; anchor: "start" | "end" }[] = [];
  cand.forEach((d) => {
    const cx = X(d.penetration_rate), cy = Y(d.ca_total), r = rad(d.qty_total);
    const txt = String(d.article);
    const w = Math.min(txt.length, 22) * 6.1;
    const opts: { x: number; y: number; anchor: "start" | "end" }[] = [
      { x: cx + r + 4, y: cy + 4, anchor: "start" },
      { x: cx - r - 4, y: cy + 4, anchor: "end" },
      { x: cx + r + 2, y: cy - r - 2, anchor: "start" },
      { x: cx - r - 2, y: cy + r + 11, anchor: "end" },
    ];
    for (const o of opts) {
      const x1 = o.anchor === "start" ? o.x : o.x - w, x2 = x1 + w, y1 = o.y - 10, y2 = o.y + 3;
      if (x1 < L || x2 > W - R || y1 < T - 4 || y2 > T + ph) continue;
      if (boxes.some((b) => !(x2 < b.x1 || x1 > b.x2 || y2 < b.y1 || y1 > b.y2))) continue;
      boxes.push({ x1, y1, x2, y2 });
      labels.push({ d, ...o });
      break;
    }
  });
  const short = (t: string) => (t.length > 22 ? t.slice(0, 21) + "…" : t);

  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} onMouseLeave={() => setHover(null)}>
        {/* bandes de statut */}
        {STATUT_PEN.map((b) => {
          const x1 = X(Math.max(b.from, xMin)), x2 = X(b.to);
          if (x2 <= x1) return null;
          return (
            <g key={b.key}>
              <rect x={x1} y={T} width={x2 - x1} height={ph} fill={b.color} opacity={0.07} />
              <text x={(x1 + x2) / 2} y={T - 10} textAnchor="middle" fontSize={11} fontWeight={800} fill={b.color}>
                {locale() === "en" ? b.en : b.short}
              </text>
              {b.from > 0 && <line x1={x1} x2={x1} y1={T - 4} y2={T + ph} stroke={b.color} strokeDasharray="4 4" opacity={0.6} />}
            </g>
          );
        })}
        {/* grille */}
        {yTicks.map((v) => (
          <g key={`y${v}`}>
            <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="rgba(80,100,85,0.12)" />
            <text x={L - 8} y={Y(v) + 4} textAnchor="end" fontSize={11} fill={MUTED}>{euroLbl(v)}</text>
          </g>
        ))}
        {xTicks.map((v) => (
          <g key={`x${v}`}>
            <line x1={X(v)} x2={X(v)} y1={T + ph} y2={T + ph + 5} stroke={MUTED} />
            <text x={X(v)} y={T + ph + 18} textAnchor="middle" fontSize={11} fill={MUTED}>{pctLbl(v)}</text>
          </g>
        ))}
        <line x1={L} x2={W - R} y1={T + ph} y2={T + ph} stroke="rgba(80,100,85,0.35)" />
        <text x={L + pw / 2} y={H - 6} textAnchor="middle" fontSize={11.5} fontWeight={700} fill={INK}>
          {tr("Présence : part des tickets contenant le produit →", "Presence: share of transactions with the product →")}
        </text>
        <text x={14} y={T + ph / 2} textAnchor="middle" fontSize={11.5} fontWeight={700} fill={INK} transform={`rotate(-90 14 ${T + ph / 2})`}>
          {tr("Chiffre d'affaires →", "Revenue →")}
        </text>
        {/* points (les petits au-dessus des gros) */}
        {[...pts].sort((a, b) => (b.qty_total || 0) - (a.qty_total || 0)).map((d) => {
          const on = hover && hover.article === d.article;
          return (
            <circle key={d.article} cx={X(d.penetration_rate)} cy={Y(d.ca_total)} r={rad(d.qty_total) + (on ? 2 : 0)}
                    fill={penStatutColor(d.statut)} fillOpacity={on ? 0.95 : 0.7} stroke="#fff" strokeWidth={on ? 2 : 1}
                    style={{ cursor: "pointer" }} onMouseEnter={() => setHover(d)} onClick={() => openP(d.article)} />
          );
        })}
        {labels.map(({ d, x, y, anchor }) => (
          <text key={`l${d.article}`} x={x} y={y} textAnchor={anchor} fontSize={10.5} fontWeight={700} fill={INK}
                style={{ paintOrder: "stroke", stroke: "var(--dk-surface, #fff)", strokeWidth: 3, pointerEvents: "none" }}>
            {short(d.article)}
          </text>
        ))}
      </svg>
      {hover && (
        <div style={{ position: "absolute", left: `${(X(hover.penetration_rate) / W) * 100}%`, top: `${(Y(hover.ca_total) / H) * 100}%`,
                      transform: X(hover.penetration_rate) > W * 0.6 ? "translate(calc(-100% - 14px), -50%)" : "translate(14px, -50%)",
                      background: "var(--dk-surface, #fff)", border: "1px solid var(--dk-line, #E3E4DD)", borderRadius: 10, padding: "8px 12px",
                      boxShadow: "0 8px 24px rgba(30,40,32,0.18)", fontSize: ".74rem", color: INK, pointerEvents: "none", whiteSpace: "nowrap", zIndex: 5 }}>
          <div style={{ fontWeight: 800, marginBottom: 3 }}>{hover.article}</div>
          <div>{tr("Présence", "Presence")} : <b>{fmt(hover.penetration_rate, 1)} %</b> {tr("des tickets", "of transactions")}</div>
          <div>{tr("Chiffre d'affaires", "Revenue")} : <b>{fmt(hover.ca_total, 0)} €</b></div>
          <div>{tr("Quantité vendue", "Quantity sold")} : <b>{fmt(hover.qty_total, 0)}</b></div>
          <div style={{ color: penStatutColor(hover.statut), fontWeight: 700 }}>{tr(hover.statut, trData(hover.statut))}</div>
        </div>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", marginTop: 6, fontSize: ".7rem", color: MUTED }}>
        {STATUT_PEN.map((b) => (
          <span key={b.key} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 99, background: b.color, display: "inline-block" }} />
            {locale() === "en" ? b.en : b.short} {b.to < 100 ? `${b.from}–${b.to} %` : `≥ ${b.from} %`}
          </span>
        ))}
        <span>· {tr("taille du point = quantité vendue", "dot size = quantity sold")}</span>
        <span>· {tr("chaque graduation vaut 10 fois la précédente, pour voir petits et gros produits sur le même graphique", "each gridline is 10× the previous one, so small and large products fit on one chart")}</span>
      </div>
    </div>
  );
}

/* Rôle de chaque produit dans le panier (tickets à plusieurs produits).
   Une ligne par produit : part habituelle du ticket (avec le seuil de 50 % du cahier des charges),
   nombre de tickets à plusieurs produits où il apparaît, et son chiffre d'affaires dans ces tickets.
   Tri au choix ; les 12 premiers sont affichés, « Voir tout » montre la liste complète. */
function ContributionRows({ rows, seuil = 50 }: { rows: any[]; seuil?: number }) {
  const [sort, setSort] = useState<"part" | "freq" | "ca">("part");
  const [all, setAll] = useState(false);
  const key = sort === "part" ? "contribution_med" : sort === "freq" ? "nb_tickets_multi" : "ca_total_multi";
  const sorted = [...(rows || [])].sort((a, b) => (b[key] || 0) - (a[key] || 0));
  const shown = all ? sorted : sorted.slice(0, 12);
  const mxF = Math.max(1, ...sorted.map((r) => r.nb_tickets_multi || 0));
  const mxC = Math.max(1, ...sorted.map((r) => r.ca_total_multi || 0));
  const head = (k: typeof sort, l: string) => (
    <button onClick={() => setSort(k)} className="sort-pill" aria-pressed={sort === k}
            style={{ border: "none", cursor: "pointer", padding: "5px 12px", borderRadius: 999, fontSize: ".74rem", fontWeight: 700,
                     background: sort === k ? "var(--dk-pill, #1F2B23)" : "var(--dk-soft)", color: sort === k ? "#fff" : "var(--dk-ink2)" }}>
      {l}{sort === k ? " ↓" : ""}
    </button>
  );
  const grid = "minmax(140px, 1.3fr) minmax(150px, 1.6fr) minmax(110px, 1fr) minmax(90px, 0.8fr)";
  return (
    <div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", margin: "4px 0 12px" }}>
        <span style={{ fontSize: ".74rem", color: MUTED, marginRight: 4 }}>{tr("Trier par :", "Sort by:")}</span>
        {head("part", tr("Part du ticket", "Share of basket"))}
        {head("freq", tr("Fréquence", "Frequency"))}
        {head("ca", tr("Chiffre d'affaires", "Revenue"))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: grid, gap: 14, fontSize: ".7rem", color: MUTED, fontWeight: 600, padding: "0 0 6px", borderBottom: "1px solid var(--dk-line)" }}>
        <span>{tr("Produit", "Product")}</span>
        <span>{tr(`Part habituelle du ticket (trait = ${seuil} %)`, `Typical share of basket (line = ${seuil}%)`)}</span>
        <span>{tr("Tickets à plusieurs produits", "Multi-product transactions")}</span>
        <span style={{ textAlign: "right" }}>{tr("CA dans ces tickets", "Revenue in them")}</span>
      </div>
      {shown.map((r, i) => {
        const gen = r.contribution_med >= seuil;
        return (
          <div key={r.article} style={{ display: "grid", gridTemplateColumns: grid, gap: 14, alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--dk-line)" }}>
            <span style={{ fontSize: ".8rem", fontWeight: 600, color: INK, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              <ProdName name={r.article} />
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }} title={tr(`${fmt(r.contribution_med, 1)} % du ticket (moyenne ${fmt(r.contribution_moy, 1)} %)`, `${fmt(r.contribution_med, 1)}% of the basket (mean ${fmt(r.contribution_moy, 1)}%)`)}>
              <div style={{ position: "relative", flex: 1, height: 10, borderRadius: 99, background: "var(--dk-grid)" }}>
                <div style={{ width: `${Math.min(100, r.contribution_med)}%`, height: "100%", borderRadius: 99, background: gen ? "#2E7D4F" : "#8DC05A" }} />
                <div style={{ position: "absolute", left: `${seuil}%`, top: -3, bottom: -3, width: 2, background: "var(--dk-ink2)", opacity: 0.5 }} />
              </div>
              <b className="num" style={{ fontSize: ".78rem", color: INK, width: 44, textAlign: "right" }}>{fmt(r.contribution_med, 0)} %</b>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }} title={tr(`${fmt(r.nb_tickets_multi)} tickets (${fmt(r.frequence_multi_pct, 1)} % des tickets à plusieurs produits)`, `${fmt(r.nb_tickets_multi)} transactions (${fmt(r.frequence_multi_pct, 1)}% of multi-product ones)`)}>
              <div style={{ flex: 1, height: 10, borderRadius: 99, background: "var(--dk-grid)" }}>
                <div style={{ width: `${(r.nb_tickets_multi / mxF) * 100}%`, height: "100%", borderRadius: 99, background: "#D4A52A" }} />
              </div>
              <span className="num" style={{ fontSize: ".76rem", color: "var(--dk-ink2)", width: 44, textAlign: "right" }}>{fmt(r.nb_tickets_multi)}</span>
            </div>
            <div style={{ textAlign: "right" }}>
              <span className="num" style={{ fontSize: ".78rem", fontWeight: 700, color: INK }}>{fmt(r.ca_total_multi)} €</span>
              <div style={{ height: 4, borderRadius: 99, background: "var(--dk-grid)", marginTop: 4 }}>
                <div style={{ width: `${(r.ca_total_multi / mxC) * 100}%`, height: "100%", borderRadius: 99, background: "#4A78A8", marginLeft: "auto" }} />
              </div>
            </div>
          </div>
        );
      })}
      {sorted.length > 12 && (
        <button className="link-btn" onClick={() => setAll((v) => !v)}>
          {all ? tr("Afficher moins", "Show less") : tr(`Voir les ${sorted.length} produits`, `See all ${sorted.length} products`)}
        </button>
      )}
    </div>
  );
}

/* Paires à promouvoir : fréquence (horizontal) × probabilité (vertical), bulle = force du lien (lift).
   Cercles toujours ronds (le graphique garde ses proportions), zones nommées dans les coins,
   étiquettes des paires les plus fortes sans chevauchement, détail au survol. */
function AssocScatter({ rules, height = 440 }: { rules: any[]; height?: number }) {
  const [hover, setHover] = useState<any>(null);
  const openP = useOpenProduct();
  const pts = (rules || []).filter((r) => r.support > 0 && r.confidence > 0);
  if (!pts.length) return <div className="cs" style={{ padding: 30, textAlign: "center" }}>{tr("Aucune paire à afficher.", "No pair to show.")}</div>;
  const W = 820, H = height, L = 56, R = 20, T = 20, B = 50;
  const pw = W - L - R, ph = H - T - B;
  const nice = (v: number) => { const p = Math.pow(10, Math.floor(Math.log10(v))); return [1, 2, 2.5, 5, 10].map((m) => m * p).find((x) => x >= v) || v; };
  const xStep = nice(Math.max(...pts.map((d) => d.support)) / 4);
  const xMax = Math.ceil(Math.max(...pts.map((d) => d.support)) / xStep) * xStep;
  const yMax = Math.min(100, Math.ceil(Math.max(...pts.map((d) => d.confidence)) / 20) * 20);
  const X = (v: number) => L + (v / xMax) * pw;
  const Y = (v: number) => T + ph - (v / yMax) * ph;
  const q = (arr: number[], p: number) => { const a = [...arr].sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(p * a.length))]; };
  const xs = q(pts.map((d) => d.support), 0.7), ys = q(pts.map((d) => d.confidence), 0.7);
  const lMax = Math.max(...pts.map((d) => d.lift), 1);
  const rad = (l: number) => 6 + Math.sqrt(Math.max(l - 1, 0) / Math.max(lMax - 1, 0.01)) * 16;
  const col = (l: number) => (l >= 3 ? "#1F5E3A" : l >= 2 ? "#2E7D4F" : "#8DC05A");
  const zones = [
    { x1: X(xs), x2: X(xMax), y1: Y(yMax), y2: Y(ys), c: Q1, t: tr("Offre groupée", "Bundle offer"), s: tr("fréquentes et probables", "frequent and likely"), ax: "end", px: X(xMax) - 10, py: Y(yMax) + 18 },
    { x1: X(0), x2: X(xs), y1: Y(yMax), y2: Y(ys), c: Q2, t: tr("Suggestion en caisse", "Till suggestion"), s: tr("rares mais très probables", "rare but very likely"), ax: "start", px: X(0) + 10, py: Y(yMax) + 18 },
    { x1: X(xs), x2: X(xMax), y1: Y(ys), y2: Y(0), c: Q3, t: tr("Placement en rayon", "Shelf placement"), s: tr("fréquentes, moins probables", "frequent, less likely"), ax: "end", px: X(xMax) - 10, py: Y(0) - 22 },
    { x1: X(0), x2: X(xs), y1: Y(ys), y2: Y(0), c: Q4, t: tr("À ignorer", "To ignore"), s: tr("impact faible", "low impact"), ax: "start", px: X(0) + 10, py: Y(0) - 22 },
  ];
  const label = (d: any) => { const a = String(d.antecedent).split(",")[0].trim(), b = String(d.consequent).split(",")[0].trim(); const t = `${a} + ${b}`; return t.length > 30 ? t.slice(0, 29) + "…" : t; };
  const boxes: any[] = []; const labels: any[] = [];
  [...pts].sort((a, b) => b.lift - a.lift).slice(0, 7).forEach((d) => {
    const cx = X(d.support), cy = Y(d.confidence), r = rad(d.lift), t = label(d), w = t.length * 6;
    for (const o of [{ x: cx + r + 5, y: cy + 4, a: "start" }, { x: cx - r - 5, y: cy + 4, a: "end" }, { x: cx, y: cy - r - 6, a: "middle" }, { x: cx, y: cy + r + 13, a: "middle" }]) {
      const x1 = o.a === "start" ? o.x : o.a === "end" ? o.x - w : o.x - w / 2, x2 = x1 + w, y1 = o.y - 10, y2 = o.y + 3;
      if (x1 < L || x2 > W - R || y1 < T || y2 > T + ph) continue;
      if (boxes.some((b) => !(x2 < b.x1 || x1 > b.x2 || y2 < b.y1 || y1 > b.y2))) continue;
      boxes.push({ x1, y1, x2, y2 }); labels.push({ d, t, ...o }); break;
    }
  });
  const xt: number[] = []; for (let v = 0; v <= xMax + 1e-9; v += xStep) xt.push(v);
  const yt: number[] = []; for (let v = 0; v <= yMax; v += 20) yt.push(v);
  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} onMouseLeave={() => setHover(null)}>
        {zones.map((z, i) => (
          <g key={i}>
            <rect x={z.x1} y={z.y1} width={Math.max(0, z.x2 - z.x1)} height={Math.max(0, z.y2 - z.y1)} fill={z.c} opacity={i === 0 ? 0.1 : 0.05} rx={6} />
            <text x={z.px} y={z.py} textAnchor={z.ax as any} fontSize={12} fontWeight={800} fill={z.c}>{z.t}</text>
            <text x={z.px} y={z.py + 14} textAnchor={z.ax as any} fontSize={10} fill={MUTED}>{z.s}</text>
          </g>
        ))}
        {yt.map((v) => (<g key={`y${v}`}><line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="rgba(80,100,85,0.12)" /><text x={L - 8} y={Y(v) + 4} textAnchor="end" fontSize={11} fill={MUTED}>{fmt(v)} %</text></g>))}
        {xt.map((v) => (<g key={`x${v}`}><line x1={X(v)} x2={X(v)} y1={T} y2={T + ph} stroke="rgba(80,100,85,0.08)" /><text x={X(v)} y={T + ph + 18} textAnchor="middle" fontSize={11} fill={MUTED}>{fmt(v, xStep < 1 ? 1 : 0)} %</text></g>))}
        <line x1={X(xs)} x2={X(xs)} y1={T} y2={T + ph} stroke="var(--dk-ink2)" strokeDasharray="4 4" opacity={0.35} />
        <line x1={L} x2={W - R} y1={Y(ys)} y2={Y(ys)} stroke="var(--dk-ink2)" strokeDasharray="4 4" opacity={0.35} />
        <line x1={L} x2={W - R} y1={T + ph} y2={T + ph} stroke="rgba(80,100,85,0.35)" />
        <text x={L + pw / 2} y={H - 8} textAnchor="middle" fontSize={11.5} fontWeight={700} fill={INK}>{tr("Fréquence : % des tickets qui contiennent la paire →", "Frequency: % of transactions with the pair →")}</text>
        <text x={14} y={T + ph / 2} textAnchor="middle" fontSize={11.5} fontWeight={700} fill={INK} transform={`rotate(-90 14 ${T + ph / 2})`}>{tr("Probabilité d'achat du 2ᵉ produit →", "Probability of buying the 2nd →")}</text>
        {[...pts].sort((a, b) => a.lift - b.lift).map((d, i) => {
          const on = hover === d;
          return (
            <circle key={i} cx={X(d.support)} cy={Y(d.confidence)} r={rad(d.lift) + (on ? 2 : 0)} fill={col(d.lift)} fillOpacity={on ? 0.95 : 0.75}
                    stroke="#fff" strokeWidth={on ? 2.5 : 1.5} style={{ cursor: "pointer", transition: "r .15s" }}
                    onMouseEnter={() => setHover(d)} onClick={() => openP(String(d.antecedent).split(",")[0].trim())} />
          );
        })}
        {labels.map((l, i) => (
          <text key={i} x={l.x} y={l.y} textAnchor={l.a} fontSize={10.5} fontWeight={700} fill={INK}
                style={{ paintOrder: "stroke", stroke: "var(--dk-surface, #fff)", strokeWidth: 3, pointerEvents: "none" }}>{l.t}</text>
        ))}
      </svg>
      {hover && (
        <div style={{ position: "absolute", left: `${(X(hover.support) / W) * 100}%`, top: `${(Y(hover.confidence) / H) * 100}%`,
                      transform: X(hover.support) > W * 0.6 ? "translate(calc(-100% - 16px), -50%)" : "translate(16px, -50%)",
                      background: "var(--dk-surface, #fff)", border: "1px solid var(--dk-line)", borderRadius: 12, padding: "10px 12px",
                      boxShadow: "0 10px 28px rgba(30,40,32,0.18)", fontSize: ".76rem", color: INK, pointerEvents: "none", maxWidth: 300, zIndex: 5 }}>
          <div style={{ fontWeight: 800, marginBottom: 4 }}>{hover.antecedent} <span style={{ color: MUTED }}>→</span> {hover.consequent}</div>
          <div>{tr("Dans", "In")} <b>{fmt(hover.support, 2)} %</b> {tr("des tickets", "of transactions")}</div>
          <div><b>{fmt(hover.confidence, 0)} %</b> {tr("des clients du 1er produit prennent aussi le 2e", "of buyers of the 1st also take the 2nd")}</div>
          <div><b>× {fmt(hover.lift, 1)}</b> {tr("plus souvent que par hasard", "more often than by chance")}</div>
          <div style={{ color: MUTED, marginTop: 4, fontSize: ".7rem" }}>{tr("Cliquez pour la fiche du 1er produit", "Click for the 1st product's sheet")}</div>
        </div>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", marginTop: 6, fontSize: ".72rem", color: MUTED }}>
        {[{ c: "#1F5E3A", t: tr("lien très fort (× 3 et plus)", "very strong link (× 3+)") }, { c: "#2E7D4F", t: tr("fort (× 2 à 3)", "strong (× 2–3)") }, { c: "#8DC05A", t: tr("modéré (moins de × 2)", "moderate (under × 2)") }].map((l) => (
          <span key={l.t} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 99, background: l.c }} />{l.t}</span>
        ))}
        <span>· {tr("taille de la bulle = force du lien · pointillés = seuil des 30 % de paires les plus fortes", "bubble size = link strength · dashed = top-30% threshold")}</span>
      </div>
    </div>
  );
}

/* ─── Fiche produit : un clic sur un nom de produit (classement, bulle, tableau, recherche, association)
   ouvre ce panneau avec tout ce que le tableau de bord sait du produit. ─── */
const ProductCtx = createContext<(name: string) => void>(() => {});
function useOpenProduct() { return useContext(ProductCtx); }

/** Nom de produit cliquable */
function ProdName({ name, style }: { name: string; style?: React.CSSProperties }) {
  const open = useOpenProduct();
  return (
    <span className="prod-link" role="button" tabIndex={0} title={tr("Ouvrir la fiche produit", "Open the product sheet")}
          onClick={(e) => { e.stopPropagation(); open(name); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); open(name); } }}
          style={style}>
      {name}
    </span>
  );
}

const QUAD_INFO: Record<string, { fr: string; en: string; color: string }> = {
  Star: { fr: "Star (indispensable)", en: "Star (essential)", color: Q1 },
  Niche: { fr: "Niche (rentable)", en: "Niche (profitable)", color: Q2 },
  Trafic: { fr: "Produit d'appel", en: "Traffic builder", color: Q3 },
  Dormant: { fr: "Stock dormant", en: "Dormant stock", color: Q4 },
};

function ProductPanel({ name, base, extra, onClose }: { name: string; base: any[]; extra: any; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const all = base || [];
  const m = all.find((i: any) => i.article === name);
  const caRank = m ? [...all].sort((a: any, b: any) => b.ca_total - a.ca_total).findIndex((i: any) => i.article === name) + 1 : 0;
  const caTot = all.reduce((a: number, i: any) => a + (i.ca_total || 0), 0) || 1;
  const v = (extra.vel?.macro_items || []).find((i: any) => i.article === name);
  const f = (extra.freq?.items || []).find((i: any) => i.article === name);
  const has = (txt: string) => String(txt || "").split(/\s*,\s*/).includes(name) || String(txt || "") === name;
  const pairs = (extra.assoc?.rules || [])
    .filter((r: any) => has(r.antecedent) || has(r.consequent))
    .map((r: any) => ({ other: has(r.antecedent) ? r.consequent : r.antecedent, lift: r.lift, conf: r.confidence }))
    .filter((x: any, i: number, arr: any[]) => arr.findIndex((y) => y.other === x.other) === i)
    .slice(0, 5);
  const q = m ? QUAD_INFO[m.quadrant] : null;
  const stat = (l: string, val: string, sub?: string) => (
    <div className="pp-stat"><div className="l">{l}</div><div className="v">{val}</div>{sub && <div className="s">{sub}</div>}</div>
  );
  const loading = !extra.vel || !extra.freq || !extra.assoc;
  return (
    <>
      <div className="pp-veil" onClick={onClose} />
      <aside className="pp" role="dialog" aria-label={name}>
        <div className="pp-head">
          <button className="pp-close" onClick={onClose} aria-label={tr("Fermer", "Close")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
          <div style={{ fontSize: ".72rem", color: MUTED, fontWeight: 600 }}>{m ? trData(m.category) : tr("Produit", "Product")}</div>
          <div style={{ fontSize: "1.3rem", fontWeight: 800, color: INK, letterSpacing: "-0.02em", paddingRight: 40, marginTop: 2 }}>{name}</div>
          {q && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              <span className="pp-tag" style={{ background: `color-mix(in srgb, ${q.color} 14%, transparent)`, color: q.color }}>{tr(q.fr, q.en)}</span>
              {caRank > 0 && <span className="pp-tag" style={{ background: "var(--dk-soft)", color: "var(--dk-ink2)" }}>{tr(`n° ${caRank} en chiffre d'affaires`, `#${caRank} by revenue`)}</span>}
            </div>
          )}
        </div>
        <div className="pp-body">
          {!m && <div className="cs">{tr("Ce produit n'a pas de ventes sur la période.", "This product has no sales in the period.")}</div>}
          {m && (
            <>
              <div className="pp-stats">
                {stat(tr("Chiffre d'affaires", "Revenue"), `${fmt(m.ca_total)} €`, tr(`${fmt((m.ca_total / caTot) * 100, 1)} % du total`, `${fmt((m.ca_total / caTot) * 100, 1)}% of total`))}
                {stat(tr("Présence dans les tickets", "Presence in transactions"), `${fmt(m.penetration_rate, 1)} %`, tr(`environ 1 client sur ${fmt(100 / Math.max(m.penetration_rate, 0.01), 0)}`, `about 1 customer in ${fmt(100 / Math.max(m.penetration_rate, 0.01), 0)}`))}
                {stat(tr("Ventes par jour de vente", "Sales per selling day"), fmt(m.daily_velocity, 1), tr(`sur ${fmt(m.jours_actifs)} jours`, `over ${fmt(m.jours_actifs)} days`))}
                {stat(tr("Heure de pointe", "Peak hour"), m.peak_hour != null ? `${String(m.peak_hour).padStart(2, "0")} h` : "—", m.ratio_pic_percent ? tr(`${fmt(m.ratio_pic_percent, 0)} % des ventes du produit`, `${fmt(m.ratio_pic_percent, 0)}% of the product's sales`) : undefined)}
                {f && stat(tr("Régularité", "Regularity"), `${fmt(f.repurchase_freq_pct, 0)} %`, tr(`des semaines avec une vente (${trData(f.statut_frequence)})`, `of weeks with a sale (${trData(f.statut_frequence)})`))}
                {v && v.ratio_touristic > 0 && stat(tr("Effet saison touristique", "Tourist season effect"), `× ${fmt(v.ratio_touristic, 1)}`, tr(`${fmt(v.velocity_touristic, 1)} articles / jour en saison`, `${fmt(v.velocity_touristic, 1)} items / day in season`))}
              </div>
              <div className="cc" style={{ padding: "14px 16px" }}>
                <div className="ct" style={{ fontSize: ".9rem" }}>{tr("Que faire ?", "What to do?")}</div>
                <div style={{ fontSize: ".84rem", color: "var(--dk-ink2)", lineHeight: 1.5, marginTop: 4 }}>
                  {tr(m.action || "—", QUAD_EN_ACTION[m.quadrant] || m.action || "—")}
                  {m.alerte_horaire && <div style={{ marginTop: 6, fontWeight: 700, color: ALERT }}>⏰ {tr(m.alerte_horaire, String(m.alerte_horaire).replace("Remplir avant", "Restock before"))}</div>}
                </div>
              </div>
              <div className="cc" style={{ padding: "14px 16px" }}>
                <div className="ct" style={{ fontSize: ".9rem" }}>{tr("Souvent acheté avec", "Often bought with")}</div>
                {loading && <div className="cs">{tr("Chargement…", "Loading…")}</div>}
                {!loading && pairs.length === 0 && <div className="cs">{tr("Aucune association marquante pour ce produit.", "No notable association for this product.")}</div>}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
                  {pairs.map((x: any, i: number) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: ".82rem" }}>
                      <ProdName name={x.other} style={{ color: INK, fontWeight: 600 }} />
                      <span style={{ color: MUTED, flexShrink: 0 }}>{tr(`× ${fmt(x.lift, 1)} plus que le hasard`, `× ${fmt(x.lift, 1)} vs chance`)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="cs" style={{ marginBottom: 0 }}>{tr("Pour plus de détails sur ce produit, posez la question à l'assistant IA.", "For more detail on this product, ask the AI assistant.")}</div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
const QUAD_EN_ACTION: Record<string, string> = {
  Star: "Critical priority: no stock-outs, hourly alert",
  Niche: "Stock for loyal customers (large volumes)",
  Trafic: "Place in the window or at the till to attract, moderate stock",
  Dormant: "Reduce production, consider discontinuing",
};

/* Ventes moyennes par jour de la semaine : tous les jours, saison touristique, jours d'événement */
function DowGroupedBars({ rows }: { rows: any[] }) {
  const W = 900, H = 260, padL = 44, padR = 10, padT = 16, padB = 46;
  const series = [
    { key: "all", label: tr("Tous les jours", "All days"), color: MUTED },
    { key: "touristic", label: tr("Saison touristique", "Tourist season"), color: ORANGE },
    { key: "event", label: tr("Jours d'événement", "Event days"), color: PEACH },
  ];
  const max = Math.max(1, ...rows.flatMap((r) => series.map((s) => Number(r[s.key]) || 0))) * 1.1;
  const gw = (W - padL - padR) / Math.max(rows.length, 1);
  const bw = (gw * 0.75) / series.length;
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / max);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 260 }} preserveAspectRatio="xMidYMid meet">
      {[0.25, 0.5, 0.75, 1].map((t, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={y(t * max)} y2={y(t * max)} stroke="var(--dk-line, #ECEDE7)" />
          <text x={padL - 6} y={y(t * max) + 3} textAnchor="end" fontSize="10" fill={MUTED} fontWeight="700">{fmt(t * max)}</text>
        </g>
      ))}
      {rows.map((r, i) => (
        <g key={i}>
          {series.map((s, j) => {
            const v = r[s.key];
            if (v == null) return null;
            const x = padL + i * gw + gw * 0.125 + j * bw;
            return (
              <rect key={j} x={x} y={y(v)} width={bw - 2} height={y(0) - y(v)} rx={2} fill={s.color} fillOpacity={0.9}>
                <title>{`${trData(r.day)} · ${s.label} : ${fmt(v)} ${tr("articles", "items")}`}</title>
              </rect>
            );
          })}
          <text x={padL + i * gw + gw / 2} y={H - padB + 16} textAnchor="middle" fontSize="11" fill={INK} fontWeight="700">{trData(r.day)}</text>
        </g>
      ))}
      <g transform={`translate(${padL}, ${H - 8})`}>
        {series.map((s, j) => (
          <g key={j} transform={`translate(${j * 170}, 0)`}>
            <rect x="0" y="-10" width="12" height="12" rx="2" fill={s.color} />
            <text x="18" y="0" fontSize="11" fill={INK} fontWeight="700">{s.label}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}

/* ══════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════ */

/* Recherche produit avec suggestions : la liste s'affiche pendant la saisie,
   mais les données ne se rechargent qu'avec Entrée, un clic sur une suggestion ou « Rechercher ». */
function ProductSearch({ value, onChange, onSubmit, names, active, onPick }: {
  value: string; onChange: (v: string) => void; onSubmit: (v: string) => void; names: string[]; active: string; onPick?: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(-1);
  const t = value.trim().toLowerCase();
  const sugg = useMemo(() => {
    if (!t) return [] as string[];
    const words = (n: string) => n.toLowerCase().split(/[^a-z0-9à-ÿ]+/i).filter(Boolean);
    const starts = names.filter((n) => words(n).some((w) => w.startsWith(t)) || n.toLowerCase().startsWith(t));
    const first = starts.filter((n) => n.toLowerCase().startsWith(t));
    const rest = starts.filter((n) => !n.toLowerCase().startsWith(t));
    return [...first, ...rest].slice(0, 10);
  }, [t, names]);
  // Choisir une suggestion : filtre les onglets ET ouvre la fiche du produit
  const pick = (n: string) => { onChange(n); onSubmit(n); setOpen(false); setHi(-1); onPick?.(n); };
  const bold = (n: string) => {
    const low = n.toLowerCase();
    let start = -1;
    for (let k = 0; k <= low.length - t.length; k++) {
      if ((k === 0 || !/[a-z0-9à-ÿ]/i.test(low[k - 1])) && low.startsWith(t, k)) { start = k; break; }
    }
    if (start < 0 || !t) return <>{n}</>;
    return <>{n.slice(0, start)}<strong style={{ color: ORANGE }}>{n.slice(start, start + t.length)}</strong>{n.slice(start + t.length)}</>;
  };
  return (
    <div style={{ position: "relative", flex: "1 1 340px", maxWidth: 560 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 6px 6px 16px", borderRadius: 999,
                    background: "var(--dk-surface, #fff)", border: `1px solid ${open && sugg.length ? ORANGE : "var(--dk-line, #E3E4DD)"}`,
                    boxShadow: "0 2px 10px rgba(30,40,32,0.06)" }}>
        <IconSearch size={15} color={MUTED} />
        <input
          value={value}
          placeholder={tr("Rechercher un produit (tapez les premières lettres d'un mot)", "Search a product (type the first letters of a word)")}
          onChange={(e) => { onChange(e.target.value); setOpen(true); setHi(-1); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && sugg.length) { e.preventDefault(); setOpen(true); setHi((h) => (h + 1) % sugg.length); }
            else if (e.key === "ArrowUp" && sugg.length) { e.preventDefault(); setHi((h) => (h <= 0 ? sugg.length - 1 : h - 1)); }
            else if (e.key === "Enter") { e.preventDefault(); if (open && hi >= 0 && sugg[hi]) pick(sugg[hi]); else { onSubmit(value); setOpen(false); } }
            else if (e.key === "Escape") { setOpen(false); setHi(-1); }
          }}
          style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontSize: ".84rem", color: INK, padding: "6px 0" }}
        />
        {value && (
          <button onClick={() => { onChange(""); onSubmit(""); }} title={tr("Effacer", "Clear")}
                  style={{ border: "none", background: "transparent", color: MUTED, cursor: "pointer", fontSize: "1rem", padding: "0 6px" }}>×</button>
        )}
        <button onClick={() => { onSubmit(value); setOpen(false); }}
                style={{ border: "none", borderRadius: 999, background: ORANGE, color: "#fff", fontWeight: 800, fontSize: ".78rem", padding: "8px 16px", cursor: "pointer" }}>
          {tr("Rechercher", "Search")}
        </button>
      </div>
      {open && sugg.length > 0 && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 50, maxHeight: 320, overflowY: "auto",
                      background: "var(--dk-surface, #fff)", border: "1px solid var(--dk-line, #E3E4DD)", borderRadius: 12,
                      boxShadow: "0 12px 32px rgba(30,40,32,0.16)", padding: 4 }}>
          {sugg.map((n, i) => (
            <div key={n} onMouseDown={(e) => { e.preventDefault(); pick(n); }} onMouseEnter={() => setHi(i)}
                 style={{ padding: "8px 12px", borderRadius: 8, cursor: "pointer", fontSize: ".82rem", color: INK,
                          background: i === hi ? "var(--dk-soft, #F3F5EF)" : "transparent" }}>
              {bold(n)}
            </div>
          ))}
          <div style={{ padding: "6px 12px 4px", fontSize: ".66rem", color: MUTED }}>
            {tr("↑ ↓ pour choisir · Entrée pour valider", "↑ ↓ to choose · Enter to confirm")}
          </div>
        </div>
      )}
      {active && (
        <div style={{ marginTop: 6, fontSize: ".7rem", color: MUTED }}>
          {tr(`Filtre actif : « ${active} » — appliqué à tous les onglets`, `Active filter: « ${active} » — applied to all tabs`)}
        </div>
      )}
    </div>
  );
}

export default function ProduitsPage() {
  const { openChat } = useChat();
  const [tab, setTab] = useState<"matrix" | "pen" | "vel" | "ticket" | "freq" | "assoc">("matrix");

  // ── RECHERCHE produit commune à tous les onglets ──
  const [allNames, setAllNames] = useState<string[]>([]);
  const [allItems, setAllItems] = useState<any[]>([]);   // tous les produits (2024–2025), pour la fiche produit
  useEffect(() => {
    fetchMatrix("Toutes")
      .then((d) => {
        setAllItems(d?.items || []);
        setAllNames((d?.items || []).map((i: any) => i.article).sort((a: string, b: string) => a.localeCompare(b)));
      })
      .catch(() => setAllNames([]));
  }, []);

  // ── FICHE PRODUIT (panneau latéral) ──
  const [panelName, setPanelName] = useState<string | null>(null);
  const [panelExtra, setPanelExtra] = useState<any>({});
  const openProduct = (name: string) => {
    setPanelName(name);
    // Données complémentaires chargées une seule fois, au premier clic
    if (!panelExtra.vel) fetchVelocity().then((d) => setPanelExtra((x: any) => ({ ...x, vel: d }))).catch(() => setPanelExtra((x: any) => ({ ...x, vel: {} })));
    if (!panelExtra.freq) fetchFrequency().then((d) => setPanelExtra((x: any) => ({ ...x, freq: d }))).catch(() => setPanelExtra((x: any) => ({ ...x, freq: {} })));
    if (!panelExtra.assoc) fetchAssociations("Lift ↓", 0).then((d) => setPanelExtra((x: any) => ({ ...x, assoc: d }))).catch(() => setPanelExtra((x: any) => ({ ...x, assoc: {} })));
  };

  // Années présentes dans les ventes (filtre « Période »)
  const [years, setYears] = useState<number[]>([]);
  useEffect(() => {
    fetchDataPeriod().then((p) => setYears((p?.annees || []).slice().sort((a, b) => b - a))).catch(() => setYears([]));
  }, []);
  const periodLabel = years.length ? (years.length > 1 ? `${Math.min(...years)} – ${Math.max(...years)}` : String(years[0])) : "—";

  // ── MATRICE states ──
  const [matrixData, setMatrixData] = useState<any>(null);
  const [matrixQuad, setMatrixQuad] = useState<string>("Tous");
  const [loading, setLoading] = useState(false);

  // ── PEN states ──
  const [penData, setPenData] = useState<any>(null);
  const [searchPen, setSearchPen] = useState("");
  const [searchInputPen, setSearchInputPen] = useState("");
  const [penCats, setPenCats] = useState<string[]>([]);
  const [penStatuts, setPenStatuts] = useState<string[]>([]);
  const [penSelected, setPenSelected] = useState<string | null>(null);
  const [yearPen, setYearPen] = useState<string>("Toutes");

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
    if (tab === "matrix") {
      fetchMatrix(yearPen)
        .then((res) => setData(setMatrixData, res))
        .catch((err) => handleErr(setMatrixData, err));
    } else if (tab === "pen") {
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

  // Listes filtrées par la recherche (onglets calculés côté navigateur ; « Présence » filtre côté serveur)
  const q = searchPen.trim().toLowerCase();
  const hasQ = (n: any) => !q || String(n || "").toLowerCase().includes(q);
  const matrixItems = (matrixData?.items || []).filter((i: any) => hasQ(i.article));
  const velItems = (velData?.macro_items || []).filter((p: any) => hasQ(p.article));
  const ticketTop = (ticketData?.top20 || []).filter((p: any) => hasQ(p.article));
  // Tous les produits analysés (pour les lignes triables et le compte des rôles) ; repli sur les 30 premiers
  const ticketAll = (ticketData?.all_items || ticketData?.top20 || []).filter((p: any) => hasQ(p.article));
  const freqItems = (freqData?.items || []).filter((p: any) => hasQ(p.article));
  const assocRules = (assocData?.rules || []).filter((r: any) => hasQ(r.antecedent) || hasQ(r.consequent));

  /* ─────────────────────────────────────────────
     TABS BAR
     ───────────────────────────────────────────── */
  const TABS = [
    { id: "matrix", label: tr("Matrice de décision", "Decision matrix"), sub: tr("Que faire de chaque produit ?", "What to do with each product?"), Icon: IconScatter, color: ORANGE },
    { id: "pen", label: tr("Présence dans les tickets", "Presence in transactions"), sub: tr("Part des tickets avec le produit", "Share of transactions with the product"), Icon: IconTarget, color: ORANGE },
    { id: "vel", label: tr("Vitesse de Vente", "Sales Velocity"), sub: tr("Cadence journalière & horaire", "Daily & hourly pace"), Icon: IconBolt, color: "var(--dk-accent-deep, #2A7148)" },
    { id: "ticket", label: tr("Poids dans le panier", "Weight in the basket"), sub: tr("Rôle dans les paniers", "Role in baskets"), Icon: IconTicketPerc, color: PEACH },
    { id: "freq", label: tr("Régularité de vente", "Sales regularity"), sub: tr("Semaines avec vente", "Weeks with sales"), Icon: IconRepeat, color: "var(--dk-accent-deep, #3E8E5E)" },
    { id: "assoc", label: tr("Associations", "Associations"), sub: tr("Produits achetés ensemble", "Products bought together"), Icon: IconLink2, color: "var(--dk-accent-deep, #1F5E3A)" },
  ] as const;

  return (
    <ProductCtx.Provider value={openProduct}>
    <RetainProvider>
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
                      border:"1px solid var(--dk-line, rgba(120,140,120,0.18))",
                      boxShadow:"0 2px 12px rgba(0,0,0,0.06)" }}>
          <div>
            <div style={{ fontSize: ".62rem", color: MUTED, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 2 }}>
              {tr("Références", "Products")}
            </div>
            <div style={{ fontSize: "1.35rem", fontWeight: 800, color: INK }}>
              {tab === "matrix" && matrixData?.items ? fmt(matrixData.items.length) : tab === "pen" && penData ? fmt(penData.kpis?.total_articles) : tab === "freq" && freqData ? fmt(freqData.nb_produits) : "—"}
            </div>
          </div>
          <div>
            <div style={{ fontSize: ".62rem", color: MUTED, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 2 }}>
              {tab === "assoc" ? tr("Associations", "Associations") : tab === "vel" ? tr("Articles / jour (moy.)", "Items / day (avg.)") : tab === "ticket" ? tr("Tickets à plusieurs produits", "Multi-product transactions") : tab === "pen" ? tr("Présence max", "Max presence") : "—"}
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
            {tab === "matrix" || tab === "pen" ? (
              <select
                value={yearPen}
                onChange={(e) => setYearPen(e.target.value)}
                style={{ fontSize: ".85rem", fontWeight: 800, padding: "5px 10px", borderRadius: 8, border: "1px solid var(--dk-line, #E3E4DD)", background: "var(--dk-surface, #FAFAF7)", color: INK }}
              >
                <option value="Toutes">{periodLabel}</option>
                {years.length > 1 && years.map((y) => <option key={y} value={String(y)}>{y}</option>)}
              </select>
            ) : (
              <div style={{ fontSize: "1rem", fontWeight: 800, color: INK, padding: "6px 0" }}>{periodLabel}</div>
            )}
          </div>
        </div>
      </div>

      {/* ── TABS Selector ── */}
      <div style={{ margin: "18px 28px 16px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: 6, background: "var(--dk-surface)", borderRadius: 28, border: "1px solid var(--dk-line)" }}>
          {TABS.map((t) => {
            const Icon = t.Icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id as any)}
                style={{
                  flex: "1 1 190px",
                  minWidth: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  borderRadius: 999,
                  cursor: "pointer",
                  border: "none",
                  background: active ? "var(--dk-accent-wash)" : "transparent",
                  boxShadow: active ? "inset 0 0 0 1px color-mix(in srgb, var(--dk-accent) 30%, transparent)" : "none",
                  transition: "all 0.2s",
                }}
              >
                <div
                  style={{
                    width: 32, height: 32, borderRadius: 9,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: active ? `color-mix(in srgb, ${t.color} 8%, transparent)` : "var(--dk-page, #F1F1EC)",
                    flexShrink: 0,
                  }}
                >
                  <Icon size={16} color={active ? t.color : MUTED} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", minWidth: 0 }}>
                  <span style={{ fontSize: ".82rem", fontWeight: 800, color: active ? INK : "var(--dk-ink2, #4A524C)", whiteSpace: "nowrap" }}>
                    {t.label}
                  </span>
                  <span style={{ fontSize: ".64rem", color: MUTED, whiteSpace: "nowrap" }}>{t.sub}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── RECHERCHE PRODUIT (tous les onglets) ── */}
      <div style={{ margin: "0 28px 16px", display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <ProductSearch
          value={searchInputPen}
          onChange={setSearchInputPen}
          onSubmit={(v) => setSearchPen(v.trim())}
          names={allNames}
          active={searchPen}
          onPick={openProduct}
        />
      </div>

      {loading && (
        <div className="sw" style={{ padding: "40px 0", color: MUTED, fontSize: ".9rem", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <div className="w-5 h-5 rounded-full border-2 border-[#2E7D4F] border-t-transparent animate-spin" />
          {tr("Analyse en cours…", "Analysing…")}
        </div>
      )}

      {/* ══════════════════════════════════════════════
          TAB 0: MATRICE DE DÉCISION (cahier des charges)
          ══════════════════════════════════════════════ */}
      {tab === "matrix" && matrixData?.items && !loading && (() => {
        const q = matrixData.quadrants || {};
        const QUAD = [
          { key: "Star", color: Q1 },
          { key: "Niche", color: Q2 },
          { key: "Trafic", color: Q3 },
          { key: "Dormant", color: Q4 },
        ];
        const QUAD_EN: Record<string, { label: string; action: string }> = {
          Star: { label: "Star (essential)", action: "Critical priority: no stock-outs, hourly alert" },
          Niche: { label: "Niche (profitable)", action: "Stock for loyal customers (large volumes)" },
          Trafic: { label: "Traffic builder", action: "Place in the window or at the till to attract, moderate stock" },
          Dormant: { label: "Dormant stock", action: "Reduce production, consider discontinuing" },
        };
        const colorOf = (k: string) => (QUAD.find((x) => x.key === k) || QUAD[3]).color;
        const seuils = matrixData.seuils || {};
        const stars = matrixItems.filter((i: any) => i.quadrant === "Star");
        const rows = matrixItems.filter((i: any) => matrixQuad === "Tous" || i.quadrant === matrixQuad);
        return (
          <>
            <div className="sw">
              <div className="grid-main">
                <div className="cc hero-card">
                  <ChartAssistantButton chartType="product_decision_matrix" chartData={{ items: matrixData.items, quadrants: matrixData.quadrants, seuils: matrixData.seuils }} chartName="MatrixGrid"
                    userQuestion="Explique cette matrice de décision des produits" position="top-right" onOpenChat={openChat} />
                  <CardHeader
                    title={tr("Matrice de décision", "Decision matrix")}
                    sub={tr("Chaque produit est classé selon sa présence dans les tickets (horizontal) et ce qu'il vend par jour de vente (vertical). Cliquez sur une case pour filtrer la fiche, ou sur une bulle pour ouvrir la fiche du produit.", "Each product is placed by its presence in transactions (horizontal) and what it sells per selling day (vertical). Click a box to filter the sheet, or a bubble to open the product sheet.")}
                    icon={<IconGrid size={16} color={ORANGE} />}
                  />
                  <MatrixGrid
                    items={matrixItems}
                    quadrants={q}
                    seuils={seuils}
                    active={matrixQuad}
                    onSelect={(k: string) => setMatrixQuad(matrixQuad === k ? "Tous" : k)}
                    colors={{ Star: Q1, Niche: Q2, Trafic: Q3, Dormant: Q4 }}
                    labelsEn={QUAD_EN}
                  />
                  <Takeaway>
                    {tr(
                      `${fmt(q.Star?.nb || 0)} produits Stars réalisent ${fmt(q.Star?.part_ca || 0, 0)} % du chiffre d'affaires : ce sont eux qu'il ne faut jamais manquer. Frontières : présence moyenne ${fmt(seuils.penetration_moyenne || 0, 1)} % des tickets, ${fmt(seuils.vitesse_moyenne || 0, 1)} articles par jour de vente.`,
                      `${fmt(q.Star?.nb || 0)} Star products make ${fmt(q.Star?.part_ca || 0, 0)}% of revenue: these must never run out. Boundaries: average presence ${fmt(seuils.penetration_moyenne || 0, 1)}% of transactions, ${fmt(seuils.vitesse_moyenne || 0, 1)} items per selling day.`
                    )}
                  </Takeaway>
                </div>
                <div className="side-col">
                  {/* Les Stars et leur action : ce qu'il ne faut jamais manquer */}
                  <div className="cc">
                    <div className="ct" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 26, height: 26, borderRadius: "50%", background: Q1, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><IconStar size={14} color="#fff" /></span>
                      {tr("Les Stars à ne jamais manquer", "Stars never to run out of")}
                    </div>
                    <div className="cs">{tr("Classées par chiffre d'affaires · cliquez pour la fiche", "Ranked by revenue · click for the sheet")}</div>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      {[...stars].sort((a: any, b: any) => b.ca_total - a.ca_total).slice(0, 7).map((st: any, i: number) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--dk-line)" }}>
                          <span className="num" style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--dk-soft)", color: MUTED, fontSize: ".68rem", fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: ".82rem", fontWeight: 700, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}><ProdName name={st.article} /></div>
                            <div style={{ fontSize: ".7rem", color: MUTED }}>
                              {fmt(st.penetration_rate, 1)} % {tr("des tickets", "of transactions")} · {fmt(st.ca_total)} €
                            </div>
                          </div>
                          {st.alerte_horaire && (
                            <span title={tr(st.alerte_horaire, String(st.alerte_horaire).replace("Remplir avant", "Restock before"))} style={{ fontSize: ".66rem", fontWeight: 800, color: ALERT, background: "color-mix(in srgb, var(--dk-alert) 10%, transparent)", padding: "3px 8px", borderRadius: 99, whiteSpace: "nowrap" }}>
                              ⏰ {String(st.alerte_horaire).replace(/[^0-9:h]/g, "")}
                            </span>
                          )}
                        </div>
                      ))}
                      {stars.length === 0 && <div className="cs">{tr("Aucun produit Star.", "No Star product.")}</div>}
                    </div>
                    <div style={{ fontSize: ".76rem", color: "var(--dk-ink2)", marginTop: 10, lineHeight: 1.45 }}>
                      <b>{tr("Action : ", "Action: ")}</b>{tr("zéro rupture ; remplir le rayon avant l'heure indiquée par ⏰.", "no stock-outs; restock before the hour shown by ⏰.")}
                    </div>
                  </div>
                  <RetainCard max={3} />
                </div>
              </div>
            </div>

            <div className="sw">
            <Details key={matrixQuad} defaultOpen={matrixQuad !== "Tous"} label={matrixQuad === "Tous" ? tr(`Voir le détail : les ${fmt(matrixItems.length)} produits, leur catégorie et leur action`, `See details: all ${fmt(matrixItems.length)} products, their category and action`) : tr(`Produits de la case « ${matrixQuad} »`, `Products in the "${matrixQuad}" box`)}>
            <div className="sec-title" style={{ padding: "6px 4px 10px" }}>
              {tr("Fiche par produit", "Product sheet")}
              {matrixQuad !== "Tous" && (
                <button onClick={() => setMatrixQuad("Tous")} style={{ marginLeft: 10, fontSize: ".7rem", fontWeight: 700, border: "1px solid var(--dk-line, #E3E4DD)", borderRadius: 8, padding: "2px 8px", background: "var(--dk-surface, #fff)", color: INK, cursor: "pointer" }}>
                  {tr("Voir tous les produits", "Show all products")}
                </button>
              )}
            </div>
            <div>
              <div className="cc">
                <div className="cs" style={{ marginBottom: 8 }}>
                  {tr(
                    `${stars.filter((s: any) => s.alerte_horaire).length} Star(s) concentrent leurs ventes sur une heure (≥ ${fmt(seuils.pic_horaire_pct || 40)} % des ventes du produit) : remplir le rayon avant l'heure indiquée.`,
                    `${stars.filter((s: any) => s.alerte_horaire).length} Star(s) concentrate their sales in one hour (≥ ${fmt(seuils.pic_horaire_pct || 40)}% of the product's sales): restock before the hour shown.`
                  )}
                </div>
                <div style={{ maxHeight: 420, overflow: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".72rem" }}>
                    <thead style={{ position: "sticky", top: 0, background: "var(--dk-surface, white)" }}>
                      <tr style={{ borderBottom: "1px solid var(--dk-line, #ECEDE7)", color: MUTED, textAlign: "right" }}>
                        <th style={{ textAlign: "left", padding: "8px 6px" }}>{tr("Produit", "Product")}</th>
                        <th style={{ textAlign: "left", padding: "8px 6px" }}>{tr("Famille", "Family")}</th>
                        <th style={{ padding: "8px 6px" }}>{tr("Présence (% tickets)", "Presence (% transactions)")}</th>
                        <th style={{ padding: "8px 6px" }}>{tr("Ventes / jour de vente", "Sales / selling day")}</th>
                        <th style={{ padding: "8px 6px" }}>{tr("Chiffre d'affaires", "Revenue")}</th>
                        <th style={{ textAlign: "left", padding: "8px 6px" }}>{tr("Catégorie stratégique", "Strategic category")}</th>
                        <th style={{ textAlign: "left", padding: "8px 6px" }}>{tr("Action", "Action")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r: any, i: number) => (
                        <tr key={i} style={{ borderBottom: "1px solid var(--dk-surface, #FCFCFA)" }}>
                          <td style={{ padding: "7px 6px", fontWeight: 700, color: INK }}><ProdName name={r.article} /></td>
                          <td style={{ padding: "7px 6px", color: MUTED }}>{trData(r.category)}</td>
                          <td style={{ padding: "7px 6px", textAlign: "right", color: INK }}>{fmt(r.penetration_rate, 1)} %</td>
                          <td style={{ padding: "7px 6px", textAlign: "right", color: INK }}>{fmt(r.daily_velocity, 1)}</td>
                          <td style={{ padding: "7px 6px", textAlign: "right", color: INK }}>{fmt(r.ca_total)} €</td>
                          <td style={{ padding: "7px 6px" }}>
                            <span style={{ fontSize: ".65rem", fontWeight: 800, padding: "2px 8px", borderRadius: 99, background: `color-mix(in srgb, ${colorOf(r.quadrant)} 12%, transparent)`, color: colorOf(r.quadrant) }}>
                              {tr(r.categorie_strategique, QUAD_EN[r.quadrant]?.label || r.categorie_strategique)}
                            </span>
                          </td>
                          <td style={{ padding: "7px 6px", color: "var(--dk-ink2, #4A524C)" }}>
                            {tr(r.action, QUAD_EN[r.quadrant]?.action || r.action)}
                            {r.alerte_horaire && (
                              <span style={{ marginLeft: 6, fontWeight: 800, color: ALERT }}>· {tr(r.alerte_horaire, r.alerte_horaire.replace("Remplir avant", "Restock before"))}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="cs" style={{ marginTop: 8 }}>
                  {(() => {
                    // Produits « de saison » : classés Niche et vendus sur peu de jours (moins d'un quart des jours du produit le plus régulier)
                    const maxJ = Math.max(...(matrixData.items || []).map((i: any) => i.jours_actifs || 0), 1);
                    const seas = (matrixData.items || [])
                      .filter((i: any) => i.quadrant === "Niche" && (i.jours_actifs || 0) < maxJ / 4)
                      .sort((a: any, b: any) => b.daily_velocity - a.daily_velocity)
                      .slice(0, 2).map((i: any) => i.article);
                    return seas.length
                      ? tr(`Les produits vendus seulement quelques jours dans l'année (ex. ${seas.join(", ")}) ont une vitesse élevée sur leurs jours de vente : ils ressortent en « Niche ». Les frontières suivent la règle du cahier des charges (moyennes de la boutique).`,
                           `Products sold only on a few days a year (e.g. ${seas.join(", ")}) sell fast on their selling days, so they appear as “Niche”. Boundaries follow the specification rule (shop averages).`)
                      : tr("Les frontières suivent la règle du cahier des charges (moyennes de la boutique).", "Boundaries follow the specification rule (shop averages).");
                  })()}
                </div>
                <ExpertNote>
                  Matrice de décision pénétration × vélocité (cahier des charges, composante 2 §4). penetration_rate = COUNT(DISTINCT (date_id, ticket_number)) avec le produit / tickets × 100 ; daily_velocity = Σ quantity / jours actifs du produit (SPPD) ; frontières = moyennes (pénétration {fmt(seuils.penetration_moyenne || 0, 2)} %, vélocité {fmt(seuils.vitesse_moyenne || 0, 2)}) ; alerte horaire si ratio_pic_percent ≥ {fmt(seuils.pic_horaire_pct || 40)} %. Critère phase 5 (pénétration &lt; 1 % et vélocité &lt; 1) : {fmt(matrixData.nb_dormant_strict || 0)} produit(s). API : /api/products/matrix.
                </ExpertNote>
              </div>
            </div>
            </Details>
            </div>
          </>
        );
      })()}

      {/* ══════════════════════════════════════════════
          TAB 1: PÉNÉTRATION
          ══════════════════════════════════════════════ */}
      {tab === "pen" && penData && !loading && (
        <>
          {/* Filters bar */}
          <div className="cc" style={{ margin: "0 28px 14px", padding: "16px 20px", borderRadius:"14px",
          background: "var(--dk-soft, #F5F6F1)",
          border:"1px solid var(--dk-line, rgba(140,160,140,.25))",
          boxShadow:"0 4px 16px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <IconFilter size={16} color={ORANGE} />
                <span style={{ fontSize: ".78rem", fontWeight: 800, color: INK }}>{tr("Filtres", "Filters")}</span>
              </div>
              {/* Search */}
              {/* La recherche produit est désormais en haut de la page, commune à tous les onglets */}
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
                    label={tr(c, trData(c))}
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
                    label={`${tr(s.replace(/ *\([^)]*\) */g, ""), trData(s.replace(/ *\([^)]*\) */g, "")))} (${fmt(penData.kpis?.status_counts_all?.[s] ?? 0)})`}
                  />
                ))}
              </div>
            </div>
          </div>

          {(penData.items || []).length === 0 && (
            <div className="cc" style={{ margin: "0 28px 14px", padding: "18px 20px", color: INK, fontSize: ".86rem" }}>
              {penStatuts.includes("Leader (Indispensable)") && penStatuts.length === 1
                ? tr("Aucun produit n'est présent dans au moins 50 % des tickets (statut « Leader »). Le produit le plus présent est classé « Cœur ».", "No product is in at least 50% of transactions (\"Leader\" status). The most present product is classed \"Core\".")
                : tr("Aucun produit ne correspond à ces filtres.", "No product matches these filters.")}
            </div>
          )}
          {(penData.items || []).length > 0 && (<>
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
                <div className="cs" style={{ marginTop: 4 }}>{(penCats.length || penStatuts.length || searchPen) ? tr("Correspondant aux filtres", "Matching the filters") : tr(`Vendues sur ${yearPen === "Toutes" ? periodLabel : yearPen}`, `Sold in ${yearPen === "Toutes" ? periodLabel : yearPen}`)}</div>
              </div>
              <div className="cc">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: `color-mix(in srgb, ${OK} 8%, transparent)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <IconTrendUp size={15} color={OK} />
                  </div>
                  <div style={{ fontSize: ".78rem", fontWeight: 700, color: INK }}>{tr("Produit le plus présent", "Most present product")}</div>
                </div>
                <div style={{ fontSize: "1.75rem", fontWeight: 800, color: OK, lineHeight: 1, marginTop: 10 }}>{Number(penData.kpis?.pen_max || 0).toFixed(0)}%</div>
                <div className="cs" style={{ marginTop: 4 }}>{tr(`${(penData.items || [])[0]?.article || ""} : part des tickets qui le contiennent`, `${(penData.items || [])[0]?.article || ""}: share of transactions that include it`)}</div>
              </div>
              <div className="cc">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: `color-mix(in srgb, ${PEACH} 13%, transparent)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <IconScale size={15} color={ORANGE} />
                  </div>
                  <div style={{ fontSize: ".78rem", fontWeight: 700, color: INK }}>{tr("Présence médiane", "Median presence")}</div>
                </div>
                <div style={{ fontSize: "1.75rem", fontWeight: 800, color: ORANGE, lineHeight: 1, marginTop: 10 }}>{Number(penData.kpis?.pen_median || 0).toFixed(1)}%</div>
                <div className="cs" style={{ marginTop: 4 }}>{tr("La moitié des produits sont dans moins de tickets", "Half of the products appear in fewer transactions")}</div>
              </div>
              <div className="cc">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: `color-mix(in srgb, ${WARN} 8%, transparent)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <IconTrophy size={15} color={WARN} />
                  </div>
                  <div style={{ fontSize: ".78rem", fontWeight: 700, color: INK }}>{tr("Leaders et produits cœur", "Leaders and core products")}</div>
                </div>
                <div style={{ fontSize: "1.75rem", fontWeight: 800, color: WARN, lineHeight: 1, marginTop: 10 }}>
                  {fmt((penData.kpis?.status_counts?.["Leader (Indispensable)"] || 0) + (penData.kpis?.status_counts?.["Produit Cœur (Core)"] || 0))}
                </div>
                <div className="cs" style={{ marginTop: 4 }}>{tr("Présents dans au moins 30 % des tickets", "In at least 30% of transactions")}</div>
              </div>
            </div>
          </div>

          {/* Row 1: Ranked bar + Scatter Pen × CA */}
          <div className="sec-title">
            <IconBar size={14} color={ORANGE} /> {tr("Présence × chiffre d'affaires", "Presence × revenue")}
          </div>
          <div className="sw">
            <div className="grid-main">
              <div className="cc hero-card">
                <ChartAssistantButton chartType="penetration_scatter_ca" chartData={{ items: penData.items?.slice(0, 120) || [], filters: { search: searchPen, categories: penCats, statuts: penStatuts, year: yearPen } }} chartName="PenetrationScatterCA"
                  userQuestion="Explique ce graphique de présence × chiffre d'affaires" position="top-right" onOpenChat={openChat} />
                <CardHeader
                  title={tr("Présence × Chiffre d'affaires : où investir ?", "Presence × Revenue: where to invest?")}
                  sub={tr("Chaque point est un produit. À droite : présent dans beaucoup de tickets ; en haut : rapporte beaucoup. Survolez un point pour ses chiffres.", "Each dot is a product. Right: in many transactions; top: high revenue. Hover a dot for its figures.")}
                  icon={<IconTarget size={16} color={ORANGE} />}
                />
<PresenceCaChart items={penData.items || []} height={500} />
                {(() => {
                  const it = penData.items || [];
                  if (!it.length) return null;
                  const topCa = [...it].sort((a: any, b: any) => b.ca_total - a.ca_total)[0];
                  const topPen = it[0];
                  const tot = it.reduce((a: number, x: any) => a + (x.ca_total || 0), 0) || 1;
                  const med = [...it].map((x: any) => x.penetration_rate).sort((a: number, b: number) => a - b)[Math.floor(it.length / 2)];
                  const caCut = [...it].map((x: any) => x.ca_total).sort((a: number, b: number) => b - a)[Math.max(0, Math.floor(it.length * 0.2) - 1)];
                  const occ = it.filter((x: any) => x.penetration_rate < med && x.ca_total >= caCut).slice(0, 2).map((x: any) => x.article);
                  const part = fmt((topCa.ca_total / tot) * 100, 0);
                  const fr = topCa.article === topPen.article
                    ? `${topCa.article} est à la fois le plus présent et celui qui rapporte le plus (${part} % du chiffre d'affaires affiché).`
                    : `Le plus présent est ${topPen.article} (${fmt(topPen.penetration_rate, 1)} % des tickets) ; celui qui rapporte le plus est ${topCa.article} (${part} % du chiffre d'affaires affiché).`;
                  const en = topCa.article === topPen.article
                    ? `${topCa.article} is both the most present product and the top earner (${part}% of the revenue shown).`
                    : `The most present is ${topPen.article} (${fmt(topPen.penetration_rate, 1)}% of transactions); the top earner is ${topCa.article} (${part}% of the revenue shown).`;
                  return (
                    <Takeaway>
                      {tr(
                        fr + (occ.length ? ` ${occ.join(" et ")} : peu de tickets mais un chiffre d'affaires élevé, ce sont des achats d'occasion ou à prix élevé.` : ""),
                        en + (occ.length ? ` ${occ.join(" and ")}: few transactions but high revenue — occasional or high-price purchases.` : "")
                      )}
                    </Takeaway>
                  );
                })()}
              </div>
              <div className="side-col">
              <div className="cc">
                <ChartAssistantButton chartType="penetration_ranking" chartData={{ items: penData.items, filters: { search: searchPen, categories: penCats, statuts: penStatuts, year: yearPen } }} chartName="PenetrationRanking"
                  userQuestion="Explique le classement selon le taux de pénétration" position="top-right" onOpenChat={openChat} />
                <CardHeader
                  title={tr("Produits les plus présents dans les tickets", "Products most present in transactions")}
                  sub={tr("Les 8 références les plus présentes · cliquez pour la fiche", "The 8 most present products · click for the sheet")}
                  icon={<IconTarget size={16} color={ORANGE} />}
                />
                <RankedRows
                  rows={penData.items || []}
                  valueKey="penetration_rate"
                  subKey="category"
                  colorKey={(r, i) => pctColor(Number(r.penetration_rate) || 0)}
                  maxShow={8}
                  unit="%"
                />
                {(penData.items || []).length > 1 && (
                  <Takeaway>
                    {tr(
                      `${(penData.items || [])[0].article} est dans ${fmt((penData.items || [])[0].penetration_rate, 1)} % des tickets (environ 1 client sur ${fmt(100 / Math.max((penData.items || [])[0].penetration_rate, 0.01), 0)}), ${(penData.items || [])[0].penetration_rate >= 2 * (penData.items || [])[1].penetration_rate ? "loin devant" : "devant"} ${(penData.items || [])[1].article} (${fmt((penData.items || [])[1].penetration_rate, 1)} %).${(penData.items || [])[0].penetration_rate >= 30 ? " Une rupture sur ce produit toucherait une grande partie des clients." : ""}`,
                      `${(penData.items || [])[0].article} is in ${fmt((penData.items || [])[0].penetration_rate, 1)}% of transactions (about 1 customer in ${fmt(100 / Math.max((penData.items || [])[0].penetration_rate, 0.01), 0)}), ${(penData.items || [])[0].penetration_rate >= 2 * (penData.items || [])[1].penetration_rate ? "far ahead of" : "ahead of"} ${(penData.items || [])[1].article} (${fmt((penData.items || [])[1].penetration_rate, 1)}%).${(penData.items || [])[0].penetration_rate >= 30 ? " A stock-out on it would affect a large share of customers." : ""}`
                    )}
                  </Takeaway>
                )}
                <ExpertNote>
                  Taux de pénétration (penetration_rate) = tickets contenant le produit / tickets uniques × 100, ticket = (date_id, ticket_number), dédoublonnage intra-ticket. Statuts (config.py, cahier) : ≥ 50 % Leader, ≥ 30 % Cœur, ≥ 10 % Régulier, sinon Niche. indice_categorie = taux / moyenne des taux de la catégorie (normalisation par catégorie, §7). API : /api/products/penetration.
                </ExpertNote>
              </div>
                <RetainCard max={3} />
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
                        {!isSearchActive && penStatuts.length === 0 && (
                          <div className="cc">
                            <ChartAssistantButton chartType="penetration_status_distribution" chartData={{ status_counts: penData.kpis?.status_counts, filters: { search: searchPen, categories: penCats, statuts: penStatuts, year: yearPen } }} chartName="PenetrationStatusDistribution"
                              userQuestion="Explique la répartition des produits par statut" position="top-right" onOpenChat={openChat} />
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
                            {(() => {
                              const sc: Record<string, number> = penData.kpis?.status_counts || {};
                              const tot = Object.values(sc).reduce((a, b) => a + Number(b), 0) || 1;
                              const niche = Number(sc["Niche / À surveiller"] || 0);
                              return (
                                <Takeaway>
                                  {tr(
                                    `${fmt(niche)} produits sur ${fmt(tot)} sont dans moins de 10 % des tickets (seuil « Niche » du cahier des charges).${!penData.kpis?.status_counts_all?.["Leader (Indispensable)"] ? " Aucun produit n'atteint 50 % des tickets (« Leader »)." : ""}`,
                                    `${fmt(niche)} of ${fmt(tot)} products appear in under 10% of transactions ("Niche" threshold of the specification).${!penData.kpis?.status_counts_all?.["Leader (Indispensable)"] ? " No product reaches 50% of transactions (\"Leader\")." : ""}`
                                  )}
                                </Takeaway>
                              );
                            })()}
                          </div>
                        )}
                        <div className="cc" style={{ gridColumn: isSearchActive || penStatuts.length > 0 ? "1 / -1" : undefined }}>
                          <ChartAssistantButton chartType="penetration_weekly_trend" chartData={{ weekly_trend: penData.weekly_trend, filters: { search: searchPen, categories: penCats, statuts: penStatuts, year: yearPen } }} chartName="PenetrationWeeklyTrend"
                            userQuestion="Explique l'évolution hebdomadaire du taux de pénétration" position="top-right" onOpenChat={openChat} />
                          <CardHeader
                            title={tr("Présence dans les tickets, semaine par semaine", "Presence in transactions, week by week")}
                            sub={isFiltered ? tr("Les 5 produits les plus présents de toute la boutique (filtres non appliqués). Survolez un point pour la valeur exacte.", "The shop's 5 most present products (filters not applied). Hover a point for the exact value.") : tr("Les 5 produits les plus présents. Survolez un point pour voir la date et la valeur exacte.", "The 5 most present products. Hover over a point to see the date and exact value.")}
                            icon={<IconSparkline size={16} color={ORANGE} />}
                          />
                          <MultiLineChart series={penData.weekly_trend || []} height={310} />
                          {(() => {
                            const w = (penData.weekly_trend || [])[0];
                            if (!w?.series?.length) return null;
                            const ser = w.series;
                            const avg = (arr: any[]) => arr.reduce((a: number, x: any) => a + x.rate, 0) / Math.max(arr.length, 1);
                            const first = avg(ser.slice(0, 8)), last = avg(ser.slice(-8, -1).length ? ser.slice(-8, -1) : ser.slice(-8));
                            return (
                              <Takeaway>
                                {tr(
                                  `${w.article} : ${fmt(first, 0)} % des tickets au début de la période, ${fmt(last, 0)} % sur les dernières semaines.${last < first * 0.7 ? " Baisse marquée : vérifier avec la boutique si les dernières données sont complètes." : last > first * 1.3 ? " Nette progression sur la période." : " Présence stable sur la période."}`,
                                  `${w.article}: ${fmt(first, 0)}% of transactions at the start of the period, ${fmt(last, 0)}% over the last weeks.${last < first * 0.7 ? " Sharp drop: check with the shop that the latest data is complete." : last > first * 1.3 ? " Clear increase over the period." : " Stable presence over the period."}`
                                )}
                              </Takeaway>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Row 3: Catégories pénétration moyenne + Part CA par catégorie — seulement si > 2 catégories disponibles */}
                {!isSearchActive && (penData.category_summary || []).length >= 2 && (
                  <div className="sw">
                    <Details label={tr("Voir le détail : présence et chiffre d'affaires par famille", "See details: presence and revenue by family")}>
                    <div>
                      <div className="g2">
                        <div className="cc">
                          <ChartAssistantButton chartType="penetration_category_avg" chartData={{ category_summary: penData.category_summary, filters: { search: searchPen, categories: penCats, statuts: penStatuts, year: yearPen } }} chartName="PenetrationCategoryAvg"
                            userQuestion="Explique le taux de pénétration moyen par catégorie" position="top-right" onOpenChat={openChat} />
                          <CardHeader
                            title={tr("Présence de chaque famille dans les tickets", "Presence of each family in transactions")}
                            sub={(penCats.length || penStatuts.length) ? tr("Toute la boutique (filtres non appliqués) : part des tickets avec au moins un produit de la famille", "Whole shop (filters not applied): share of transactions with at least one product of the family") : tr("Part des tickets contenant au moins un produit de la famille", "Share of transactions with at least one product of the family")}
                            icon={<IconBox size={16} color={ORANGE} />}
                          />
                          <CategoryBars cats={(penData.category_summary || []).map((c: any) => ({ category: c.category, taux_moyen: c.taux_categorie ?? c.taux_moyen, nb_articles: c.nb_articles }))} height={260} />
                          {(penData.category_summary || [])[0] && (
                            <Takeaway>
                              {tr(
                                `${penData.category_summary[0].category} est la famille la plus présente : ${fmt(penData.category_summary[0].taux_categorie, 0)} % des tickets, soit ${penData.category_summary[0].taux_categorie >= 50 ? "plus d'un client sur deux" : `environ 1 client sur ${fmt(100 / Math.max(penData.category_summary[0].taux_categorie, 0.01), 0)}`}.`,
                                `${trData(penData.category_summary[0].category)} is the most present family: ${fmt(penData.category_summary[0].taux_categorie, 0)}% of transactions, i.e. ${penData.category_summary[0].taux_categorie >= 50 ? "more than one customer in two" : `about 1 customer in ${fmt(100 / Math.max(penData.category_summary[0].taux_categorie, 0.01), 0)}`}.`
                              )}
                            </Takeaway>
                          )}
                        </div>
                        <div className="cc">
                          <ChartAssistantButton chartType="category_revenue_share" chartData={{ category_summary: penData.category_summary }} chartName="CategoryRevenueShare"
                            userQuestion="Explique la part du chiffre d'affaires par catégorie" position="top-right" onOpenChat={openChat} />
                          <CardHeader
                            title={tr("Part du chiffre d'affaires par catégorie", "Share of revenue by category")}
                            sub={(penCats.length || penStatuts.length) ? tr("Toute la boutique (filtres non appliqués)", "Whole shop (filters not applied)") : tr("Pourcentage du chiffre d'affaires total", "Percentage of total revenue")}
                            icon={<IconBox size={16} color={ORANGE} />}
                          />
                          <CategoryBars cats={(() => {
                            const rows = penData.category_summary || [];
                            const tot = rows.reduce((a: number, c: any) => a + Number(c.ca_total || 0), 0) || 1;
                            return rows
                              .map((c: any) => ({ category: c.category, taux_moyen: (Number(c.ca_total || 0) / tot) * 100, nb_articles: c.nb_articles }))
                              .sort((a: any, b: any) => b.taux_moyen - a.taux_moyen);
                          })()} height={260} />
                          {(() => {
                            const rows = [...(penData.category_summary || [])].sort((a: any, b: any) => b.ca_total - a.ca_total);
                            const tot = rows.reduce((a: number, c: any) => a + Number(c.ca_total || 0), 0) || 1;
                            if (rows.length < 2) return null;
                            return (
                              <Takeaway>
                                {tr(
                                  `${rows[0].category} fait ${fmt((rows[0].ca_total / tot) * 100, 0)} % du chiffre d'affaires ; ${rows[1].category} en fait ${fmt((rows[1].ca_total / tot) * 100, 0)} % avec beaucoup moins de tickets.`,
                                  `${trData(rows[0].category)} makes ${fmt((rows[0].ca_total / tot) * 100, 0)}% of revenue; ${trData(rows[1].category)} makes ${fmt((rows[1].ca_total / tot) * 100, 0)}% with far fewer transactions.`
                                )}
                              </Takeaway>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                    </Details>
                  </div>
                )}
              </>
            );
          })()}

          {/* Row 4: Zoom produit sélectionné + Recommandations (replié) */}
          <div className="sw">
            <Details label={tr("Voir le détail : évolution d'un produit et que faire selon la présence", "See details: one product's trend and what to do by presence")}>
            <div className="g2">
              <div className="cc">
                <ChartAssistantButton chartType="penetration_product_trend" chartData={{ items: penData.items, selected: penSelected, weekly_trend: (penData.weekly_trend || []).filter((w: any) => w.article === penSelected) }} chartName="PenetrationProductTrend"
                  userQuestion="Explique l'évolution de pénétration du produit sélectionné" position="top-right" onOpenChat={openChat} />
                <CardHeader
                  title={tr("Évolution de la présence — produit sélectionné", "Presence trend — selected product")}
                  sub={tr("Choisissez un produit ci-dessous pour voir son évolution", "Pick a product below to see its trend")}
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
                        borderColor: penSelected === p.article ? ORANGE : "var(--dk-line, #E2E5DD)",
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
                  <div style={{ padding: 14, borderRadius: 12, background: "var(--dk-soft, #F7F8F4)" }}>
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
                            <div className="cs" style={{ padding: "10px 0" }}>
                              {tr("La tendance hebdomadaire est calculée pour les 5 produits les plus présents.", "The weekly trend is computed for the 5 most present products.")}
                            </div>
                          )}
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--dk-line, #F1F1EC)" }}>
                            <div><div className="cs">{tr("Présence", "Presence")}</div><div style={{ fontWeight: 800, color: ORANGE }}>{Number(p?.penetration_rate || 0).toFixed(1)}%</div></div>
                            <div><div className="cs">{tr("Tickets", "Transactions")}</div><div style={{ fontWeight: 800, color: INK }}>{fmt(p?.tickets_count)}</div></div>
                            <div><div className="cs">{tr("CA total", "Total revenue")}</div><div style={{ fontWeight: 800, color: INK }}>{fmt(p?.ca_total)} €</div></div>
                            <div title={tr("Taux du produit / taux moyen de sa catégorie", "Product rate / category average rate")}><div className="cs">{tr("Indice famille", "Family index")}</div><div style={{ fontWeight: 800, color: INK }}>{Number(p?.indice_categorie || 0).toFixed(1)}×</div></div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
              <div className="cc">
                <ChartAssistantButton chartType="penetration_recommendations" chartData={{ kpis: penData.kpis, status_counts: penData.kpis?.status_counts, filters: { search: searchPen, categories: penCats, statuts: penStatuts, year: yearPen } }} chartName="PenetrationRecommendations"
                  userQuestion="Explique les recommandations basées sur la pénétration" position="top-right" onOpenChat={openChat} />
                <CardHeader
                  title={tr("Que faire selon la présence dans les tickets", "What to do based on presence in transactions")}
                  sub={tr("Actions opérationnelles suggérées", "Suggested operational actions")}
                  icon={<IconSparkles size={16} color={ORANGE} />}
                />
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
                  {[
                    { title: tr("Protéger les leaders et produits cœur", "Protect the leaders and core products"), desc: tr(`${fmt((penData.kpis?.status_counts?.["Leader (Indispensable)"] || 0) + (penData.kpis?.status_counts?.["Produit Cœur (Core)"] || 0))} référence(s) dans au moins 30 % des tickets — stock de sécurité renforcé, zéro rupture, pas de remise sans raison`, `${fmt((penData.kpis?.status_counts?.["Leader (Indispensable)"] || 0) + (penData.kpis?.status_counts?.["Produit Cœur (Core)"] || 0))} product(s) in at least 30% of transactions — higher safety stock, no stock-outs, no discounts without reason`), color: ORANGE, Icon: IconStar },
                    { title: tr("Rendre visibles les produits réguliers", "Make the regular products visible"), desc: tr(`${fmt(penData.kpis?.status_counts?.["Produit Régulier"] || 0)} référence(s) entre 10 et 30 % des tickets — emplacement visible en caisse ou en vitrine`, `${fmt(penData.kpis?.status_counts?.["Produit Régulier"] || 0)} product(s) in 10–30% of transactions — visible spot at the till or in the window`), color: PEACH, Icon: IconTrendUp },
                    { title: tr("Évaluer les produits de niche", "Review the niche products"), desc: tr(`${fmt(penData.kpis?.status_counts?.["Niche / À surveiller"] || 0)} référence(s) sous 10 % des tickets — à croiser avec la vitesse de vente avant toute décision`, `${fmt(penData.kpis?.status_counts?.["Niche / À surveiller"] || 0)} product(s) below 10% of transactions — check sales velocity before any decision`), color: LIGHT, Icon: IconSearchCircle },
                    { title: tr("Comparer dans chaque famille", "Compare within each family"), desc: tr("L'indice famille compare chaque produit à la moyenne de sa catégorie (cahier des charges, normalisation par catégorie)", "The family index compares each product with its category average (specification, category normalisation)"), color: MUTED, Icon: IconAlert },
                  ].map((r, i) => {
                    const RIcon = r.Icon;
                    return (
                      <div key={i} style={{ display: "flex", gap: 10, padding: 10, borderRadius: 10, background: `color-mix(in srgb, ${r.color} 8%, transparent)`, borderLeft: `3px solid ${r.color}` }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, flexShrink: 0, marginTop: 1 }}>
                          <RIcon size={16} color={r.color} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: ".78rem", fontWeight: 800, color: INK, marginBottom: 2 }}>{r.title}</div>
                          <div style={{ fontSize: ".68rem", color: "var(--dk-ink2, #4A524C)", lineHeight: 1.35 }}>{r.desc}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            </Details>
          </div>
          </>)}
        </>
      )}

      {/* ══════════════════════════════════════════════
          TAB 2: VITESSE DE VENTE
          ══════════════════════════════════════════════ */}
      {tab === "vel" && velData && !loading && (
        <>
          <div className="sec-title">
            <IconBolt size={14} color={ORANGE} /> {tr("Quand les produits partent", "When products sell")}
          </div>
          <div className="sw">
            <div className="grid-2 stretch">
              <div className="cc hero-card">
                <ChartAssistantButton chartType="velocity_dow" chartData={{ dow_velocity: velData.dow_velocity }} chartName="VelocityDOW"
                  userQuestion="Explique la vitesse de vente par jour de la semaine" position="top-right" onOpenChat={openChat} />
                <CardHeader
                  title={tr("Articles vendus selon le jour de la semaine", "Items sold by day of the week")}
                  sub={tr("Moyenne par jour d'ouverture", "Average per opening day")}
                  icon={<IconCalendarDays size={16} color={ORANGE} />}
                />
                <DowGroupedBars rows={velData.dow_velocity || []} />
                {(() => {
                  const d = velData.dow_velocity || [];
                  if (!d.length) return null;
                  const best = d.reduce((m: any, x: any) => (x.all > m.all ? x : m), d[0]);
                  const ratio = best.touristic ? best.touristic / best.all : null;
                  return (
                    <Takeaway>
                      {tr(
                        `${best.day} est le jour le plus chargé (${fmt(best.all)} articles en moyenne)${ratio ? ` ; en saison touristique, il monte à ${fmt(best.touristic)} articles (× ${fmt(ratio, 1)})` : ""}. Adapter les fournées au jour et à la saison.`,
                        `${trData(best.day)} is the busiest day (${fmt(best.all)} items on average)${ratio ? `; in the tourist season it rises to ${fmt(best.touristic)} items (× ${fmt(ratio, 1)})` : ""}. Adjust batches to the day and the season.`
                      )}
                    </Takeaway>
                  );
                })()}
                <ExpertNote>
                  Macro-vélocité (dow_velocity) = moyenne des Σ quantity par jour d'ouverture, par day_of_week ; touristic = jours dim_dates.is_touristic ; event = jours avec dim_events.is_event. Micro-vélocité : pic horaire par produit, ratio_pic_percent = quantité à l'heure de pointe / quantité totale ; alerte si ≥ 40 % (PIC_HORAIRE_SEUIL_PCT). stock_securite et ratios saison/événement par produit : table product_velocity_stats (notebook).
                </ExpertNote>
                <div className="cs" style={{ marginTop: 6 }}>{tr("Articles vendus en moyenne par jour d'ouverture.", "Average items sold per opening day.")}</div>
              </div>
              <div className="cc">
                <ChartAssistantButton chartType="velocity_hourly_distribution" chartData={{ hourly_distribution: velData.hourly_distribution }} chartName="VelocityHourlyDistribution"
                  userQuestion="Explique la distribution horaire de la vitesse" position="top-right" onOpenChat={openChat} />
                <CardHeader
                  title={tr("Articles vendus à chaque heure", "Items sold at each hour")}
                  sub={tr(`Total sur ${periodLabel}, toutes les journées`, `Total over ${periodLabel}, all days`)}
                  icon={<IconBar size={16} color={ORANGE} />}
                />
                <SimpleBar rows={velData.hourly_distribution || []} labelKey="heure_label" valueKey="global_qte_per_hour" unit={tr("u.", "u.")} color={PEACH} height={200} />
                {(() => {
                  const h = velData.hourly_distribution || [];
                  if (!h.length) return null;
                  const pk = h.reduce((m: any, x: any) => (x.global_qte_per_hour > m.global_qte_per_hour ? x : m), h[0]);
                  return (
                    <Takeaway>
                      {tr(`Le plus d'articles partent à ${pk.heure_label} : les rayons doivent être pleins avant cette heure.`, `Most items sell at ${pk.heure_label}: shelves must be full before then.`)}
                    </Takeaway>
                  );
                })()}
              </div>
            </div>
          </div>

          <div className="sec-title">
            <IconAlert size={14} color={ORANGE} /> {tr("Remplissage des rayons", "Shelf restocking")}
          </div>
          <div className="sw">
            <div className="grid-main">
              <div className="cc">
                <ChartAssistantButton chartType="velocity_hourly_concentration" chartData={{ macro_items: velItems, seuil_pic_horaire_pct: velData.seuil_pic_horaire_pct }} chartName="VelocityHourlyConcentration"
                  userQuestion="Explique les produits concentrés sur une plage horaire" position="top-right" onOpenChat={openChat} />
                <CardHeader
                  title={tr("Produits fortement concentrés sur une plage horaire", "Products heavily concentrated in one time slot")}
                  sub={tr(`Heure de pointe ≥ ${velData.seuil_pic_horaire_pct ?? 40} % des ventes du produit (cahier des charges)`, `Peak hour ≥ ${velData.seuil_pic_horaire_pct ?? 40}% of the product's sales (specification)`)}
                  icon={<IconAlert size={16} color={ALERT} />}
                />
                {(() => {
                  const conc = velItems
                    .filter((p: any) => p.alerte_replissage_avant)
                    .sort((a: any, b: any) => (b.ratio_pic_percent || 0) - (a.ratio_pic_percent || 0))
                    .slice(0, 6);
                  if (!conc.length) {
                    return <div className="cs" style={{ marginTop: 10 }}>{tr("Aucun produit ne concentre autant ses ventes sur une seule heure.", "No product concentrates its sales this much in a single hour.")}</div>;
                  }
                  return (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginTop: 8 }}>
                      {conc.map((p: any, i: number) => (
                        <div key={i} style={{ padding: 10, borderRadius: 10, background: `rgba(192,80,44,0.08)`, border: "1px solid rgba(192,80,44,0.25)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                            <div className="pdot" style={{ background: ALERT }} />
                            <span style={{ fontSize: ".74rem", fontWeight: 800, color: INK }}><ProdName name={p.article} /></span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".68rem", color: MUTED }}>
                            <span>{tr("Pic", "Peak")} {String(p.peak_hour).padStart(2, "0")}h · {fmt(p.ratio_pic_percent)} %</span>
                            <span style={{ fontWeight: 700, color: ALERT }}>{tr("remplir avant", "restock before")} {p.alerte_replissage_avant}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
              <div className="side-col"><RetainCard max={3} /></div>
            </div>
            <Details label={tr("Voir le détail : vitesse et heure de pointe de chaque produit", "See details: velocity and peak hour of each product")}>
              <div className="cc">
                <ChartAssistantButton chartType="velocity_hourly_monitoring" chartData={{ macro_items: velItems }} chartName="VelocityHourlyMonitoring"
                  userQuestion="Explique le tableau de surveillance horaire" position="top-right" onOpenChat={openChat} />
                <CardHeader
                  title={tr("Vitesse et heure de pointe par produit", "Velocity and peak hour by product")}
                  sub={tr("Les 12 produits les plus vendus par jour", "The 12 best-selling products per day")}
                  icon={<IconScale size={16} color={ORANGE} />}
                />
                <div style={{ marginTop: 8, overflow: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".72rem" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--dk-line, #ECEDE7)", color: MUTED, textAlign: "right" }}>
                        <th style={{ textAlign: "left", padding: "8px 4px", fontSize: ".65rem" }}>{tr("Produit", "Product")}</th>
                        <th style={{ padding: "8px 4px", fontSize: ".65rem" }}>{tr("Ventes / jour", "Sales / day")}</th>
                        <th style={{ padding: "8px 4px", fontSize: ".65rem" }}>{tr("Stock de sécurité", "Safety stock")}</th>
                        <th style={{ padding: "8px 4px", fontSize: ".65rem" }}>{tr("Heure de pointe", "Peak hour")}</th>
                        <th style={{ padding: "8px 4px", fontSize: ".65rem" }}>{tr("Part du pic", "Peak share")}</th>
                        <th style={{ padding: "8px 4px", fontSize: ".65rem" }}>{tr("Action", "Action")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {velItems.slice(0, 12).map((p: any, i: number) => {
                        const alerte = !!p.alerte_replissage_avant;
                        return (
                          <tr key={i} style={{ borderBottom: "1px solid var(--dk-surface, #FCFCFA)" }}>
                            <td style={{ padding: "8px 4px", fontWeight: 700, color: INK }}><ProdName name={p.article} /></td>
                            <td style={{ padding: "8px 4px", textAlign: "right", fontWeight: 600, color: INK }}>{fmt(p.daily_velocity, 1)}</td>
                            <td style={{ padding: "8px 4px", textAlign: "right", color: INK }}>{fmt(p.stock_securite, 0)}</td>
                            <td style={{ padding: "8px 4px", textAlign: "right", color: INK }}>{p.peak_hour != null ? `${String(p.peak_hour).padStart(2, "0")}h` : "—"}</td>
                            <td style={{ padding: "8px 4px", textAlign: "right", color: INK }}>{fmt(p.ratio_pic_percent)} %</td>
                            <td style={{ padding: "8px 4px", textAlign: "right" }}>
                              <span style={{ fontSize: ".62rem", fontWeight: 800, padding: "2px 7px", borderRadius: 99, background: `color-mix(in srgb, ${alerte ? ALERT : OK} 8%, transparent)`, color: alerte ? ALERT : OK }}>
                                {alerte ? tr(`Remplir avant ${p.alerte_replissage_avant}`, `Restock before ${p.alerte_replissage_avant}`) : tr("Flux stable", "Steady flow")}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </Details>
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
                  <div style={{ fontSize: ".78rem", fontWeight: 700, color: INK }}>{tr("Tickets à plusieurs produits", "Transactions with several products")}</div>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 10 }}>
                  <div style={{ fontSize: "1.9rem", fontWeight: 800, color: ORANGE, lineHeight: 1 }}>{fmt(ticketData.stats?.nb_multi)}</div>
                  <div style={{ fontSize: ".85rem", fontWeight: 700, color: MUTED }}>
                    ({Number(ticketData.stats?.pct_multi || 0).toFixed(1)}%)
                  </div>
                </div>
                <div className="cs" style={{ marginTop: 4 }}>{tr("Le client a pris au moins deux produits différents", "The customer bought at least two different products")}</div>
              </div>
              <div className="cc">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: "var(--dk-page, #F1F1EC)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <IconBox size={15} color={MUTED} />
                  </div>
                  <div style={{ fontSize: ".78rem", fontWeight: 700, color: INK }}>{tr("Tickets à un seul produit", "Single-product transactions")}</div>
                </div>
                <div style={{ fontSize: "1.9rem", fontWeight: 800, color: INK, lineHeight: 1, marginTop: 10 }}>{fmt(ticketData.stats?.nb_mono)}</div>
                <div className="cs" style={{ marginTop: 4 }}>{tr("Une ou plusieurs unités d'un seul produit", "One or more units of a single product")}</div>
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
            <div className="grid-main">
              <div className="cc hero-card">
                <ChartAssistantButton chartType="ticket_contribution_top20" chartData={{ top20: ticketTop, stats: ticketData.stats }} chartName="TicketContributionTop20"
                  userQuestion="Explique les produits qui contribuent le plus au ticket" position="top-right" onOpenChat={openChat} />
                <CardHeader
                  title={tr("Rôle de chaque produit dans le panier", "Each product's role in the basket")}
                  sub={tr("Tickets à plusieurs produits : part habituelle du produit dans la valeur du ticket, fréquence et chiffre d'affaires. Cliquez sur un nom pour la fiche.", "Multi-product transactions: the product's typical share of basket value, frequency and revenue. Click a name for the sheet.")}
                  icon={<IconTrophy size={16} color={WARN} />}
                />
                <ContributionRows rows={ticketAll} />
                {ticketTop[0] && (
                  <Takeaway>
                    {tr(
                      `Quand il est acheté avec d'autres produits, ${ticketTop[0].article} représente habituellement ${fmt(ticketTop[0].contribution_med, 0)} % du ticket : c'est un produit qui fait le panier.`,
                      `When bought with other products, ${ticketTop[0].article} usually makes ${fmt(ticketTop[0].contribution_med, 0)}% of the basket: it drives the basket value.`
                    )}
                  </Takeaway>
                )}
                {(() => {
                  const t = ticketTop;
                  if (!t.length) return null;
                  const f = [...t].sort((a: any, b: any) => b.nb_tickets_multi - a.nb_tickets_multi)[0];
                  return (
                    <Takeaway>
                      {tr(
                        `${f.article} est le produit le plus souvent présent dans les paniers à plusieurs produits (${fmt(f.nb_tickets_multi)} tickets) : le bon point de départ pour une offre groupée.`,
                        `${f.article} is the product most often in multi-product baskets (${fmt(f.nb_tickets_multi)} transactions): the right starting point for a bundle.`
                      )}
                    </Takeaway>
                  );
                })()}
                <ExpertNote>
                  Ticket contribution = total_revenue de la ligne / total du ticket × 100, sur les tickets à ≥ 2 produits distincts (clé date_id + ticket_number) ; contribution_med = PERCENTILE_CONT(0.5) ; produits avec ≥ 10 tickets. Rôle : « Générateur de chiffre » si médiane ≥ 50 % (CONTRIBUTION_GENERATEUR_SEUIL_PCT), sinon « Accessoire ». ca_total_multi = CA du produit dans les tickets multi-produits.
                </ExpertNote>
              </div>
              <div className="side-col">
                {(() => {
                  const dist = ticketData.stats?.distribution_par_statut || {};
                  const roles = [
                    { k: "Générateur de chiffre", en: "Revenue driver", d: tr("au moins 50 % du ticket quand il est acheté avec d'autres produits", "at least 50% of the basket when bought with other products"), c: "#2E7D4F" },
                    { k: "Accessoire", en: "Accessory", d: tr("moins de 50 % du ticket : il accompagne un autre achat", "under 50% of the basket: it goes with another purchase"), c: "#8DC05A" },
                  ];
                  return (
                    <div className="cc">
                      <ChartAssistantButton chartType="ticket_role_distribution" chartData={{ distribution: ticketData.stats?.distribution_par_statut, nb_produits: ticketData.stats?.nb_produits_analysables }} chartName="TicketRoles"
                        userQuestion="Explique la répartition des produits entre les deux rôles dans le panier" position="top-right" onOpenChat={openChat} />
                      <div className="ct">{tr("Deux rôles dans le panier", "Two roles in the basket")}</div>
                      <div className="cs">{tr(`Sur les ${fmt(ticketData.stats?.nb_produits_analysables || ticketAll.length)} produits présents dans au moins 10 tickets à plusieurs produits (règle du cahier des charges)`, `Out of the ${fmt(ticketData.stats?.nb_produits_analysables || ticketAll.length)} products in at least 10 multi-product transactions (specification rule)`)}</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {roles.map((r) => (
                          <div key={r.k} style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 12px", borderRadius: 14, background: "var(--dk-soft)" }}>
                            <span className="num" style={{ fontSize: "1.6rem", fontWeight: 800, color: r.c, minWidth: 40, textAlign: "center" }}>{fmt(dist[r.k]?.nb || 0)}</span>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: ".84rem", fontWeight: 700, color: INK }}>{tr(r.k, r.en)}</div>
                              <div style={{ fontSize: ".72rem", color: MUTED, lineHeight: 1.4 }}>{r.d}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
                <RetainCard max={3} />
              </div>
            </div>
          </div>

          {/* Sections « Stratégie & Synthèse » (donut des rôles, tuiles) et « Matrice de décision » (nuage illisible, doublon du précédent) retirées. */}

        </>
      )}

      {/* ══════════════════════════════════════════════
          TAB 4: FRÉQUENCE D'ACHAT
          ══════════════════════════════════════════════ */}
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
                <div style={{ fontSize: "1.9rem", fontWeight: 800, color: INK, lineHeight: 1, marginTop: 10 }}>{fmt(freqData.total_sem)}</div>
                <div className="cs" style={{ marginTop: 4 }}>{tr("Semaines couvertes par les ventes", "Weeks covered by sales")}</div>
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
                <div className="cs" style={{ marginTop: 4 }}>{tr(`Vendus toutes les semaines · ${fmt(freqData.part_ca_quotidiens || 0, 1)} % du CA`, `Sold every week · ${fmt(freqData.part_ca_quotidiens || 0, 1)}% of revenue`)}</div>
              </div>
            </div>
          </div>

          <div className="sec-title">
            <IconRepeat size={14} color={ORANGE} /> {tr("Régularité et classes", "Regularity and classes")}
          </div>
          <div className="sw">
            <div className="g2">
              <div className="cc">
                <CardHeader
                  title={tr("Produits vendus le plus régulièrement", "Most regularly sold products")}
                  sub={tr("Top 20 : part des semaines avec au moins une vente", "Top 20: share of weeks with at least one sale")}
                  icon={<IconTrophy size={16} color={ORANGE} />}
                />
                <RankedRows
                  rows={freqItems}
                  valueKey="repurchase_freq_pct"
                  colorKey={(r) => statutColor(r.statut_frequence)}
                  maxShow={20}
                  unit="%"
                />
                <Takeaway>
                  {tr(
                    `${fmt(freqData.nb_quotidiens || 0)} produits se vendent toutes les semaines sans exception et font ${fmt(freqData.part_ca_quotidiens || 0, 0)} % du chiffre d'affaires : ce sont les produits à ne jamais manquer.`,
                    `${fmt(freqData.nb_quotidiens || 0)} products sell every single week and make ${fmt(freqData.part_ca_quotidiens || 0, 0)}% of revenue: these must never run out.`
                  )}
                </Takeaway>
                <ExpertNote>
                  Repurchase frequency (repurchase_freq_pct) = semaines ISO avec vente (week_iso, année incluse) / semaines de la période des ventes × 100 ({fmt(freqData.total_sem || 0)} semaines). Classes : 100 % Quotidien, ≥ 75 % Régulier, ≥ 50 % Cyclique, sinon Sporadique. Fidélité du marché envers le produit, sans identifiant client.
                </ExpertNote>
              </div>
              <div className="cc">
                <CardHeader
                  title={tr("Répartition des produits selon leur régularité de vente", "Products by sales regularity")}
                  sub={tr("Classes de régularité", "Regularity classes")}
                  icon={<IconDonutPie size={16} color={ORANGE} />}
                />
                <CategoryBars
                  cats={(() => {
                    const sc: Record<string, number> = freqData.status_distribution || {};
                    const tot = Object.values(sc).reduce((x, y) => x + Number(y), 0) || 1;
                    return ["Quotidien", "Regulier", "Cyclique", "Sporadique"]
                      .filter((k) => sc[k] != null)
                      .map((k) => ({ category: k, taux_moyen: (Number(sc[k]) / tot) * 100, nb_articles: Number(sc[k]) }));
                  })()}
                  height={250}
                />
                {(() => {
                  const sc: Record<string, number> = freqData.status_distribution || {};
                  const tot = Object.values(sc).reduce((a, b) => a + Number(b), 0) || 1;
                  return (
                    <Takeaway>
                      {tr(
                        `${fmt((Number(sc["Sporadique"] || 0) / tot) * 100, 0)} % des produits sont vendus moins d'une semaine sur deux : produits saisonniers ou d'événement.`,
                        `${fmt((Number(sc["Sporadique"] || 0) / tot) * 100, 0)}% of products sell in fewer than half of the weeks: seasonal or event products.`
                      )}
                    </Takeaway>
                  );
                })()}
              </div>
            </div>
          </div>

          <div className="sw"><RetainCard max={6} style={{ marginBottom: 16 }} /></div>

          <div className="sec-title">
            <IconGrid size={14} color={ORANGE} /> {tr("Catégories & Distribution", "Categories & Distribution")}
          </div>
          <div className="sw">
            <div>
              <div className="cc">
                <CardHeader
                  title={tr("Régularité de vente moyenne par catégorie", "Average sales regularity by category")}
                  sub={tr("Comparatif des familles", "Family comparison")}
                  icon={<IconBox size={16} color={ORANGE} />}
                />
                <CategoryBars
                  cats={Object.entries(
                    freqItems.reduce((acc: any, p: any) => {
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
                {(() => {
                  const acc: Record<string, { t: number; c: number }> = {};
                  freqItems.forEach((p: any) => { acc[p.category] = acc[p.category] || { t: 0, c: 0 }; acc[p.category].t += Number(p.repurchase_freq_pct) || 0; acc[p.category].c += 1; });
                  const best = Object.entries(acc).map(([k, v]) => ({ k, v: v.t / Math.max(v.c, 1) })).sort((a, b) => b.v - a.v)[0];
                  if (!best) return null;
                  return (
                    <Takeaway>
                      {tr(`${best.k} est la famille la plus régulière : ses produits se vendent en moyenne ${fmt(best.v, 0)} % des semaines.`, `${trData(best.k)} is the most regular family: its products sell in ${fmt(best.v, 0)}% of weeks on average.`)}
                    </Takeaway>
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
                  style={{ fontSize: ".72rem", fontWeight: 700, padding: "6px 12px", borderRadius: 10, border: "1px solid var(--dk-line, #E3E4DD)", background: "var(--dk-surface, #FAFAF7)", outline: "none", color: INK }}
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
                  style={{ fontSize: ".72rem", fontWeight: 700, padding: "6px 12px", borderRadius: 10, border: "1px solid var(--dk-line, #E3E4DD)", background: "var(--dk-surface, #FAFAF7)", outline: "none", color: INK }}
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

          {/* Opportunité principale */}
          {assocData.pct_tickets_mono ? (
            <div className="sw">
              <div className="cc" style={{ marginBottom: 12, borderLeft: `4px solid ${ORANGE}`, fontSize: ".82rem", color: INK }}>
                <strong>{fmt(assocData.pct_tickets_mono)} %</strong> {tr("des tickets ne contiennent qu'un seul produit : c'est la marge de progression du panier. Les paires ci-dessous indiquent quoi proposer.", "of transactions contain a single product: that is the room to grow the basket. The pairs below show what to suggest.")}
              </div>
            </div>
          ) : null}

          {/* KPIs */}
          <div className="sw">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 14 }}>
              {[
                { lbl: tr("Groupes associés", "Associated groups"), val: fmt(assocData.nb_total_regles), sub: tr("Chaque groupe de produits compté une fois", "Each product group counted once"), icon: IconLink2, color: ORANGE },
                { lbl: tr("Lien le plus fort", "Strongest link"), val: `${Math.max(...assocRules.map((r: any) => Number(r.lift) || 0), 1).toFixed(2)}×`, sub: tr("Fois plus souvent que le hasard", "Times more often than chance"), icon: IconBolt, color: "var(--dk-accent-deep, #2A7148)" },
                { lbl: tr("Probabilité max", "Max probability"), val: `${Math.max(...assocRules.map((r: any) => Number(r.confidence) || 0), 0).toFixed(1)}%`, sub: tr("Clients du 1er produit qui prennent le 2e", "Customers of the 1st product who also take the 2nd"), icon: IconTrendUp, color: OK },
                { lbl: tr("Paire la plus fréquente", "Most frequent pair"), val: `${Math.max(...assocRules.map((r: any) => Number(r.support) || 0), 0).toFixed(1)}%`, sub: tr("Part des tickets qui la contiennent", "Share of transactions containing it"), icon: IconDonutPie, color: WARN },
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
            <div className="grid-main stretch">
              <div className="cc hero-card" style={{ minHeight: 440 }}>
                <ChartAssistantButton chartType="association_scatter" chartData={{ rules: assocRules }} chartName="AssociationScatter"
                  userQuestion="Explique ce graphique des associations à promouvoir" position="top-right" onOpenChat={openChat} />
                <CardHeader
                  title={tr("Paires à promouvoir en priorité", "Pairs to promote first")}
                  sub={tr("Chaque bulle est une paire de produits. En haut à droite : paires fréquentes et probables, à proposer en offre groupée. Survolez une bulle pour le détail.", "Each bubble is a product pair. Top right: frequent and likely pairs, to offer as a bundle. Hover a bubble for details.")}
                  icon={<IconTarget size={16} color={ORANGE} />}
                />
                <AssocScatter rules={assocRules} height={460} />
              </div>
              <div className="cc" style={{ minHeight: 440 }}>
                <ChartAssistantButton chartType="association_top12" chartData={{ rules: assocRules.slice(0, 10) }} chartName="AssociationTop12"
                  userQuestion="Explique les 10 liens les plus forts" position="top-right" onOpenChat={openChat} />
                <CardHeader
                  title={tr("Les 10 paires les plus fortes", "The 10 strongest pairs")}
                  sub={tr(`Sur ${fmt(assocData.nb_total_regles)} groupes de produits associés`, `Out of ${fmt(assocData.nb_total_regles)} associated product groups`)}
                  icon={<IconBolt size={16} color={ORANGE} />}
                />
                <RankedRows
                  labelKey="pair"
                  rows={assocRules.map((r: any) => ({
                    pair: `${r.antecedent} → ${r.consequent}`,
                    lift: Number(r.lift) || 0,
                  }))}
                  valueKey="lift"
                  colorKey={(r, i) => {
                    const v = Number((assocRules[i] || {}).lift) || 0;
                    return v >= 3 ? ORANGE : v >= 2 ? PEACH : LIGHT;
                  }}
                  maxShow={10}
                  unit="×"
                />
                {assocRules[0] && (
                  <Takeaway>
                    {tr(
                      `${assocRules[0].antecedent} et ${assocRules[0].consequent} : achetés ensemble ${fmt(assocRules[0].lift, 1)} fois plus souvent que par hasard. À proposer ensemble en caisse ou en formule.`,
                      `${assocRules[0].antecedent} and ${assocRules[0].consequent}: bought together ${fmt(assocRules[0].lift, 1)} times more often than by chance. Suggest them together at the till or as a deal.`
                    )}
                  </Takeaway>
                )}
                <ExpertNote>
                  Apriori (mlxtend, notebook). support = P(A ∩ B) ; confidence = P(B | A) ; lift = P(A ∩ B) / (P(A) × P(B)). Seuils : support ≥ 1 %, confiance ≥ 30 %, lift ≥ 1,2. Règles A → B et B → A regroupées (un groupe de produits = une ligne) : {fmt(assocData.nb_total_regles || 0)} groupes pour {fmt(assocData.nb_regles_brutes || 0)} règles. Tri : {assocSort}.
                </ExpertNote>
              </div>
            </div>
          </div>

          {/* Histogramme et matrice du Lift retirés : difficiles à lire, ils répétaient la liste ci-dessus. */}

          {/* Tableau complet des associations retiré : il répétait le classement ci-dessus. */}

          <div className="sw"><RetainCard max={6} style={{ marginBottom: 16 }} /></div>

          <div className="sec-title">
            <IconSparkles size={14} color={ORANGE} /> {tr("Synthèse & Plan d'action", "Summary & Action plan")}
          </div>
          <div className="sw">
            <div>
              <div className="cc">
                <ChartAssistantButton chartType="associations_table" chartData={{ rules: assocRules, nb_total_regles: assocData.nb_total_regles }} chartName="AssociationsRecommendations"
                  userQuestion="Explique quoi faire de ces associations" position="top-right" onOpenChat={openChat} />
                <CardHeader
                  title={tr("Que faire de ces associations ?", "What to do with these associations?")}
                  sub={tr("Suggestions basées sur les associations détectées", "Suggestions based on the detected associations")}
                  icon={<IconSparkles size={16} color={ORANGE} />}
                />
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
                  {[
                    { title: tr("Offre groupée : les liens les plus forts", "Bundle offer: the strongest links"), desc: tr(`${assocRules.filter((r: any) => r.lift >= 3).length} paires achetées au moins 3 fois plus souvent que par hasard — proposer un prix pour le lot`, `${assocRules.filter((r: any) => r.lift >= 3).length} pairs bought at least 3 times more often than by chance — offer a bundle price`), color: ORANGE, Icon: IconTarget },
                    { title: tr("Placement côte à côte", "Side-by-side placement"), desc: tr(`${assocRules.filter((r: any) => r.confidence >= 60).length} paires où plus de 60 % des clients du premier produit prennent le second — les rapprocher en boutique`, `${assocRules.filter((r: any) => r.confidence >= 60).length} pairs where over 60% of customers of the first product also take the second — place them closer in the shop`), color: PEACH, Icon: IconMapPin },
                    { title: tr("Suggestion en caisse", "Checkout suggestion"), desc: `${assocRules.slice(0, 5).map((r: any) => r.consequent).filter((x: string, i: number, arr: string[]) => arr.indexOf(x) === i).slice(0, 3).join(" · ")}${tr(" : à proposer au moment de payer", ": suggest at payment")}`, color: WARN, Icon: IconCart },
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
                          <div style={{ fontSize: ".68rem", color: "var(--dk-ink2, #4A524C)", lineHeight: 1.4 }}>{r.desc}</div>
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
      {panelName && (
        <ProductPanel name={panelName} base={allItems} extra={panelExtra} onClose={() => setPanelName(null)} />
      )}
    </div>
    </RetainProvider>
    </ProductCtx.Provider>
  );
}
