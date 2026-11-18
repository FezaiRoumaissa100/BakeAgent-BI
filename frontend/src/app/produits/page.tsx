"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { niceScale, fmtAxisNum } from "@/lib/chartScale";
import { colors, categoryPalette } from "@/lib/theme";
import { ExpertNote } from "@/components/Expert";
import { RetainProvider, RetainCard, Takeaway, Details, Scope } from "@/components/Ui";
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
import { useSelectedPeriod } from "@/lib/selectedDay";

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
  if (v >= 70) return "var(--dk-accent-deep, #43309E)";
  if (v >= 40) return "var(--ch-1)";
  if (v >= 20) return "var(--ch-2)";
  return "var(--dk-warn, #B7791F)";
}
function statutColor(s: string) {
  const x = String(s).toLowerCase();
  if (x.includes("leader") || x.includes("cœur") || x.includes("coeur") || x.includes("pha") || x.includes("dominant") || x.includes("quotidien")) return "var(--dk-accent-deep, #43309E)";
  if (x.includes("régulier") || x.includes("regulier") || x.includes("croissance")) return "var(--ch-1)";
  if (x.includes("cyclique") || x.includes("niche")) return "var(--dk-warn, #B7791F)";
  if (x.includes("sporadique") || x.includes("éliminer") || x.includes("mort")) return "var(--dk-muted, #5E5A78)";
  return "var(--ch-peak)";
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
              <div style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
                {labelKey === "article" ? <ProdName name={String(r[labelKey])} /> : <span>{String(r[labelKey])}</span>}
                {/* la famille sous le nom (et non à côté de la valeur) : le nom n'est plus coupé */}
                {subKey && r[subKey] != null && <small style={{ color: MUTED, fontSize: ".66rem", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{trData(r[subKey])}</small>}
              </div>
            </div>
            <div className="pbar-w" style={{ width: 80 }}>
              <div className="pbar" style={{ width: `${(Number(r[valueKey]) / max) * 100}%`, background: c }} />
            </div>
            <span className="pval">
              <strong style={{ color: INK }}>{fmt(r[valueKey], Number.isInteger(r[valueKey]) ? 0 : 1)}</strong>
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
                      style={{ fontSize: 10, fontWeight: 800, fill: "var(--dk-ink, #24213A)" }}
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
                  stroke="var(--dk-ink, #24213A)"
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
            background: "var(--dk-soft, #F4F1FC)",
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
  // Survol : une ligne verticale sur la semaine visée et la bulle standard avec les 5 produits
  const [hovIdx, setHovIdx] = useState<number | null>(null);

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
    const idx = clientXToIdx(e.clientX);
    if (!isSelecting) { setHovIdx(idx); return; }
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
    setHovIdx(null);
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
      <div style={{ position: "relative" }}>
      {hovIdx != null && !isSelecting && (() => {
        const xPct = (toX(hovIdx) / W) * 100;
        const rows = series.map((s0, si) => ({ name: s0.article, c: PALETTE_DISTINCTE[si % PALETTE_DISTINCTE.length], v: s0.series[hovIdx]?.rate }))
          .filter((r) => r.v != null).sort((a, b) => (b.v as number) - (a.v as number));
        return (
          <div className="ch-tip" style={xPct > 60 ? { right: `${100 - xPct + 1.5}%`, top: 8 } : { left: `${xPct + 1.5}%`, top: 8 }}>
            <div className="ch-tip-d">{tr(`Semaine du ${weeks[hovIdx]}`, `Week of ${weeks[hovIdx]}`)}</div>
            {rows.map((r) => (
              <div key={r.name} className="ch-tip-row"><span className="ch-tip-k"><i className="ch-tip-dot" style={{ background: r.c }} />{trData(r.name)}</span><b className="num">{fmt(r.v as number, 1)} %</b></div>
            ))}
            <div className="ch-tip-s" style={{ marginTop: 4 }}>{tr("% des paniers qui contiennent le produit", "% of baskets containing the product")}</div>
          </div>
        );
      })()}
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

            </g>
          );
        })}
        {/* Survol : ligne de la semaine et points de chaque produit */}
        {hovIdx != null && !isSelecting && (
          <g pointerEvents="none">
            <line x1={toX(hovIdx)} x2={toX(hovIdx)} y1={pad.t} y2={H - pad.b} stroke="var(--dk-muted)" strokeOpacity={0.5} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
            {series.map((s0, si) => s0.series[hovIdx] && (
              <ellipse key={si} cx={toX(hovIdx)} cy={toY(s0.series[hovIdx].rate)} rx={6} ry={5.5} fill="var(--dk-surface, #fff)" stroke={PALETTE_DISTINCTE[si % PALETTE_DISTINCTE.length]} strokeWidth={3} vectorEffect="non-scaling-stroke" />
            ))}
          </g>
        )}
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
      </div>
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
  scaleMax,
}: {
  cats: { category: string; taux_moyen: number; ca_total?: number; nb_articles?: number }[];
  color?: string;
  height?: number;
  scaleMax?: number;     // ex. 100 pour des pourcentages : la longueur de barre se lit alors directement
}) {
  const max = scaleMax ?? Math.max(...cats.map((c) => c.taux_moyen), 1);
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
                width: 150,
                fontSize: ".78rem",
                color: INK,
                fontWeight: 600,
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
            <span style={{ width: 52, textAlign: "right", fontSize: ".8rem", fontWeight: 800, color: INK }}>
              {fmt(c.taux_moyen, 1)} %
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
  const total = vals.reduce((t, v) => t + v, 0);
  const [hov, setHov] = useState<number | null>(null);
  return (
    <div style={{ height }} className="w-full flex flex-col justify-between pt-2" onMouseLeave={() => setHov(null)}>
      <div className="flex items-end gap-1.5 flex-1 w-full relative" style={{ paddingTop: 18 }}>
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-40">
          <div className="w-full border-b border-[color:var(--dk-line)] border-dashed" />
          <div className="w-full border-b border-[color:var(--dk-line)] border-dashed" />
          <div className="w-full border-b border-[color:var(--dk-line)]" />
        </div>
        {rows.map((r, i) => {
          const v = vals[i];
          const pct = Math.max(3, (v / max) * 100);
          const isMax = v === max;
          return (
            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full relative" style={{ zIndex: hov === i ? 20 : 10, cursor: "pointer" }} onMouseEnter={() => setHov(i)}>
              {hov === i && (
                <div className="ch-tip" style={i > rows.length / 2 ? { right: "calc(100% + 8px)", top: 0 } : { left: "calc(100% + 8px)", top: 0 }}>
                  <div className="ch-tip-d">{(() => { const m = /^(\d{1,2})h$/.exec(String(r[labelKey]).trim()); const h = m ? Number(m[1]) : NaN; return Number.isFinite(h) ? tr(`${h} h – ${h + 1} h`, `${h}:00 – ${h + 1}:00`) : trData(r[labelKey]); })()}</div>
                  <div className="ch-tip-row"><span className="ch-tip-k">{labelKey === "heure_label" ? tr("Articles vendus", "Items sold") : tr("Valeur", "Value")}</span><b className="num">{fmt(v)}{labelKey === "heure_label" ? "" : ` ${unit}`}</b></div>
                  {total > 0 && <div className="ch-tip-row"><span className="ch-tip-k">{labelKey === "heure_label" ? tr("Part de la journée", "Share of the day") : tr("Part du total", "Share of total")}</span><b className="num">{v > 0 && (v / total) * 100 < 1 ? "< 1" : fmt((v / total) * 100)} %</b></div>}
                  {Array.isArray(r.per_product) && r.per_product.length > 0 && (<>
                    <div className="ch-tip-sep" />
                    <div className="ch-tip-k" style={{ fontSize: ".68rem", marginBottom: 2 }}>{tr("Ce qui part le plus", "Top sellers")}</div>
                    {r.per_product.slice(0, 3).map((p: any) => (
                      <div key={p.article} className="ch-tip-row"><span>{trData(p.article)}</span><b className="num">{fmt(p.qte_this_hour)}</b></div>
                    ))}
                  </>)}
                </div>
              )}
              <div className="text-[11px] font-bold leading-none mb-1 whitespace-nowrap" style={{ color: isMax ? ORANGE : MUTED }}>
                {fmtAxisNum(v)}
              </div>
              <div
                className="w-full rounded-t-sm transition-all"
                style={{ height: `${pct}%`, background: isMax || hov === i ? ORANGE : color, opacity: hov != null && hov !== i ? 0.4 : isMax ? 1 : 0.85 }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1.5 mt-1.5 pt-1 border-t border-[color:var(--dk-grid)] text-[11px] font-semibold" style={{ color: MUTED }}>
        {rows.map((r, i) => (
          <span key={i} className="flex-1 text-center whitespace-nowrap overflow-hidden">
            {rows.length <= 16 || i % 2 === 0 ? trData(r[labelKey]) : ""}
          </span>
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
    { key: "event", label: tr("Événement", "Event"), color: "var(--dk-accent-deep, #43309E)" },
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
            <div key={i} className="w-full border-b border-[color:var(--dk-line)] border-dashed" />
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
      <div className="flex justify-between mt-1.5 pt-1 border-t border-[color:var(--dk-grid)] text-[9px] font-semibold text-center" style={{ color: MUTED }}>
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
            const fill = v === 0 ? "var(--dk-soft, #F4F1FC)" : isDiag ? "var(--dk-soft, #F4F1FC)" : ORANGE;
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
        color: active ? "white" : "var(--dk-ink2, #3A3655)",
        boxShadow: active ? `0 2px 10px rgba(91,69,194,0.28)` : "none",
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
  scope,
}: {
  title: string;
  sub?: string;
  icon?: React.ReactNode;
  scope?: { period?: React.ReactNode; calc?: React.ReactNode; unit?: React.ReactNode };
}) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {icon && <div style={{ display: "flex" }}>{icon}</div>}
        <div style={{ minWidth: 0 }}>
          <div className="ct" style={{ marginBottom: 0 }}>{title}</div>
          {sub && <div className="cs" style={{ marginBottom: 0 }}>{sub}</div>}
        </div>
      </div>
      {scope && <Scope period={scope.period} calc={scope.calc} unit={scope.unit} />}
    </div>
  );
}

/* « Que faire de chaque produit » (matrice de décision du cahier des charges), écrite pour un boulanger :
   chaque groupe porte le nom de l'ACTION (« Ne jamais manquer »…), l'ancien nom (Star, Niche…) reste en petit.
   Chaque case : nombre de produits, part du chiffre d'affaires, pourquoi en une ligne, et ses 3 premiers produits
   avec leur présence dans les paniers. Le classement reste celui du back-end (seuils = moyennes de la boutique).
   Clic sur une case = filtre la liste ci-dessous ; clic sur un produit = sa fiche. */
// Nom de chaque groupe de la matrice, par l'action à mener (ce que lit le boulanger)
const groupName = (k: string) => k === "Star" ? tr("Ne jamais manquer", "Never run out") : k === "Trafic" ? tr("Attire les clients", "Brings customers in")
  : k === "Niche" ? tr("Pour les habitués", "For your regulars") : k === "Dormant" ? tr("À revoir", "To review") : k;

/* Liste des produits d'un groupe de la matrice : 4 onglets (un par groupe), grille compacte sur 3 colonnes. */
function GroupList({ items, start, colors: col }: { items: any[]; start: string; colors: Record<string, string> }) {
  const openP = useOpenProduct();
  const [g, setG] = useState(start);
  const [all, setAll] = useState(false);
  const keys = ["Star", "Trafic", "Niche", "Dormant"];
  const list = (items || []).filter((i: any) => i.quadrant === g).sort((a: any, b: any) => (b.ca_total || 0) - (a.ca_total || 0));
  const SHOW = 24;
  const shown = all ? list : list.slice(0, SHOW);
  const why: Record<string, string> = {
    Star: tr("Ne jamais les laisser manquer.", "Never let them run out."),
    Trafic: tr("Les garder bien en vue, en stock modéré.", "Keep them in view, moderate stock."),
    Niche: tr("Prévoir assez pour ceux qui les prennent.", "Plan enough for those who buy them."),
    Dormant: tr("Produire moins, ou les retirer.", "Make fewer, or drop them."),
  };
  return (
    <div className="gl cc">
      <div className="gl-tabs" role="tablist">
        {keys.map((k) => {
          const n = (items || []).filter((i: any) => i.quadrant === k).length;
          return (
            <button key={k} type="button" role="tab" aria-selected={g === k} className={`gl-tab${g === k ? " on" : ""}`}
              style={{ ["--gc" as any]: col[k] }} onClick={() => { setG(k); setAll(false); }}>
              <i aria-hidden="true" />{groupName(k)} <span className="num">{fmt(n)}</span>
            </button>
          );
        })}
      </div>
      <div className="gl-why"><b>{tr("Que faire :", "What to do:")}</b> {why[g]}</div>
      <div className="gl-grid">
        {shown.map((p: any) => (
          <button key={p.article} type="button" className="gl-row" onClick={() => openP(p.article)}
            title={tr(`${trData(p.article)} · ${trData(p.category)} · ${fmt(p.daily_velocity, 1)} articles par jour de vente`, `${trData(p.article)} · ${trData(p.category)} · ${fmt(p.daily_velocity, 1)} items per selling day`)}>
            <span className="gl-name">{trData(p.article)}</span>
            {p.alerte_horaire && <span className="gl-alarm">⏰ {String(p.alerte_horaire).replace(/[^0-9:h]/g, "")}</span>}
            <span className="gl-pct num">{fmt(p.penetration_rate, 1)} %</span>
            <span className="gl-ca num">{fmt(p.ca_total)} €</span>
          </button>
        ))}
      </div>
      <div className="gl-foot">
        <span>{tr("% = part des paniers qui contiennent le produit · € = chiffre d'affaires de la période · cliquez un produit pour sa fiche", "% = share of baskets containing the product · € = revenue for the period · click a product for its sheet")}</span>
        {list.length > SHOW && (
          <button type="button" className="link-btn" onClick={() => setAll(!all)}>
            {all ? tr("Afficher moins", "Show less") : tr(`Afficher les ${fmt(list.length)} produits`, `Show all ${fmt(list.length)} products`)}
          </button>
        )}
      </div>
    </div>
  );
}

function MatrixGrid({ items, quadrants, seuils, active, onSelect, colors: col, labelsEn }: any) {
  const openP = useOpenProduct();
  const layout = [
    { key: "Star", Icon: IconStar, title: tr("Ne jamais manquer", "Never run out"), old: "Star",
      why: tr("Se vend beaucoup, et dans plus de paniers que la moyenne.", "Sells a lot, and in more baskets than average.") },
    { key: "Trafic", Icon: IconBasket, title: tr("Attire les clients", "Brings customers in"), old: tr("Produit d'appel", "Traffic builder"),
      why: tr("Dans plus de paniers que la moyenne, mais peu à la fois : à garder bien en vue.", "In more baskets than average, a little at a time: keep it in view.") },
    { key: "Niche", Icon: IconGem, title: tr("Pour les habitués", "For your regulars"), old: "Niche",
      why: tr("Se vend en quantité, mais dans moins de paniers : prévoir pour ceux qui le prennent.", "Sells in volume, but in fewer baskets: plan for those who buy it.") },
    { key: "Dormant", Icon: IconBox, title: tr("À revoir", "To review"), old: tr("Stock dormant", "Dormant stock"),
      why: tr("Se vend peu et rarement : produire moins, ou le retirer.", "Sells little and rarely: make fewer, or drop it.") },
  ];
  const byQuad = (k: string) => (items || []).filter((i: any) => i.quadrant === k).sort((a: any, b: any) => (b.ca_total || 0) - (a.ca_total || 0));

  return (
    <div style={{ marginTop: 12 }}>
      <div className="mx-quad" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
        {layout.map(({ key, Icon, title, old, why }) => {
          const d = quadrants[key] || {};
          const color = col[key];
          const list = byQuad(key);
          const on = active === key;
          const dim = active !== "Tous" && !on;
          return (
            <div key={key} style={{
              borderRadius: 14, padding: "12px 14px", position: "relative",
              border: `1px solid ${on ? color : "var(--dk-line)"}`,
              boxShadow: on ? `0 0 0 1px ${color}` : "none",
              background: `color-mix(in srgb, ${color} ${key === "Star" ? 9 : 5}%, var(--dk-surface))`,
              opacity: dim ? 0.5 : 1, transition: "opacity .15s, box-shadow .15s",
            }}>
              <button type="button" onClick={() => onSelect(key)} aria-pressed={on}
                title={tr("Voir ces produits dans la liste ci-dessous", "Show these products in the list below")}
                style={{ all: "unset", cursor: "pointer", display: "block", width: "100%" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 28, height: 28, borderRadius: 9, background: color, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon size={14} color="#fff" />
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: ".95rem", fontWeight: 800, color: INK, lineHeight: 1.15 }}>{title}</div>
                    <div style={{ fontSize: ".62rem", color: MUTED, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase" }}>{old}</div>
                  </div>
                  <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <div className="num" style={{ fontSize: "1.25rem", fontWeight: 800, color: INK, lineHeight: 1 }}>{fmt(d.nb || 0)}</div>
                    <div style={{ fontSize: ".62rem", color: MUTED, fontWeight: 600 }}>{tr("produits", "products")}</div>
                  </div>
                </div>
                <div style={{ fontSize: ".74rem", color: "var(--dk-ink2)", marginTop: 8, lineHeight: 1.35 }}>{why}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                  <div style={{ flex: 1, height: 5, borderRadius: 99, background: "var(--dk-soft)", overflow: "hidden" }}>
                    <div style={{ width: `${Math.min(100, d.part_ca || 0)}%`, height: "100%", background: color, borderRadius: 99 }} />
                  </div>
                  <span style={{ fontSize: ".7rem", color: MUTED, whiteSpace: "nowrap" }}><b className="num" style={{ color: INK }}>{fmt(d.part_ca || 0, 0)} %</b> {tr("du CA", "of revenue")}</span>
                </div>
              </button>

              <div style={{ marginTop: 8, borderTop: "1px solid var(--dk-line)" }}>
                {list.slice(0, 3).map((p: any) => (
                  <div key={p.article} onClick={() => openP(p.article)}
                    title={tr(`${trData(p.article)} : dans ${fmt(p.penetration_rate, 1)} % des paniers, ${fmt(p.ca_total)} € sur la période`, `${trData(p.article)}: in ${fmt(p.penetration_rate, 1)}% of baskets, €${fmt(p.ca_total)} over the period`)}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", cursor: "pointer", borderBottom: "1px dashed var(--dk-line)" }}>
                    <span style={{ fontSize: ".76rem", fontWeight: 700, color: INK, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {trData(p.article)}
                    </span>
                    {p.alerte_horaire && (
                      <span title={tr(p.alerte_horaire, String(p.alerte_horaire).replace("Remplir avant", "Restock before"))}
                        style={{ fontSize: ".64rem", fontWeight: 800, color: ALERT }}>⏰ {String(p.alerte_horaire).replace(/[^0-9:h]/g, "")}</span>
                    )}
                    <span className="num" style={{ fontSize: ".7rem", color: MUTED, fontWeight: 600, whiteSpace: "nowrap" }}>{tr(`${fmt(p.penetration_rate, 0)} % des paniers`, `${fmt(p.penetration_rate, 0)}% of baskets`)}</span>
                  </div>
                ))}
                {list.length > 3 && (
                  <button type="button" onClick={() => onSelect(key)}
                    style={{ all: "unset", cursor: "pointer", fontSize: ".7rem", fontWeight: 700, color: "var(--dk-accent)", marginTop: 6, display: "inline-block" }}>
                    {tr(`Voir les ${fmt(list.length)} produits →`, `See all ${fmt(list.length)} products →`)}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: ".7rem", color: MUTED, marginTop: 10, lineHeight: 1.45 }}>
        {tr(
          `Comment c'est classé : « se vend beaucoup » = plus de ${fmt(seuils.vitesse_moyenne || 0, 1)} articles par jour de vente ; « plus de paniers que la moyenne » = dans plus de ${fmt(seuils.penetration_moyenne || 0, 1)} % des tickets. Ce sont les moyennes de la boutique. ⏰ = remplir le rayon avant cette heure.`,
          `How it's sorted: "sells a lot" = more than ${fmt(seuils.vitesse_moyenne || 0, 1)} items per selling day; "more baskets than average" = in more than ${fmt(seuils.penetration_moyenne || 0, 1)}% of transactions. These are the shop averages. ⏰ = restock before this hour.`
        )}
      </div>
    </div>
  );
}

// Phrase qui dit ce qu'il faut retenir du graphique (calculée à partir des données)
/* Présence × Chiffre d'affaires : axes à graduations ×10 (les produits vont de quelques euros à 150 000 €),
   bandes de fond = statuts du cahier des charges (Niche < 10 %, Régulier, Cœur ≥ 30 %, Leader ≥ 50 %). */
const STATUT_PEN = [
  { key: "Niche / À surveiller", short: "Niche", en: "Niche", from: 0, to: 10, color: "#8A7B6E" },
  { key: "Produit Régulier", short: "Régulier", en: "Regular", from: 10, to: 30, color: "var(--ch-2)" },
  { key: "Produit Cœur (Core)", short: "Cœur", en: "Core", from: 30, to: 50, color: "var(--ch-1)" },
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
  const W = 820, H = height, L = 70, R = 24, T = 44, B = 50;
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
    const w = Math.min(txt.length, 22) * 7.1;
    const opts: { x: number; y: number; anchor: "start" | "end" }[] = [
      { x: cx + r + 4, y: cy + 4, anchor: "start" },
      { x: cx - r - 4, y: cy + 4, anchor: "end" },
      { x: cx + r + 2, y: cy - r - 2, anchor: "start" },
      { x: cx - r - 2, y: cy + r + 11, anchor: "end" },
    ];
    for (const o of opts) {
      const x1 = o.anchor === "start" ? o.x : o.x - w, x2 = x1 + w, y1 = o.y - 12, y2 = o.y + 3;
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
        {/* bandes de statut ; les noms des bandes étroites passent sur une 2e ligne au lieu de se chevaucher */}
        {(() => {
          const placed: { x1: number; x2: number; row: number }[] = [];
          return STATUT_PEN.map((b) => {
            const x1 = X(Math.max(b.from, xMin)), x2 = X(b.to);
            if (x2 <= x1) return null;
            const name = locale() === "en" ? b.en : b.short;
            const w = name.length * 7.2 + 6, cx = Math.min(W - R - w / 2, Math.max(L + w / 2, (x1 + x2) / 2));
            let row = 0;
            while (placed.some((q) => q.row === row && !(cx + w / 2 < q.x1 || cx - w / 2 > q.x2))) row++;
            placed.push({ x1: cx - w / 2, x2: cx + w / 2, row });
            return (
              <g key={b.key}>
                <rect x={x1} y={T} width={x2 - x1} height={ph} fill={b.color} opacity={0.07} />
                <text x={cx} y={T - 8 - row * 15} textAnchor="middle" fontSize={12.5} fontWeight={800} fill={b.color}>{name}</text>
                {b.from > 0 && <line x1={x1} x2={x1} y1={T - 4} y2={T + ph} stroke={b.color} strokeDasharray="4 4" opacity={0.6} />}
              </g>
            );
          });
        })()}
        {/* grille */}
        {yTicks.map((v) => (
          <g key={`y${v}`}>
            <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="rgba(80,100,85,0.12)" />
            <text x={L - 8} y={Y(v) + 4.5} textAnchor="end" fontSize={12.5} fontWeight={600} fill={MUTED}>{euroLbl(v)}</text>
          </g>
        ))}
        {xTicks.map((v) => (
          <g key={`x${v}`}>
            <line x1={X(v)} x2={X(v)} y1={T + ph} y2={T + ph + 5} stroke={MUTED} />
            <text x={X(v)} y={T + ph + 19} textAnchor="middle" fontSize={12.5} fontWeight={600} fill={MUTED}>{pctLbl(v)}</text>
          </g>
        ))}
        <line x1={L} x2={W - R} y1={T + ph} y2={T + ph} stroke="rgba(80,100,85,0.35)" />
        <text x={L + pw / 2} y={H - 6} textAnchor="middle" fontSize={12.5} fontWeight={700} fill={INK}>
          {tr("Présence : part des tickets contenant le produit →", "Presence: share of transactions with the product →")}
        </text>
        <text x={16} y={T + ph / 2} textAnchor="middle" fontSize={12.5} fontWeight={700} fill={INK} transform={`rotate(-90 16 ${T + ph / 2})`}>
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
          <text key={`l${d.article}`} x={x} y={y} textAnchor={anchor} fontSize={12} fontWeight={700} fill={INK}
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

/* Détail « Poids dans le panier » : un tableau simple, des chiffres seulement (plus de barres).
   Filtre par rôle, tri par colonne, 15 lignes puis « Voir tout ». */
function ContributionRows({ rows, seuil = 50 }: { rows: any[]; seuil?: number }) {
  const openP = useOpenProduct();
  const [sort, setSort] = useState<"part" | "freq" | "ca">("ca");
  const [role, setRole] = useState<"all" | "gen" | "acc">("all");
  const [all, setAll] = useState(false);
  const key = sort === "part" ? "contribution_med" : sort === "freq" ? "nb_tickets_multi" : "ca_total_multi";
  const isGen = (r: any) => (Number(r.contribution_med) || 0) >= seuil;
  const filtered = (rows || []).filter((r) => role === "all" || (role === "gen" ? isGen(r) : !isGen(r)));
  const sorted = [...filtered].sort((a, b) => (b[key] || 0) - (a[key] || 0));
  const shown = all ? sorted : sorted.slice(0, 15);
  const th = (k: typeof sort | null, l: string, align: "left" | "right" = "right") => (
    <th style={{ textAlign: align, padding: "8px 10px", fontSize: ".68rem", fontWeight: 800, color: MUTED, textTransform: "uppercase", letterSpacing: ".05em", borderBottom: "1px solid var(--dk-line)", whiteSpace: "nowrap" }}>
      {k ? (
        <button type="button" onClick={() => setSort(k)} style={{ all: "unset", cursor: "pointer", color: sort === k ? INK : MUTED }}>
          {l}{sort === k ? " ↓" : ""}
        </button>
      ) : l}
    </th>
  );
  const nGen = (rows || []).filter(isGen).length, nAcc = (rows || []).length - nGen;
  return (
    <div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", margin: "2px 0 10px" }}>
        <div className="seg" role="group" aria-label={tr("Rôle", "Role")}>
          <button type="button" className={role === "all" ? "on" : ""} onClick={() => setRole("all")}>{tr(`Tous (${rows.length})`, `All (${rows.length})`)}</button>
          <button type="button" className={role === "gen" ? "on" : ""} onClick={() => setRole("gen")}>{tr(`Font le panier (${nGen})`, `Make the basket (${nGen})`)}</button>
          <button type="button" className={role === "acc" ? "on" : ""} onClick={() => setRole("acc")}>{tr(`Accompagnent (${nAcc})`, `Go with (${nAcc})`)}</button>
        </div>
        <span style={{ fontSize: ".7rem", color: MUTED }}>{tr("Cliquez sur un titre de colonne pour trier.", "Click a column title to sort.")}</span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".8rem", minWidth: 560 }}>
          <thead>
            <tr>
              {th(null, "#", "left")}
              {th(null, tr("Produit", "Product"), "left")}
              {th(null, tr("Rôle", "Role"), "left")}
              {th("part", tr("Part du ticket", "Basket share"))}
              {th("freq", tr("Tickets", "Transactions"))}
              {th("ca", tr("CA dans ces tickets", "Revenue in them"))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r: any, i: number) => {
              const g = isGen(r);
              return (
                <tr key={r.article} onClick={() => openP(r.article)} style={{ cursor: "pointer", background: i % 2 ? "var(--dk-soft)" : "transparent" }}>
                  <td className="num" style={{ padding: "7px 10px", color: MUTED, fontWeight: 700, width: 28 }}>{i + 1}</td>
                  <td style={{ padding: "7px 10px", fontWeight: 700, color: INK }}>{trData(r.article)}</td>
                  <td style={{ padding: "7px 10px" }}>
                    <span style={{ fontSize: ".66rem", fontWeight: 800, borderRadius: 99, padding: "2px 8px", color: INK, whiteSpace: "nowrap",
                      background: g ? "color-mix(in srgb, var(--ch-1) 16%, var(--dk-surface))" : "color-mix(in srgb, var(--ch-3) 14%, var(--dk-surface))" }}>
                      {g ? tr("Fait le panier", "Makes the basket") : tr("Accompagne", "Goes with")}
                    </span>
                  </td>
                  <td className="num" style={{ padding: "7px 10px", textAlign: "right", fontWeight: sort === "part" ? 800 : 600, color: INK }}>{fmt(r.contribution_med, 0)} %</td>
                  <td className="num" style={{ padding: "7px 10px", textAlign: "right", fontWeight: sort === "freq" ? 800 : 600, color: INK }}>{fmt(r.nb_tickets_multi)}</td>
                  <td className="num" style={{ padding: "7px 10px", textAlign: "right", fontWeight: sort === "ca" ? 800 : 600, color: INK }}>{fmt(r.ca_total_multi)} €</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {sorted.length > 15 && (
        <button type="button" onClick={() => setAll(!all)} style={{ all: "unset", cursor: "pointer", fontSize: ".76rem", fontWeight: 700, color: "var(--dk-accent)", marginTop: 10, display: "inline-block" }}>
          {all ? tr("Réduire", "Show less") : tr(`Voir les ${fmt(sorted.length)} produits`, `See all ${fmt(sorted.length)} products`)}
        </button>
      )}
      <div style={{ fontSize: ".7rem", color: MUTED, marginTop: 8 }}>
        {tr(`Part du ticket = ce que le produit représente habituellement (médiane) dans la valeur d'un ticket à plusieurs produits. ${seuil} % ou plus = il fait le panier.`,
            `Basket share = what the product usually (median) represents in a multi-product transaction. ${seuil}% or more = it makes the basket.`)}
      </div>
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
  const W = 820, H = height, L = 60, R = 20, T = 20, B = 52;
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
  const col = (l: number) => (l >= 3 ? "var(--ch-peak)" : l >= 2 ? "var(--ch-1)" : "var(--ch-soft)");
  const zones = [
    { x1: X(xs), x2: X(xMax), y1: Y(yMax), y2: Y(ys), c: Q1, t: tr("Offre groupée", "Bundle offer"), s: tr("fréquentes et probables", "frequent and likely"), ax: "end", px: X(xMax) - 10, py: Y(yMax) + 18 },
    { x1: X(0), x2: X(xs), y1: Y(yMax), y2: Y(ys), c: Q2, t: tr("Suggestion en caisse", "Till suggestion"), s: tr("rares mais très probables", "rare but very likely"), ax: "start", px: X(0) + 10, py: Y(yMax) + 18 },
    { x1: X(xs), x2: X(xMax), y1: Y(ys), y2: Y(0), c: Q3, t: tr("Placement en rayon", "Shelf placement"), s: tr("fréquentes, moins probables", "frequent, less likely"), ax: "end", px: X(xMax) - 10, py: Y(0) - 22 },
    { x1: X(0), x2: X(xs), y1: Y(ys), y2: Y(0), c: Q4, t: tr("À ignorer", "To ignore"), s: tr("impact faible", "low impact"), ax: "start", px: X(0) + 10, py: Y(0) - 22 },
  ];
  const label = (d: any) => { const a = String(d.antecedent).split(",")[0].trim(), b = String(d.consequent).split(",")[0].trim(); const t = `${a} + ${b}`; return t.length > 30 ? t.slice(0, 29) + "…" : t; };
  // Les noms des zones occupent leur place en premier : les étiquettes des paires les évitent
  const boxes: any[] = zones.map((z) => {
    const w = Math.max(z.t.length * 7.6, z.s.length * 6.4);
    const x1 = z.ax === "end" ? z.px - w : z.px;
    return { x1, x2: x1 + w, y1: z.py - 13, y2: z.py + 18 };
  });
  const labels: any[] = [];
  [...pts].sort((a, b) => b.lift - a.lift).slice(0, 7).forEach((d) => {
    const cx = X(d.support), cy = Y(d.confidence), r = rad(d.lift), t = label(d), w = t.length * 7;
    for (const o of [{ x: cx + r + 5, y: cy + 4, a: "start" }, { x: cx - r - 5, y: cy + 4, a: "end" }, { x: cx, y: cy - r - 6, a: "middle" }, { x: cx, y: cy + r + 13, a: "middle" }]) {
      const x1 = o.a === "start" ? o.x : o.a === "end" ? o.x - w : o.x - w / 2, x2 = x1 + w, y1 = o.y - 12, y2 = o.y + 3;
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
          <rect key={i} x={z.x1} y={z.y1} width={Math.max(0, z.x2 - z.x1)} height={Math.max(0, z.y2 - z.y1)} fill={z.c} opacity={i === 0 ? 0.1 : 0.05} rx={6} />
        ))}
        {yt.map((v) => (<g key={`y${v}`}><line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="rgba(80,100,85,0.12)" /><text x={L - 8} y={Y(v) + 4.5} textAnchor="end" fontSize={12.5} fontWeight={600} fill={MUTED}>{fmt(v)} %</text></g>))}
        {xt.map((v) => (<g key={`x${v}`}><line x1={X(v)} x2={X(v)} y1={T} y2={T + ph} stroke="rgba(80,100,85,0.08)" /><text x={X(v)} y={T + ph + 19} textAnchor="middle" fontSize={12.5} fontWeight={600} fill={MUTED}>{fmt(v, xStep < 1 ? 1 : 0)} %</text></g>))}
        <line x1={X(xs)} x2={X(xs)} y1={T} y2={T + ph} stroke="var(--dk-ink2)" strokeDasharray="4 4" opacity={0.35} />
        <line x1={L} x2={W - R} y1={Y(ys)} y2={Y(ys)} stroke="var(--dk-ink2)" strokeDasharray="4 4" opacity={0.35} />
        <line x1={L} x2={W - R} y1={T + ph} y2={T + ph} stroke="rgba(80,100,85,0.35)" />
        <text x={L + pw / 2} y={H - 8} textAnchor="middle" fontSize={12.5} fontWeight={700} fill={INK}>{tr("Fréquence : % des tickets qui contiennent la paire →", "Frequency: % of transactions with the pair →")}</text>
        <text x={16} y={T + ph / 2} textAnchor="middle" fontSize={12.5} fontWeight={700} fill={INK} transform={`rotate(-90 16 ${T + ph / 2})`}>{tr("Probabilité d'achat du 2ᵉ produit →", "Probability of buying the 2nd →")}</text>
        {[...pts].sort((a, b) => a.lift - b.lift).map((d, i) => {
          const on = hover === d;
          return (
            <circle key={i} cx={X(d.support)} cy={Y(d.confidence)} r={rad(d.lift) + (on ? 2 : 0)} fill={col(d.lift)} fillOpacity={on ? 0.95 : 0.75}
                    stroke="#fff" strokeWidth={on ? 2.5 : 1.5} style={{ cursor: "pointer", transition: "r .15s" }}
                    onMouseEnter={() => setHover(d)} onClick={() => openP(String(d.antecedent).split(",")[0].trim())} />
          );
        })}
        {labels.map((l, i) => (
          <text key={i} x={l.x} y={l.y} textAnchor={l.a} fontSize={12} fontWeight={700} fill={INK}
                style={{ paintOrder: "stroke", stroke: "var(--dk-surface, #fff)", strokeWidth: 3, pointerEvents: "none" }}>{l.t}</text>
        ))}
        {/* Noms des zones par-dessus les bulles, avec un halo : toujours lisibles */}
        {zones.map((z, i) => (
          <g key={`zt${i}`} style={{ pointerEvents: "none" }}>
            <text x={z.px} y={z.py} textAnchor={z.ax as any} fontSize={13} fontWeight={800} fill={z.c}
                  style={{ paintOrder: "stroke", stroke: "var(--dk-surface, #fff)", strokeWidth: 4 }}>{z.t}</text>
            <text x={z.px} y={z.py + 15} textAnchor={z.ax as any} fontSize={11.5} fill={MUTED}
                  style={{ paintOrder: "stroke", stroke: "var(--dk-surface, #fff)", strokeWidth: 4 }}>{z.s}</text>
          </g>
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
        {[{ c: "var(--ch-peak)", t: tr("lien très fort (× 3 et plus)", "very strong link (× 3+)") }, { c: "var(--ch-1)", t: tr("fort (× 2 à 3)", "strong (× 2–3)") }, { c: "var(--ch-soft)", t: tr("modéré (moins de × 2)", "moderate (under × 2)") }].map((l) => (
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
  // Repère à la taille d'une demi-carte (le texte garde sa taille réelle) ; graduations rondes
  const W = 560, H = 300, padL = 46, padR = 8, padT = 14, padB = 62;
  const allSeries = [
    { key: "all", label: tr("Tous les jours", "All days"), color: MUTED },
    { key: "touristic", label: tr("Saison touristique", "Tourist season"), color: ORANGE },
    { key: "event", label: tr("Jours d'événement", "Event days"), color: PEACH },
  ];
  // Une série sans aucune valeur (ex. pas de saison touristique chez ce client) n'est ni dessinée ni en légende
  const series = allSeries.filter((s) => rows.some((r) => r[s.key] != null && Number(r[s.key]) > 0));
  const scale = niceScale(Math.max(1, ...rows.flatMap((r) => series.map((s) => Number(r[s.key]) || 0))) * 1.05, 4);
  const max = scale.max;
  const gw = (W - padL - padR) / Math.max(rows.length, 1);
  const bw = (gw * 0.78) / Math.max(series.length, 1);
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / max);
  const short = (d: string) => trData(d).slice(0, 3) + ".";
  // Survol : la bulle standard du tableau de bord (jour, chaque série, écart à un jour moyen) ; les autres jours s'estompent
  const [hov, setHov] = useState<number | null>(null);
  const avgAll = rows.reduce((t, r) => t + (Number(r.all) || 0), 0) / Math.max(rows.length, 1);
  const hr = hov != null ? rows[hov] : null;
  const hx = hov != null ? ((padL + hov * gw + gw / 2) / W) * 100 : 0;
  return (
    <div style={{ position: "relative" }} onMouseLeave={() => setHov(null)}>
    {hr && (
      <div className="ch-tip" style={hx > 60 ? { right: `${100 - hx + 6}%` } : { left: `${hx + 6}%` }}>
        <div className="ch-tip-d">{tr(`${trData(hr.day)} habituel`, `Typical ${trData(hr.day)}`)}</div>
        {series.map((s0) => hr[s0.key] != null && (
          <div key={s0.key} className="ch-tip-row"><span className="ch-tip-k"><i className="ch-tip-dot" style={{ background: s0.color }} />{s0.label}</span><b className="num">{fmt(hr[s0.key])} {tr("art.", "items")}</b></div>
        ))}
        {avgAll > 0 && (<>
          <div className="ch-tip-sep" />
          <div className="ch-tip-row ch-tip-cmp"><span className="ch-tip-k">{tr("vs un jour moyen", "vs an average day")}</span>
            <b className="num" style={{ color: Number(hr.all) >= avgAll ? "var(--dk-ok)" : "var(--dk-alert)" }}>{Number(hr.all) >= avgAll ? "+" : "−"}{fmt(Math.abs((Number(hr.all) / avgAll - 1) * 100))} %</b></div>
        </>)}
      </div>
    )}
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} preserveAspectRatio="xMidYMid meet">
      {scale.ticks.map((v, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="var(--dk-line, #ECEDE7)" />
          <text x={padL - 7} y={y(v) + 4.5} textAnchor="end" fontSize="12.5" fill={MUTED} fontWeight="700">{fmtAxisNum(v)}</text>
        </g>
      ))}
      {rows.map((r, i) => (
        <g key={i}>
          {series.map((s, j) => {
            const v = r[s.key];
            if (v == null) return null;
            const x = padL + i * gw + gw * 0.11 + j * bw;
            return (
              <rect key={j} x={x} y={y(v)} width={bw - 2} height={y(0) - y(v)} rx={2} fill={s.color} fillOpacity={hov != null && hov !== i ? 0.3 : 0.9} style={{ transition: "fill-opacity .15s ease" }} />
            );
          })}
          <text x={padL + i * gw + gw / 2} y={H - padB + 18} textAnchor="middle" fontSize="13" fill={INK} fontWeight="700">{short(r.day)}</text>
          {/* zone de survol sur toute la hauteur du jour */}
          <rect x={padL + i * gw} y={padT} width={gw} height={H - padT - padB + 24} fill="transparent" onMouseEnter={() => setHov(i)} style={{ cursor: "pointer" }} />
        </g>
      ))}
      <g transform={`translate(${padL}, ${H - 10})`}>
        {series.map((s, j) => (
          <g key={j} transform={`translate(${j * 168}, 0)`}>
            <rect x="0" y="-11" width="13" height="13" rx="2" fill={s.color} />
            <text x="19" y="0" fontSize="12.5" fill={INK} fontWeight="700">{s.label}</text>
          </g>
        ))}
      </g>
    </svg>
    </div>
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
                          background: i === hi ? "var(--dk-soft, #F4F1FC)" : "transparent" }}>
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

/* Bandeau des 3 chiffres clés en tête de chaque onglet : le même « kpi-strip » que la page Performance
   (pastille colorée, libellé, grande valeur, étiquette), avec une courte phrase dessous. */
type Kpi = { tone: "a" | "b" | "c" | "r"; icon: React.ReactNode; lbl: string; val: string; chip?: string; note?: string };
function Answers({ items }: { items: Kpi[] }) {
  return (
    <div className="kpi-strip pa-kpis">
      {items.map((k) => (
        <div key={k.lbl} className={`ks-item ks-${k.tone}`}>
          <span className="ks-ic" aria-hidden="true">{k.icon}</span>
          <div style={{ minWidth: 0 }}>
            <div className="ks-lbl">{k.lbl}</div>
            <div className="ks-line">
              <span className="ks-val">{k.val}</span>
              {k.chip && <span className="ks-d ks-n num">{k.chip}</span>}
            </div>
            {k.note && <div className="ks-note">{k.note}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

/* Colonne « Repères » à droite du graphique principal : mêmes tuiles et même carte « À retenir » que la page Performance. */
function SideRep({ sub, tiles, keepText, keepTip, refTxt }: { sub: string; tiles: any[]; keepText: string; keepTip: string; refTxt?: string }) {
  return (
    <div className="evo-side">
      <div className="rep-head">
        <span className="rep-head-ic" aria-hidden="true">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" fillOpacity=".3" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"><path d="M6.5 3.5h11a1 1 0 0 1 1 1V21l-6.5-4.4L5.5 21V4.5a1 1 0 0 1 1-1z" /></svg>
        </span>
        <div style={{ minWidth: 0 }}>
          <div className="rep-head-t">{tr("Repères", "Landmarks")}</div>
          <div className="rep-head-s">{sub}</div>
        </div>
      </div>
      <div className="evo-rep">
        {tiles.map((r: any) => (
          <div key={r.k} className={`rep-tile rt-${r.tone}`}>
            <span className="rep-ic" aria-hidden="true">{r.icon}</span>
            <div className="rep-body">
              <div className="rep-k">{r.k}</div>
              <div className="rep-line">
                <span className="rep-v num">{r.v}</span>
                {r.chip && <span className="rep-chip">{r.chip}</span>}
              </div>
              {r.note && <div className="rep-note">{r.note}</div>}
            </div>
          </div>
        ))}
      </div>
      {keepText && (
        <div className="rep-keep">
          <div className="rep-keep-k">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4Z" /></svg>
            {tr("À retenir", "Key takeaway")} {refTxt && <span className="rep-keep-ref num">{refTxt}</span>}
          </div>
          <div className="rep-keep-t">{keepText}</div>
          {keepTip && (
            <div className="rep-keep-do">
              <span className="rep-keep-ic" aria-hidden="true">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </span>
              <span><b>{tr("Que faire :", "What to do:")}</b> {keepTip}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ProduitsPage() {
  const { openChat } = useChat();
  // 3 onglets (comme la page Performance) : que faire de chaque produit · rythme de vente · le panier
  const [tab, setTab] = useState<"matrix" | "vel" | "basket">("matrix");
  // Rythme de vente : un seul graphique, vu par jour ou par heure
  const [velView, setVelView] = useState<"jour" | "heure">("jour");

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

  // ── HISTOIRE EN BREF : la paire de produits la plus parlante (fréquente ET liée) ──
  const [storyPair, setStoryPair] = useState<any>(null);
  useEffect(() => {
    fetchAssociations("Support ↓", 40)
      .then((d) => {
        const rules = (d?.rules || []).filter((r: any) => (r.lift || 0) >= 1.2);
        setStoryPair(rules.sort((a: any, b: any) => (b.confidence || 0) - (a.confidence || 0))[0] || null);
      })
      .catch(() => setStoryPair(null));
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
  // Périodes affichées sous les titres : l'onglet Matrice / Présence suit les boutons d'année, les autres couvrent tout l'historique
  const scopeAllYears = years.length > 1 ? tr(`${Math.min(...years)} et ${Math.max(...years)}`, `${Math.min(...years)} and ${Math.max(...years)}`) : years.length ? String(years[0]) : tr("toute la période", "whole period");

  // ── MATRICE states ──
  const [matrixData, setMatrixData] = useState<any>(null);
  const [matrixQuad, setMatrixQuad] = useState<string>("Tous");

  // ── PEN states ──
  const [penData, setPenData] = useState<any>(null);
  const [searchPen, setSearchPen] = useState("");
  const [searchInputPen, setSearchInputPen] = useState("");
  const [penCats, setPenCats] = useState<string[]>([]);
  const [penStatuts, setPenStatuts] = useState<string[]>([]);
  const [penSelected, setPenSelected] = useState<string | null>(null);
  // Année : choisie dans la barre du haut (une seule ici : ces analyses portent sur une année entière ou tout l'historique)
  const [per] = useSelectedPeriod();
  const yearPen = per.annee === "Toutes" ? "Toutes" : per.annee.split(",").sort().slice(-1)[0];
  const scopeSelYears = yearPen === "Toutes" ? scopeAllYears : yearPen;

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

  // Chargement des données de l'onglet ouvert (chaque onglet réunit deux analyses)
  const load = (on: boolean, fetcher: () => Promise<any>, setter: (x: any) => void) => {
    if (!on) return;
    let cancelled = false;
    fetcher()
      .then((res) => { if (!cancelled) setter(res); })
      .catch((err) => { console.error("Fetch error:", err); if (!cancelled) setter({ error: String(err?.message || err), items: [] }); });
    return () => { cancelled = true; };
  };
  useEffect(() => load(tab === "matrix", () => fetchMatrix(yearPen), setMatrixData), [tab, yearPen]);
  useEffect(() => load(tab === "matrix", () => fetchPenetration({
    search: searchPen,
    categories: penCats.length ? penCats : undefined,
    statuts: penStatuts.length ? penStatuts : undefined,
    year: yearPen,
  }), setPenData), [tab, searchPen, penCats, penStatuts, yearPen]);
  useEffect(() => load(tab === "vel" && !velData, () => fetchVelocity(), setVelData), [tab]);
  useEffect(() => load(tab === "vel" && !freqData, () => fetchFrequency(), setFreqData), [tab]);
  useEffect(() => load(tab === "basket" && !ticketData, () => fetchTicketContribution(), setTicketData), [tab]);
  useEffect(() => load(tab === "basket", () => fetchAssociations(assocSort, assocTopN), setAssocData), [tab, assocSort, assocTopN]);
  // « Analyse en cours » tant que l'analyse principale de l'onglet n'est pas arrivée
  const loading = tab === "matrix" ? !matrixData : tab === "vel" ? !velData : !ticketData;

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
    { id: "matrix", label: tr("Que faire de chaque produit", "What to do with each product"), sub: tr("4 groupes, une action chacun", "4 groups, one action each"), Icon: IconScatter },
    { id: "vel", label: tr("Rythme de vente", "Sales pace"), sub: tr("par jour et par heure (vitesse)", "per day and hour (velocity)"), Icon: IconBolt },
    { id: "basket", label: tr("Le panier", "The basket"), sub: tr("ce qu'on vient chercher, ce qu'on prend avec", "what people come for, what they add"), Icon: IconTicketPerc },
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
        <p className="page-lead">
          <span className="page-lead-ic" aria-hidden="true"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.3-2.4 3.6M12 17h.01" /></svg></span>
          <span>
          {tr("Quels produits comptent, lesquels font venir les clients, lesquels se vendent ensemble, et lesquels revoir.", "Which products matter, which bring customers in, which sell together, and which to review.")}
          </span>
        </p>
      </div>


      {/* ── ONGLETS (même barre que la page Performance) + recherche produit à droite ── */}
      <div className="sw tabs-sticky" style={{ marginTop: 4 }}>
        <div className="perf-tabbar">
          <div className="prod-tabs perf-tabs">
            {TABS.map((t) => {
              const Ic = t.Icon as any;
              const on = tab === t.id;
              return (
                <button key={t.id} type="button" onClick={() => setTab(t.id)} className={`prod-tab${on ? " on" : ""}`} aria-pressed={on}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    background: on ? "rgba(255,255,255,.2)" : "var(--dk-page, #F1EEF9)" }}>
                    <Ic size={16} color={on ? "#fff" : MUTED} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", minWidth: 0 }}>
                    <span style={{ fontSize: ".86rem", fontWeight: 800, color: on ? "#fff" : "var(--dk-ink2, #3A3655)", lineHeight: 1.2 }}>{t.label}</span>
                    <span style={{ fontSize: ".66rem", color: on ? "rgba(255,255,255,.8)" : MUTED, lineHeight: 1.3, marginTop: 2 }}>{t.sub}</span>
                  </div>
                </button>
              );
            })}
          </div>
          {/* Recherche produit (tous les onglets) : à côté des onglets, comme les filtres de Performance */}
          <div className="tab-filters pt-search" role="search">
            <ProductSearch
              value={searchInputPen}
              onChange={setSearchInputPen}
              onSubmit={(v) => setSearchPen(v.trim())}
              names={allNames}
              active={searchPen}
              onPick={openProduct}
            />
          </div>
        </div>
      </div>

      {loading && (
        <div className="sw" style={{ padding: "40px 0", color: MUTED, fontSize: ".9rem", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <div className="w-5 h-5 rounded-full border-2 border-[color:var(--ch-1)] border-t-transparent animate-spin" />
          {tr("Analyse en cours…", "Analysing…")}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          LES 3 ONGLETS — même grammaire partout (maquette validée) :
          1. trois réponses en phrases  2. une rangée « carte principale (⅔) + carte de côté (⅓) »
          3. « À retenir » (les constats des graphiques + que faire)  4. le détail, replié
          ══════════════════════════════════════════════════════════════════════ */}

      {/* ───────── 1. QUE FAIRE DE CHAQUE PRODUIT ───────── */}
      {tab === "matrix" && matrixData?.items && (() => {
        const q = matrixData.quadrants || {};
        const seuils = matrixData.seuils || {};
        const qd = (k: string) => q[k] || {};
        const QUAD_EN: Record<string, { label: string; action: string }> = {
          Star: { label: "Star (essential)", action: "Critical priority: no stock-outs, hourly alert" },
          Niche: { label: "Niche (profitable)", action: "Stock for loyal customers (large volumes)" },
          Trafic: { label: "Traffic builder", action: "Place in the window or at the till to attract, moderate stock" },
          Dormant: { label: "Dormant stock", action: "Reduce production, consider discontinuing" },
        };
        const stars = matrixItems.filter((i: any) => i.quadrant === "Star").sort((a: any, b: any) => (b.ca_total || 0) - (a.ca_total || 0));
        const hourly = stars.filter((x: any) => x.alerte_horaire);
        const hourOf = (x: any) => String(x.alerte_horaire).replace(/[^0-9:h]/g, "");
        const pen: any[] = (penData && !penData.error ? penData.items : []) || [];
        const oneIn = (p: number) => fmt(Math.max(1, Math.round(100 / Math.max(p, 0.01))));
        return (
          <div className="sw pa">
            <Answers items={[
              { tone: "a", icon: <IconStar size={17} color="#fff" />, lbl: tr("À ne jamais manquer", "Never run out"),
                val: tr(`${fmt(qd("Star").nb || 0)} produits`, `${fmt(qd("Star").nb || 0)} products`), chip: tr(`${fmt(qd("Star").part_ca || 0, 0)} % du CA`, `${fmt(qd("Star").part_ca || 0, 0)}% of revenue`),
                note: stars.slice(0, 3).map((x: any) => trData(x.article)).join(" · ") },
              hourly.length
                ? { tone: "r", icon: <IconClock size={17} color="#fff" />, lbl: tr(`Remplir avant ${hourOf(hourly[0])}`, `Restock by ${hourOf(hourly[0])}`),
                    val: trData(hourly[0].article), note: tr("Une grosse part de ses ventes tombe sur une seule heure.", "A big share of its sales falls in a single hour.") }
                : { tone: "b", icon: <IconBasket size={17} color="#fff" />, lbl: tr("Attirent les clients", "Bring customers in"),
                    val: tr(`${fmt(qd("Trafic").nb || 0)} produits`, `${fmt(qd("Trafic").nb || 0)} products`), chip: tr(`${fmt(qd("Trafic").part_ca || 0, 0)} % du CA`, `${fmt(qd("Trafic").part_ca || 0, 0)}% of revenue`) },
              { tone: "c", icon: <IconBox size={17} color="#fff" />, lbl: tr("À revoir", "To review"),
                val: tr(`${fmt(qd("Dormant").nb || 0)} produits`, `${fmt(qd("Dormant").nb || 0)} products`), chip: tr(`${fmt(qd("Dormant").part_ca || 0, 0)} % du CA`, `${fmt(qd("Dormant").part_ca || 0, 0)}% of revenue`),
                note: tr("Se vendent peu et rarement.", "Sell little and rarely.") },
            ]} />

            <div className="pa-row">
              <div className="cc">
                <ChartAssistantButton chartType="product_decision_matrix" chartData={{
                  periode_du_graphique: yearPen === "Toutes" ? "toutes les années" : `année ${yearPen} (le mois choisi ne s'applique pas ici)`,
                  nb_produits: (matrixData.items || []).length, quadrants: matrixData.quadrants, seuils: matrixData.seuils,
                  produits_par_case: Object.fromEntries(["Star", "Niche", "Trafic", "Dormant"].map((k) => [k,
                    (matrixData.items || []).filter((i: any) => i.quadrant === k).sort((a: any, b: any) => (b.ca_total || 0) - (a.ca_total || 0)).slice(0, 10)
                      .map((i: any) => ({ article: i.article, categorie: i.category, presence_pct: i.penetration_rate, articles_par_jour: i.daily_velocity, ca: i.ca_total }))])),
                  filtre_case: matrixQuad }} chartName="MatrixGrid"
                  userQuestion="Explique cette matrice de décision des produits" position="top-right" onOpenChat={openChat} />
                <CardHeader
                  title={tr("Les 4 groupes de produits", "The 4 product groups")}
                  sub={tr("Chaque groupe dit quoi faire. Cliquez un groupe pour voir tous ses produits.", "Each group says what to do. Click a group to see all its products.")}
                  scope={{ period: scopeSelYears, calc: tr("Comparé à la moyenne de la boutique", "Compared with the shop average"), unit: tr("% des paniers · % du CA", "% of baskets · % of revenue") }}
                  icon={<IconGrid size={16} color={ORANGE} />}
                />
                <MatrixGrid items={matrixItems} quadrants={q} seuils={seuils} active={matrixQuad}
                  onSelect={(k: string) => setMatrixQuad(matrixQuad === k ? "Tous" : k)}
                  colors={{ Star: Q1, Niche: Q2, Trafic: Q3, Dormant: Q4 }} labelsEn={QUAD_EN} />
                <Takeaway>
                  {tr(`${fmt(qd("Star").nb || 0)} produits font ${fmt(qd("Star").part_ca || 0, 0)} % du chiffre d'affaires, et ${fmt(qd("Dormant").nb || 0)} produits seulement ${fmt(qd("Dormant").part_ca || 0, 0)} % à eux tous.`,
                      `${fmt(qd("Star").nb || 0)} products make ${fmt(qd("Star").part_ca || 0, 0)}% of revenue, while ${fmt(qd("Dormant").nb || 0)} products make only ${fmt(qd("Dormant").part_ca || 0, 0)}% between them.`)}
                </Takeaway>
              </div>

              <div className="pa-side">
              <div className="cc pp-card">
                <ChartAssistantButton chartType="penetration_ranking" chartData={{ periode_du_graphique: yearPen === "Toutes" ? "toutes les années" : `année ${yearPen} (le mois choisi ne s'applique pas ici)`, items: pen.slice(0, 30), filters: { year: yearPen } }} chartName="PenetrationRanking"
                  userQuestion="Explique quels produits les clients prennent le plus souvent" position="top-right" onOpenChat={openChat} />
                <CardHeader
                  title={tr("Sur 10 clients, combien le prennent ?", "Out of 10 customers, how many take it?")}
                  sub={tr("Taux de pénétration : la part des tickets qui contiennent le produit. Une silhouette = 1 client sur 10.", "Penetration rate: the share of tickets containing the product. One figure = 1 customer in 10.")}
                  scope={{ period: scopeSelYears, calc: tr("Taux de pénétration = tickets avec le produit ÷ tous les tickets", "Penetration rate = tickets with the product ÷ all tickets"), unit: tr("% des tickets", "% of tickets") }}
                  icon={<IconTarget size={16} color={ORANGE} />}
                />
                {!penData ? <div className="cs" style={{ padding: 12 }}>{tr("Chargement…", "Loading…")}</div> : (
                  <div className="pp-list">
                    {pen.slice(0, 5).map((r: any) => {
                      const pct = Number(r.penetration_rate) || 0;
                      return (
                        <button key={r.article} type="button" className="pp-row" onClick={() => openProduct(r.article)}
                          title={tr(`${fmt(pct, 1)} % des tickets`, `${fmt(pct, 1)}% of transactions`)}>
                          <span className="pp-name">{trData(r.article)}</span>
                          <span className="pp-v"><b className="num">{tr(`1 sur ${oneIn(pct)}`, `1 in ${oneIn(pct)}`)}</b><small className="num">{fmt(pct, 1)} %</small></span>
                          <span className="pp-men" aria-hidden="true">
                            {Array.from({ length: 10 }, (_, k) => (
                              <span key={k} className="pp-man"><b style={{ width: `${Math.max(0, Math.min(1, pct / 10 - k)) * 100}%` }} /></span>
                            ))}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {pen.length > 1 && (
                  <Takeaway>
                    {tr(`${trData(pen[0].article)} est dans le panier d'environ 1 client sur ${oneIn(Number(pen[0].penetration_rate) || 0)}${Number(pen[0].penetration_rate) >= 2 * Number(pen[1].penetration_rate) ? ", loin devant tous les autres : une rupture toucherait beaucoup de clients" : ""}.`,
                        `${trData(pen[0].article)} is in the basket of about 1 customer in ${oneIn(Number(pen[0].penetration_rate) || 0)}${Number(pen[0].penetration_rate) >= 2 * Number(pen[1].penetration_rate) ? ", far ahead of all others: running out would affect many customers" : ""}.`)}
                  </Takeaway>
                )}
              </div>
                <RetainCard max={4} variant="strip" style={{ margin: 0 }}
              tip={tr(`ne jamais laisser manquer ${stars.slice(0, 2).map((x: any) => trData(x.article)).join(" et ")}${hourly.length ? `, remplir ${trData(hourly[0].article)} avant ${hourOf(hourly[0])}` : ""}, et regarder les ${fmt(qd("Dormant").nb || 0)} produits « à revoir » avant la prochaine commande.`,
                       `never run out of ${stars.slice(0, 2).map((x: any) => trData(x.article)).join(" and ")}${hourly.length ? `, restock ${trData(hourly[0].article)} before ${hourOf(hourly[0])}` : ""}, and look at the ${fmt(qd("Dormant").nb || 0)} products "to review" before the next order.`)} />
              </div>
            </div>

            <Details key={matrixQuad} defaultOpen={matrixQuad !== "Tous"} label={tr("Voir tous les produits, groupe par groupe", "See every product, group by group")}>
              <GroupList items={matrixItems} start={matrixQuad === "Tous" ? "Star" : matrixQuad} colors={{ Star: Q1, Niche: Q2, Trafic: Q3, Dormant: Q4 }} />
            </Details>
            {penData && !penData.error && (penData.weekly_trend || []).length > 0 && (
              <Details label={tr("Voir l'évolution semaine par semaine", "See the week-by-week trend")}>
                <div className="cc">
                  <ChartAssistantButton chartType="penetration_weekly_trend" chartData={{ periode_du_graphique: yearPen === "Toutes" ? "toutes les années" : `année ${yearPen} (le mois choisi ne s'applique pas ici)`, weekly_trend: penData.weekly_trend, filters: { year: yearPen } }} chartName="PenetrationWeeklyTrend"
                    userQuestion="Explique l'évolution hebdomadaire du taux de pénétration" position="top-right" onOpenChat={openChat} />
                  <CardHeader
                    title={tr("Les 5 produits les plus pris, semaine par semaine", "The 5 most taken products, week by week")}
                    scope={{ period: scopeSelYears, calc: tr("Part des tickets avec le produit, chaque semaine", "Share of tickets with the product, each week"), unit: tr("% des paniers", "% of baskets") }}
                    icon={<IconSparkline size={16} color={ORANGE} />}
                  />
                  <MultiLineChart series={penData.weekly_trend || []} height={300} />
                </div>
              </Details>
            )}
            <ExpertNote>
              Matrice de décision pénétration × vélocité (cahier des charges, composante 2 §4) : frontières = moyennes (pénétration {fmt(seuils.penetration_moyenne || 0, 2)} %, vélocité {fmt(seuils.vitesse_moyenne || 0, 2)}) ; alerte horaire si ratio_pic_percent ≥ {fmt(seuils.pic_horaire_pct || 40)} %. Taux de pénétration = tickets contenant le produit / tickets uniques × 100. API : /api/products/matrix, /api/products/penetration.
            </ExpertNote>
          </div>
        );
      })()}

      {/* ───────── 2. RYTHME DE VENTE ───────── */}
      {tab === "vel" && velData && (() => {
        const dow: any[] = velData.dow_velocity || [];
        const best = dow.length ? dow.reduce((m: any, x: any) => (x.all > m.all ? x : m), dow[0]) : null;
        const low = dow.length ? dow.reduce((m: any, x: any) => (x.all < m.all ? x : m), dow[0]) : null;
        const hrs: any[] = velData.hourly_distribution || [];
        const totH = hrs.reduce((t: number, x: any) => t + (Number(x.global_qte_per_hour) || 0), 0) || 1;
        const pk = hrs.length ? hrs.reduce((m: any, x: any) => (x.global_qte_per_hour > m.global_qte_per_hour ? x : m), hrs[0]) : null;
        // la plus forte fenêtre de 4 heures d'affilée
        let rush: { h: number; part: number } | null = null;
        for (const x of hrs) {
          const s4 = hrs.filter((y: any) => y.hour >= x.hour && y.hour < x.hour + 4).reduce((t: number, y: any) => t + (Number(y.global_qte_per_hour) || 0), 0);
          if (!rush || s4 / totH * 100 > rush.part) rush = { h: Number(x.hour), part: s4 / totH * 100 };
        }
        const after13 = hrs.filter((x: any) => Number(x.hour) >= 13).reduce((t: number, y: any) => t + (Number(y.global_qte_per_hour) || 0), 0) / totH * 100;
        const hot = velItems.filter((p: any) => p.alerte_replissage_avant).sort((a: any, b: any) => (b.ratio_pic_percent || 0) - (a.ratio_pic_percent || 0)).slice(0, 3);
        // agenda
        const rows = velItems.slice(0, 12).filter((p: any) => Number.isFinite(Number(p.peak_hour)));
        const hours = Array.from(new Set(rows.map((p: any) => Number(p.peak_hour)))).sort((a: any, b: any) => a - b) as number[];
        const maxV = Math.max(...rows.map((p: any) => Number(p.daily_velocity) || 0), 1);
        // régularité
        const fItems: any[] = freqData && !freqData.error ? freqItems : [];
        const every = fItems.filter((r: any) => Number(r.repurchase_freq_pct) >= 100);
        const notEvery = fItems.filter((r: any) => Number(r.repurchase_freq_pct) < 100).sort((a: any, b: any) => (Number(b.ca_total) || 0) - (Number(a.ca_total) || 0)).slice(0, 5);
        const seasonal = notEvery.filter((r: any) => Number(r.repurchase_freq_pct) < 20);
        return (
          <div className="sw pa">
            <Answers items={[
              best ? { tone: "a", icon: <IconCalendarDays size={17} color="#fff" />, lbl: tr("Jour le plus chargé", "Busiest day"),
                val: trData(best.day), chip: tr(`${fmt(best.all)} art. / jour`, `${fmt(best.all)} items / day`),
                note: low && low.all > 0 ? tr(`${fmt(best.all / low.all, 1)} fois le ${trData(low.day).toLowerCase()}`, `${fmt(best.all / low.all, 1)}× ${trData(low.day)}`) : undefined } : null,
              rush ? { tone: "b", icon: <IconClock size={17} color="#fff" />, lbl: tr("Le coup de feu", "The rush"),
                val: tr(`${rush.h}h – ${rush.h + 4}h`, `${rush.h}:00 – ${rush.h + 4}:00`), chip: tr(`${fmt(rush.part, 0)} % des articles`, `${fmt(rush.part, 0)}% of items`),
                note: tr(`Après 13h : ${fmt(after13, 0)} % seulement.`, `After 1 pm: only ${fmt(after13, 0)}%.`) } : null,
              hot.length ? { tone: "r", icon: <IconClock size={17} color="#fff" />, lbl: tr(`Remplir avant ${hot[0].alerte_replissage_avant}`, `Restock by ${hot[0].alerte_replissage_avant}`),
                val: hot.map((p: any) => trData(p.article)).join(", "), note: tr(`Part${hot.length > 1 ? "ent" : ""} d'un coup à ${String(hot[0].peak_hour).padStart(2, "0")}h.`, `Sell${hot.length > 1 ? "" : "s"} out in one go at ${String(hot[0].peak_hour).padStart(2, "0")}:00.`) }
                : pk ? { tone: "c", icon: <IconClock size={17} color="#fff" />, lbl: tr("Heure de pointe", "Peak hour"), val: pk.heure_label, note: tr("Rayons pleins avant cette heure.", "Shelves full before then.") } : null,
            ].filter(Boolean) as Kpi[]} />

            {/* 1re rangée : un seul graphique « quand on vend » (Par jour | Par heure) + « Toutes les semaines » à côté */}
            <div className="pa-row">
              <div className="cc vv-card">
                <div className="seg vv-seg" role="tablist" aria-label={tr("Vue", "View")}>
                  <button type="button" role="tab" aria-selected={velView === "jour"} className={velView === "jour" ? "on" : ""} onClick={() => setVelView("jour")}>{tr("Par jour", "By day")}</button>
                  <button type="button" role="tab" aria-selected={velView === "heure"} className={velView === "heure" ? "on" : ""} onClick={() => setVelView("heure")}>{tr("Par heure", "By hour")}</button>
                </div>
                {velView === "jour" ? (<>
                <ChartAssistantButton chartType="velocity_dow" chartData={{ periode_du_graphique: "tout l'historique (ce graphique ne suit pas la période choisie)", dow_velocity: velData.dow_velocity }} chartName="VelocityDOW"
                  userQuestion="Explique la vitesse de vente par jour de la semaine" position="top-right" onOpenChat={openChat} />
                <CardHeader
                  title={tr("Articles vendus selon le jour", "Items sold by day")}
                  scope={{ period: scopeAllYears, calc: tr("Un jour d'ouverture habituel, tous produits", "A typical opening day, all products"), unit: tr("articles par jour", "items per day") }}
                  icon={<IconCalendarDays size={16} color={ORANGE} />}
                />
                <DowGroupedBars rows={dow} />
                {best && (
                  <Takeaway>
                    {tr(`${trData(best.day)} est le jour le plus chargé (${fmt(best.all)} articles en moyenne)${best.touristic ? ` ; en saison touristique, il monte à ${fmt(best.touristic)} articles (× ${fmt(best.touristic / best.all, 1)})` : ""}. Adapter les fournées au jour et à la saison.`,
                        `${trData(best.day)} is the busiest day (${fmt(best.all)} items on average)${best.touristic ? `; in the tourist season it rises to ${fmt(best.touristic)} items (× ${fmt(best.touristic / best.all, 1)})` : ""}. Adjust batches to the day and the season.`)}
                  </Takeaway>
                )}
                </>) : (<>
                <ChartAssistantButton chartType="velocity_hourly_distribution" chartData={{ periode_du_graphique: "tout l'historique (ce graphique ne suit pas la période choisie)", hourly_distribution: velData.hourly_distribution }} chartName="VelocityHourlyDistribution"
                  userQuestion="Explique la distribution horaire de la vitesse" position="top-right" onOpenChat={openChat} />
                <CardHeader
                  title={tr("Articles vendus à chaque heure", "Items sold at each hour")}
                  scope={{ period: scopeAllYears, calc: tr("Total de chaque heure sur la période", "Total of each hour over the period"), unit: tr("articles", "items") }}
                  icon={<IconBar size={16} color={ORANGE} />}
                />
                <SimpleBar rows={hrs} labelKey="heure_label" valueKey="global_qte_per_hour" unit={tr("u.", "u.")} color={PEACH} height={300} />
                {pk && (
                  <Takeaway>
                    {tr(`Le plus d'articles partent à ${pk.heure_label} : les rayons doivent être pleins avant cette heure.`, `Most items sell at ${pk.heure_label}: shelves must be full before then.`)}
                  </Takeaway>
                )}
                </>)}
              </div>
              <div className="cc rg-card">
                {freqData && !freqData.error && <ChartAssistantButton chartType="frequency_top20" chartData={{ periode_du_graphique: "tout l'historique (ce graphique ne suit pas la période choisie)", items: fItems.slice(0, 20), total_sem: freqData.total_sem }} chartName="FrequencyTop20"
                  userQuestion="Explique les produits vendus le plus régulièrement" position="top-right" onOpenChat={openChat} />}
                <CardHeader
                  title={tr("Toutes les semaines, ou à certaines périodes ?", "Every week, or only at certain times?")}
                  sub={freqData ? tr(`Semaines avec au moins une vente, sur ${fmt(freqData.total_sem || 0)}`, `Weeks with at least one sale, out of ${fmt(freqData.total_sem || 0)}`) : undefined}
                  icon={<IconRepeat size={16} color={ORANGE} />}
                />
                {!freqData ? <div className="cs" style={{ padding: 12 }}>{tr("Chargement…", "Loading…")}</div> : (<>
                  <div className="rg-big"><b className="num">{fmt(every.length)}</b>
                    <span>{tr("produits vendus chaque semaine", "products sold every week")}<small>{tr(`${fmt(freqData.part_ca_quotidiens || 0, 0)} % du chiffre d'affaires : la base de la boutique`, `${fmt(freqData.part_ca_quotidiens || 0, 0)}% of revenue: the shop's base`)}</small></span>
                  </div>
                  <div className="rg-list">
                    <div className="rg-k">{tr("Gros vendeurs, pas toutes les semaines", "Big sellers, not every week")}</div>
                    {notEvery.map((r: any) => (
                      <button key={r.article} type="button" className="rg-line" onClick={() => openProduct(r.article)}>
                        <span>{trData(r.article)}</span><em className="num">{tr(`${fmt(r.repurchase_freq_pct, 0)} % des semaines`, `${fmt(r.repurchase_freq_pct, 0)}% of weeks`)}</em>
                      </button>
                    ))}
                  </div>
                  {seasonal.length > 0 && (
                    <Takeaway>
                      {tr(`${seasonal.slice(0, 3).map((r: any) => trData(r.article)).join(", ")} ne se vendent que quelques semaines par an, mais rapportent gros : les préparer seulement pour leur période, en quantité.`,
                          `${seasonal.slice(0, 3).map((r: any) => trData(r.article)).join(", ")} sell only a few weeks a year but bring in a lot: make them only for their season, in volume.`)}
                    </Takeaway>
                  )}
                </>)}
              </div>
            </div>

            {/* 2e rangée : ce qui doit être prêt, heure par heure (toute la largeur) */}
            {/* 2e rangée : ce qui doit être prêt (⅔) + « À retenir » à droite (⅓) */}
            <div className="pa-row ag-row-wrap">
            <div className="cc ag-card">
                <ChartAssistantButton chartType="velocity_hourly_monitoring" chartData={{ periode_du_graphique: "tout l'historique (ce graphique ne suit pas la période choisie)", macro_items: velItems }} chartName="VelocityHourlyMonitoring"
                  userQuestion="Explique le tableau de surveillance horaire" position="top-right" onOpenChat={openChat} />
                <CardHeader
                  title={tr("Ce qui doit être prêt, heure par heure", "What must be ready, hour by hour")}
                  sub={tr("Les 12 produits les plus vendus, rangés selon l'heure où ils partent le plus. Le chiffre = articles par jour.", "The 12 best sellers, by the hour they sell most. The number = items per day.")}
                  scope={{ period: scopeAllYears, calc: tr("Moyenne par jour où le produit a été vendu", "Average per day the product sold"), unit: tr("articles par jour", "items per day") }}
                  icon={<IconClock size={16} color={ORANGE} />}
                />
                <ol className="ag">
                  {hours.map((h) => {
                    const list = rows.filter((p: any) => Number(p.peak_hour) === h).sort((a: any, b: any) => (b.daily_velocity || 0) - (a.daily_velocity || 0));
                    const isHot = list.some((p: any) => p.alerte_replissage_avant);
                    return (
                      <li key={h} className={`ag-row${isHot ? " hot" : ""}`}>
                        <div className="ag-time"><b className="num">{String(h).padStart(2, "0")}:00</b></div>
                        <span className="ag-dot" aria-hidden="true" />
                        <div className="ag-body">
                          <div className="ag-chips">
                            {list.map((p: any) => {
                              const v = Number(p.daily_velocity) || 0;
                              return (
                                <button key={p.article} type="button" className={`ag-chip${v >= maxV * 0.2 ? " big" : ""}${p.alerte_replissage_avant ? " hot" : ""}`} onClick={() => openProduct(p.article)}
                                  title={tr(`${fmt(p.ratio_pic_percent)} % de ses ventes à ${String(h).padStart(2, "0")}h`, `${fmt(p.ratio_pic_percent)}% of its sales at ${String(h).padStart(2, "0")}:00`)}>
                                  {trData(p.article)}
                                  <span className="num">{fmt(v, v < 10 ? 1 : 0)}</span>
                                  {p.alerte_replissage_avant && <em className="num">{tr(`remplir avant ${p.alerte_replissage_avant}`, `restock by ${p.alerte_replissage_avant}`)}</em>}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
              <RetainCard max={4} variant="strip" style={{ margin: 0 }}
              tip={tr(`avoir les viennoiseries prêtes avant ${hours[0] != null ? `${hours[0]}h` : "l'ouverture"}${hot.length ? `, remplir ${hot.map((p: any) => trData(p.article)).join(" et ")} avant ${hot[0].alerte_replissage_avant}` : ""}${best ? `, et renforcer les fournées le ${trData(best.day).toLowerCase()}` : ""}.`,
                       `have the pastries ready before ${hours[0] != null ? `${hours[0]}:00` : "opening"}${hot.length ? `, restock ${hot.map((p: any) => trData(p.article)).join(" and ")} by ${hot[0].alerte_replissage_avant}` : ""}${best ? `, and bake more on ${trData(best.day)}` : ""}.`)} />
            </div>

            <Details label={tr("Voir la vitesse et l'heure de pointe de chaque produit", "See each product's speed and peak hour")}>
              <div className="cc">
                <div className="vl">
                  <div className="vl-h"><span>{tr("Produit", "Product")}</span><span>{tr("Par jour de vente", "Per selling day")}</span><span>{tr("Heure de pointe", "Peak hour")}</span><span>{tr("Part à cette heure", "Share at that hour")}</span></div>
                  {velItems.slice(0, 40).map((p: any) => (
                    <button key={p.article} type="button" className={`vl-r${p.alerte_replissage_avant ? " hot" : ""}`} onClick={() => openProduct(p.article)}>
                      <span>{trData(p.article)}</span>
                      <span className="num">{fmt(p.daily_velocity, p.daily_velocity < 10 ? 1 : 0)}</span>
                      <span className="num">{p.peak_hour != null ? `${String(p.peak_hour).padStart(2, "0")}h` : "—"}</span>
                      <span className="num">{fmt(p.ratio_pic_percent)} %{p.alerte_replissage_avant ? tr(` · remplir avant ${p.alerte_replissage_avant}`, ` · restock by ${p.alerte_replissage_avant}`) : ""}</span>
                    </button>
                  ))}
                </div>
              </div>
            </Details>
            <ExpertNote>
              Macro-vélocité (dow_velocity) = moyenne des Σ quantity par jour d'ouverture, par day_of_week ; touristic = jours is_touristic ; event = jours avec événement. Micro-vélocité : ratio_pic_percent = quantité à l'heure de pointe / quantité totale ; alerte si ≥ {velData.seuil_pic_horaire_pct ?? 40} %. Régularité = semaines avec vente / semaines de la période × 100.
            </ExpertNote>
          </div>
        );
      })()}

      {/* ───────── 3. LE PANIER ───────── */}
      {tab === "basket" && ticketData && (() => {
        const st = ticketData.stats || {};
        const dist = st.distribution_par_statut || {};
        const items = ticketAll || [];
        const gens = items.filter((r: any) => r.statut_contribution === "Générateur de chiffre")
          .sort((a: any, b: any) => (Number(b.nb_tickets_multi) || 0) - (Number(a.nb_tickets_multi) || 0));
        const accs = items.filter((r: any) => r.statut_contribution !== "Générateur de chiffre")
          .sort((a: any, b: any) => (Number(b.nb_tickets_multi) || 0) - (Number(a.nb_tickets_multi) || 0));
        const pts = assocRules.filter((r: any) => Number(r.support) > 0 && Number(r.confidence) > 0);
        const qq = (arr: number[], p: number) => { const a = [...arr].sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(p * a.length))] ?? 0; };
        const sT = qq(pts.map((r: any) => Number(r.support)), 0.7);
        const cT = qq(pts.map((r: any) => Number(r.confidence)), 0.7);
        const actionOf = (r: any) => {
          const hiS = Number(r.support) >= sT, hiC = Number(r.confidence) >= cT;
          if (hiS && hiC) return { t: tr("Offre groupée", "Bundle deal"), k: "a" };
          if (hiC) return { t: tr("Proposer en caisse", "Suggest at the till"), k: "b" };
          if (hiS) return { t: tr("Placer côte à côte", "Place side by side"), k: "c" };
          return { t: tr("À tester", "Worth a try"), k: "d" };
        };
        const names = (x: string) => String(x || "").split(/\s*,\s*/).map((n) => trData(n));
        const pairs = [...pts].sort((a: any, b: any) => (Number(b.confidence) * Number(b.support)) - (Number(a.confidence) * Number(a.support))).slice(0, 6);
        const best = pairs[0];
        const g0 = gens[0], a0 = accs[0];
        const multi = Number(st.pct_multi) || 0;
        return (
          <div className="sw pa">
            <Answers items={[
              { tone: "a", icon: <IconBasket size={17} color="#fff" />, lbl: tr("Achètent plusieurs produits", "Buy several products"),
                val: tr(`${fmt(Math.round(multi / 10))} clients sur 10`, `${fmt(Math.round(multi / 10))} customers in 10`), chip: tr(`${fmt(multi, 0)} % des tickets`, `${fmt(multi, 0)}% of tickets`),
                note: tr("Les autres repartent avec un seul produit : de la place pour proposer.", "The others leave with one product: room to suggest more.") },
              g0 ? { tone: "b", icon: <IconStar size={17} color="#fff" />, lbl: tr("Ce qui fait venir", "What brings people in"),
                val: trData(g0.article), chip: tr(`${fmt(g0.contribution_med, 0)} % du panier`, `${fmt(g0.contribution_med, 0)}% of basket`),
                note: tr(`Dans ${fmt(g0.nb_tickets_multi)} paniers.`, `In ${fmt(g0.nb_tickets_multi)} baskets.`) } : null,
              best ? { tone: "c", icon: <IconLink2 size={17} color="#fff" />, lbl: tr("La paire à proposer", "The pair to suggest"),
                val: `${names(best.antecedent).join(" + ")} → ${names(best.consequent).join(" + ")}`, chip: `${fmt(best.confidence, 0)} %`,
                note: tr("des clients le prennent déjà ensemble.", "of customers already take both.") } : null,
            ].filter(Boolean) as Kpi[]} />

            <div className="pa-row">
              <div className="cc">
                {assocData && !assocData.error && <ChartAssistantButton chartType="association_top12" chartData={{ periode_du_graphique: "tout l'historique (ce graphique ne suit pas la période choisie)", rules: pairs }} chartName="AssociationTop12"
                  userQuestion="Explique les produits achetés ensemble et quoi en faire" position="top-right" onOpenChat={openChat} />}
                <CardHeader
                  title={tr("Les produits achetés ensemble", "Products bought together")}
                  sub={tr("Les paires les plus utiles : fréquentes, et souvent prises ensemble.", "The most useful pairs: frequent, and often taken together.")}
                  scope={{ period: scopeAllYears, calc: tr("Tous les tickets de la période", "All tickets in the period"), unit: tr("% des clients", "% of customers") }}
                  icon={<IconLink2 size={16} color={ORANGE} />}
                />
                {!assocData ? <div className="cs" style={{ padding: 12 }}>{tr("Chargement…", "Loading…")}</div>
                  : pairs.length === 0 ? <div className="cs" style={{ padding: 12 }}>{tr("Aucune paire marquante.", "No notable pair.")}</div>
                  : (
                  <div className="bk-pairs">
                    {pairs.map((r: any, i: number) => {
                      const act = actionOf(r);
                      return (
                        <button key={i} type="button" className="bk-pair" onClick={() => openProduct(String(r.antecedent).split(",")[0].trim())}
                          title={tr(`Achetés ensemble ${fmt(r.lift, 1)} fois plus souvent que par hasard · dans ${fmt(r.support, 1)} % des tickets`, `Bought together ${fmt(r.lift, 1)}× more often than by chance · in ${fmt(r.support, 1)}% of tickets`)}>
                          <span className="bk-pn"><span>{names(r.antecedent).join(" + ")}</span><em aria-hidden="true">→</em><span>{names(r.consequent).join(" + ")}</span></span>
                          <span className="bk-pc"><b className="num">{fmt(r.confidence, 0)} %</b><small>{tr("le prennent aussi", "also take it")}</small></span>
                          <span className={`bk-act a-${act.k}`}>{act.t}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {best && (
                  <Takeaway>
                    {tr(`${fmt(best.confidence, 0)} % des clients qui prennent ${names(best.antecedent).join(" et ")} prennent aussi ${names(best.consequent).join(" et ")} : c'est la paire qui revient le plus (${fmt(best.support, 1)} % des tickets).`,
                        `${fmt(best.confidence, 0)}% of customers who take ${names(best.antecedent).join(" and ")} also take ${names(best.consequent).join(" and ")}: the pair that comes back most (${fmt(best.support, 1)}% of tickets).`)}
                  </Takeaway>
                )}
              </div>

              <div className="cc">
                <ChartAssistantButton chartType="ticket_role_distribution" chartData={{ periode_du_graphique: "tout l'historique (ce graphique ne suit pas la période choisie)", distribution: dist, stats: st, generateurs: gens.slice(0, 10), accessoires: accs.slice(0, 10) }} chartName="TicketRoles"
                  userQuestion="Explique le rôle des produits dans le panier et quoi en faire" position="top-right" onOpenChat={openChat} />
                <CardHeader
                  title={tr("Ce qui fait le panier", "What makes the basket")}
                  sub={tr("Part du montant du panier quand le produit est acheté", "Share of the basket amount when the product is bought")}
                  icon={<IconTicketPerc size={16} color={ORANGE} />}
                />
                <div className="sp2">
                  {gens.slice(0, 5).map((r: any) => (
                    <button key={r.article} type="button" className="sp2-r" onClick={() => openProduct(r.article)}>
                      <span className="sp2-l"><b>{trData(r.article)}</b><em className="num">{fmt(r.contribution_med, 0)} %</em></span>
                      <span className="sp2-b"><i style={{ width: `${Math.max(0, Math.min(100, Number(r.contribution_med) || 0))}%` }} /></span>
                    </button>
                  ))}
                </div>
                {accs.length > 0 && (
                  <div className="sp-add">
                    <div className="bk-rk">{tr("Ce qu'on y ajoute le plus souvent", "What gets added most often")}</div>
                    <div className="sp-chips">
                      {accs.slice(0, 4).map((r: any) => (
                        <button key={r.article} type="button" onClick={() => openProduct(r.article)}>{trData(r.article)} <span className="num">{fmt(r.nb_tickets_multi)}</span></button>
                      ))}
                    </div>
                  </div>
                )}
                {a0 && (
                  <Takeaway>
                    {tr(`${trData(a0.article)} est ajouté dans ${fmt(a0.nb_tickets_multi)} paniers : il accompagne presque tous les achats, à garder toujours en vue.`,
                        `${trData(a0.article)} is added to ${fmt(a0.nb_tickets_multi)} baskets: it goes with almost every purchase, keep it in view.`)}
                  </Takeaway>
                )}
              </div>
            </div>

            <RetainCard max={4} variant="strip"
              tip={tr(`${best ? `proposer ${names(best.consequent).join(" et ")} à chaque ${names(best.antecedent).join(" et ").toLowerCase()} vendu` : "proposer un produit de plus en caisse"}${g0 ? `, ne jamais manquer de ${trData(g0.article)}` : ""}${a0 ? `, et garder ${trData(a0.article)} près de la caisse` : ""}.`,
                       `${best ? `suggest ${names(best.consequent).join(" and ")} with every ${names(best.antecedent).join(" and ")} sold` : "suggest one more product at the till"}${g0 ? `, never run out of ${trData(g0.article)}` : ""}${a0 ? `, and keep ${trData(a0.article)} near the till` : ""}.`)} />

            <Details label={tr(`Voir les ${fmt(ticketAll.length)} produits (part du panier, paniers, chiffre d'affaires)`, `See all ${fmt(ticketAll.length)} products (basket share, baskets, revenue)`)}>
              <div className="cc">
                <ChartAssistantButton chartType="ticket_contribution_top20" chartData={{ periode_du_graphique: "tout l'historique (ce graphique ne suit pas la période choisie)", top20: ticketTop, stats: ticketData.stats }} chartName="TicketContributionTop20"
                  userQuestion="Explique les produits qui contribuent le plus au ticket" position="top-right" onOpenChat={openChat} />
                <ContributionRows rows={ticketAll} />
              </div>
            </Details>
            <ExpertNote>
              Ticket contribution = total_revenue de la ligne / total du ticket × 100, sur les tickets à ≥ 2 produits distincts ; contribution_med = médiane ; « Générateur de chiffre » si médiane ≥ 50 %. Associations : Apriori, support = P(A ∩ B), confidence = P(B | A), lift = P(A ∩ B) / (P(A) × P(B)) ; action = fréquence et probabilité comparées au 70e centile des paires.
            </ExpertNote>
          </div>
        );
      })()}
      {panelName && (
        <ProductPanel name={panelName} base={allItems} extra={panelExtra} onClose={() => setPanelName(null)} />
      )}
    </div>
    </RetainProvider>
    </ProductCtx.Provider>
  );
}
