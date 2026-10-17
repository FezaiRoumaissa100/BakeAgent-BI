"use client";

// Section « Prévision par produit » (page Prévisions).
// Liste des produits à gauche (recherche, tri, mini-courbe, tendance) et, à droite, les graphiques
// du produit choisi. Le produit choisi est dans l'adresse (?produit=NOM) : lien partageable,
// et la page Alertes peut ouvrir directement un produit.
// Données : résultats de forecasting/pipeline.py (route /api/forecast/products).

import React, { useEffect, useMemo, useState } from "react";
import { fetchProductForecasts, fetchProductForecast } from "@/lib/api";
import { tr, trData, locale } from "@/lib/i18n";
import { ExpertNote } from "@/components/Expert";
import { Takeaway } from "@/components/Ui";
import { ChartAssistantButton } from "@/components/ChartAssistantButton";
import { useChat } from "@/contexts/ChatContext";

const GREEN = "#2E7D4F", LIGHTG = "#8DC05A", INK = "var(--dk-ink)", MUTED = "var(--dk-muted)";
const fmt = (n: number, d = 0) => Number(n || 0).toLocaleString(locale(), { minimumFractionDigits: d, maximumFractionDigits: d });
const JOURS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const JOURS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dayLbl = (ds: string) => { const d = new Date(ds + "T00:00:00"); return `${tr(JOURS[d.getDay()], JOURS_EN[d.getDay()])} ${ds.slice(8, 10)}/${ds.slice(5, 7)}`; };
const FIAB: Record<string, { fr: string; en: string; c: string }> = {
  bonne: { fr: "Fiable", en: "Reliable", c: GREEN },
  moyenne: { fr: "Moyennement fiable", en: "Fairly reliable", c: "#D4A52A" },
  faible: { fr: "Peu fiable", en: "Less reliable", c: "#C0392B" },
  inconnue: { fr: "Fiabilité non mesurable", en: "Reliability not measurable", c: "#8E998F" },
};
const METH: Record<string, { fr: string; en: string }> = {
  moyenne_4_semaines: { fr: "Moyenne des 4 derniers mêmes jours", en: "Average of the last 4 same weekdays" },
  an_dernier: { fr: "Même période l'an dernier, ajustée au niveau actuel", en: "Same period last year, adjusted to the current level" },
  tsb: { fr: "Méthode pour ventes irrégulières (TSB)", en: "Intermittent-demand method (TSB)" },
  gbm_global: { fr: "Modèle global d'apprentissage (gradient boosting)", en: "Global learning model (gradient boosting)" },
  prophet: { fr: "Prophet (par produit)", en: "Prophet (per product)" },
};

function Spark({ v, color = GREEN }: { v: number[]; color?: string }) {
  if (!v?.length) return null;
  const W = 70, H = 22, mx = Math.max(...v, 1);
  const pts = v.map((y, i) => `${(i / Math.max(v.length - 1, 1)) * W},${H - 2 - (y / mx) * (H - 4)}`).join(" ");
  return <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true"><polyline points={pts} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" /></svg>;
}

function TrendBadge({ chg }: { chg: number | null }) {
  if (chg == null) return <span className="pp-tag" style={{ background: "var(--dk-soft)", color: MUTED, padding: "2px 8px" }}>—</span>;
  const up = chg >= 15, down = chg <= -15;
  const c = up ? GREEN : down ? "#4A78A8" : "var(--dk-ink2)";
  return (
    <span className="pp-tag num" style={{ background: up ? "var(--dk-accent-wash)" : "var(--dk-soft)", color: c, padding: "2px 8px", fontSize: ".7rem" }}>
      {up ? "↑ " : down ? "↓ " : ""}{chg >= 0 ? "+" : ""}{fmt(chg)} %
    </span>
  );
}

/* Graphique du produit : ventes réelles récentes (barres grises) + prévision (ligne verte, fourchette). */
function ProductChart({ history, forecast, sel, onSel }: any) {
  const W = 860, Hh = 300, L = 44, R = 14, T = 16, B = 40;
  const pts = [...history.map((h: any) => ({ ds: h.ds, y: h.qty, open: h.ouvert, kind: "h" })),
               ...forecast.map((f: any) => ({ ds: f.ds, y: f.yhat, lo: f.yhat_lower, hi: f.yhat_upper, open: !f.is_ferme, kind: "f", ly: f.last_year }))];
  const n = pts.length;
  const mx = Math.max(1, ...pts.map((p: any) => Math.max(p.y || 0, p.hi || 0))) * 1.1;
  const step = (() => { const r = mx / 4, p = Math.pow(10, Math.floor(Math.log10(r))); return [1, 2, 2.5, 5, 10].map((m) => m * p).find((x) => x >= r) || r; })();
  const top = Math.ceil(mx / step) * step;
  const bw = (W - L - R) / n;
  const X = (i: number) => L + bw * i + bw / 2;
  const Y = (v: number) => T + (Hh - T - B) * (1 - v / top);
  const fStart = history.length;
  const fpts = pts.slice(fStart);
  const band = fpts.filter((p: any) => p.open).length ? [
    ...fpts.map((p: any, i: number) => `${X(fStart + i)},${Y(p.open ? p.hi : 0)}`),
    ...fpts.map((p: any, i: number) => `${X(fStart + i)},${Y(p.open ? p.lo : 0)}`).reverse(),
  ].join(" ") : "";
  const ticks: number[] = []; for (let v = 0; v <= top + 1e-9; v += step) ticks.push(v);
  return (
    <svg viewBox={`0 0 ${W} ${Hh}`} style={{ width: "100%", height: "auto", display: "block" }}>
      {ticks.map((v) => (
        <g key={v}><line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="rgba(80,100,85,0.12)" />
          <text x={L - 6} y={Y(v) + 4} textAnchor="end" fontSize={10.5} fill="var(--dk-muted)">{fmt(v)}</text></g>
      ))}
      <rect x={L + bw * fStart} y={T} width={W - R - (L + bw * fStart)} height={Hh - T - B} fill="var(--dk-accent-wash)" opacity={0.6} rx={6} />
      <text x={L + bw * fStart + 8} y={T + 14} fontSize={11} fontWeight={800} fill={GREEN}>{tr("Prévision", "Forecast")}</text>
      <text x={L + bw * fStart - 8} y={T + 14} textAnchor="end" fontSize={11} fontWeight={700} fill="var(--dk-muted)">{tr("Ventes réelles", "Actual sales")}</text>
      {history.map((h: any, i: number) => (
        h.ouvert ? <rect key={h.ds} x={X(i) - bw * 0.32} y={Y(h.qty)} width={bw * 0.64} height={Y(0) - Y(h.qty)} rx={2.5} fill="#B9C7B0">
          <title>{`${dayLbl(h.ds)} : ${fmt(h.qty)} ${tr("vendus", "sold")}`}</title></rect>
          : <text key={h.ds} x={X(i)} y={Y(0) - 3} textAnchor="middle" fontSize={8} fill="var(--dk-muted)">×</text>
      ))}
      {band && <polygon points={band} fill={GREEN} opacity={0.14} />}
      <polyline points={fpts.map((p: any, i: number) => `${X(fStart + i)},${Y(p.open ? p.y : 0)}`).join(" ")} fill="none" stroke={GREEN} strokeWidth={2.4} strokeLinejoin="round" />
      {fpts.map((p: any, i: number) => p.ly != null && p.open ? (
        <circle key={`ly${i}`} cx={X(fStart + i)} cy={Y(p.ly)} r={3} fill="none" stroke="#D4A52A" strokeWidth={1.6}><title>{tr(`L'an dernier : ${fmt(p.ly)}`, `Last year: ${fmt(p.ly)}`)}</title></circle>
      ) : null)}
      {fpts.map((p: any, i: number) => {
        const on = sel === p.ds;
        return p.open ? (
          <g key={p.ds} style={{ cursor: "pointer" }} onClick={() => onSel(p.ds)}>
            <rect x={X(fStart + i) - bw / 2} y={T} width={bw} height={Hh - T - B} fill="transparent" />
            <circle cx={X(fStart + i)} cy={Y(p.y)} r={on ? 6.5 : 4.5} fill={on ? GREEN : "#fff"} stroke={GREEN} strokeWidth={2.2} />
            <title>{`${dayLbl(p.ds)} : ${fmt(p.y, 1)} (${fmt(p.lo, 0)}–${fmt(p.hi, 0)})`}</title>
          </g>
        ) : <text key={p.ds} x={X(fStart + i)} y={Y(0) - 4} textAnchor="middle" fontSize={9} fontWeight={700} fill="var(--dk-muted)">{tr("fermé", "closed")}</text>;
      })}
      {/* Dates sous le graphique : une par semaine + le premier jour prévu ; on saute une date trop proche de celui-ci (évite « 31/1201/01 ») */}
      {pts.map((p: any, i: number) => (i === fStart || (i % 7 === (n - 1) % 7 && Math.abs(i - fStart) >= 3)) ? (
        <text key={`x${i}`} x={X(i)} y={Hh - B + 16} textAnchor="middle" fontSize={10} fill={i >= fStart ? GREEN : "var(--dk-muted)"} fontWeight={i >= fStart ? 700 : 500}>{p.ds.slice(8, 10)}/{p.ds.slice(5, 7)}</text>
      ) : null)}
      <line x1={L} x2={W - R} y1={Y(0)} y2={Y(0)} stroke="rgba(80,100,85,0.35)" />
    </svg>
  );
}

export function ProductForecastSection() {
  const { openChat } = useChat();
  const [list, setList] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"qty" | "chg" | "fiab">("chg");
  const [selName, setSelName] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [h, setH] = useState<7 | 14>(7);
  const [day, setDay] = useState<string | null>(null);

  useEffect(() => {
    fetchProductForecasts().then(setList).catch((e) => setErr(String(e?.message || e)));
  }, []);

  const items: any[] = list?.items || [];
  // Produit de départ : celui de l'adresse, sinon la plus forte hausse prévue (sur un volume significatif)
  useEffect(() => {
    if (!items.length || selName) return;
    let fromUrl: string | null = null;
    try { fromUrl = new URLSearchParams(window.location.search).get("produit"); } catch {}
    const ok = fromUrl && items.find((i) => i.article === fromUrl);
    if (ok) { setSelName(fromUrl); setTimeout(() => document.getElementById("par-produit")?.scrollIntoView({ behavior: "smooth" }), 300); return; }
    const big = [...items].filter((i) => (i.usual7 || 0) >= 10 && i.change_pct != null).sort((a, b) => b.change_pct - a.change_pct)[0];
    setSelName((big || items[0]).article);
  }, [items.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const sel = items.find((i) => i.article === selName);
  useEffect(() => {
    if (!sel) return;
    setDetail(null); setDay(null);
    fetchProductForecast(sel.product_id).then(setDetail).catch(() => setDetail({ found: false }));
    try {
      const u = new URL(window.location.href);
      u.searchParams.set("produit", sel.article);
      window.history.replaceState(null, "", u.toString());
    } catch {}
  }, [sel?.product_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    const words = (n: string) => n.toLowerCase().split(/[^a-z0-9à-ÿ]+/i).filter(Boolean);
    let r = t ? items.filter((i) => i.article.toLowerCase().startsWith(t) || words(i.article).some((w) => w.startsWith(t))) : items;
    const fr = { bonne: 0, moyenne: 1, faible: 2, inconnue: 3 } as any;
    r = [...r].sort((a, b) =>
      sort === "qty" ? b.next7 - a.next7 :
      sort === "chg" ? ((b.next7 - b.usual7) - (a.next7 - a.usual7)) :
      (fr[a.fiabilite] - fr[b.fiabilite]) || ((a.wape ?? 9) - (b.wape ?? 9)));
    return r;
  }, [items, q, sort]);

  const toPrepare = useMemo(() => items.filter((i) => i.change_pct != null && i.change_pct >= 15 && i.next7 - i.usual7 >= 5)
    .sort((a, b) => (b.next7 - b.usual7) - (a.next7 - a.usual7)).slice(0, 5), [items]);

  if (err) return null;
  if (!list) return <div className="sw"><div className="cc"><div className="cs">{tr("Chargement de la prévision par produit…", "Loading the per-product forecast…")}</div></div></div>;
  if (!list.available) {
    return (
      <div className="sw"><div className="cc">
        <div className="ct">{tr("Prévision par produit", "Per-product forecast")}</div>
        <div className="cs" style={{ marginBottom: 0 }}>{tr("Elle n'a pas encore été calculée. Pour la calculer, lancer dans le dossier du projet : ", "It has not been computed yet. To compute it, run in the project folder: ")}<code>python forecasting\pipeline.py</code></div>
      </div></div>
    );
  }

  const fc = (detail?.forecast || []).slice(0, h);
  const hist = (detail?.history || []).slice(-(h === 7 ? 28 : 42));
  const openFc = fc.filter((f: any) => !f.is_ferme);
  const tot = openFc.reduce((a: number, f: any) => a + f.yhat, 0);
  const peak = openFc.reduce((m: any, f: any) => (!m || f.yhat > m.yhat ? f : m), null);
  const usualH = h === 7 ? sel?.usual7 : null;
  const dsel = fc.find((f: any) => f.ds === day);
  const fb = FIAB[sel?.fiabilite || "inconnue"];
  const attention = (list.checks || []).filter((c: any) => c.severity === "attention");
  const runNotes: any = (() => { try { return JSON.parse(list.run?.notes || "{}") || {}; } catch { return {}; } })();

  return (
    <div id="par-produit">
      <div className="sec-title">{tr("Prévision par produit", "Per-product forecast")}</div>

      {attention.length > 0 && (
        <div className="sw">
          <div className="insight" style={{ margin: "0 0 16px", borderLeftColor: "#D4A52A" }}>
            <b>{tr("À vérifier avant de lire les prévisions : ", "Check before reading the forecasts: ")}</b>
            {attention.map((c: any, i: number) => <span key={i}>{c.date_from ? `${c.date_from.slice(8, 10)}/${c.date_from.slice(5, 7)}/${c.date_from.slice(0, 4)} → ${c.date_to?.slice(8, 10)}/${c.date_to?.slice(5, 7)}/${c.date_to?.slice(0, 4)} : ` : ""}{c.detail} </span>)}
          </div>
        </div>
      )}

      {/* ── À préparer en plus cette semaine ── */}
      {toPrepare.length > 0 && (
        <div className="sw">
          <div className="cc" style={{ marginBottom: 16 }}>
            <ChartAssistantButton chartType="product_forecast_to_prepare" chartData={{ items: toPrepare }} chartName="ProductForecastToPrepare"
              userQuestion="Explique quels produits préparer en plus cette semaine" position="top-right" onOpenChat={openChat} />
            <div className="ct">{tr("À préparer en plus cette semaine", "Prepare more of this week")}</div>
            <div className="cs">{tr("Produits dont la prévision des 7 prochains jours dépasse nettement l'habitude · cliquez pour le détail", "Products whose next-7-day forecast is clearly above usual · click for details")}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 10 }}>
              {toPrepare.map((p) => (
                <button key={p.product_id} onClick={() => setSelName(p.article)}
                        style={{ textAlign: "left", cursor: "pointer", border: `1px solid ${selName === p.article ? GREEN : "var(--dk-line)"}`, background: selName === p.article ? "var(--dk-accent-wash)" : "var(--dk-surface)", borderRadius: 16, padding: "12px 14px", transition: "all .2s" }}>
                  <div style={{ fontSize: ".8rem", fontWeight: 700, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.article}</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
                    <span className="num" style={{ fontSize: "1.25rem", fontWeight: 800, color: GREEN }}>+{fmt(p.next7 - p.usual7)}</span>
                    <span style={{ fontSize: ".72rem", color: MUTED }}>{tr("articles vs habitude", "items vs usual")}</span>
                  </div>
                  <div style={{ fontSize: ".72rem", color: MUTED }}>{fmt(p.next7)} {tr("prévus", "forecast")} · <TrendBadge chg={p.change_pct} /></div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="sw">
        <div className="grid-main" style={{ gridTemplateColumns: "minmax(280px, 1fr) minmax(0, 2.2fr)" }}>
          {/* ── Liste des produits ── */}
          <div className="cc" style={{ display: "flex", flexDirection: "column", padding: "16px 14px" }}>
            <ChartAssistantButton chartType="product_forecast_list" chartData={{ items: filtered.slice(0, 40).map((i: any) => ({ article: i.article, next7: i.next7, usual7: i.usual7, change_pct: i.change_pct, fiabilite: i.fiabilite })), nb_total: items.length }} chartName="ProductForecastList"
              userQuestion="Explique la liste des prévisions par produit" position="top-right" onOpenChat={openChat} />
            <div className="ct" style={{ padding: "0 6px" }}>{tr(`${items.length} produits prévus`, `${items.length} forecast products`)}</div>
            <div className="cs" style={{ padding: "0 6px" }}>{tr(`Prévision des 7 prochains jours · ${list.non_prevus?.inactif || 0} inactifs et ${list.non_prevus?.insuffisant || 0} sans historique suffisant ne sont pas prévus`, `Next 7 days · ${list.non_prevus?.inactif || 0} inactive and ${list.non_prevus?.insuffisant || 0} with too little history are not forecast`)}</div>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Chercher un produit…", "Search a product…")}
                   style={{ margin: "4px 6px 10px", padding: "9px 14px", borderRadius: 999, border: "1px solid var(--dk-line)", background: "var(--dk-soft)", color: INK, fontSize: ".82rem", outline: "none" }} />
            <div style={{ display: "flex", gap: 6, padding: "0 6px 10px", flexWrap: "wrap" }}>
              {([["chg", tr("Écart à l'habitude", "Gap vs usual")], ["qty", tr("Quantité", "Quantity")], ["fiab", tr("Fiabilité", "Reliability")]] as const).map(([k, l]) => (
                <button key={k} onClick={() => setSort(k)} style={{ border: "none", cursor: "pointer", padding: "5px 11px", borderRadius: 999, fontSize: ".72rem", fontWeight: 700, background: sort === k ? "var(--dk-pill, #1F2B23)" : "var(--dk-soft)", color: sort === k ? "#fff" : "var(--dk-ink2)" }}>{l}</button>
              ))}
            </div>
            <div style={{ overflowY: "auto", maxHeight: 560, display: "flex", flexDirection: "column", gap: 2 }}>
              {filtered.map((p) => {
                const on = p.article === selName;
                return (
                  <button key={p.product_id} onClick={() => setSelName(p.article)}
                          style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center", textAlign: "left", cursor: "pointer",
                                   border: "none", borderRadius: 14, padding: "9px 10px", background: on ? "var(--dk-accent-wash)" : "transparent",
                                   boxShadow: on ? `inset 3px 0 0 ${GREEN}` : "none", transition: "background .15s" }}
                          onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = "var(--dk-soft)"; }}
                          onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = "transparent"; }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: ".8rem", fontWeight: on ? 800 : 600, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.article}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: ".7rem", color: MUTED, marginTop: 2 }}>
                        <span className="num">{fmt(p.next7)} {tr("prévus", "forecast")}</span>
                        <TrendBadge chg={p.change_pct} />
                      </div>
                    </div>
                    <Spark v={p.spark} color={p.tendance === "hausse" ? GREEN : p.tendance === "baisse" ? "#4A78A8" : "#8E998F"} />
                  </button>
                );
              })}
              {filtered.length === 0 && <div className="cs" style={{ padding: 10 }}>{tr("Aucun produit ne correspond.", "No matching product.")}</div>}
            </div>
          </div>

          {/* ── Détail du produit choisi ── */}
          <div className="cc hero-card">
            {sel && detail && (
              <ChartAssistantButton chartType="product_forecast_detail" chartData={{ product: sel, detail, horizon: h }} chartName="ProductForecastChart"
                userQuestion={`Explique la prévision du produit ${sel.article}`} position="top-right" onOpenChat={openChat} />
            )}
            {!sel || !detail ? <div className="cs">{tr("Chargement…", "Loading…")}</div> : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", paddingRight: 34 }}>
                  <div>
                    <div style={{ fontSize: ".74rem", color: MUTED, fontWeight: 600 }}>{trData(sel.category)}</div>
                    <div style={{ fontSize: "1.3rem", fontWeight: 800, color: INK, letterSpacing: "-0.02em" }}>{sel.article}</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                      <span className="pp-tag" style={{ background: `color-mix(in srgb, ${fb.c} 13%, transparent)`, color: fb.c }}>{tr(fb.fr, fb.en)}{sel.wape != null ? tr(` · erreur moyenne ±${fmt(sel.wape * 100)} %`, ` · average error ±${fmt(sel.wape * 100)}%`) : ""}</span>
                      <span className="pp-tag" style={{ background: "var(--dk-soft)", color: "var(--dk-ink2)" }}>{tr(`Ventes ${sel.segment}s`, `${sel.segment} sales`)}</span>
                      {sel.saisonnier && <span className="pp-tag" style={{ background: "var(--dk-soft)", color: "#A0694A" }}>{tr("Saisonnier", "Seasonal")}</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4, padding: 3, borderRadius: 999, background: "var(--dk-soft)" }}>
                    {[7, 14].map((v) => (
                      <button key={v} onClick={() => setH(v as 7 | 14)} style={{ border: "none", cursor: "pointer", padding: "6px 14px", borderRadius: 999, fontSize: ".76rem", fontWeight: 700, background: h === v ? GREEN : "transparent", color: h === v ? "#fff" : "var(--dk-ink2)" }}>
                        {v} {tr("jours", "days")}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Chiffres clés */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, margin: "14px 0 6px" }}>
                  {[
                    { l: tr(`Prévu sur ${h} jours`, `Forecast over ${h} days`), v: fmt(tot), s: usualH ? tr(`habituellement ${fmt(usualH)}`, `usually ${fmt(usualH)}`) : tr("articles", "items") },
                    { l: tr("Jour le plus chargé", "Busiest day"), v: peak ? dayLbl(peak.ds) : "—", s: peak ? tr(`${fmt(peak.yhat)} articles prévus`, `${fmt(peak.yhat)} items forecast`) : "" },
                    { l: tr("À préparer ce jour-là", "To prepare that day"), v: peak ? fmt(Math.ceil(peak.yhat_upper)) : "—", s: tr("borne haute : 9 jours sur 10, on ne manque pas", "high bound: no shortage 9 days out of 10") },
                  ].map((k) => (
                    <div key={k.l} className="pp-stat"><div className="l">{k.l}</div><div className="v">{k.v}</div><div className="s">{k.s}</div></div>
                  ))}
                </div>

                <ProductChart history={hist} forecast={fc} sel={day} onSel={(d: string) => setDay(day === d ? null : d)} />
                <div style={{ display: "flex", flexWrap: "wrap", gap: 14, fontSize: ".72rem", color: MUTED, marginTop: 4 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 12, height: 10, borderRadius: 3, background: "#B9C7B0" }} />{tr("ventes réelles", "actual sales")}</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, height: 3, background: GREEN }} />{tr("prévision", "forecast")}</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, height: 10, background: GREEN, opacity: 0.18, borderRadius: 3 }} />{tr("fourchette basse – haute", "low – high range")}</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 9, height: 9, borderRadius: 99, border: "1.6px solid #D4A52A" }} />{tr("même jour de la semaine, il y a 52 semaines", "same weekday, 52 weeks earlier")}</span>
                  <span>· {tr("cliquez sur un jour prévu pour le détail", "click a forecast day for details")}</span>
                </div>

                {dsel && (
                  <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 16, background: "var(--dk-accent-wash)", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
                    <div><div style={{ fontSize: ".72rem", color: MUTED }}>{tr("Jour", "Day")}</div><div style={{ fontWeight: 800, color: INK }}>{dayLbl(dsel.ds)}</div></div>
                    <div><div style={{ fontSize: ".72rem", color: MUTED }}>{tr("Prévu", "Forecast")}</div><div className="num" style={{ fontWeight: 800, color: GREEN }}>{fmt(dsel.yhat, 1)}</div></div>
                    <div><div style={{ fontSize: ".72rem", color: MUTED }}>{tr("Fourchette", "Range")}</div><div className="num" style={{ fontWeight: 700, color: INK }}>{fmt(dsel.yhat_lower)} – {fmt(dsel.yhat_upper)}</div></div>
                    <div><div style={{ fontSize: ".72rem", color: MUTED }}>{tr("À préparer", "To prepare")}</div><div className="num" style={{ fontWeight: 800, color: INK }}>{fmt(Math.ceil(dsel.yhat_upper))}</div></div>
                    <div><div style={{ fontSize: ".72rem", color: MUTED }}><span title={tr("Même jour de la semaine, 52 semaines plus tôt (pas la même date)", "Same weekday, 52 weeks earlier (not the same date)")}>{tr("Il y a 52 semaines", "52 weeks earlier")}</span></div><div className="num" style={{ fontWeight: 700, color: INK }}>{dsel.last_year != null ? fmt(dsel.last_year) : "—"}</div></div>
                  </div>
                )}

                {sel.saison && (
                  <Takeaway>
                    {tr(
                      sel.saison === "debut"
                        ? `Début de saison : l'an dernier, ${sel.article} se vendait nettement plus à cette période qu'avant. La prévision suit donc l'an dernier, ajustée au niveau actuel de la boutique ; sa fiabilité ne peut pas être mesurée sur les semaines précédentes (hors saison).`
                        : `Fin de saison : l'an dernier, les ventes de ${sel.article} chutaient nettement à cette période. La prévision suit donc l'an dernier plutôt que les dernières semaines.`,
                      sel.saison === "debut"
                        ? `Season start: last year ${sel.article} sold clearly more at this time than before. The forecast follows last year, adjusted to the shop's current level; its reliability cannot be measured on the previous (off-season) weeks.`
                        : `Season end: last year, sales of ${sel.article} dropped sharply at this time. The forecast follows last year rather than the last few weeks.`
                    )}
                  </Takeaway>
                )}
                {usualH != null && usualH > 0 && (
                  <Takeaway>
                    {tr(
                      `${sel.article} : ${fmt(tot)} articles prévus sur les 7 prochains jours, ${tot >= usualH ? "soit" : "contre"} ${fmt(usualH)} habituellement (${tot >= usualH ? "+" : ""}${fmt(((tot - usualH) / usualH) * 100)} %).${peak ? ` Jour le plus chargé : ${dayLbl(peak.ds)} (${fmt(peak.yhat)} prévus, en préparer ${fmt(Math.ceil(peak.yhat_upper))} pour ne pas manquer).` : ""}`,
                      `${sel.article}: ${fmt(tot)} items forecast over the next 7 days vs ${fmt(usualH)} usually (${tot >= usualH ? "+" : ""}${fmt(((tot - usualH) / usualH) * 100)}%).${peak ? ` Busiest day: ${dayLbl(peak.ds)} (${fmt(peak.yhat)} forecast, prepare ${fmt(Math.ceil(peak.yhat_upper))} to avoid running out).` : ""}`
                    )}
                  </Takeaway>
                )}
                <ExpertNote>
                  Méthode retenue : {METH[sel.method]?.fr || sel.method} (« {sel.method} »){sel.saison ? ` — règle de saison (${sel.saison})` : `, choisie par compétition sur ${runNotes.fenetres_test ?? "?"} fenêtres de test de ${list.run?.horizon || 14} jours réparties sur l'année`}. WAPE = {sel.wape != null ? fmt(sel.wape * 100, 1) : "—"} % (moyenne 4 semaines : {sel.wape_baseline != null ? fmt(sel.wape_baseline * 100, 1) : "—"} %). Classe Syntetos-Boylan : {sel.segment} (ADI {detail.model?.adi ?? "—"}, CV² {detail.model?.cv2 ?? "—"}){sel.saisonnier ? ", saisonnier" : ""}. Fourchette = quantiles 10 % / 90 % des erreurs réellement observées pendant les tests, par méthode et par taille de prévision (moins de 1, 1 à 5, 5 et plus par jour). {runNotes.couverture_fourchette != null ? `Mesurée sur des fenêtres de test non utilisées pour la construire, pour les produits prévus à au moins 1 par jour : ${fmt(runNotes.couverture_fourchette * 100, 0)} % des ventes réelles dans la fourchette${runNotes.au_dessus_fourchette != null ? `, ${fmt(runNotes.au_dessus_fourchette * 100, 0)} % au-dessus (jours où la quantité à préparer aurait manqué)` : ""}.` : "Couverture non mesurable (historique trop court)."} Jours d'événement courts (Noël, réveillon, 1er janvier, Pâques…) : chaque produit suit ce qu'il a vendu le même jour d'événement l'an dernier, ajusté à son niveau actuel ; un jour habituellement fermé est prévu ouvert s'il l'était l'an dernier avec un vrai volume. Quantité à préparer = borne haute du jour. Calcul du {list.run?.run_at} sur les données jusqu'au {list.run?.data_end}. API : /api/forecast/products/{sel.product_id}.
                </ExpertNote>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
