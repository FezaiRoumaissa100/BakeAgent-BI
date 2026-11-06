"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ExpertNote } from "@/components/Expert";
import { Details, Scope, FilterDrop } from "@/components/Ui";
import { colors, categoryPalette } from "@/lib/theme";
import { fetchPerformance } from "@/lib/api";
import { niceScale, fmtAxisEuro } from "@/lib/chartScale";
import { useBox } from "@/lib/useBox";
import { useSelectedDay, setSelectedDay, dayLong, useSelectedPeriod, periodOfDay } from "@/lib/selectedDay";
import Link from "next/link";
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
const ORANGE = stroke;                 // "var(--ch-1)"
const PEACH = strokeAlt;               // "var(--ch-soft)"
const LIGHT = colors.accentPale;
const INK = ink;                       // "var(--dk-ink)"
const MUTED = muted;                   // "var(--dk-muted)"
const C1 = colors.beige;                  // beige foncé
const C2 = colors.gold;
const AVG = "var(--ch-2)";                   // ligne de moyenne : ambre, distincte de la courbe verte                  // doré
const C3 = colors.amberLight;                  // ambre
const PANIER = colors.green;
const TICKETS = colors.blue;
const PAPER = colors.paper;               // fond crème carte (opaque)
const PAPER_2 = colors.paper2;
const PALETTE: string[] = [...categoryPalette, "var(--ch-ramp-3)", "var(--ch-ramp-7)"];  // ordre fixe : Vert, Blé doré, Bleu, Croûte, Prune, Autres…

// « 2025-12-01 » → « décembre 2025 »
function monthLabel(s?: string) {
  if (!s) return "";
  const d = new Date(s.length === 7 ? s + "-01" : s);
  if (isNaN(d.getTime())) return s;
  const t = d.toLocaleDateString(locale(), { month: "long", year: "numeric" });
  return t.charAt(0).toUpperCase() + t.slice(1);
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
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [, W, H] = useBox(1100, 480, svgRef);   // taille réelle du graphique
  const padL = 64, padR = 96, padT = 40, padB = 44;
  const vals = series.map((s) => s.ca);
  // Graduations rondes ; un peu de marge en haut pour l'étiquette MAX
  const scale = niceScale(Math.max(...vals, moyenne + ecartType) * 1.1);
  const max = scale.max;
  const min = 0;
  const xW = W - padL - padR, yH = H - padT - padB;
  const n = Math.max(series.length - 1, 1);

  const [zoomStart, setZoomStart] = useState<number | null>(null);
  const [zoomEnd, setZoomEnd] = useState<number | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selStart, setSelStart] = useState<number | null>(null);
  const [selCurrent, setSelCurrent] = useState<number | null>(null);
  const [hov, setHov] = useState<number | null>(null);   // mois survolé

  const effStart = zoomStart ?? 0;
  const effEnd = zoomEnd ?? n;
  const effN = Math.max(effEnd - effStart, 1);

  const getX = (i: number) => padL + ((i - effStart) / effN) * xW;
  const getY = (v: number) => padT + yH - ((v - min) / (max - min)) * yH;


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
    if (!isSelecting) { setHov(clientXToIdx(e.clientX)); return; }
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
    setHov(null);
    if (isSelecting) handleMouseUp();
  };

  const resetZoom = () => {
    setZoomStart(null);
    setZoomEnd(null);
  };

  const visibleSeries = series.filter((_, i) => i >= effStart && i <= effEnd);
  const visibleVals = visibleSeries.map(s => s.ca);

  const pts = visibleSeries.map((s, idx) => {
    const i = effStart + idx;
    return { x: getX(i), y: getY(s.ca), s, i };
  });

  let path = "";
  let area = "";
  if (pts.length > 0) {
    path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      // Segments droits d'un mois à l'autre : la ligne ne montre que les vraies valeurs mensuelles
      path += ` L ${pts[i + 1].x} ${pts[i + 1].y}`;
    }
    area = `${path} L ${pts[pts.length - 1].x} ${padT + yH} L ${pts[0].x} ${padT + yH} Z`;
  }

  const yTicks = scale.ticks;

  const isZoomed = zoomStart !== null && zoomEnd !== null;
  const selX1 = selStart !== null && selCurrent !== null ? getX(Math.min(selStart, selCurrent)) : 0;
  const selX2 = selStart !== null && selCurrent !== null ? getX(Math.max(selStart, selCurrent)) : 0;

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
      {isZoomed && (
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
      )}
      <div style={{ position: "relative", flex: 1, minHeight: 0, display: "flex" }}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "100%", cursor: "crosshair" }} preserveAspectRatio="xMidYMid meet"
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
              stroke={AVG} strokeWidth="2" strokeDasharray="8 5" opacity="0.95"/>
        <line x1={padL} x2={W - padR} y1={getY(moyenne + ecartType)} y2={getY(moyenne + ecartType)}
              stroke={C1} strokeWidth="1.2" strokeDasharray="4 4" opacity="0.8"/>
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={getY(v)} y2={getY(v)} stroke="var(--dk-line, #ECEDE7)" strokeWidth="1"/>
            <text x={padL - 12} y={getY(v) + 4} textAnchor="end"
                  fontSize="13" fill={MUTED} fontWeight="700">
              {fmtAxisEuro(v, locale())}
            </text>
          </g>
        ))}
        {area && <path d={area} fill="url(#ev_area2)" />}
        {path && <path d={path} fill="none" stroke={ORANGE} strokeWidth={pts.length > 120 ? 1.6 : pts.length > 48 ? 2.2 : 3.2} strokeLinecap="round" strokeLinejoin="round"/>}
        {/* Mois sous l'axe (l'année sous janvier et sous le premier mois affiché) */}
        {pts.map(({ x, s, i }, k) => {
          const [m, y] = String(s.label || "").split(" ");
          const showYear = k === 0 || (m || "").startsWith("Jan");
          // Selon la place : tous les mois, un sur deux, un par trimestre, ou seulement les années (plusieurs années affichées)
          const gap = pts.length > 1 ? Math.abs(pts[1].x - pts[0].x) : 99;
          const mi = Number(String(s.date || "").slice(5, 7)) - 1;   // 0 = janvier
          const every = gap >= 36 ? 1 : gap >= 18 ? 2 : gap >= 11 ? 3 : 0;
          const hideMonth = every === 0 ? true : (mi >= 0 ? mi % every !== 0 : k % every !== 0);
          // Beaucoup d'années (ex. 20) : une année sur 2 ou sur 5 pour que les années ne se chevauchent pas
          const yGap = gap * 12;
          const yStep = yGap >= 38 ? 1 : yGap >= 19 ? 2 : 5;
          const yNum = Number(y);
          const yearOk = !y || k === 0 || yStep === 1 || yNum % yStep === 0;
          return (
            <g key={`xl${i}`}>
              {!hideMonth && <text x={x} y={padT + yH + 20} textAnchor="middle" fontSize="11.5" fill={MUTED} fontWeight="600">{m}</text>}
              {showYear && yearOk && <text x={x} y={padT + yH + (every === 0 ? 22 : 36)} textAnchor={every === 0 && k > 0 ? "start" : "middle"} fontSize="11" fill="var(--dk-ink2, #3A3655)" fontWeight="800">{y}</text>}
              {showYear && yearOk && every === 0 && k > 0 && <line x1={x} x2={x} y1={padT} y2={padT + yH} stroke="var(--dk-line, #ECEDE7)" strokeWidth="1" strokeDasharray="2 4" />}
            </g>
          );
        })}
        {/* Étiquette de la moyenne, sur fond de carte pour rester lisible quand la courbe passe dessous */}
        {(() => {
          // Dans la marge de droite, au bout de la ligne : plus rien ne cache la courbe
          const x2 = W - padR + 8, y2 = getY(moyenne);
          return (
            <g pointerEvents="none">
              <rect x={x2} y={y2 - 17} width={84} height={34} rx={9} fill="var(--dk-surface, #fff)" stroke={AVG} strokeWidth="1.3" />
              <text x={x2 + 42} y={y2 - 3} textAnchor="middle" fontSize="10" fill={AVG} fontWeight="800">{tr("MOYENNE", "AVERAGE")}</text>
              <text x={x2 + 42} y={y2 + 11} textAnchor="middle" fontSize="11.5" fill={AVG} fontWeight="800">{fmtAxisEuro(moyenne, locale())}</text>
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
        {hov != null && !isSelecting && series[hov] && (
          <g pointerEvents="none">
            <line x1={getX(hov)} x2={getX(hov)} y1={padT} y2={padT + yH} stroke="var(--dk-muted)" strokeWidth="1.2" strokeDasharray="3 3" opacity=".7" />
            <circle cx={getX(hov)} cy={getY(series[hov].ca)} r="6.5" fill={ORANGE} stroke="var(--dk-surface, #fff)" strokeWidth="2.5" />
          </g>
        )}
      </svg>
      {hov != null && !isSelecting && series[hov] && (() => {
        const sx = getX(hov) / W, v = series[hov].ca;
        const d = moyenne ? ((v - moyenne) / moyenne) * 100 : 0;
        const prev = hov > 0 ? series[hov - 1].ca : null;
        const dm = prev ? ((v - prev) / prev) * 100 : null;
        const y12 = hov >= 12 ? series[hov - 12].ca : null;
        const dy = y12 ? ((v - y12) / y12) * 100 : null;
        const sg = (x: number) => `${x >= 0 ? "+" : "−"}${fmt(Math.abs(x), 0)} %`;
        return (
          <div className="ch-tip" style={{ left: `${sx * 100}%`, transform: `translateX(${sx > 0.75 ? "-100%" : sx < 0.2 ? "0" : "-50%"})` }}>
            <div className="ch-tip-d">{(series[hov] as any).label_long || series[hov].label}</div>
            <div className="ch-tip-row"><span className="ch-tip-k">{tr("CA", "Revenue")}</span><b className="num">{fmt(v)} €</b></div>
            <div className="ch-tip-sep" />
            {([[d, tr("vs la moyenne", "vs average")], [dm, tr("vs le mois d'avant", "vs previous month")], [dy, tr("vs un an plus tôt", "vs a year earlier")]] as [number | null, string][])
              .filter(([x]) => x !== null).map(([x, lbl]) => (
                <div key={lbl} className="ch-tip-row ch-tip-cmp"><span className="ch-tip-k">{lbl}</span><b className="num" style={{ color: (x as number) >= 0 ? "var(--dk-ok)" : "var(--dk-alert)" }}>{sg(x as number)}</b></div>
              ))}
          </div>
        );
      })()}
      </div>
    </div>
  );
}

function Comp2425BarChart({ data, yPrec, yDer, yMax = 0 }: { data: Array<{ mois: string; ca_prec: number; ca_der: number }>; yPrec: number; yDer: number; yMax?: number }) {
  const [boxRef, W, H] = useBox(1100, 400);
  const padL = 64, padR = 40, padT = 24, padB = 34;
  const scale = niceScale(Math.max(...data.flatMap(d => [d.ca_prec, d.ca_der]), yMax, 1));   // yMax : même échelle que le graphique du dessus
  const max = scale.max;
  const n = data.length;
  const groupW = (W - padL - padR) / n;
  const barW = (groupW * 0.38);
  const getY = (v: number) => padT + (H - padT - padB) * (1 - v / max);
  const [hov, setHov] = useState<number | null>(null);   // mois survolé
  const hd = hov != null ? data[hov] : null;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
    <svg ref={boxRef} viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "100%" }} preserveAspectRatio="xMidYMid meet" onMouseLeave={() => setHov(null)}>
      {scale.ticks.map((v, i) => {
        const y = getY(v);
        return (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="var(--dk-line, #ECEDE7)"/>
            <text x={padL - 8} y={y + 4} textAnchor="end" fontSize="12" fill={MUTED} fontWeight="700">
              {fmtAxisEuro(v, locale())}
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const gx = padL + i * groupW;
        const x24 = gx + groupW * 0.12;
        const x25 = x24 + barW + groupW * 0.06;
        const y24 = getY(d.ca_prec), y25 = getY(d.ca_der);
        const dim = hov != null && hov !== i;
        return (
          <g key={i} onMouseEnter={() => setHov(i)} style={{ cursor: "pointer" }}>
            <rect x={gx + 2} y={padT} width={groupW - 4} height={getY(0) - padT} rx={6} fill={hov === i ? "var(--dk-soft)" : "transparent"} />
            <rect x={x24} y={y24} width={barW} height={getY(0) - y24} rx={3} fill={colors.amber} fillOpacity={dim ? 0.35 : 0.88}/>
            <rect x={x25} y={y25} width={barW} height={getY(0) - y25} rx={3} fill={ORANGE} fillOpacity={dim ? 0.35 : 0.92}/>
            <text x={gx + groupW / 2} y={H - padB + 18} textAnchor="middle"
                  fontSize="11" fill={INK} fontWeight="700">{trData(d.mois)}</text>
          </g>
        );
      })}
      <g transform={`translate(${W - padR - 180}, 6)`}>
        <rect x="0" y="0" width="12" height="12" rx="3" fill={colors.amber}/>
        <text x="18" y="10" fontSize="11" fill={INK} fontWeight="700">{yPrec}</text>
        <rect x="80" y="0" width="12" height="12" rx="3" fill={ORANGE}/>
        <text x="98" y="10" fontSize="11" fill={INK} fontWeight="700">{yDer}</text>
      </g>
    </svg>
    {hd && (() => {
      const sx = (padL + (hov as number) * groupW + groupW / 2) / W;
      const d = hd.ca_prec > 0 ? ((hd.ca_der - hd.ca_prec) / hd.ca_prec) * 100 : null;
      return (
        <div className="ch-tip" style={{ left: `${sx * 100}%`, transform: `translateX(${sx > 0.75 ? "-100%" : sx < 0.2 ? "0" : "-50%"})` }}>
          <div className="ch-tip-d">{trData(hd.mois)}</div>
          <div className="ch-tip-row"><span className="ch-tip-k"><span className="ch-tip-dot" style={{ background: colors.amber }} />{yPrec}</span><b className="num">{fmt(hd.ca_prec)} €</b></div>
          <div className="ch-tip-row"><span className="ch-tip-k"><span className="ch-tip-dot" style={{ background: ORANGE }} />{yDer}</span><b className="num">{hd.ca_der > 0 ? `${fmt(hd.ca_der)} €` : "—"}</b></div>
          {d !== null && hd.ca_der > 0 && (
            <div className="num" style={{ marginTop: 2, fontWeight: 800, color: d >= 0 ? "var(--dk-ok)" : "var(--dk-alert)" }}>{d >= 0 ? "▲ +" : "▼ −"}{fmt(Math.abs(d), 0)} %</div>
          )}
        </div>
      );
    })()}
    </div>
  );
}

// Nom de produit lisible : « TRADITIONAL BAGUETTE » → « Traditional Baguette »
const SMALL_W = new Set(["au", "aux", "de", "du", "des", "la", "le", "les", "et", "à", "en", "d", "l"]);
const niceName = (x: string) => String(x || "").toLowerCase().split(" ")
  .map((w, i) => (i > 0 && SMALL_W.has(w) ? w : w.replace(/(^|[\-'(])(\p{L})/gu, (_m, a, c) => a + c.toUpperCase()))).join(" ");

// Classement compact : nom · barre fine · montant et part ; bulle au survol
type RankItem = { article: string; value: number; part: number; evo?: number | null };
const evoTxt = (d: number) => `${d >= 0 ? "▲ +" : "▼ −"}${fmt(Math.abs(d), 0)}\u00a0%`;

// Classement compact : rang · nom · barre fine · valeur · part · tendance ; deux colonnes au-delà de 10 produits
function TopRankList({ items, fmtV, fmtS, evoRef, evoHead = "", valLbl }: { items: RankItem[]; fmtV: (v: number) => string; fmtS: (v: number) => string; evoRef: string | null; evoHead?: string; valLbl: string }) {
  const [hov, setHov] = useState<number | null>(null);
  const hasEvo = items.some((it) => it.evo != null);
  const twoCols = items.length > 10;
  const head = (k: string) => (
    <div key={k} className="rank-row rank-head">
      <span />
      <span>{tr("Produit", "Product")}</span>
      <span className="r">{valLbl === tr("Chiffre d'affaires", "Revenue") ? tr("CA", "Revenue") : valLbl === tr("Quantité vendue", "Quantity sold") ? tr("Qté", "Qty") : valLbl}</span>
      {!twoCols && <span className="r">{tr("Part", "Share")}</span>}
      {hasEvo && <span className="r">{evoHead}</span>}
    </div>
  );
  return (
    <div className="rank-wrap">
    <div className={`rank-heads${twoCols ? " two" : ""}${hasEvo ? " evo" : ""}`}>{twoCols ? [head("a"), head("b")] : head("a")}</div>
    <div className={`rank${twoCols ? " two" : ""}${hasEvo ? " evo" : ""}`} style={twoCols ? { gridTemplateRows: `repeat(${Math.ceil(items.length / 2)}, auto)` } : undefined} onMouseLeave={() => setHov(null)}>
      {items.map((it, i) => (
        <div key={i} className={`rank-row${i < 3 ? " top" : ""}${hov === i ? " on" : ""}`} onMouseEnter={() => setHov(i)}>
          <span className="rank-n num">{i + 1}</span>
          <span className="rank-name">{niceName(it.article)}</span>
          <span className="rank-val num"><b>{fmtS(it.value)}</b></span>
          {!twoCols && <span className="rank-pct num">{fmt(it.part, 1)} %</span>}
          {hasEvo && <span className={`rank-evo num ${it.evo == null ? "" : it.evo >= 0 ? "up" : "down"}`}>{it.evo == null ? "—" : evoTxt(it.evo)}</span>}
          {hov === i && (
            <div className={`ch-tip rank-tip${i < 3 || (twoCols && i === Math.ceil(items.length / 2)) ? " below" : ""}`}>
              <div className="ch-tip-d">{niceName(it.article)}</div>
              <div className="ch-tip-row"><span className="ch-tip-k">{valLbl}</span><b className="num">{fmtV(it.value)}</b></div>
              <div className="ch-tip-row"><span className="ch-tip-k">{tr("Part du total", "Share of total")}</span><b className="num">{fmt(it.part, 1)} %</b></div>
              {it.evo != null && evoRef && <div className="ch-tip-row"><span className="ch-tip-k">{evoRef}</span><b className="num" style={{ color: it.evo >= 0 ? "var(--dk-ok)" : "var(--dk-alert)" }}>{evoTxt(it.evo)}</b></div>}
              <div className="ch-tip-row"><span className="ch-tip-k">{tr("Rang", "Rank")}</span><b className="num">{i + 1} / {items.length}</b></div>
            </div>
          )}
        </div>
      ))}
    </div>
    </div>
  );
}

// Petit anneau « part du total » : n°1 · les suivants du classement · tous les autres
function ShareDonut({ items }: { items: RankItem[] }) {
  // Les 3 premiers produits chacun leur part, puis le reste du classement, puis tous les autres produits
  const top = items.slice(0, 3);
  const pTop = top.reduce((a, it) => a + (it.part || 0), 0);
  const pN = items.slice(3).reduce((a, it) => a + (it.part || 0), 0);
  const rest = Math.max(0, 100 - pTop - pN);
  const segs = [
    ...top.map((it, i) => ({ k: `p${i + 1}`, w: it.part || 0, lbl: niceName(it.article) })),
    { k: "pn", w: pN, lbl: tr(`les ${Math.max(0, items.length - 3)} suivants`, `the next ${Math.max(0, items.length - 3)}`) },
    { k: "po", w: rest, lbl: tr("tous les autres", "all the others") },
  ].filter((x) => x.w > 0.05);
  const p1 = pTop;
  const [hov, setHov] = useState<string | null>(null);
  const R = 52, C = 2 * Math.PI * R;
  let acc = 0;
  const on = segs.find((x) => x.k === hov);
  return (
    <div className="sdonut">
      <svg viewBox="0 0 140 140" width="140" height="140" onMouseLeave={() => setHov(null)}>
        <circle cx="70" cy="70" r={R} fill="none" stroke="var(--dk-line)" strokeWidth="16" />
        {segs.map((x) => {
          const len = (x.w / 100) * C, off = acc; acc += len;
          return <circle key={x.k} className={`sd-seg ${x.k}${hov && hov !== x.k ? " dim" : ""}`} cx="70" cy="70" r={R} fill="none" strokeWidth={hov === x.k ? 19 : 16}
            strokeDasharray={`${Math.max(0, len - 2)} ${C}`} strokeDashoffset={-off} transform="rotate(-90 70 70)" onMouseEnter={() => setHov(x.k)} />;
        })}
        <text x="70" y="67" textAnchor="middle" className="sd-big">{fmt(on ? on.w : p1 + pN, 0)} %</text>
        <text x="70" y="84" textAnchor="middle" className="sd-small">{on ? (on.lbl.length > 16 ? on.lbl.slice(0, 15) + "…" : on.lbl) : tr(`les ${items.length} premiers`, `the top ${items.length}`)}</text>
      </svg>
      <div className="sd-leg">
        {segs.map((x) => (
          <span key={x.k} className={`sd-it${hov === x.k ? " on" : ""}`} onMouseEnter={() => setHov(x.k)} onMouseLeave={() => setHov(null)}>
            <span className={`share-dot ${x.k}`} />{!/^p\d$/.test(x.k) && <b className="num">{fmt(x.w, 0)} %</b>}<span className={`sd-lbl${/^p\d$/.test(x.k) ? " wide" : ""}`}>{x.lbl}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// Jour × heure : une case par heure et par jour, plus la couleur est foncée plus la boutique vend à ce moment
function WeekHourHeat({ cells, rareDays, onPick }: { cells: Array<{ dow: number; hour: number; ca_moy: number; tk_moy: number }>; rareDays: number[]; onPick?: (c: any) => void }) {
  const [hov, setHov] = useState<{ dow: number; hour: number } | null>(null);
  const DAYS = [tr("Lun", "Mon"), tr("Mar", "Tue"), tr("Mer", "Wed"), tr("Jeu", "Thu"), tr("Ven", "Fri"), tr("Sam", "Sat"), tr("Dim", "Sun")];
  const DAYS_L = [tr("Lundi", "Monday"), tr("Mardi", "Tuesday"), tr("Mercredi", "Wednesday"), tr("Jeudi", "Thursday"), tr("Vendredi", "Friday"), tr("Samedi", "Saturday"), tr("Dimanche", "Sunday")];
  const useful = cells.filter((c) => c.ca_moy > 0.5 && !rareDays.includes(c.dow));
  if (!useful.length) return null;
  const hours = Array.from(new Set(cells.filter((c) => c.ca_moy > 0.5).map((c) => c.hour))).sort((a, b) => a - b);
  const h0 = hours[0], h1 = hours[hours.length - 1];
  const cols = Array.from({ length: h1 - h0 + 1 }, (_, i) => h0 + i);
  const vmax = Math.max(...useful.map((c) => c.ca_moy), 1);
  const get = (d: number, h: number) => cells.find((c) => c.dow === d && c.hour === h);
  const top = [...useful].sort((a, b) => b.ca_moy - a.ca_moy)[0];
  const hc = hov ? get(hov.dow, hov.hour) : null;
  return (
    <div className="whh" onMouseLeave={() => setHov(null)}>
      <div className="whh-grid" style={{ gridTemplateColumns: `44px repeat(${cols.length}, minmax(0, 1fr))` }}>
        <span />
        {cols.map((h) => <span key={h} className="whh-h num">{String(h).padStart(2, "0")}h</span>)}
        {DAYS.map((dl, d) => {
          const rare = rareDays.includes(d);
          return (
            <React.Fragment key={d}>
              <span className={`whh-d${rare ? " rare" : ""}`} title={rare ? tr("Rarement ouvert", "Rarely open") : undefined}>{dl}</span>
              {cols.map((h) => {
                const c = get(d, h);
                const v = c ? c.ca_moy : 0;
                const t = v / vmax;
                const isTop = top && top.dow === d && top.hour === h;
                return (
                  <span key={h} className={`whh-c${rare ? " rare" : ""}${v <= 0.5 ? " zero" : ""}${isTop ? " top" : ""}${hov && hov.dow === d && hov.hour === h ? " on" : ""}`}
                    style={!rare && v > 0.5 ? { background: `color-mix(in srgb, var(--whh) ${Math.round(12 + t * 88)}%, var(--dk-surface))` } : undefined}
                    onMouseEnter={() => setHov({ dow: d, hour: h })} onClick={() => c && onPick && onPick(c)} />
                );
              })}
            </React.Fragment>
          );
        })}
      </div>
      <div className="whh-foot">
        <span className="whh-leg"><span>{tr("Calme", "Quiet")}</span><span className="whh-ramp" /><span>{tr("Très chargé", "Very busy")}</span></span>
        <span className="whh-info">
          {hc && hov
            ? (rareDays.includes(hov.dow)
                ? tr(`${DAYS_L[hov.dow]} ${hov.hour}h : rarement ouvert`, `${DAYS_L[hov.dow]} ${hov.hour}:00: rarely open`)
                : tr(`${DAYS_L[hov.dow]} ${hov.hour}h–${hov.hour + 1}h : ${fmt(hc.ca_moy)} € et ${fmt(hc.tk_moy)} tickets en moyenne`, `${DAYS_L[hov.dow]} ${hov.hour}:00–${hov.hour + 1}:00: €${fmt(hc.ca_moy)} and ${fmt(hc.tk_moy)} transactions on average`))
            : tr("Survolez une case : chiffre d'affaires et tickets de cette heure, un jour habituel.", "Hover a cell: revenue and transactions for that hour on a typical day.")}
        </span>
      </div>
    </div>
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
  days: Array<{ day: string; ca_total: number; ca_moyen: number; nb_jours?: number }>; mode: "total" | "moyen";
}) {
  const valFn = (d: any) => mode === "total" ? d.ca_total : d.ca_moyen;
  // Jours rarement ouverts (ex. mercredi, quelques jours de fête) : pas de barre (leur moyenne n'est pas comparable),
  // juste une mention sous l'axe. Ils ne comptent ni dans l'échelle, ni dans la moyenne, ni dans le meilleur jour.
  const maxJ = Math.max(...days.map((d: any) => d.nb_jours ?? 0));
  const isRare = (d: any) => d.nb_jours != null && d.nb_jours < maxJ * 0.4;
  const regularDays = days.filter((d: any) => !isRare(d));
  const vals = regularDays.map(valFn);
  const maxRegular = Math.max(...vals, 1);
  const minRegular = Math.min(...vals);
  const mean = vals.reduce((s, v) => s + v, 0) / Math.max(vals.length, 1);
  const [boxRef, W, H] = useBox(1100, 320);
  const padL = 52, padR = 12, padT = 14, padB = 62;
  const slot = (W - padL - padR) / days.length;
  const bw = Math.min(64, slot * 0.6);
  const scale = niceScale(maxRegular * 1.12);
  const getY = (v: number) => padT + (H - padT - padB) * (1 - Math.min(v, scale.max) / scale.max);
  const unit = mode === "total" ? (v: number) => fmtAxisEuro(v, locale()) : (v: number) => `${fmt(v)} €`;

  return (
    <svg ref={boxRef} viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "100%" }} preserveAspectRatio="xMidYMid meet">
      {scale.ticks.map((v, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={getY(v)} y2={getY(v)} stroke="var(--dk-line, #ECEDE7)"/>
          <text x={padL - 8} y={getY(v) + 4} textAnchor="end" fontSize="11.5" fill={MUTED} fontWeight="700">{fmtAxisEuro(v, locale())}</text>
        </g>
      ))}
      {/* Moyenne des jours habituellement ouverts */}
      <line x1={padL} x2={W - padR} y1={getY(mean)} y2={getY(mean)} stroke="var(--dk-ink2)" strokeDasharray="5 4" strokeWidth={1.2}/>
      <text x={padL + 4} y={H - 6} fontSize="11" fill="var(--dk-ink2)" fontWeight="700">
        {tr(`- - -  moyenne des jours habituels : ${unit(mean)}`, `- - -  average of usual days: ${unit(mean)}`)}
      </text>
      {days.map((d, i) => {
        const v = valFn(d);
        const rare = isRare(d);
        const cx = padL + i * slot + slot / 2;
        const best = !rare && v === maxRegular, worst = !rare && v === minRegular;
        return (
          <g key={i}>
            <title>{rare
              ? tr(`${d.day} : ouvert seulement ${(d as any).nb_jours} jours (moyenne ${fmt(v)} € ces jours-là, non comparable)`, `${d.day}: open only ${(d as any).nb_jours} days (average €${fmt(v)} those days, not comparable)`)
              : `${d.day} : ${unit(v)}${(d as any).nb_jours ? tr(` · ${(d as any).nb_jours} jours ouverts`, ` · ${(d as any).nb_jours} open days`) : ""}`}</title>
            {!rare && (
              <>
                <rect x={cx - bw / 2} y={getY(v)} width={bw} height={getY(0) - getY(v)} rx={4}
                      fill={best ? ORANGE : "var(--ch-1)"} fillOpacity={best ? 0.95 : worst ? 0.35 : 0.55}/>
                <text x={cx} y={getY(v) + 16} textAnchor="middle" fontSize={bw < 46 ? 10.5 : 12} fill={best ? "#fff" : INK} fontWeight="800">{fmt(v)}</text>
              </>
            )}
            <text x={cx} y={H - padB + 20} textAnchor="middle" fontSize="12.5" fill={rare ? MUTED : INK} fontWeight="700">{W < 600 ? trData(d.day).slice(0, 3) + "." : trData(d.day)}</text>
            {rare && (d as any).nb_jours != null && (
              <text x={cx} y={H - padB + 36} textAnchor="middle" fontSize="10.5" fill={MUTED} fontWeight="600">
                {W < 600 ? tr("rare", "rare") : tr(`rarement ouvert (${(d as any).nb_jours} j)`, `rarely open (${(d as any).nb_jours} d)`)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function HourlyDual({ data, nbJours }: { data: Array<{ hour: number; heure_label: string; ca: number; tickets: number }>; nbJours: number }) {
  // Moyenne d'un jour ouvert, heure par heure (total de la période ÷ nombre de jours ouverts),
  // pour la même lecture que le graphique des jours. Les tickets sont dans l'info-bulle.
  const j = Math.max(1, nbJours || 1);
  const rows = data.map((d) => ({ ...d, caJ: d.ca / j, tkJ: d.tickets / j }));
  const [boxRef, W, H] = useBox(1100, 320);
  const padL = 64, padR = 16, padT = 26, padB = 44;
  const scale = niceScale(Math.max(...rows.map((d) => d.caJ), 1) * 1.12);
  const n = Math.max(rows.length, 1);
  const groupW = (W - padL - padR) / n;
  const bw = Math.min(46, groupW * 0.62);
  const getY = (v: number) => padT + (H - padT - padB) * (1 - v / scale.max);
  const peak = rows.reduce((m, d) => (d.caJ > m.caJ ? d : m), rows[0] || ({ caJ: 0, hour: -1 } as any));

  return (
    <svg ref={boxRef} viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "100%" }} preserveAspectRatio="xMidYMid meet">
      {scale.ticks.map((v, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={getY(v)} y2={getY(v)} stroke="var(--dk-line, #ECEDE7)"/>
          <text x={padL - 8} y={getY(v) + 4} textAnchor="end" fontSize="11.5" fill={MUTED} fontWeight="700">{fmtAxisEuro(v, locale())}</text>
        </g>
      ))}
      {rows.map((d, i) => {
        const cx = padL + i * groupW + groupW / 2;
        const isPeak = d.hour === peak?.hour;
        const showVal = isPeak;
        return (
          <g key={i}>
            <title>{tr(`${d.heure_label} : ${fmt(d.caJ)} € en moyenne un jour ouvert · ${fmt(d.tkJ, 1)} tickets`, `${d.heure_label}: €${fmt(d.caJ)} on an average open day · ${fmt(d.tkJ, 1)} transactions`)}</title>
            <rect x={cx - bw / 2} y={getY(d.caJ)} width={bw} height={getY(0) - getY(d.caJ)} rx={3}
                  fill={isPeak ? ORANGE : "var(--ch-1)"} fillOpacity={isPeak ? 0.95 : 0.55}/>
            {showVal && (
              <text x={cx} y={getY(d.caJ) - 6} textAnchor="middle" fontSize="12" fill={INK} fontWeight="800">{tr(`${fmt(d.caJ)} €`, `€${fmt(d.caJ)}`)}</text>
            )}
            {(groupW >= 34 || i % 2 === 0) && <text x={cx} y={H - padB + 18} textAnchor="middle" fontSize="12" fill={INK} fontWeight="700">{d.heure_label}</text>}
          </g>
        );
      })}
    </svg>
  );
}

/* Chiffre d'affaires de chaque jour d'un mois (un seul mois choisi) ; le jour choisi est en couleur */
function DailyMonthBars({ rows, avg, sel }: { rows: Array<{ date: string; ca: number }>; avg: number; sel: string | null }) {
  const [boxRef, W, H] = useBox(1100, 300);
  const padL = 56, padR = 12, padT = 22, padB = 34;
  const scale = niceScale(Math.max(...rows.map((r) => r.ca), 1) * 1.1);
  const n = Math.max(rows.length, 1);
  const slot = (W - padL - padR) / n;
  const bw = Math.max(3, Math.min(26, slot * 0.7));
  const getY = (v: number) => padT + (H - padT - padB) * (1 - v / scale.max);
  const dowShort = (ds: string) => new Date(ds + "T12:00:00").toLocaleDateString(tr("fr-FR", "en-GB"), { weekday: "narrow" });
  return (
    <svg ref={boxRef} viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "100%" }} preserveAspectRatio="xMidYMid meet">
      {scale.ticks.map((v, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={getY(v)} y2={getY(v)} stroke="var(--dk-line, #ECEDE7)" />
          <text x={padL - 8} y={getY(v) + 4} textAnchor="end" fontSize="11.5" fill={MUTED} fontWeight="700">{fmtAxisEuro(v, locale())}</text>
        </g>
      ))}
      {avg > 0 && <line x1={padL} x2={W - padR} y1={getY(avg)} y2={getY(avg)} stroke="var(--dk-ink2)" strokeDasharray="5 4" strokeWidth={1.2} />}
      {rows.map((r, i) => {
        const cx = padL + i * slot + slot / 2;
        const isSel = r.date === sel;
        const day = Number(r.date.slice(8, 10));
        const showLbl = n <= 16 || day === 1 || day % 5 === 0 || isSel;
        return (
          <g key={r.date}>
            <title>{`${new Date(r.date + "T12:00:00").toLocaleDateString(tr("fr-FR", "en-GB"), { weekday: "long", day: "numeric", month: "long" })} : ${fmt(r.ca)} €`}</title>
            {r.ca > 0 ? (
              <rect x={cx - bw / 2} y={getY(r.ca)} width={bw} height={getY(0) - getY(r.ca)} rx={3}
                fill={isSel ? ORANGE : "var(--ch-1)"} fillOpacity={isSel ? 1 : 0.45} />
            ) : (
              <text x={cx} y={getY(0) - 4} textAnchor="middle" fontSize="9" fill={MUTED}>×</text>
            )}
            {isSel && r.ca > 0 && <text x={cx} y={getY(r.ca) - 6} textAnchor="middle" fontSize="12" fontWeight="800" fill={INK}>{fmt(r.ca)} €</text>}
            {showLbl && <text x={cx} y={H - padB + 15} textAnchor="middle" fontSize="10.5" fontWeight={isSel ? 800 : 600} fill={isSel ? INK : MUTED}>{day}</text>}
            {showLbl && n <= 16 && <text x={cx} y={H - padB + 28} textAnchor="middle" fontSize="9.5" fill={MUTED}>{dowShort(r.date)}</text>}
          </g>
        );
      })}
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

  // Année(s) et mois : choisis dans la barre du haut (période partagée avec Produits ; un jour choisi règle son mois)
  const [per, setPer, perReady] = useSelectedPeriod();
  const annee = per.annee, mois = per.mois;
  const anneeLbl = annee === "Toutes" ? tr("Toutes", "All") : annee.split(",").join(", ");
  const [saison, setSaison] = useState<string>("Toutes");
  const [categorie, setCategorie] = useState<string>("Toutes");
  const [evenement, setEvenement] = useState<string>("Tous");
  const [activeTab, setActiveTab] = useState<TabId>("evolution");
  const [topN, setTopN] = useState(10);
  // Classement selon : chiffre d'affaires, quantité vendue ou nombre de tickets
  const [topMetric, setTopMetric] = useState<"ca" | "qte" | "tkt">("ca");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    if (!perReady) return;
    // Petit délai : cocher plusieurs années d'affilée ne lance qu'une seule demande
    const tm = setTimeout(() => {
      fetchPerformance({ annee, saison, mois, categorie, evenement })
        .then((res) => {
          if (cancelled) return;
          setData(res);
          setLoading(false);
        })
        .catch(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);
    return () => { cancelled = true; clearTimeout(tm); };
  }, [annee, saison, mois, categorie, evenement, perReady]);

  const kpis = useMemo(() => {
    const r = data?.kpis || {};
    return {
      total_ca: r.total_ca ?? r.ca_total ?? 0,
      nb_tickets: r.nb_tickets ?? r.tickets ?? 0,
      panier: r.panier ?? 0,
      nb_jours: r.nb_jours ?? r.jours_actifs ?? 0,
      nb_jours_ouverts: r.nb_jours_ouverts ?? r.nb_jours ?? r.jours_actifs ?? 0,   // jours ouverts, sans les ventes isolées d'un jour fermé
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
  // Comparaison sur la même période de l'année (ex. 1er jan – 15 mars des deux côtés si l'année n'est pas finie)
  const ck = data?.comp_kpis || null;
  // « Mars 2025 vs 2024 » quand un mois est choisi, sinon « 2025 vs 2024 »
  const cmpRef = ck ? `${mois !== "Tous" ? trData(mois) + " " : ""}${ck.der} vs ${ck.prec}` : "";
  const vsN1 = (cur: number, prev?: number, key?: "total_ca" | "nb_tickets" | "panier") => {
    if (ck) {
      if (!key || !ck.kpis_prec?.[key] || !ck.kpis_der?.[key]) return null;
      const d = ((ck.kpis_der[key] - ck.kpis_prec[key]) / ck.kpis_prec[key]) * 100;
      return tr(`${cmpRef} : ${d >= 0 ? "▲ +" : "▼ "}${fmt(d, 1)} %`, `${cmpRef}: ${d >= 0 ? "▲ +" : "▼ "}${fmt(d, 1)}%`);
    }
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
  // Même comparaison que les pastilles, en nombres : pour relier clients, panier et chiffre d'affaires
  const dOf = (key: "total_ca" | "nb_tickets" | "panier") => {
    if (ck) return ck.kpis_prec?.[key] && ck.kpis_der?.[key] ? ((ck.kpis_der[key] - ck.kpis_prec[key]) / ck.kpis_prec[key]) * 100 : null;
    if (n1 && n1[key]) return ((kpis[key] - n1[key]) / n1[key]) * 100;
    if (annee === "Toutes" && y25 && y24 && y24[key]) return ((y25[key] - y24[key]) / y24[key]) * 100;
    return null;
  };
  const story = (() => {
    const dc = dOf("total_ca"), dt = dOf("nb_tickets"), dp = dOf("panier");
    if (dc === null || dt === null || dp === null) return null;
    const ref = ck ? cmpRef : n1 ? `${annee} vs ${n1.annee}` : `${yDerK} vs ${yPrecK}`;
    // Période comparée quand une des deux années n'est pas complète
    const MOL = [tr("janv.", "Jan"), tr("févr.", "Feb"), tr("mars", "Mar"), tr("avr.", "Apr"), tr("mai", "May"), tr("juin", "Jun"), tr("juil.", "Jul"), tr("août", "Aug"), tr("sept.", "Sep"), tr("oct.", "Oct"), tr("nov.", "Nov"), tr("déc.", "Dec")];
    const md = (x: string) => { const [m, d] = String(x).split("-").map(Number); return `${d === 1 ? tr("1er", "1") : d} ${MOL[(m || 1) - 1]}`; };
    const period = ck && !ck.complet ? tr(`Comparé sur la même période des deux années : du ${md(ck.debut)} au ${md(ck.fin)}.`, `Compared over the same period in both years: ${md(ck.debut)} to ${md(ck.fin)}.`) : null;
    const p = (d: number) => `${d >= 0 ? "+" : "−"}${fmt(Math.abs(d), 0)}\u00a0%`;
    let fr: string, en: string, tipFr: string, tipEn: string;
    if (dt < 0 && dp >= 0) {
      fr = `Moins de clients (${p(dt)}), mais chacun dépense plus (${p(dp)}) : ${dc >= 0 ? `le chiffre d'affaires progresse quand même (${p(dc)})` : `pas assez pour compenser, le chiffre d'affaires recule (${p(dc)})`}.`;
      en = `Fewer customers (${p(dt)}), but each one spends more (${p(dp)}): ${dc >= 0 ? `revenue still grows (${p(dc)})` : `not enough to make up for it, revenue falls (${p(dc)})`}.`;
      tipFr = "Piste : faire revenir les clients."; tipEn = "Next step: bring customers back.";
    } else if (dt >= 0 && dp < 0) {
      fr = `Plus de clients (${p(dt)}), mais des paniers plus petits (${p(dp)}) : ${dc >= 0 ? `le chiffre d'affaires progresse (${p(dc)})` : `le chiffre d'affaires recule (${p(dc)})`}.`;
      en = `More customers (${p(dt)}), but smaller baskets (${p(dp)}): ${dc >= 0 ? `revenue grows (${p(dc)})` : `revenue falls (${p(dc)})`}.`;
      tipFr = "Piste : proposer un produit en plus à chaque passage."; tipEn = "Next step: suggest one more item at each visit.";
    } else if (dt >= 0 && dp >= 0) {
      fr = `Plus de clients (${p(dt)}) et des paniers plus gros (${p(dp)}) : le chiffre d'affaires progresse (${p(dc)}).`;
      en = `More customers (${p(dt)}) and bigger baskets (${p(dp)}): revenue grows (${p(dc)}).`;
      tipFr = "Bonne dynamique : garder le cap."; tipEn = "Good momentum: keep it up.";
    } else {
      fr = `Moins de clients (${p(dt)}) et des paniers plus petits (${p(dp)}) : le chiffre d'affaires recule (${p(dc)}).`;
      en = `Fewer customers (${p(dt)}) and smaller baskets (${p(dp)}): revenue falls (${p(dc)}).`;
      tipFr = "Piste : faire revenir les clients et soigner les ventes en plus."; tipEn = "Next step: bring customers back and work on add-on sales.";
    }
    return { ref, period, text: tr(fr, en), tip: tr(tipFr, tipEn), up: dc >= 0 };
  })();

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

  // Jour choisi dans la barre du haut : on propose de voir son mois
  const [selDay] = useSelectedDay();
  const MOIS_FR = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
  const selMonthName = selDay ? MOIS_FR[Number(selDay.slice(5, 7)) - 1] : "";
  const selYear = selDay ? selDay.slice(0, 4) : "";
  const showingSelMonth = !!selDay && annee === selYear && mois === selMonthName;

  const monthly = data?.monthly || {};
  // Un seul mois dans les données filtrées : on montre les jours de ce mois (fourni par le backend)
  const dailyRows: any[] = monthly.daily || [];
  const oneMonth = (monthly.series?.length || 0) <= 1 && dailyRows.length > 0;
  const topProds = data?.top_products || {};
  const seasonality = data?.seasonality || {};
  // Période réellement couverte par les graphiques (affichée sous chaque titre)
  const pY0 = String(data?.periode?.debut || "").slice(0, 4), pY1 = String(data?.periode?.fin || "").slice(0, 4);
  const scopeYears = annee !== "Toutes" ? anneeLbl : (pY0 && pY1 && pY0 !== pY1 ? `${pY0} – ${pY1}` : pY0 || tr("toute la période", "whole period"));
  const periodTxt = mois !== "Tous" ? `${trData(mois)} ${scopeYears}` : scopeYears;
  const scopePeriod = [
    scopeYears,
    mois !== "Tous" ? trData(mois) : "",
    saison !== "Toutes" ? tr(`saison ${trData(saison)}`, `${trData(saison)} season`) : "",
    categorie !== "Toutes" ? trData(categorie) : "",
    evenement !== "Tous" ? trData(evenement) : "",
  ].filter(Boolean).join(" · ");
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

  // Jours forts / faibles : seulement parmi les jours HABITUELLEMENT ouverts.
  // Un jour rarement ouvert (ex. le mercredi, ouvert seulement quelques jours de fête) a une moyenne trompeuse.
  const saisonInsights = useMemo(() => {
    const all = seasonality?.days || [];
    if (!all.length) return null;
    const maxJ = Math.max(...all.map((d: any) => d.nb_jours ?? 0));
    const regular = (d: any) => d.nb_jours == null || d.nb_jours >= maxJ * 0.4;
    const days = all.filter(regular);
    const rare = all.filter((d: any) => !regular(d));
    if (!days.length) return null;
    const best = days.reduce((a: any, b: any) => a.ca_moyen > b.ca_moyen ? a : b);
    const worst = days.reduce((a: any, b: any) => a.ca_moyen < b.ca_moyen ? a : b);
    const ratio = best.ca_moyen / Math.max(worst.ca_moyen || 1, 1);
    return { best, worst, ratio, rare };
  }, [seasonality]);
  // Phrase « fermé le mercredi (ouvert seulement 23 fois, des jours particuliers) »
  const rareNote = (fr: boolean) => {
    const r: any[] = saisonInsights?.rare || [];
    if (!r.length) return "";
    const names = r.map((d) => (fr ? d.day : trData(d.day)).toLowerCase()).join(fr ? " et le " : " and ");
    const n = r.map((d) => d.nb_jours).join("/");
    if (r.every((d) => !d.nb_jours))      // jamais ouvert sur la période : simplement fermé
      return fr ? ` La boutique est fermée le ${names}.` : ` The shop is closed on ${names}.`;
    return fr ? ` La boutique est habituellement fermée le ${names} (ouverte seulement ${n} fois, des jours particuliers).`
              : ` The shop is usually closed on ${names} (open only ${n} times, on special days).`;
  };

  if (loading && !data) {
    return (
      <div style={{ padding: "40px", color: MUTED, fontSize: "0.9rem", fontWeight: 600, display:"flex", alignItems:"center", gap:"10px"}}>
        <IconSparkline size={20} /> {tr("Chargement de l'analyse commerciale...", "Loading sales analysis...")}
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: "40px" }} className={loading ? "perf-busy" : ""} aria-busy={loading}>
      {loading && (
        <div className="busy-pill" role="status">
          <span className="busy-dot" aria-hidden="true" />{tr("Mise à jour des chiffres…", "Updating figures…")}
        </div>
      )}

      {/* ══════════════════════════════════════════════
          TITRE DE PAGE + DESCRIPTION
          ══════════════════════════════════════════════ */}
      <div style={{ marginBottom: "20px", padding: "0 28px" }}>
        <h1 style={{ fontSize:"1.8rem", fontWeight:800, color:INK,
                     letterSpacing:"-0.03em", lineHeight:1.1, margin:0 }}>
          {tr("Performance", "Overall")} <span style={{ color: ORANGE }}>{tr("Générale", "Performance")}</span>
        </h1>
        <p className="page-lead">
          <span className="page-lead-ic" aria-hidden="true"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.3-2.4 3.6M12 17h.01" /></svg></span>
          <span>
          {tr("Comment la boutique vend : l'évolution des ventes, les produits qui rapportent, les jours et heures forts, et le poids de chaque famille.",
              "How the shop sells: the sales trend, the products that earn, the strong days and hours, and the weight of each family.")}
          </span>
        </p>
      </div>

      {/* ══════ FILTRES — une seule barre compacte : année et mois en boutons, le reste en petites listes ══════ */}
      <div className="sw" style={{ marginBottom: "8px" }}>
        <div className="filter-bar">
          <span className="fd-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 5h18l-7 8v6l-4 2v-8Z" /></svg>
            {tr("Filtres", "Filters")}
          </span>
          {/* Quatre listes déroulantes, même style : année, mois, famille, événement */}
          <span className="per-note">{tr("Période : en haut à droite", "Period: top right")}</span>
          <FilterDrop label={tr("Famille", "Family")} value={categorie} allValue="Toutes" onChange={setCategorie}
            icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" /><circle cx="7.5" cy="7.5" r="1.5" /></svg>}
            options={filters.categories.map((o: string) => ({ value: o, label: o === "Toutes" ? tr("Toutes", "All") : trData(o) }))} />
          <FilterDrop label={tr("Jour de fête", "Holiday")} value={evenement} allValue="Tous" onChange={setEvenement}
            icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9Z" /></svg>}
            options={filters.evenements.map((o: string) => ({ value: o, label: o === "Tous" ? tr("Toutes", "All") : trData(o) }))} />
          {(saison !== "Toutes" || categorie !== "Toutes" || evenement !== "Tous") && (
            <button type="button" className="filter-reset" title={tr("Effacer les filtres", "Clear filters")} aria-label={tr("Effacer les filtres", "Clear filters")}
              onClick={() => { setSaison("Toutes"); setCategorie("Toutes"); setEvenement("Tous"); }}>
              ×
            </button>
          )}
        </div>
      </div>

      {selDay && (
        <div className="sw">
          <div className="day-note">
            <span>{tr("Jour choisi :", "Chosen day:")} <b>{dayLong(selDay, tr("fr-FR", "en-GB"))}</b>{showingSelMonth ? tr(" · les graphiques montrent son mois", " · charts show its month") : ""}</span>
            {!showingSelMonth && (
              <button type="button" onClick={() => { setSaison("Toutes"); setPer(periodOfDay(selDay as string)); }}>
                {tr(`Voir ${selMonthName.toLowerCase()} ${selYear}`, `See ${selMonthName} ${selYear}`)}
              </button>
            )}
            <Link href="/">{tr("Voir ce jour en détail", "See this day in detail")}</Link>
            <button type="button" onClick={() => { setSelectedDay(null); }}>{tr("Revenir à toute la période", "Back to the whole period")}</button>
          </div>
        </div>
      )}


      {/* ══════════════════════════════════════════════
          KPIs — Style Vue du Jour (cc, sw, ct, cs)
          ══════════════════════════════════════════════ */}
      <div className="sw">
        {/* Trois chiffres de la période choisie : une seule bande fine, une teinte par chiffre,
            la valeur et l'évolution sur la même ligne */}
        <div className="kpi-strip">
          {[
            { tone: "a", icon: <IconCash size={17} color="#fff" />, lbl: tr("Chiffre d'affaires", "Revenue"), val: `${fmt(kpis.total_ca / 1000, 1)} k€`, d: vsN1(kpis.total_ca, n1?.total_ca, "total_ca") },
            { tone: "b", icon: <IconTicket size={17} color="#fff" />, lbl: tr("Tickets", "Transactions"), val: fmt(kpis.nb_tickets), d: vsN1(kpis.nb_tickets, n1?.nb_tickets, "nb_tickets") },
            { tone: "c", icon: <IconCart size={17} color="#fff" />, lbl: tr("Panier moyen", "Average basket"), val: `${fmt(kpis.panier, 2)} €`, d: vsN1(kpis.panier, n1?.panier, "panier") },
          ].map((k) => {
            const up = k.d ? k.d.includes("▲") : null;
            return (
              <div key={k.lbl} className={`ks-item ks-${k.tone}`}>
                <span className="ks-ic" aria-hidden="true">{k.icon}</span>
                <div style={{ minWidth: 0 }}>
                  <div className="ks-lbl">{k.lbl}</div>
                  <div className="ks-line">
                    <span className="ks-val num">{k.val}</span>
                    {k.d && <span className={`ks-d num ${up ? "up" : "down"}`}>{k.d}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          4 ONGLETS (icônes SVG + pas emojis)
          ══════════════════════════════════════════════ */}
      <div className="sw" style={{ marginTop: 16 }}>
        <div className="prod-tabs perf-tabs">
          {([
            { id:"evolution", Icon: IconTrendUp, label:tr("Évolution des ventes", "Sales trend"), sub: tr("mois par mois", "month by month") },
            { id:"top",       Icon: IconTrophy,  label:tr("Meilleurs produits", "Best products"), sub: tr("ce qui rapporte le plus", "top earners") },
            { id:"saison",    Icon: IconCalendar, label:tr("Jours & heures", "Days & hours"), sub: tr("quand la boutique vend", "when the shop sells") },
            { id:"categories",Icon: IconTag,     label:tr("Familles", "Families"), sub: tr("poids de chaque famille", "weight of each family") },
          ] as const).map((t) => {
            const on = activeTab === t.id;
            const Ic = t.Icon as any;
            return (
              <button key={t.id} type="button" onClick={() => setActiveTab(t.id)} className={`prod-tab${on ? " on" : ""}`} aria-pressed={on}>
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
      </div>

      {/* ──────────────────────────────────────────────
          TAB 1 · ÉVOLUTION DU CA
          ────────────────────────────────────────────── */}
      {activeTab === "evolution" && (
        <div className="sw" style={{ paddingTop:"14px" }}>
          <div className="sec-title" style={{ display:"flex", alignItems:"center", gap:"9px"}}>
            <IconTrendUp size={16} /> {tr("Comment les ventes évoluent, mois par mois", "How sales move, month by month")}
          </div>
          {/* Un seul mois choisi (ex. un jour choisi dans la barre du haut) : le chiffre d'affaires jour par jour de ce mois */}
          {oneMonth && (() => {
            const open = dailyRows.filter((d: any) => d.ca > 0);
            const avg = open.reduce((s: number, d: any) => s + d.ca, 0) / Math.max(open.length, 1);
            const best = open.reduce((m: any, d: any) => (!m || d.ca > m.ca ? d : m), null);
            const worst = open.reduce((m: any, d: any) => (!m || d.ca < m.ca ? d : m), null);
            const sel = selDay ? dailyRows.find((d: any) => d.date === selDay) : null;
            const dLbl = (ds: string) => new Date(ds + "T12:00:00").toLocaleDateString(tr("fr-FR", "en-GB"), { weekday: "long", day: "numeric", month: "long" });
            const monthName = new Date(dailyRows[0].date + "T12:00:00").toLocaleDateString(tr("fr-FR", "en-GB"), { month: "long", year: "numeric" });
            return (
              <div className="grid-main stretch">
                <div className="cc" style={{ padding: "20px 24px" }}>
                  <ChartAssistantButton chartType="daily_month" chartData={{ jours: dailyRows, moyenne: avg, jour_choisi: selDay, filtres_page: { annee, mois, categorie, evenement } }} chartName="DailyMonth"
                    userQuestion="Explique le chiffre d'affaires jour par jour de ce mois" position="top-right" onOpenChat={openChat} />
                  <div className="ct">{tr(`Chiffre d'affaires jour par jour — ${monthName}`, `Revenue day by day — ${monthName}`)}</div>
                  <Scope period={scopePeriod} calc={tr("Total de chaque jour", "Total of each day")} unit="€" style={{ marginTop: 4 }} />
                  <div className="cs">{tr(`Un seul mois est choisi : chaque barre est un jour.${sel ? " Le jour choisi est en couleur." : ""} Pointillés = moyenne des jours ouverts.`, `Only one month is selected: each bar is a day.${sel ? " The chosen day is highlighted." : ""} Dashed line = average of open days.`)}</div>
                  <div style={{ height: "300px", width: "100%", marginTop: "8px" }}>
                    <DailyMonthBars rows={dailyRows} avg={avg} sel={selDay} />
                  </div>
                  {sel && avg > 0 && (
                    <Takeaway>
                      {tr(`Le ${dLbl(sel.date)} : ${fmt(sel.ca)} €, soit ${sel.ca >= avg ? "+" : "−"}${fmt(Math.abs(sel.ca / avg - 1) * 100)} % par rapport à un jour moyen de ce mois (${fmt(avg)} €).`,
                          `${dLbl(sel.date)}: €${fmt(sel.ca)}, ${sel.ca >= avg ? "+" : "−"}${fmt(Math.abs(sel.ca / avg - 1) * 100)}% vs an average day this month (€${fmt(avg)}).`)}
                    </Takeaway>
                  )}
                </div>
                <div className="side-col">
                  <div className="cc" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div className="ct">{tr("Repères du mois", "Month landmarks")}</div>
                    {sel && <InsightBox icon={<IconCalendar size={16} color={ORANGE} />} color={ORANGE} title={tr("Jour choisi", "Chosen day")} strong={`${dLbl(sel.date)} — ${fmt(sel.ca)} €`} />}
                    {best && <InsightBox icon={<IconArrowMaxUp size={16} color={ORANGE} />} color={ORANGE} title={tr("Meilleur jour", "Best day")} strong={`${dLbl(best.date)} — ${fmt(best.ca)} €`} />}
                    {worst && <InsightBox icon={<IconArrowMinDown size={16} color={C1} />} color={C1} title={tr("Jour ouvert le plus faible", "Weakest open day")} strong={`${dLbl(worst.date)} — ${fmt(worst.ca)} €`} />}
                    <InsightBox icon={<IconScale size={16} color={C3} />} color={C3} title={tr("Jour moyen", "Average day")} strong={tr(`${fmt(avg)} € sur ${open.length} jours ouverts`, `€${fmt(avg)} over ${open.length} open days`)} />
                    {ck && ck.kpis_prec?.total_ca > 0 && ck.kpis_der?.total_ca > 0 && (() => {
                      const d = ((ck.kpis_der.total_ca - ck.kpis_prec.total_ca) / ck.kpis_prec.total_ca) * 100;
                      const md = (x: string) => { const [m, dd] = String(x).split("-").map(Number); return `${dd}/${String(m).padStart(2, "0")}`; };
                      const part = !ck.complet && mois !== "Tous" ? tr(` (du ${md(ck.debut)} au ${md(ck.fin)})`, ` (${md(ck.debut)} to ${md(ck.fin)})`) : "";
                      return <InsightBox icon={<IconTrendUp size={16} color={d >= 0 ? "#1E9E64" : "#D9483B"} />} color={d >= 0 ? "#1E9E64" : "#D9483B"}
                        title={tr(`${cmpRef}${part}`, `${cmpRef}${part}`)}
                        strong={tr(`${d >= 0 ? "▲ +" : "▼ −"}${fmt(Math.abs(d), 0)} % · ${fmt(ck.kpis_der.total_ca)} € contre ${fmt(ck.kpis_prec.total_ca)} €`, `${d >= 0 ? "▲ +" : "▼ −"}${fmt(Math.abs(d), 0)}% · €${fmt(ck.kpis_der.total_ca)} vs €${fmt(ck.kpis_prec.total_ca)}`)} />;
                    })()}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* À gauche : CA mois par mois, puis la comparaison N vs N−1 dessous (même taille, même échelle).
              À droite : « Repères » sur toute la hauteur, avec des repères utiles pour cette page. */}
          {!oneMonth && (() => {
            const series: any[] = monthly.series || [];
            const mu = Number(monthly.moyenne) || 0, sd = Number(monthly.ecart_type) || 0;
            const monthOnly = (m: any) => String(m.label_long || m.label || "").replace(/\s*\d{4}$/, "");
            const uniq = (arr: string[]) => Array.from(new Set(arr));
            const byCal = (arr: any[]) => [...arr].sort((a: any, b: any) => String(a.date).slice(5, 7).localeCompare(String(b.date).slice(5, 7)));
            const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
            const hi = uniq(byCal(series.filter((m: any) => m.ca > mu + sd)).map(monthOnly)).map(cap);
            const lo = uniq(byCal(series.filter((m: any) => m.ca < mu - sd)).map(monthOnly)).map(cap);
            // « À retenir » : avec une année d'avant, on relie clients / panier / CA ;
            // sans année d'avant (ex. première année), on retient l'écart entre mois forts et mois calmes
            const andList = (a: string[]) => a.length > 1 ? `${a.slice(0, -1).join(", ")} ${tr("et", "and")} ${a[a.length - 1]}` : (a[0] || "");
            const keep = story || (() => {
              const mxv = Number(monthly.ca_max?.val) || 0, mnv = Number(monthly.ca_min?.val) || 0;
              if (!mxv || series.length < 2) return null;
              const ratio = mnv > 0 ? mxv / mnv : 0;
              const mxL = monthLabel(monthly.ca_max?.date_str), mnL = monthLabel(monthly.ca_min?.date_str);
              const text = ratio >= 1.3
                ? tr(`Le meilleur mois (${mxL}) vend ${fmt(ratio, 1)} fois plus que le plus faible (${mnL}).`,
                     `The best month (${mxL}) sells ${fmt(ratio, 1)}× more than the weakest (${mnL}).`)
                : tr(`Les ventes restent régulières d'un mois à l'autre (de ${fmt(mnv)} € à ${fmt(mxv)} €).`,
                     `Sales stay steady from month to month (${fmt(mnv)} € to ${fmt(mxv)} €).`);
              const tip = hi.length
                ? tr(`prévoir plus de stock et de personnel pour ${andList(hi)}${lo.length ? `, et animer les mois calmes (${andList(lo)})` : ""}.`,
                     `plan more stock and staff for ${andList(hi)}${lo.length ? `, and boost the quiet months (${andList(lo)})` : ""}.`)
                : lo.length ? tr(`animer les mois calmes (${andList(lo)}).`, `boost the quiet months (${andList(lo)}).`)
                : tr("garder le rythme, et comparer avec l'année prochaine.", "keep the pace, and compare with next year.");
              return { ref: periodTxt, period: tr("Pas d'année précédente à comparer.", "No previous year to compare with."), text, tip, up: true };
            })();
            const comp: any[] = monthly.comp_24_25 || [];
            const both = comp.filter((m: any) => m.ca_prec > 0 && m.ca_der > 0).map((m: any) => ({ ...m, d: ((m.ca_der - m.ca_prec) / m.ca_prec) * 100 }));
            const ca = monthly.comp_annees;
            // Même échelle pour les deux graphiques
            const evoMax = niceScale(Math.max(...series.map((m: any) => m.ca), ...comp.flatMap((m: any) => [m.ca_prec, m.ca_der]), mu + sd, 1) * 1.1).max;
            const upN = both.filter((m: any) => m.d > 0).length;
            const tp = both.reduce((a: number, m: any) => a + m.ca_prec, 0), td = both.reduce((a: number, m: any) => a + m.ca_der, 0);
            const dTot = tp ? ((td - tp) / tp) * 100 : 0;
            const bestUp = [...both].sort((a: any, b: any) => b.d - a.d)[0];
            const worst = [...both].sort((a: any, b: any) => a.d - b.d)[0];
            const lastM = both[both.length - 1];
            const sg = (d: number) => `${d >= 0 ? "+" : "−"}${fmt(Math.abs(d), 0)} %`;
            const showComp = comp.length > 0 && ca;
            return (
            <div className={`evo-grid${showComp ? "" : " evo-single"}`}>
              <div className="evo-left">
          <div className="cc" style={{ padding:"20px 24px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start",
                          marginBottom:"4px", flexWrap:"wrap", gap:"8px" }}>
              <div>
                <ChartAssistantButton chartType="evolution_ca" chartData={{ series: monthly.series, moyenne: monthly.moyenne, ecartType: monthly.ecart_type, caMax: monthly.ca_max, caMin: monthly.ca_min, filtres_page: { annee, saison, mois, categorie, evenement } }} chartName="EvolutionLineChart"
                  userQuestion="Explique ce graphique d'évolution du chiffre d'affaires" position="top-right" onOpenChat={openChat} />
                <div className="ct" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {tr("Chiffre d'affaires mois par mois", "Revenue month by month")}
                  {/* Légende discrète : au survol du ⓘ (pour l'analyste), sans encombrer le graphique */}
                  <span className="leg-info" tabIndex={0} aria-label={tr("Légende", "Legend")}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9.5" /><path d="M12 11v6M12 7.5h.01" /></svg>
                    <span className="leg-pop" role="tooltip">
                      <span className="leg-row"><span className="leg-line" style={{ background: ORANGE }} />{tr("CA mensuel", "Monthly revenue")}</span>
                      <span className="leg-row"><span className="leg-line dash" style={{ borderColor: AVG }} />{tr("Moyenne des mois", "Monthly average")}</span>
                      <span className="leg-row"><span className="leg-band" style={{ background: PEACH }} />{tr("Fourchette habituelle (moyenne ± 1 écart-type)", "Usual range (average ± 1 std dev)")}</span>
                    </span>
                  </span>
                </div>
              </div>
            </div>
            <div style={{ marginBottom: 2, display: "flex", alignItems: "center", flexWrap: "wrap", gap: "4px 14px" }}>
                <Scope period={scopePeriod} calc={tr("Total de chaque mois", "Total of each month")} unit="€" style={{ marginTop: 0 }} />
                <div className="cs" style={{ margin: 0 }}>{tr("Moyenne :", "Average:")} {fmt(monthly.moyenne)} € · {tr("fourchette :", "range:")} {fmt(Math.max(0, monthly.moyenne - monthly.ecart_type))} – {fmt(monthly.moyenne + monthly.ecart_type)} €</div>
            </div>
            <div className="evo-chart1" style={{ height:"236px", width:"100%", marginTop:"2px" }}>
              {monthly.series && <EvolutionLineChart
                series={monthly.series} moyenne={monthly.moyenne} ecartType={monthly.ecart_type}
                caMax={monthly.ca_max} caMin={monthly.ca_min} />}
            </div>
            <ExpertNote>
              Fourchette habituelle = moyenne mensuelle ± 1 écart-type (σ = {fmt(monthly.ecart_type || 0)} €, μ = {fmt(monthly.moyenne || 0)} €), calculée sur les mois filtrés. Panier moyen = CA / COUNT(DISTINCT (date_id, ticket_number)). Comparaison : kpis_n1 (année − 1, mêmes filtres) ou kpis_par_annee (2025 vs 2024).
            </ExpertNote>

          </div>
                {showComp && (
              <div className="cc" style={{ padding:"20px 24px" }}>
                <ChartAssistantButton chartType="comparison_2024_2025" chartData={{ data: comp, annees: ca, filtres_page: { annee, saison, mois, categorie, evenement } }} chartName="Comp2425BarChart"
                  userQuestion="Explique ce graphique comparant le CA des deux années" position="top-right" onOpenChat={openChat} />
                <div className="ct">{tr("Cette année face à l'an dernier", "This year vs last year")}</div>
                <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "8px 12px" }}>
                  <Scope period={`${ca.der} vs ${ca.prec}`} calc={tr("Total de chaque mois, une barre par année", "Total of each month, one bar per year")} unit="€" style={{ marginTop: 0 }} />
                </div>
                <div style={{ height:"200px", width:"100%", marginTop:"2px" }}>
                  <Comp2425BarChart data={comp} yPrec={Number(ca.prec)} yDer={Number(ca.der)} yMax={evoMax}/>
                </div>
              </div>
                )}
              </div>
              <div className="evo-side">
                <div className="rep-head">
                  <span className="rep-head-ic" aria-hidden="true">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" fillOpacity=".3" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"><path d="M6.5 3.5h11a1 1 0 0 1 1 1V21l-6.5-4.4L5.5 21V4.5a1 1 0 0 1 1-1z" /></svg>
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div className="rep-head-t">{tr("Repères", "Landmarks")}</div>
                    <div className="rep-head-s">{showComp ? tr("Ce qu'il faut retenir de ces deux graphiques", "What to take from these two charts") : tr("Ce qu'il faut retenir de ce graphique", "What to take from this chart")}</div>
                  </div>
                </div>
                <div className="evo-rep">
                  {([
                    { tone: "violet", icon: <IconArrowMaxUp size={16} color="#fff" />, k: tr("Meilleur mois", "Best month"),
                      v: `${fmt(monthly.ca_max?.val)} €`, chip: monthLabel(monthly.ca_max?.date_str), note: tr("Le mois le plus fort de la période.", "The strongest month of the period.") },
                    { tone: "rose", icon: <IconArrowMinDown size={16} color="#fff" />, k: tr("Mois le plus faible", "Weakest month"),
                      v: `${fmt(monthly.ca_min?.val)} €`, chip: monthLabel(monthly.ca_min?.date_str), note: tr("Le mois le plus calme de la période.", "The quietest month of the period.") },
                    hi.length > 0 ? { tone: "gold", icon: <IconTrendUp size={16} color="#fff" />, k: hi.length > 1 ? tr("Mois forts", "Strong months") : tr("Mois fort", "Strong month"),
                      v: hi.length > 1 ? `${hi.slice(0, -1).join(", ")} ${tr("et", "and")} ${hi[hi.length - 1]}` : hi[0], note: tr(hi.length > 1 ? "Des mois bien au-dessus de l'habitude. Prévoir plus de stock et de personnel." : "Un mois bien au-dessus de l'habitude. Prévoir plus de stock et de personnel.", hi.length > 1 ? "Months well above usual. Plan more stock and staff." : "A month well above usual. Plan more stock and staff.") } : null,
                    showComp && both.length > 0 ? { tone: "teal", icon: <IconScale size={16} color="#fff" />, k: tr(`${ca.der} face à ${ca.prec}`, `${ca.der} vs ${ca.prec}`),
                      v: tr(`${upN} mois sur ${both.length}`, `${upN} of ${both.length} months`), chip: tr("en hausse", "up"), gauge: upN / both.length } : null,
                    hi.length === 0 && showComp && bestUp && bestUp.d > 0 ? { tone: "green", icon: <IconArrowMaxUp size={16} color="#fff" />, k: tr("Plus forte progression sur un an", "Biggest year-on-year rise"),
                      v: sg(bestUp.d), chip: trData(bestUp.mois), note: `${fmt(bestUp.ca_prec)} € → ${fmt(bestUp.ca_der)} €` } : null,
                  ].filter(Boolean) as any[]).map((r: any) => (
                    <div key={r.k} className={`rep-tile rt-${r.tone}`}>
                      <span className="rep-ic" aria-hidden="true">{r.icon}</span>
                      <div className="rep-body">
                        <div className="rep-k">{r.k}</div>
                        <div className="rep-line">
                          <span className="rep-v num">{r.v}</span>
                          {r.chip && <span className="rep-chip">{r.chip}</span>}
                        </div>
                        {r.gauge != null && (
                          <div className="rep-gauge" aria-hidden="true"><span style={{ width: `${Math.round(r.gauge * 100)}%` }} /></div>
                        )}
                        {r.note && <div className="rep-note">{r.note}</div>}
                      </div>
                    </div>
                  ))}
                </div>
                {keep && (
                  <div className="rep-keep">
                    <div className="rep-keep-k">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4Z" /></svg>
                      {tr("À retenir", "Key takeaway")} <span className="rep-keep-ref num">{keep.ref}</span>
                    </div>
                    <div className="rep-keep-t">{keep.text}</div>
                    {keep.period && <div className="rep-keep-p">{keep.period}</div>}
                    <div className="rep-keep-do">
                      <span className="rep-keep-ic" aria-hidden="true">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                      </span>
                      <span><b>{tr("Que faire :", "What to do:")}</b> {keep.tip.replace(/^(Piste|Next step)\s*:\s*/, "")}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            );
          })()}
        </div>
      )}

      {/* ──────────────────────────────────────────────
          TAB 2 · TOP PRODUITS
          ────────────────────────────────────────────── */}
      {activeTab === "top" && (() => {
        const src: any[] = topMetric === "qte" ? (topProds.by_qte || []) : topMetric === "tkt" ? (topProds.by_tkt || []) : (topProds.by_ca || []);
        const all: RankItem[] = src.map((it: any) => ({ article: it.article, value: Number(topMetric === "qte" ? it.quantity : topMetric === "tkt" ? it.nb_tkt : it.total_revenue) || 0, part: Number(it.part) || 0, evo: it.evo ?? null }));
        const shown = all.slice(0, topN);
        const p1 = shown[0];
        const fmtV = (v: number) => topMetric === "ca" ? (v >= 1000 ? `${fmt(v / 1000, 1)} k€` : `${fmt(v, 0)} €`) : topMetric === "qte" ? tr(`${fmt(v, 0)} vendus`, `${fmt(v, 0)} sold`) : tr(`${fmt(v, 0)} tickets`, `${fmt(v, 0)} tickets`);
        const fmtS = (v: number) => topMetric === "ca" ? fmtV(v) : fmt(v, 0);
        const rankOf = (it: RankItem) => shown.indexOf(it) + 1;
        const valLbl = topMetric === "ca" ? tr("Chiffre d'affaires", "Revenue") : topMetric === "qte" ? tr("Quantité vendue", "Quantity sold") : tr("Tickets", "Transactions");
        const ck = data?.comp_kpis || null;
        const evoRef = ck ? cmpRef : null;
        const evoHead = ck ? `vs ${mois !== "Tous" ? trData(mois).toLowerCase() + " " : ""}${ck.prec}` : "";
        const withEvo = shown.filter((it) => it.evo != null);
        const rise = [...withEvo].sort((a, b) => (b.evo as number) - (a.evo as number))[0];
        const fall = [...withEvo].sort((a, b) => (a.evo as number) - (b.evo as number))[0];
        const sumShown = shown.reduce((a, it) => a + it.part, 0);
        const top3 = shown.slice(0, 3).reduce((a, it) => a + it.part, 0);
        const strong = topMetric !== "tkt" && (shown.length <= 10 ? sumShown >= 60 : sumShown >= 75);
        const noun = topMetric === "ca" ? tr("du chiffre d'affaires", "of revenue") : topMetric === "qte" ? tr("des articles vendus", "of items sold") : tr("des tickets", "of transactions");
        const keepText = !p1 ? "" : topMetric === "tkt"
          ? tr(`${niceName(p1.article)} est dans ${fmt(p1.part, 0)} % des tickets : c'est le produit qui fait venir les clients.`, `${niceName(p1.article)} is in ${fmt(p1.part, 0)} % of transactions: it is what brings customers in.`)
          : p1.part >= 15
            ? tr(`Un seul produit, ${niceName(p1.article)}, fait ${fmt(p1.part, 0)} % ${noun} : c'est le pilier de la boutique.`, `One product, ${niceName(p1.article)}, makes ${fmt(p1.part, 0)} % ${noun}: it is the shop's backbone.`)
            : sumShown >= 50
              ? tr(`Les ${shown.length} premiers produits font ${fmt(sumShown, 0)} % ${noun} : l'essentiel se joue sur peu de produits.`, `The top ${shown.length} products make ${fmt(sumShown, 0)} % ${noun}: a few products carry the shop.`)
              : tr(`Les ventes sont réparties sur beaucoup de produits : les ${shown.length} premiers font ${fmt(sumShown, 0)} % ${noun}.`, `Sales are spread over many products: the top ${shown.length} make ${fmt(sumShown, 0)} % ${noun}.`);
        const bigDrop = fall && (fall.evo as number) <= -10 ? fall : null;
        const keepTip = !p1 ? "" : ((p1.part >= 15 || topMetric === "tkt")
          ? tr(`ne jamais manquer de ${niceName(p1.article)}`, `never run out of ${niceName(p1.article)}`)
          : tr("surveiller le stock des 3 premiers produits chaque jour", "check stock of the top 3 products every day"))
          + (bigDrop ? tr(`, et regarder pourquoi ${niceName(bigDrop.article)} baisse (prix, qualité, place en vitrine).`, `, and look into why ${niceName(bigDrop.article)} is dropping (price, quality, display).`) : ".");
        const title = topMetric === "ca" ? tr(`Les ${topN} produits qui rapportent le plus`, `The ${topN} top-earning products`)
          : topMetric === "qte" ? tr(`Les ${topN} produits les plus vendus`, `The ${topN} best-selling products`)
          : tr(`Les ${topN} produits les plus présents dans les tickets`, `The ${topN} products in the most transactions`);
        const calc = topMetric === "ca" ? tr("Chiffre d'affaires total du produit et sa part du total", "Product's total revenue and its share of the total")
          : topMetric === "qte" ? tr("Quantité vendue et sa part de tous les articles vendus", "Quantity sold and its share of all items sold")
          : tr("Nombre de tickets qui contiennent le produit", "Number of transactions containing the product");
        const tiles: any[] = [
          rise && (rise.evo as number) > 0 ? { tone: "teal", icon: <IconArrowMaxUp size={15} color="#fff" />, k: tr(`Plus forte hausse · ${evoRef}`, `Biggest rise · ${evoRef}`), v: niceName(rise.article), chip: evoTxt(rise.evo as number), note: tr(`N°${rankOf(rise)} du classement, sur la même période de l'année.`, `#${rankOf(rise)} in the ranking, same period of the year.`) } : null,
          fall && (fall.evo as number) < 0 ? { tone: "rose", icon: <IconArrowMinDown size={15} color="#fff" />, k: tr(`Plus forte baisse · ${evoRef}`, `Biggest drop · ${evoRef}`), v: niceName(fall.article), chip: evoTxt(fall.evo as number), note: tr(`N°${rankOf(fall)} du classement, sur la même période de l'année.`, `#${rankOf(fall)} in the ranking, same period of the year.`) } : null,
          withEvo.length === 0 ? { tone: "gold", icon: <IconBar size={15} color="#fff" />, k: tr("Top 3", "Top 3"), v: `${fmt(top3, 1)} %`, chip: noun, note: shown.slice(0, 3).map((it) => niceName(it.article)).join(" · ") } : null,
          topMetric !== "tkt" ? { tone: "violet", icon: <IconScale size={15} color="#fff" />, k: tr("Concentration", "Concentration"), v: strong ? tr("Forte", "High") : tr("Modérée", "Moderate"), info: true,
            note: strong ? tr("Quelques produits font l'essentiel des ventes.", "A few products make most of the sales.") : tr("Les ventes sont réparties sur beaucoup de produits.", "Sales are spread over many products.") } : null,
        ].filter(Boolean);
        return (
        <div className="sw" style={{ paddingTop:"14px" }}>
          <div className="sec-title" style={{ display:"flex", alignItems:"center", gap:"9px"}}>
            <IconTrophy size={16} /> {topMetric === "ca" ? tr("Les produits qui rapportent le plus", "The products that earn the most")
              : topMetric === "qte" ? tr("Les produits les plus vendus", "The best-selling products")
              : tr("Les produits les plus présents dans les tickets", "The products in the most transactions")}
          </div>
          <div className="evo-grid top-grid">
            <div className="evo-left">
              <div className="cc" style={{ padding:"20px 24px" }}>
                <ChartAssistantButton chartType="top_products_revenue" chartData={{ items: shown, metrique: topMetric, n: topN, filtres_page: { annee, saison, mois, categorie, evenement } }} chartName="TopNHBar"
                  userQuestion="Explique ce graphique des top produits" position="top-right" onOpenChat={openChat} />
                <div className="top-head">
                  <div className="ct" style={{ margin: 0 }}>{title}</div>
                  <div className="top-ctrls">
                    <div className="seg-n" role="group" aria-label={tr("Classer selon", "Rank by")}>
                      {([["ca", tr("Chiffre d'affaires", "Revenue")], ["qte", tr("Quantité", "Quantity")], ["tkt", tr("Tickets", "Transactions")]] as const).map(([k, l]) => (
                        <button key={k} type="button" className={topMetric === k ? "on" : ""} aria-pressed={topMetric === k} onClick={() => setTopMetric(k)}>{l}</button>
                      ))}
                    </div>
                    <div className="seg-n" role="group" aria-label={tr("Nombre de produits", "Number of products")}>
                      {[5, 10, 15, 20].filter((k) => k <= Math.max(5, all.length)).map((k) => (
                        <button key={k} type="button" className={topN === k ? "on" : ""} aria-pressed={topN === k} onClick={() => setTopN(k)}>{k}</button>
                      ))}
                    </div>
                  </div>
                </div>
                <Scope period={scopePeriod} calc={calc} unit={topMetric === "ca" ? "€" : topMetric === "qte" ? tr("unités", "units") : tr("tickets", "transactions")} />
                <div className={`top-body${topMetric === "tkt" ? " solo" : ""}${shown.length > 10 ? " wide" : ""}`}>
                  {shown.length > 0 && topMetric !== "tkt" && <ShareDonut items={shown} />}
                  {shown.length > 0 && <TopRankList items={shown} fmtV={fmtV} fmtS={fmtS} evoRef={evoRef} evoHead={evoHead} valLbl={valLbl} />}
                </div>
                {withEvo.length > 0 && evoRef && <div className="rank-foot">{tr(`Classement sur ${periodTxt} · ▲▼ : ${evoRef}, sur la même période de l'année.`, `Ranking over ${periodTxt} · ▲▼: ${evoRef}, same period of the year.`)}</div>}
              </div>
            </div>
            {p1 && (
            <div className="evo-side">
              <div className="rep-head">
                <span className="rep-head-ic" aria-hidden="true">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" fillOpacity=".3" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"><path d="M6.5 3.5h11a1 1 0 0 1 1 1V21l-6.5-4.4L5.5 21V4.5a1 1 0 0 1 1-1z" /></svg>
                </span>
                <div style={{ minWidth: 0 }}>
                  <div className="rep-head-t">{tr("Repères", "Landmarks")}</div>
                  <div className="rep-head-s">{tr("Ce qu'il faut retenir de ce classement", "What to take from this ranking")}</div>
                </div>
              </div>
              <div className="evo-rep">
                {tiles.map((r: any) => (
                  <div key={r.k} className={`rep-tile rt-${r.tone}`}>
                    <span className="rep-ic" aria-hidden="true">{r.icon}</span>
                    <div className="rep-body">
                      <div className="rep-k" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {r.k}
                        {r.info && (
                          <span className="leg-info sm" tabIndex={0} aria-label={tr("Explication", "Explanation")}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9.5" /><path d="M12 11v6M12 7.5h.01" /></svg>
                            <span className="leg-pop wrap" role="tooltip">
                              {tr(`La concentration dit si les ventes reposent sur quelques produits ou sur beaucoup. Ici, les ${shown.length} premiers produits font ${fmt(sumShown, 0)} % ${noun}. « Forte » : une rupture de stock sur l'un d'eux coûte cher. « Modérée » : le risque est mieux réparti.`,
                                  `Concentration tells whether sales rely on a few products or many. Here the top ${shown.length} make ${fmt(sumShown, 0)} % ${noun}. "High": running out of one of them is costly. "Moderate": the risk is spread out.`)}
                            </span>
                          </span>
                        )}
                      </div>
                      <div className="rep-line">
                        <span className="rep-v num">{r.v}</span>
                        {r.chip && <span className="rep-chip">{r.chip}</span>}
                      </div>
                      {r.note && <div className="rep-note">{r.note}</div>}
                    </div>
                  </div>
                ))}
              </div>
              <div className="rep-keep">
                <div className="rep-keep-k">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4Z" /></svg>
                  {tr("À retenir", "Key takeaway")} <span className="rep-keep-ref num">{periodTxt}</span>
                </div>
                <div className="rep-keep-t">{keepText}</div>
                <div className="rep-keep-do">
                  <span className="rep-keep-ic" aria-hidden="true">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                  </span>
                  <span><b>{tr("Que faire :", "What to do:")}</b> {keepTip}</span>
                </div>
              </div>
            </div>
            )}
          </div>
        </div>
        );
      })()}

      {/* ──────────────────────────────────────────────
          TAB 3 · SAISONNALITÉ
          ────────────────────────────────────────────── */}
      {activeTab === "saison" && (() => {
        const days: any[] = seasonality.days || [];
        const hourly: any[] = seasonality.hourly || [];
        const heat: any[] = seasonality.heatmap || [];
        const DOWS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
        const rareIdx = (saisonInsights?.rare || []).map((d: any) => DOWS.indexOf(d.day)).filter((x: number) => x >= 0);
        const totH = hourly.reduce((a: number, x: any) => a + x.ca, 0) || 1;
        const pk = hourly.length ? hourly.reduce((m: any, x: any) => (x.ca > m.ca ? x : m), hourly[0]) : null;
        const before13 = hourly.filter((x: any) => x.hour < 13).reduce((a: number, x: any) => a + x.ca, 0) / totH * 100;
        // Les 3 heures d'affilée qui font le plus de ventes (le « coup de feu »)
        let rush: { h: number; part: number } | null = null;
        for (const x of hourly) {
          const s3 = hourly.filter((y: any) => y.hour >= x.hour && y.hour < x.hour + 3).reduce((a: number, y: any) => a + y.ca, 0);
          if (!rush || s3 / totH * 100 > rush.part) rush = { h: x.hour, part: s3 / totH * 100 };
        }
        const usefulHeat = heat.filter((c: any) => !rareIdx.includes(c.dow) && c.ca_moy > 0.5);
        const topCell = usefulHeat.length ? usefulHeat.reduce((m: any, c: any) => (c.ca_moy > m.ca_moy ? c : m), usefulHeat[0]) : null;
        const best = saisonInsights?.best, worst = saisonInsights?.worst;
        const dayL = (d: string) => trData(d);
        const tiles: any[] = [
          best ? { tone: "violet", icon: <IconArrowMaxUp size={15} color="#fff" />, k: tr("Jour le plus fort", "Strongest day"), v: dayL(best.day), chip: `${fmt(best.ca_moyen)} €/${tr("j", "d")}`,
            note: worst ? tr(`${fmt(saisonInsights!.ratio, 1)} fois le jour le plus calme (${dayL(worst.day).toLowerCase()}, ${fmt(worst.ca_moyen)} €).`, `${fmt(saisonInsights!.ratio, 1)}× the quietest day (${dayL(worst.day)}, €${fmt(worst.ca_moyen)}).`) : "" } : null,
          pk ? { tone: "rose", icon: <IconClock size={15} color="#fff" />, k: tr("Heure de pointe", "Peak hour"), v: `${pk.hour}h – ${pk.hour + 1}h`, chip: `${fmt(pk.ca / totH * 100, 0)} %`,
            note: rush ? tr(`Le coup de feu : ${rush.h}h – ${rush.h + 3}h fait ${fmt(rush.part, 0)} % des ventes.`, `Rush: ${rush.h}:00–${rush.h + 3}:00 makes ${fmt(rush.part, 0)}% of sales.`) : "" } : null,
          topCell ? { tone: "gold", icon: <IconCalendar size={15} color="#fff" />, k: tr("Moment le plus chargé", "Busiest moment"), v: tr(`${DOWS[topCell.dow]} ${topCell.hour}h`, `${trData(DOWS[topCell.dow])} ${topCell.hour}:00`),
            chip: tr(`${fmt(topCell.tk_moy)} tickets`, `${fmt(topCell.tk_moy)} transactions`), note: tr(`${fmt(topCell.ca_moy)} € en une heure, un jour habituel.`, `€${fmt(topCell.ca_moy)} in one hour on a typical day.`) } : null,
          hourly.length ? { tone: "teal", icon: <IconClock size={15} color="#fff" />, k: tr("Après 13 h", "After 1 pm"), v: tr(`${fmt(100 - before13, 0)} % des ventes`, `${fmt(100 - before13, 0)}% of sales`),
            note: 100 - before13 < 35 ? tr("L'après-midi est calme : petites fournées, moins de produits frais en fin de journée.", "Afternoons are quiet: small batches, fewer fresh products late in the day.")
              : tr("L'après-midi compte aussi : garder du choix jusqu'à la fermeture.", "Afternoons matter too: keep a good choice until closing.") } : null,
        ].filter(Boolean);
        const keepText = pk ? tr(`${fmt(before13, 0)} % des ventes se font avant 13 h, et ${rush ? `${rush.h}h – ${rush.h + 3}h` : `${pk.hour}h`} est le moment clé de la journée.`,
                                 `${fmt(before13, 0)}% of sales happen before 1 pm, and ${rush ? `${rush.h}:00–${rush.h + 3}:00` : `${pk.hour}:00`} is the key moment of the day.`) : "";
        const keepTip = rush ? tr(`avoir les produits phares prêts avant ${rush.h}h${topCell ? `, et renforcer l'équipe le ${DOWS[topCell.dow].toLowerCase()} matin` : ""}${worst ? ` ; le ${worst.day.toLowerCase()}, préparer moins` : ""}.`,
                                  `have the best sellers ready before ${rush.h}:00${topCell ? `, and add staff on ${trData(DOWS[topCell.dow])} mornings` : ""}${worst ? `; on ${trData(worst.day)}, prepare less` : ""}.`) : "";
        return (
        <div className="sw" style={{ paddingTop:"14px" }}>
          <div className="sec-title" style={{ display:"flex", alignItems:"center", gap:"9px"}}>
            <IconCalendar size={16} /> {tr("Quand la boutique vend : jours et heures", "When the shop sells: days and hours")}
          </div>
          <div className="evo-grid jh-grid">
            <div className="evo-left">
              {heat.length > 0 && (
                <div className="cc" style={{ padding:"20px 24px" }}>
                  <ChartAssistantButton chartType="week_hour_heatmap" chartData={{ cellules: heat, jours_rares: rareIdx, filtres_page: { annee, saison, mois, categorie, evenement } }} chartName="WeekHourHeat"
                    userQuestion="Explique cette carte des ventes par jour et par heure" position="top-right" onOpenChat={openChat} />
                  <div className="ct">{tr("La semaine, heure par heure", "The week, hour by hour")}</div>
                  <Scope period={scopePeriod} calc={tr("Chiffre d'affaires moyen de chaque heure, un jour d'ouverture habituel", "Average revenue of each hour on a typical open day")} unit={tr("€ par heure", "€ per hour")} />
                  <WeekHourHeat cells={heat} rareDays={rareIdx} />
                </div>
              )}
              <div className="jh-pair">
                <div className="cc" style={{ padding:"18px 20px" }}>
                  <ChartAssistantButton chartType="day_of_week_bars" chartData={{ days, mode: "moyen", filtres_page: { annee, saison, mois, categorie, evenement } }} chartName="DayOfWeekBars"
                    userQuestion="Explique ce graphique du CA moyen par jour de la semaine" position="top-right" onOpenChat={openChat} />
                  <div className="ct">{tr("Par jour", "By day")}</div>
                  <Scope period={scopePeriod} calc={tr("Un jour d'ouverture habituel", "A typical open day")} unit={tr("€ par jour", "€ per day")} />
                  <div style={{ height:"200px", width:"100%", marginTop:"6px" }}>
                    {days.length > 0 && <DayOfWeekBars days={days} mode="moyen"/>}
                  </div>
                </div>
                {hourly.length > 0 && (
                  <div className="cc" style={{ padding:"18px 20px" }}>
                    <ChartAssistantButton chartType="hourly_dual" chartData={{ data: hourly, filtres_page: { annee, saison, mois, categorie, evenement } }} chartName="HourlyDual"
                      userQuestion="Explique ce graphique du CA et des tickets par heure" position="top-right" onOpenChat={openChat} />
                    <div className="ct">{tr("Par heure", "By hour")}</div>
                    <Scope period={scopePeriod} calc={tr("Un jour d'ouverture habituel", "A typical open day")} unit={tr("€ par heure", "€ per hour")} />
                    <div style={{ height:"200px", width:"100%", marginTop:"6px" }}>
                      <HourlyDual data={hourly} nbJours={kpis.nb_jours_ouverts}/>
                    </div>
                  </div>
                )}
              </div>
            </div>
            {tiles.length > 0 && (
            <div className="evo-side">
              <div className="rep-head">
                <span className="rep-head-ic" aria-hidden="true">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" fillOpacity=".3" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"><path d="M6.5 3.5h11a1 1 0 0 1 1 1V21l-6.5-4.4L5.5 21V4.5a1 1 0 0 1 1-1z" /></svg>
                </span>
                <div style={{ minWidth: 0 }}>
                  <div className="rep-head-t">{tr("Repères", "Landmarks")}</div>
                  <div className="rep-head-s">{tr("Ce qu'il faut retenir des jours et des heures", "What to take from days and hours")}</div>
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
                    {tr("À retenir", "Key takeaway")} <span className="rep-keep-ref num">{periodTxt}</span>
                  </div>
                  <div className="rep-keep-t">{keepText}</div>
                  {rareNote(true) && <div className="rep-keep-p">{tr(rareNote(true).trim(), rareNote(false).trim())}</div>}
                  <div className="rep-keep-do">
                    <span className="rep-keep-ic" aria-hidden="true">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                    </span>
                    <span><b>{tr("Que faire :", "What to do:")}</b> {keepTip}</span>
                  </div>
                </div>
              )}
            </div>
            )}
          </div>
        </div>
        );
      })()}

      {/* ──────────────────────────────────────────────
          TAB 4 · CATÉGORIES
          ────────────────────────────────────────────── */}
      {activeTab === "categories" && (
        <div className="sw" style={{ paddingTop:"14px" }}>
          <div className="sec-title" style={{ display:"flex", alignItems:"center", gap:"9px"}}>
            <IconTag size={16} /> {tr("Ce que pèse chaque famille de produits", "What each product family weighs")}
          </div>

          {/* Treemap des catégories retiré : il répétait le graphique et le tableau ci-dessous. */}
          {categories.length > 0 && (
            <div style={{ display:"grid", gridTemplateColumns:"1fr", gap:"32px", marginBottom:"40px" }}>
              <div className="cc" style={{ padding:"28px 32px" }}>
                <ChartAssistantButton chartType="category_performance_hbar" chartData={{ data: categories, field: "ca", filtres_page: { annee, saison, mois, categorie, evenement } }} chartName="CategoryPerformanceHBar"
                  userQuestion="Explique la répartition du chiffre d'affaires par catégorie" position="top-right" onOpenChat={openChat} />
                <div className="ct">{tr("Chiffre d'affaires par catégorie", "Revenue by category")}</div>
                <Scope period={scopePeriod} calc={tr("Total de la famille et sa part du total", "Family total and its share")} unit="€" />
                <div style={{ marginTop:"20px" }}>
                  <CatHBar data={categories} field="ca"
                    labelFn={(_v, r) => `${fmtAxisEuro(r.ca, locale())} · ${fmt(r.part, 1)} %`} />
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
            <Details label={tr("Voir le détail : les familles en chiffres", "See details: families in figures")}>
              <div className="cc" style={{ padding:"20px 32px 32px", marginTop:"14px" }}>
                <ChartAssistantButton chartType="category_summary_table" chartData={{ categories, filtres_page: { annee, saison, mois, categorie, evenement } }} chartName="CategorySummaryTable"
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
                            <tr key={i} style={{ borderBottom:"1px solid var(--dk-surface, #FFFFFF)" }}>
                              <td style={{ padding:"13px 8px", fontSize:"0.82rem", fontWeight:800,
                                           color:INK, textAlign:"left",
                                           display:"flex", alignItems:"center", gap:"10px" }}>
                                <div style={{ width:"9px", height:"9px", borderRadius:"50%",
                                              background: PALETTE[i % PALETTE.length],
                                              boxShadow:`0 0 0 2px color-mix(in srgb, ${PALETTE[i % PALETTE.length]} 15%, transparent)` }}/>
                                {trData(c.category)}
                              </td>
                              <td style={{ padding:"13px 8px" }}>
                                <div style={{ display:"flex", alignItems:"center", gap:"8px"}}>
                                  <div style={{ flex:1, height:"14px", borderRadius:"4px",
                                                background:"var(--dk-soft, #F4F1FC)", overflow:"hidden" }}>
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
                                                background:"var(--dk-soft, #F4F1FC)", overflow:"hidden" }}>
                                    <div style={{ width:`${partPct}%`, height:"100%",
                                                  background:`linear-gradient(90deg, color-mix(in srgb, ${C1} 33%, transparent), color-mix(in srgb, ${C3} 67%, transparent))` }}/>
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
            </Details>
          )}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════
   SOUS-COMPOSANTS UI
   ════════════════════════════════════════════════ */

// Mois abrégés des boutons de période
const MOIS_COURTS: Record<string, string> = { Janvier: "Janv.", "Février": "Févr.", Mars: "Mars", Avril: "Avr.", Mai: "Mai", Juin: "Juin", Juillet: "Juil.", "Août": "Août", Septembre: "Sept.", Octobre: "Oct.", Novembre: "Nov.", "Décembre": "Déc." };
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
      <div style={{ fontSize:"0.85rem", color:"var(--dk-ink2, #3A3655)", lineHeight:1.45,
                    display:"flex", alignItems:"flex-start", gap:"8px" }}>
        <span style={{ flexShrink:0, marginTop:"1px"}}>{icon}</span>
        <span>
          <strong style={{ fontWeight:800 }}>{title}</strong>
          {strong && !asRow && (
            <div style={{ marginTop:"4px", fontWeight:700, color:"var(--dk-ink, #24213A)" }}>{strong}</div>
          )}
        </span>
      </div>
      {asRow && strong && (
        <span style={{ fontSize:"0.82rem", fontWeight:700, color:"var(--dk-ink2, #3A3655)" }}>
          {strong}
        </span>
      )}
    </div>
  );
}
