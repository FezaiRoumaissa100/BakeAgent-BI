"use client";

import { DailyKPIs, HourlyData } from "@/types/kpis";
import { colors } from "@/lib/theme";
import React from "react";
import { IconSparkline } from "./Icons";
import { ChartAssistantButton } from "@/components/ChartAssistantButton";
import { useChat } from "@/contexts/ChatContext";
import { siteConfig } from "@/lib/siteConfig";
import { ExpertNote } from "@/components/Expert";
import { RetainProvider, RetainCard, Takeaway } from "@/components/Ui";
import { tr, trData, locale, num } from "@/lib/i18n";

const ORANGE = colors.accent;
const PEACH = colors.accentLight;
const LIGHT = colors.accentPale;
const INK = colors.ink;
const MUTED = colors.muted;
const GRID = colors.grid;
const PAL = [
  ORANGE,
  PEACH,
  "#3E8E5E",
  "#B9D7A0",
  LIGHT,
  "var(--dk-accent-deep, #2A7148)",
  "#DCEBD9",
  "var(--dk-accent-deep, #3E8E5E)",
  "var(--dk-soft, #E4F0E6)",
  "var(--dk-accent-deep, #1F5E3A)",
];

function fmt(n: number, dec = 0) {
  return Number(n || 0).toLocaleString(locale(), {
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
          stroke="var(--dk-line, #EEF5EF)"
          strokeWidth="16"
          strokeLinecap="round"
        />
        <path
          d="M 25 100 A 75 75 0 0 1 175 100"
          fill="none"
          stroke="var(--dk-line, #E3E4DD)"
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
          stroke="var(--dk-accent-deep, #1F5E3A)"
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
            title={tr(`${p.article}: ${p.quantity} unités`, `${p.article}: ${p.quantity} units`)}
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
  height?: number | string;
}) {
  const vals = data.map((d) => Number(d[valueKey]) || 0);
  const max = Math.max(...vals, 1);

  return (
    <div style={typeof height === "number" ? { height } : { flex: 1, minHeight: 0 }} className="w-full flex flex-col justify-between pt-2">
      <div className="flex items-end gap-1.5 flex-1 w-full relative">
        {/* Horizontal grid lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-40">
          <div className="w-full border-b border-[var(--dk-line)] border-dashed" />
          <div className="w-full border-b border-[var(--dk-line)] border-dashed" />
          <div className="w-full border-b border-[var(--dk-line)]" />
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
              <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 text-white text-[11px] font-bold py-1 px-2 rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-30 shadow-lg" style={{ background: "var(--dk-pill, #1F2B23)" }}>
                {d.heure}{tr(" : ", ": ")}{fmt(v)} {unit}
              </div>
              <div
                className="w-full transition-all group-hover:brightness-90"
                style={{
                  height: `${pct}%`,
                  background: isMax ? ORANGE : "#8DC05A",
                  borderRadius: "6px 6px 2px 2px",
                }}
              />
            </div>
          );
        })}
      </div>

      {/* X Axis */}
      <div className="flex gap-1.5 mt-1.5 pt-1.5 text-[10px] font-semibold" style={{ color: MUTED, borderTop: "1px solid var(--dk-line)" }}>
        {data.map((d, i) => (
          <span key={i} className="flex-1 text-center">{d.heure}</span>
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
            fill={color === ORANGE ? "rgba(46,125,79,0.10)" : "rgba(141,192,90,0.10)"}
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
              stroke="var(--dk-surface, white)"
              strokeWidth="1.2"
            />
          ))}
        </svg>
      </div>

      <div className="flex justify-between mt-1.5 pt-1 border-t border-[#ECEDE7] text-[8px] font-semibold" style={{ color: MUTED }}>
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
   HERO SECTION (KPIs individuels, fond normal)
──────────────────────────────────────────────────── */
export function Hero({ kpis }: { kpis: DailyKPIs }) {
  // Cadence comparée à la cadence habituelle du même jour de la semaine (pas de seuil fixe)
  const v_ref = Number(kpis.vitesse_ref || 0);
  const v_ratio = v_ref > 0 ? Number(kpis.vitesse || 0) / v_ref : 1;
  const v_level = v_ref <= 0 ? "na" : v_ratio >= 1.2 ? "high" : v_ratio <= 0.8 ? "low" : "normal";
  const v_text =
    v_level === "high" ? tr("Forte", "Strong") : v_level === "low" ? tr("Faible", "Low") : v_level === "normal" ? tr("Normale", "Normal") : tr("Sans repère", "No reference");
  const v_badge_bg =
    v_level === "high"
      ? "rgba(46,125,79, 0.08)"
      : v_level === "low"
      ? "rgba(110,117,111, 0.08)"
      : "rgba(92,101,96, 0.08)";
  const v_badge_color =
    v_level === "high" ? ORANGE : v_level === "low" ? MUTED : "var(--dk-ink2, #5C6560)";
  const jourLabel = kpis.jour_semaine ? trData(kpis.jour_semaine) : "";
  const refLabel = kpis.ref_label || tr("jours comparables", "comparable days");

  const paire_texte = kpis.top_pairs[0]
    ? `${kpis.top_pairs[0].pa.slice(0, 12)} + ${kpis.top_pairs[0].pb.slice(0, 12)}`
    : tr("Aucune paire", "No pair");
  const top_prod_name = kpis.top_qte[0]?.article || tr("Aucun", "None");

  const delta = Number(kpis.delta_vs_moy || 0);
  const hasRef = Number(kpis.ca_ref || 0) > 0;
  const deltaTxt = `${delta > 0 ? "+" : ""}${num(delta, 0)} %`;
  const trend_text = !hasRef
    ? tr("Aucun jour comparable", "No comparable day")
    : Math.abs(delta) < 10
    ? tr(`CA dans la normale (${deltaTxt} vs ${refLabel})`, `Revenue within normal range (${deltaTxt} vs previous same weekdays)`)
    : tr(`CA ${deltaTxt} vs ${refLabel}`, `Revenue ${deltaTxt} vs previous same weekdays`);

  const top3 = kpis.top_qte.slice(0, 3);
  const mx_cnt = kpis.top_pairs[0]?.cnt || 1;

  return (
    <div className="outer" style={{ height: "auto", padding: "0 18px", boxSizing: "border-box" }}>

      {/* ── EN-TÊTE DE PAGE ── */}
      <div style={{ padding: "0 10px", marginBottom: 16 }}>
        <h1 className="page-h1" style={{ fontSize: "1.8rem", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1, margin: 0 }}>
          {tr("Vue du", "Daily")} <span style={{ color: ORANGE }}>{tr("Jour", "View")}</span>
        </h1>
        <p style={{ color: MUTED, fontSize: ".9rem", marginTop: 6 }}>
          {tr("Journée du ", "Day of ")}{jourLabel ? `${jourLabel.toLowerCase()} ` : ""}{kpis.date_fr || siteConfig.dataEndLabel}
          {hasRef ? tr(` · comparée ${refLabel.startsWith("moyenne") ? "à la" : "au"} ${refLabel}`, " · compared with the previous same weekdays") : ""}
        </p>
      </div>

      {/* ── PHRASE CLÉ ── */}
      <div className="insight" style={{ margin: "0 10px 16px" }}>
        <b>
          {hasRef
            ? (Math.abs(delta) < 10
                ? tr("Une journée dans la normale. ", "A normal day. ")
                : delta > 0 ? tr("Une journée plus forte que d'habitude. ", "A stronger day than usual. ") : tr("Une journée plus calme que d'habitude. ", "A quieter day than usual. "))
            : tr("Journée sans point de comparaison. ", "No comparable day. ")}
        </b>
        {tr(
          `${fmt(kpis.ca_jour)} € de chiffre d'affaires${hasRef ? ` (${deltaTxt} par rapport à d'habitude)` : ""}, ${fmt(kpis.tickets)} tickets et un pic à ${String(kpis.peak_h).padStart(2, "0")} h. ${top_prod_name !== "Aucun" ? `${top_prod_name} est le produit le plus vendu.` : ""}`,
          `${fmt(kpis.ca_jour)} € of revenue${hasRef ? ` (${deltaTxt} vs usual)` : ""}, ${fmt(kpis.tickets)} transactions and a peak at ${String(kpis.peak_h).padStart(2, "0")}:00. ${top_prod_name !== "None" ? `${top_prod_name} is the best-selling product.` : ""}`
        )}
      </div>

      {/* ── 4 INDICATEURS : valeur du jour, écart à l'habituel, mini-barres habituel / ce jour ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 16, marginBottom: 16, padding: "0 10px" }}>
        {[
          { icon: "€", lbl: tr("Chiffre d'affaires", "Revenue"), cur: Number(kpis.ca_jour || 0), ref: Number(kpis.ca_ref || 0), unit: " €", dec: 0 },
          { icon: "№", lbl: tr("Tickets", "Transactions"), cur: Number(kpis.tickets || 0), ref: Number(kpis.tickets_ref || 0), unit: "", dec: 0 },
          { icon: "Ø", lbl: tr("Panier moyen", "Average basket"), cur: Number(kpis.panier || 0), ref: Number(kpis.tickets_ref || 0) > 0 ? Number(kpis.ca_ref || 0) / Number(kpis.tickets_ref) : 0, unit: " €", dec: 2 },
        ].map((k, i) => {
          const d = k.ref > 0 ? ((k.cur - k.ref) / k.ref) * 100 : null;
          const up = (d ?? 0) >= 0;
          const mx = Math.max(k.cur, k.ref, 1);
          return (
            <div key={i} className="cc" style={{ padding: "18px 20px", display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--dk-accent-wash)", color: "var(--dk-accent-deep)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: ".95rem" }}>{k.icon}</span>
                  <span style={{ fontSize: ".85rem", fontWeight: 600, color: "var(--dk-ink2)" }}>{k.lbl}</span>
                </div>
                <div className="num" style={{ fontSize: "2rem", fontWeight: 800, color: INK, letterSpacing: "-0.03em", marginTop: 12, lineHeight: 1 }}>
                  {fmt(k.cur, k.dec)}{k.unit}
                </div>
                <div style={{ fontSize: ".8rem", marginTop: 8, color: MUTED }}>
                  {d !== null ? (
                    <>
                      <span style={{ fontWeight: 700, color: up ? "var(--dk-ok)" : "var(--dk-alert)" }}>{up ? "▲ +" : "▼ "}{num(d, 1)} %</span>
                      {tr(` vs ${fmt(k.ref, k.dec)}${k.unit}`, ` vs ${fmt(k.ref, k.dec)}${k.unit}`)}
                    </>
                  ) : tr("sans repère", "no reference")}
                </div>
              </div>
              {k.ref > 0 && (
                <div title={tr(`Habituel : ${fmt(k.ref, k.dec)}${k.unit} · ce jour : ${fmt(k.cur, k.dec)}${k.unit}`, `Usual: ${fmt(k.ref, k.dec)}${k.unit} · this day: ${fmt(k.cur, k.dec)}${k.unit}`)}
                     style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", flexShrink: 0 }}>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 70 }}>
                    <div style={{ width: 18, height: `${(k.ref / mx) * 100}%`, background: "#8DC05A", borderRadius: "4px 4px 2px 2px" }} />
                    <div style={{ width: 18, height: `${(k.cur / mx) * 100}%`, background: "#2E7D4F", borderRadius: "4px 4px 2px 2px" }} />
                  </div>
                  <div style={{ fontSize: ".64rem", color: MUTED, marginTop: 5 }}>{tr("hab. · jour", "usual · day")}</div>
                </div>
              )}
            </div>
          );
        })}
        {/* Heure de pointe */}
        <div className="cc" style={{ padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--dk-accent-wash)", color: "var(--dk-accent-deep)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
            </span>
            <span style={{ fontSize: ".85rem", fontWeight: 600, color: "var(--dk-ink2)" }}>{tr("Heure de pointe", "Peak hour")}</span>
          </div>
          <div className="num" style={{ fontSize: "2rem", fontWeight: 800, color: INK, letterSpacing: "-0.03em", marginTop: 12, lineHeight: 1 }}>
            {String(kpis.peak_h).padStart(2, "0")} h
          </div>
          <div style={{ fontSize: ".8rem", marginTop: 8, color: MUTED }}>
            {tr(`${fmt(Number(kpis.peak_ca_h || 0))} € encaissés sur cette heure`, `${fmt(Number(kpis.peak_ca_h || 0))} € taken in that hour`)}
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
            <span className="pval">{fmt(row[col])} €</span>
          </div>
        );
      })}
    </div>
  );
}

/* Cadence de vente : articles par heure d'activité, comparée aux mêmes jours précédents */
function CadenceCard({ kpis }: { kpis: DailyKPIs }) {
  const { openChat } = useChat();
  const v = Number(kpis.vitesse || 0);
  const v_ref = Number(kpis.vitesse_ref || 0);
  const ratio = v_ref > 0 ? v / v_ref : 1;
  const level = v_ref <= 0 ? "na" : ratio >= 1.2 ? "high" : ratio <= 0.8 ? "low" : "normal";
  const label = level === "high" ? tr("Forte", "Strong") : level === "low" ? tr("Faible", "Low") : level === "normal" ? tr("Normale", "Normal") : tr("Sans repère", "No reference");
  const col = level === "high" ? "var(--dk-ok)" : level === "low" ? "var(--dk-warn)" : "var(--dk-ink2)";
  const mx = Math.max(v, v_ref, 1);
  return (
    <div className="cc">
      <ChartAssistantButton chartType="vitesse_gauge" chartData={{ vitesse: v, vitesse_ref: v_ref, heures_act: kpis.heures_act }} chartName="VitesseGauge"
        userQuestion="Explique cette cadence de vente" position="top-right" onOpenChat={openChat} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingRight: 26 }}>
        <div className="ct">{tr("Cadence de vente", "Sales pace")}</div>
        <span className="pp-tag" style={{ background: "var(--dk-accent-wash)", color: col }}>{label}</span>
      </div>
      <div style={{ marginTop: 6 }}>
        <span className="bc-big">{num(v, 1)}</span>
        <span style={{ fontSize: ".8rem", color: MUTED, marginLeft: 6, fontWeight: 600 }}>{tr("articles / heure", "items / hour")}</span>
      </div>
      {v_ref > 0 && (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
          {[{ l: tr("Ce jour", "This day"), x: v, c: "#2E7D4F" }, { l: tr("D'habitude", "Usually"), x: v_ref, c: "#8DC05A" }].map((r) => (
            <div key={r.l} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: ".76rem", color: MUTED }}>
              <span style={{ width: 70 }}>{r.l}</span>
              <div style={{ flex: 1, height: 8, borderRadius: 99, background: "var(--dk-grid)" }}>
                <div style={{ width: `${(r.x / mx) * 100}%`, height: "100%", borderRadius: 99, background: r.c }} />
              </div>
              <b className="num" style={{ color: INK, width: 34, textAlign: "right" }}>{num(r.x, 1)}</b>
            </div>
          ))}
        </div>
      )}
      <div className="cs" style={{ marginTop: 10, marginBottom: 0 }}>
        {tr(`Sur ${kpis.heures_act || 0} heures avec des ventes.`, `Over ${kpis.heures_act || 0} hours with sales.`)}
      </div>
    </div>
  );
}

/* Produits achetés ensemble ce jour-là (paires les plus fréquentes) */
function PairsCard({ kpis }: { kpis: DailyKPIs }) {
  const { openChat } = useChat();
  const pairs = kpis.top_pairs.slice(0, 5);
  const mx = pairs[0]?.cnt || 1;
  return (
    <div className="cc">
      <ChartAssistantButton chartType="day_pairs" chartData={{ pairs }} chartName="PairsCard"
        userQuestion="Explique les produits achetés ensemble ce jour-là" position="top-right" onOpenChat={openChat} />
      <div className="ct">{tr("Achetés ensemble ce jour-là", "Bought together that day")}</div>
      <div className="cs">{tr("Paires de produits dans le même ticket", "Product pairs in the same transaction")}</div>
      {pairs.length === 0 && <div className="cs">{tr("Aucune paire ce jour-là.", "No pair that day.")}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {pairs.map((p, i) => (
          <div key={i} title={`${p.pa} + ${p.pb} : ${p.cnt}`}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: ".8rem", color: INK }}>
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>
                {p.pa} <span style={{ color: MUTED }}>+</span> {p.pb}
              </span>
              <b className="num" style={{ flexShrink: 0 }}>{p.cnt} {tr("fois", "times")}</b>
            </div>
            <div style={{ height: 6, borderRadius: 99, background: "var(--dk-grid)", marginTop: 5 }}>
              <div style={{ width: `${(p.cnt / mx) * 100}%`, height: "100%", borderRadius: 99, background: i === 0 ? "#2E7D4F" : "#8DC05A" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AnalyticsSections({ kpis }: { kpis: DailyKPIs }) {
  const { openChat } = useChat();
  const catTotal = kpis.categories.reduce((s, c) => s + c.total_revenue, 0) || 1;
  const nb_total = Math.max(kpis.tickets, 1);

  return (
    <RetainProvider>
    <div style={{ paddingBottom: 24 }}>
      {/* ── Rangée principale : CA par heure (2/3) + cadence et « À retenir » (1/3) ── */}
      <div className="sec-title">{tr("Rythme de la journée", "Daily rhythm")}</div>
      <div className="sw">
        <div className="grid-main stretch">
          <div className="cc hero-card" style={{ display: "flex", flexDirection: "column" }}>
            <ChartAssistantButton chartType="hourly_bar" chartData={{ data: kpis.hourly_data, valueKey: "ca", unit: "€" }} chartName="PlotlyBarChart"
              userQuestion="Explique ce graphique horaire du chiffre d'affaires" position="top-right" onOpenChat={openChat} />
            <div className="ct">{tr("Chiffre d'affaires par heure", "Revenue by hour")}</div>
            <div className="cs">{tr("Survolez une barre pour le montant exact. Pic d'activité : ", "Hover a bar for the exact amount. Peak activity: ")}{String(kpis.peak_h).padStart(2, "0")}h</div>
            <div style={{ flex: 1, minHeight: 290, display: "flex", flexDirection: "column" }}>
              <PlotlyBarChart data={kpis.hourly_data} valueKey="ca" unit="€" height="100%" />
            </div>
            {kpis.hourly_data?.length > 0 && (
              <Takeaway>
                {tr(
                  `Pic à ${String(kpis.peak_h).padStart(2, "0")}h : ${fmt(kpis.peak_ca_h || 0)} €, soit ${fmt(((kpis.peak_ca_h || 0) / (kpis.ca_jour || 1)) * 100)} % du chiffre d'affaires de la journée.`,
                  `Peak at ${String(kpis.peak_h).padStart(2, "0")}:00: ${fmt(kpis.peak_ca_h || 0)} €, i.e. ${fmt(((kpis.peak_ca_h || 0) / (kpis.ca_jour || 1)) * 100)}% of the day's revenue.`
                )}
              </Takeaway>
            )}
          </div>
          <div className="side-col">
            <CadenceCard kpis={kpis} />
            <RetainCard max={3} />
          </div>
        </div>
      </div>

      {/* ── Produits du jour : ce qui rapporte (1/2) + ce qui s'achète ensemble (1/2) ── */}
      <div className="sec-title">{tr("Produits du jour", "Today's products")}</div>
      <div className="sw">
        <div className="grid-2 stretch">
          <div className="cc">
            <ChartAssistantButton chartType="prod_rows_top_ca" chartData={{ list: kpis.top_ca.slice(0, 8), col: "total_revenue" }} chartName="TopProductsCA"
              userQuestion="Explique ce classement des top produits par chiffre d'affaires" position="top-right" onOpenChat={openChat} />
            <div className="ct">{tr("Produits qui rapportent le plus", "Highest-earning products")}</div>
            <div className="cs">{tr("Chiffre d'affaires du jour (€)", "Today's revenue (€)")}</div>
            <ProdRows products={kpis.top_ca} col="total_revenue" />
            {kpis.top_ca?.[0] && (
              <Takeaway>
                {tr(
                  `${kpis.top_ca[0].article} réalise ${fmt(((kpis.top_ca[0].total_revenue || 0) / (kpis.ca_jour || 1)) * 100)} % du chiffre d'affaires de la journée.`,
                  `${kpis.top_ca[0].article} makes ${fmt(((kpis.top_ca[0].total_revenue || 0) / (kpis.ca_jour || 1)) * 100)}% of the day's revenue.`
                )}
              </Takeaway>
            )}
          </div>
          <PairsCard kpis={kpis} />
        </div>
      </div>

      {/* ── Mix et catégories (1/2 + 1/2) ── */}
      <div className="sec-title">{tr("Mix et catégories", "Mix & categories")}</div>
      <div className="sw">
        <div className="grid-2 stretch">
          <div className="cc">
            <ChartAssistantButton chartType="category_revenue_distribution" chartData={{ categories: kpis.categories, total: catTotal }} chartName="CategoryRevenue"
              userQuestion="Explique la répartition du chiffre d'affaires par catégorie" position="top-right" onOpenChat={openChat} />
            <div className="ct">{tr("Répartition par catégorie", "Breakdown by category")}</div>
            <div className="cs">{tr("CA par famille de produits", "Revenue by product family")}</div>
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
                      {trData(c.category)}
                    </span>
                    <div style={{ width: 100, height: 6, background: "var(--dk-line, #ECEDE7)", borderRadius: 99, flexShrink: 0 }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: PAL[i % PAL.length], borderRadius: 99 }} />
                    </div>
                    <span style={{ fontSize: ".74rem", fontWeight: 700, color: "var(--dk-ink2, #4A524C)", width: 36, textAlign: "right" }}>
                      {pct.toFixed(0)}%
                    </span>
                    <span style={{ fontSize: ".74rem", fontWeight: 700, color: MUTED, width: 70, textAlign: "right" }}>
                      {fmt(c.total_revenue)} €
                    </span>
                  </div>
                );
              })}
            </div>
            {kpis.categories?.[0] && (
              <Takeaway>
                {tr(
                  `${kpis.categories[0].category} pèse ${fmt((kpis.categories[0].total_revenue / catTotal) * 100)} % du chiffre d'affaires de la journée.`,
                  `${trData(kpis.categories[0].category)} weighs ${fmt((kpis.categories[0].total_revenue / catTotal) * 100)}% of the day's revenue.`
                )}
              </Takeaway>
            )}
          </div>

          <div className="cc">
            <ChartAssistantButton chartType="basket_composition" chartData={{ total_tickets: kpis.tickets, nb_multi: kpis.nb_multi, nb_mono: kpis.nb_mono, pct_multi: (kpis.nb_multi / nb_total) * 100, pct_mono: (kpis.nb_mono / nb_total) * 100 }} chartName="BasketComposition"
              userQuestion="Explique la composition des paniers d'aujourd'hui" position="top-right" onOpenChat={openChat} />
            <div className="ct">{tr("Composition des paniers", "Basket composition")}</div>
            <div className="cs">{tr("Tickets à plusieurs articles ou à un seul article", "Multi-item vs single-item transactions")}</div>
            {/* Barre corrigée : elle mélangeait le CA (en €) et des nombres de tickets, avec des tailles fixes.
                Elle montre maintenant la vraie répartition des tickets à plusieurs articles / à un seul article. */}
            <div style={{ display: "flex", gap: 5, marginBottom: 12 }}>
              <div style={{ height: 42, borderRadius: 10, background: ORANGE, flex: kpis.nb_multi || 0 }} />
              <div style={{ height: 42, borderRadius: 10, background: LIGHT, flex: kpis.nb_mono || 0 }} />
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: ".70rem", color: "var(--dk-ink2, #4A524C)", fontWeight: 500 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: ORANGE }} />
                {tr("Plusieurs articles : ", "Multiple items: ")}{kpis.nb_multi} ({fmt((kpis.nb_multi / nb_total) * 100)}{tr(" %", "%")})
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: ".70rem", color: "var(--dk-ink2, #4A524C)", fontWeight: 500 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: LIGHT, border: `1px solid ${PEACH}` }} />
                {tr("Un seul article : ", "Single item: ")}{kpis.nb_mono} ({fmt((kpis.nb_mono / nb_total) * 100)}{tr(" %", "%")})
              </div>
            </div>
            <Takeaway>
              {tr(
                `${fmt((kpis.nb_mono / nb_total) * 100)} % des clients n'ont pris qu'un seul produit : c'est là qu'une suggestion en caisse peut faire monter le panier.`,
                `${fmt((kpis.nb_mono / nb_total) * 100)}% of customers bought a single product: that is where a till suggestion can raise the basket.`
              )}
            </Takeaway>
            <ExpertNote>
              Repère (ca_ref, tickets_ref) = moyenne des jours ouverts J−7, J−14, J−21, J−28 ({kpis.nb_jours_ref ?? 0} jour(s)). Vitesse = articles / heures avec ventes ; vitesse_ref sur les mêmes jours ; seuils ±20 %. Heure de pointe = heure au CA maximal. Ticket mono = 1 seul product_id distinct.
            </ExpertNote>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="pf">
        <span>
          {siteConfig.bakeryName} &nbsp;·&nbsp; {tr(siteConfig.dataSourceLabel, "POS · Checkout system")} &nbsp;·&nbsp; {kpis.total_lignes ? <>{fmt(kpis.total_lignes)} {tr("lignes", "rows")} &nbsp;·&nbsp; </> : null}{kpis.date_str || siteConfig.dataEndLabel}
        </span>
        <span>{tr("Données historiques — pas le stock réel", "Historical data — not actual stock")}</span>
      </div>
    </div>
    </RetainProvider>
  );
}
