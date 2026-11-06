"use client";

// Section « Prévision par produit » (page Prévisions).
// Liste des produits à gauche (recherche, tri, mini-courbe, tendance) et, à droite, les graphiques
// du produit choisi. Le produit choisi est dans l'adresse (?produit=NOM) : lien partageable,
// et la page Alertes peut ouvrir directement un produit.
// Données : résultats de forecasting/pipeline.py (route /api/forecast/products).

import React, { useEffect, useMemo, useState } from "react";
import { fetchProductForecasts, fetchProductForecast } from "@/lib/api";
import { niceScale, fmtAxisNum } from "@/lib/chartScale";
import { useBox } from "@/lib/useBox";
import { tr, trData, locale } from "@/lib/i18n";
import { ExpertNote } from "@/components/Expert";
import { Takeaway, Scope } from "@/components/Ui";
import { ChartAssistantButton } from "@/components/ChartAssistantButton";
import { useChat } from "@/contexts/ChatContext";

const GREEN = "var(--ch-1)", LIGHTG = "var(--ch-soft)", INK = "var(--dk-ink)", MUTED = "var(--dk-muted)";
const fmt = (n: number, d = 0) => Number(n || 0).toLocaleString(locale(), { minimumFractionDigits: d, maximumFractionDigits: d });
const JOURS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const JOURS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dayLbl = (ds: string) => { const d = new Date(ds + "T00:00:00"); return `${tr(JOURS[d.getDay()], JOURS_EN[d.getDay()])} ${ds.slice(8, 10)}/${ds.slice(5, 7)}`; };
const FIAB: Record<string, { fr: string; en: string; c: string }> = {
  bonne: { fr: "Fiable", en: "Reliable", c: GREEN },
  moyenne: { fr: "Moyennement fiable", en: "Fairly reliable", c: "var(--ch-2)" },
  faible: { fr: "Peu fiable", en: "Less reliable", c: "var(--dk-alert)" },
  inconnue: { fr: "Fiabilité non mesurable", en: "Reliability not measurable", c: "var(--ch-other)" },
};
const METH: Record<string, { fr: string; en: string }> = {
  moyenne_4_semaines: { fr: "Moyenne des 4 derniers mêmes jours", en: "Average of the last 4 same weekdays" },
  an_dernier: { fr: "Même période l'an dernier, ajustée au niveau actuel", en: "Same period last year, adjusted to the current level" },
  tsb: { fr: "Méthode pour ventes irrégulières (TSB)", en: "Intermittent-demand method (TSB)" },
  gbm_global: { fr: "Modèle global d'apprentissage (gradient boosting)", en: "Global learning model (gradient boosting)" },
  prophet: { fr: "Prophet (par produit)", en: "Prophet (per product)" },
};

function TrendBadge({ chg }: { chg: number | null }) {
  if (chg == null) return <span className="pp-tag" style={{ background: "var(--dk-soft)", color: MUTED, padding: "2px 8px" }}>—</span>;
  const up = chg >= 15, down = chg <= -15;
  const c = up ? GREEN : down ? "var(--ch-3)" : "var(--dk-ink2)";
  return (
    <span className="pp-tag num" style={{ background: up ? "var(--dk-accent-wash)" : "var(--dk-soft)", color: c, padding: "2px 8px", fontSize: ".7rem" }}>
      {up ? "↑ " : down ? "↓ " : ""}{chg >= 0 ? "+" : ""}{fmt(chg)} %
    </span>
  );
}

/* Graphique du produit : ventes réelles récentes (barres grises) + prévision (ligne verte, fourchette). */
function ProductChart({ history, forecast, sel, onSel, euro = false, seasonal = false }: any) {
  // Taille réelle du cadre (hauteur fixe) : le graphique ne grandit plus avec la largeur de la page
  const [boxRef, W, Hh] = useBox<SVGSVGElement>(900, 240);
  const L = 50, R = 12, T = 26, B = 34;
  const pts = [...history.map((h: any) => ({ ds: h.ds, y: h.qty, open: h.ouvert, kind: "h" })),
               ...forecast.map((f: any) => ({ ds: f.ds, y: f.yhat, lo: f.yhat_lower, hi: f.yhat_upper, open: !f.is_ferme, kind: "f", ly: f.last_year }))];
  const n = pts.length;
  const scale = niceScale(Math.max(1, ...pts.map((p: any) => p.y || 0)) * 1.1, 4);
  const top = scale.max;
  const bw = (W - L - R) / n;
  const X = (i: number) => L + bw * i + bw / 2;
  const Y = (v: number) => T + (Hh - T - B) * (1 - v / top);
  const fStart = history.length;
  const fpts = pts.slice(fStart);
  const band = fpts.filter((p: any) => p.open).length ? [
    ...fpts.map((p: any, i: number) => `${X(fStart + i)},${Y(p.open ? p.hi : 0)}`),
    ...fpts.map((p: any, i: number) => `${X(fStart + i)},${Y(p.open ? p.lo : 0)}`).reverse(),
  ].join(" ") : "";
  const ticks = scale.ticks;
  // Aucune vente sur les jours affichés (ex. galette des rois avant janvier) : on le dit, sinon la zone paraît cassée
  const noSales = history.length > 0 && history.every((h: any) => !h.ouvert || !(h.qty > 0));
  // Dates : environ 6 sur l'axe, dont le premier jour prévu ; rien de trop proche de celui-ci (pas de chevauchement)
  const every = Math.max(1, Math.ceil(n / 6));
  const showDate = (i: number) => i === fStart || (i % every === (n - 1) % every && Math.abs(i - fStart) >= Math.ceil(every * 0.75));
  return (
    <svg ref={boxRef} viewBox={`0 0 ${W} ${Hh}`} style={{ width: "100%", height: 240, display: "block" }}>
      {ticks.map((v) => (
        <g key={v}><line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="rgba(80,100,85,0.12)" />
          <text x={L - 7} y={Y(v) + 4.5} textAnchor="end" fontSize={11.5} fontWeight={600} fill="var(--dk-muted)">{fmtAxisNum(v)}{euro ? " €" : ""}</text></g>
      ))}
      <rect x={L + bw * fStart} y={T} width={W - R - (L + bw * fStart)} height={Hh - T - B} fill="var(--dk-accent-wash)" opacity={0.6} rx={6} />
      <text x={L + bw * fStart + 6} y={T - 8} fontSize={13} fontWeight={800} fill={GREEN}>{tr("Prévision", "Forecast")}</text>
      <text x={L + bw * fStart - 6} y={T - 8} textAnchor="end" fontSize={13} fontWeight={700} fill="var(--dk-muted)">{tr("Ventes réelles", "Actual sales")}</text>
      {history.map((h: any, i: number) => (
        h.ouvert ? <rect key={h.ds} x={X(i) - bw * 0.32} y={Y(h.qty)} width={bw * 0.64} height={Y(0) - Y(h.qty)} rx={2.5} fill="var(--ch-ramp-3)">
          <title>{euro ? `${dayLbl(h.ds)} : ${fmt(h.qty)} €` : `${dayLbl(h.ds)} : ${fmt(h.qty)} ${tr("vendus", "sold")}`}</title></rect>
          : <text key={h.ds} x={X(i)} y={Y(0) - 3} textAnchor="middle" fontSize={11} fill="var(--dk-muted)">×</text>
      ))}
      {noSales && (
        <g pointerEvents="none">
          <text x={(L + L + bw * fStart) / 2} y={(T + Hh - B) / 2 - 4} textAnchor="middle" fontSize={13} fontWeight={700} fill="var(--dk-ink2)">
            {tr("Aucune vente sur ces semaines", "No sales in these weeks")}
          </text>
          <text x={(L + L + bw * fStart) / 2} y={(T + Hh - B) / 2 + 15} textAnchor="middle" fontSize={11.5} fill="var(--dk-muted)">
            {seasonal ? tr("produit de saison : il se vend surtout pendant sa période", "seasonal product: it sells mostly in its season") : tr("le produit n'a pas été vendu sur cette période", "the product was not sold in this period")}
          </text>
        </g>
      )}
      <polyline points={fpts.map((p: any, i: number) => `${X(fStart + i)},${Y(p.open ? p.y : 0)}`).join(" ")} fill="none" stroke={GREEN} strokeWidth={2.4} strokeLinejoin="round" />
      {fpts.map((p: any, i: number) => {
        const on = sel === p.ds;
        return p.open ? (
          <g key={p.ds} style={{ cursor: "pointer" }} onClick={() => onSel(p.ds)}>
            <rect x={X(fStart + i) - bw / 2} y={T} width={bw} height={Hh - T - B} rx={4} fill={on ? "rgba(115,87,217,0.16)" : "transparent"} />
            <circle cx={X(fStart + i)} cy={Y(p.y)} r={on ? 6.5 : 4.5} fill={on ? GREEN : "#fff"} stroke={GREEN} strokeWidth={2.2} />
            <title>{`${dayLbl(p.ds)} : ${fmt(p.y, 1)} (${fmt(p.lo, 0)}–${fmt(p.hi, 0)})`}</title>
          </g>
        ) : <text key={p.ds} x={X(fStart + i)} y={Y(0) - 4} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--dk-muted)">{tr("fermé", "closed")}</text>;
      })}
      {/* Dates sous le graphique : une par semaine + le premier jour prévu ; on saute une date trop proche de celui-ci (évite « 31/1201/01 ») */}
      {pts.map((p: any, i: number) => showDate(i) ? (
        <text key={`x${i}`} x={X(i)} y={Hh - B + 20} textAnchor="middle" fontSize={13} fill={i >= fStart ? GREEN : "var(--dk-muted)"} fontWeight={i >= fStart ? 700 : 500}>{p.ds.slice(8, 10)}/{p.ds.slice(5, 7)}</text>
      ) : null)}
      <line x1={L} x2={W - R} y1={Y(0)} y2={Y(0)} stroke="rgba(80,100,85,0.35)" />
    </svg>
  );
}

/* Barre de choix du produit : recherche + liste déroulante (flèche), triable ; clavier : ↑ ↓ Entrée Échap */
function ProductPicker({ items, all, toPrepare = [], sel, q, setQ, sort, setSort, onPick, note }: any) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const boxRef = React.useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  useEffect(() => { setHi(0); }, [q, sort]);
  const shown = items.slice(0, 60);
  const pick = (a: string) => { onPick(a); setOpen(false); };
  const sugg = [...all].filter((i: any) => i.change_pct != null && (i.usual7 || 0) >= 5).sort((a: any, b: any) => (b.next7 - b.usual7) - (a.next7 - a.usual7)).slice(0, 4);
  return (
    <div className="cc" style={{ padding: "10px 12px", marginBottom: 12, overflow: "visible", position: "relative", zIndex: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div ref={boxRef} style={{ position: "relative", flex: "1 1 340px", maxWidth: 520 }}>
          <div className="pick-box" onClick={() => setOpen(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input value={q} placeholder={sel ? sel.article : tr("Chercher un produit…", "Search a product…")}
              onFocus={() => setOpen(true)}
              onChange={(e) => { setQ(e.target.value); setOpen(true); }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setHi((v) => Math.min(v + 1, shown.length - 1)); }
                else if (e.key === "ArrowUp") { e.preventDefault(); setHi((v) => Math.max(v - 1, 0)); }
                else if (e.key === "Enter" && shown[hi]) { e.preventDefault(); pick(shown[hi].article); }
                else if (e.key === "Escape") setOpen(false);
              }}
              aria-label={tr("Choisir un produit", "Choose a product")} />
            <button type="button" className="pick-arrow" aria-label={tr("Ouvrir la liste", "Open the list")}
              onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }}><path d="m6 9 6 6 6-6" /></svg>
            </button>
          </div>
          {open && (
            <div className="pick-pop" role="listbox">
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", borderBottom: "1px solid var(--dk-line)" }}>
                <span style={{ fontSize: ".66rem", fontWeight: 800, color: MUTED, textTransform: "uppercase", letterSpacing: ".06em" }}>{tr("Trier", "Sort")}</span>
                {([["chg", tr("Écart à l'habitude", "Gap vs usual")], ["qty", tr("Quantité", "Quantity")], ["fiab", tr("Fiabilité", "Reliability")]] as const).map(([k, l]) => (
                  <button key={k} type="button" onClick={() => setSort(k)} className={`pick-sort${sort === k ? " on" : ""}`}>{l}</button>
                ))}
                <span style={{ marginLeft: "auto", fontSize: ".66rem", color: MUTED }}>{tr(`${items.length} produits`, `${items.length} products`)}</span>
              </div>
              <div style={{ maxHeight: 340, overflowY: "auto" }}>
                {shown.map((p: any, i: number) => {
                  const on = sel && p.article === sel.article;
                  return (
                    <button key={p.product_id} type="button" role="option" aria-selected={on}
                      className={`pick-row${i === hi ? " hi" : ""}${on ? " on" : ""}`}
                      onMouseEnter={() => setHi(i)} onClick={() => pick(p.article)}>
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ display: "block", fontSize: ".8rem", fontWeight: 700, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.article}</span>
                        <span style={{ display: "block", fontSize: ".68rem", color: MUTED }}>{trData(p.category)}</span>
                      </span>
                      <span className="num" style={{ width: 70, textAlign: "right", fontSize: ".72rem", color: "var(--dk-ink2)" }}>{tr(`${fmt(p.next7)} prévus`, `${fmt(p.next7)} fcst`)}</span>
                      <span style={{ width: 74, textAlign: "right", whiteSpace: "nowrap" }}><TrendBadge chg={p.change_pct} /></span>
                    </button>
                  );
                })}
                {shown.length === 0 && <div className="cs" style={{ padding: 12 }}>{tr("Aucun produit ne correspond.", "No matching product.")}</div>}
              </div>
              <div style={{ padding: "7px 12px", fontSize: ".66rem", color: MUTED, borderTop: "1px solid var(--dk-line)" }}>{note}</div>
            </div>
          )}
        </div>
        {/* « À préparer en plus cette semaine » : en petites pastilles à côté de la recherche (au lieu d'une grande carte) */}
        {(toPrepare.length > 0 ? toPrepare : sugg).length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: ".7rem", fontWeight: 800, color: "var(--dk-ink2)" }} title={tr("Prévision des 7 prochains jours nettement au-dessus d'une semaine habituelle", "Next 7 days forecast clearly above a usual week")}>
              {toPrepare.length > 0 ? tr("À préparer en plus cette semaine :", "Prepare more this week:") : tr("En forte hausse :", "Rising most:")}
            </span>
            {(toPrepare.length > 0 ? toPrepare : sugg).map((p: any) => (
              <button key={p.product_id} type="button" onClick={() => pick(p.article)} className={`pick-chip${sel && sel.article === p.article ? " on" : ""}`}
                title={tr(`${fmt(p.next7)} pièces prévues sur 7 jours, contre ${fmt(p.usual7)} une semaine habituelle`, `${fmt(p.next7)} pieces forecast over 7 days, vs ${fmt(p.usual7)} in a usual week`)}>
                {p.article} <b className="num" style={{ color: "var(--ch-1)", marginLeft: 4 }}>+{fmt(p.next7 - p.usual7)} {tr("pièces", "pcs")}</b>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function ProductForecastSection({ horizon = 7, unit = "articles" }: { horizon?: number; unit?: string }) {
  const { openChat } = useChat();
  const [list, setList] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"qty" | "chg" | "fiab">("chg");
  const [selName, setSelName] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  // Horizon : celui choisi en haut de la page Prévisions (7, 14 ou 30 jours), le même pour tout
  const h = (horizon >= 30 ? 30 : horizon >= 14 ? 14 : 7) as 7 | 14 | 30;
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

  // Unité : articles, ou chiffre d'affaires (même bouton que la prévision globale) = pièces × prix moyen récent du produit
  const prix = Number(detail?.prix_moyen) || 0;
  const euro = unit === "ca" && prix > 0;
  const k = euro ? prix : 1;
  const fcRaw = (detail?.forecast || []).slice(0, h);
  const fc = fcRaw.map((f: any) => (euro ? { ...f, yhat: f.yhat * k, yhat_lower: f.yhat_lower * k, yhat_upper: f.yhat_upper * k, last_year: f.last_year != null ? f.last_year * k : null } : f));
  const hist = (detail?.history || []).slice(-(h === 7 ? 28 : h === 14 ? 42 : 90))
    .map((x: any) => (euro ? { ...x, qty: x.rev != null ? x.rev : x.qty * k } : x));
  const u = (v: number) => (euro ? `${fmt(v)} €` : fmt(v));
  const openFc = fc.filter((f: any) => !f.is_ferme);
  const tot = openFc.reduce((a: number, f: any) => a + f.yhat, 0);
  const peak = openFc.reduce((m: any, f: any) => (!m || f.yhat > m.yhat ? f : m), null);
  // Habitude sur l'horizon : une semaine habituelle (usual7) ramenée au nombre de jours affichés
  const usualH = sel?.usual7 != null ? ((sel.usual7 * h) / 7) * k : null;
  const dsel = fc.find((f: any) => f.ds === day);
  // Jour suivi par les chiffres clés : le jour cliqué, sinon le jour le plus chargé
  const focus = dsel || peak;
  const focusRaw = focus ? fcRaw.find((x: any) => x.ds === focus.ds) : null;
  const prep = focusRaw ? Math.ceil(focusRaw.conseille ?? focusRaw.yhat_upper ?? 0) : null;
  const qty = (v: number) => (euro ? `${u(v)}` : tr(`${fmt(v)} pièces`, `${fmt(v)} pcs`));
  const fb = FIAB[sel?.fiabilite || "inconnue"];
  const attention = (list.checks || []).filter((c: any) => c.severity === "attention");
  const runNotes: any = (() => { try { return JSON.parse(list.run?.notes || "{}") || {}; } catch { return {}; } })();

  return (
    <div id="par-produit">
      <div className="sec-title">{tr("Prévision par produit", "Per-product forecast")}</div>

      {attention.length > 0 && (
        <div className="sw">
          <div className="insight" style={{ margin: "0 0 16px", borderLeftColor: "var(--ch-2)" }}>
            <b>{tr("À vérifier avant de lire les prévisions : ", "Check before reading the forecasts: ")}</b>
            {attention.map((c: any, i: number) => <span key={i}>{c.date_from ? `${c.date_from.slice(8, 10)}/${c.date_from.slice(5, 7)}/${c.date_from.slice(0, 4)} → ${c.date_to?.slice(8, 10)}/${c.date_to?.slice(5, 7)}/${c.date_to?.slice(0, 4)} : ` : ""}{c.detail} </span>)}
          </div>
        </div>
      )}

      {/* ── À préparer en plus cette semaine ── */}
      <div className="sw">
        {/* ── Choix du produit : une barre de recherche avec liste déroulante (au lieu d'une longue liste) ── */}
        <ProductPicker items={filtered} all={items} toPrepare={toPrepare} sel={sel} q={q} setQ={setQ} sort={sort} setSort={setSort}
          onPick={(a: string) => { setSelName(a); setQ(""); }}
          note={tr(`${items.length} produits prévus · ${list.non_prevus?.inactif || 0} inactifs et ${list.non_prevus?.insuffisant || 0} sans historique suffisant ne sont pas prévus`,
                   `${items.length} forecast products · ${list.non_prevus?.inactif || 0} inactive and ${list.non_prevus?.insuffisant || 0} with too little history are not forecast`)} />
        <div>
          {/* ── Détail du produit choisi : graphique à gauche, chiffres clés à droite (comme la prévision globale) ── */}
          <div className="fc-layout">
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
                      {sel.saisonnier && <span className="pp-tag" style={{ background: "var(--dk-soft)", color: "var(--ch-4)" }}>{tr("Saisonnier", "Seasonal")}</span>}
                    </div>
                  </div>
                </div>


                {hist.length > 0 && fc.length > 0 && (
                  <Scope period={tr(`Réel ${dayLbl(hist[0].ds)} → ${dayLbl(hist[hist.length - 1].ds)} · Prévu ${dayLbl(fc[0].ds)} → ${dayLbl(fc[fc.length - 1].ds)}`, `Actual ${dayLbl(hist[0].ds)} → ${dayLbl(hist[hist.length - 1].ds)} · Forecast ${dayLbl(fc[0].ds)} → ${dayLbl(fc[fc.length - 1].ds)}`)}
                    calc={euro ? tr(`Chiffre d'affaires de ${trData(sel.article)}, réel ou prévu (pièces × prix moyen ${fmt(prix, 2)} €)`, `${trData(sel.article)} revenue, actual or forecast (pieces × average price €${fmt(prix, 2)})`)
                               : tr(`Pièces de ${trData(sel.article)} vendues ou prévues chaque jour`, `Pieces of ${trData(sel.article)} sold or forecast each day`)}
                    unit={euro ? tr("€ par jour", "€ per day") : tr("pièces par jour", "pieces per day")} />
                )}
                {unit === "ca" && !euro && <div className="cs">{tr("Prix du produit indisponible : affichage en pièces.", "Product price unavailable: shown in pieces.")}</div>}
                <ProductChart history={hist} forecast={fc} euro={euro} seasonal={!!(sel.saisonnier || sel.saison)} sel={focus?.ds ?? null} onSel={(d: string) => setDay(day === d ? null : d)} />
                <div style={{ fontSize: ".72rem", color: MUTED, marginTop: 4 }}>{tr("Cliquez sur un jour prévu : les chiffres clés à droite passent à ce jour.", "Click a forecast day: the key figures on the right switch to that day.")}</div>


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
                <ExpertNote>
                  Méthode retenue : {METH[sel.method]?.fr || sel.method} (« {sel.method} »){sel.saison ? ` — règle de saison (${sel.saison})` : `, choisie par compétition sur ${runNotes.fenetres_test ?? "?"} fenêtres de test de ${list.run?.horizon || 14} jours réparties sur l'année`}. WAPE = {sel.wape != null ? fmt(sel.wape * 100, 1) : "—"} % (moyenne 4 semaines : {sel.wape_baseline != null ? fmt(sel.wape_baseline * 100, 1) : "—"} %). Classe Syntetos-Boylan : {sel.segment} (ADI {detail.model?.adi ?? "—"}, CV² {detail.model?.cv2 ?? "—"}){sel.saisonnier ? ", saisonnier" : ""}. Fourchette = quantiles 10 % / 90 % des erreurs réellement observées pendant les tests, par méthode et par taille de prévision (moins de 1, 1 à 5, 5 et plus par jour). {runNotes.couverture_fourchette != null ? `Mesurée sur des fenêtres de test non utilisées pour la construire, pour les produits prévus à au moins 1 par jour : ${fmt(runNotes.couverture_fourchette * 100, 0)} % des ventes réelles dans la fourchette${runNotes.au_dessus_fourchette != null ? `, ${fmt(runNotes.au_dessus_fourchette * 100, 0)} % au-dessus (jours où la quantité à préparer aurait manqué)` : ""}.` : "Couverture non mesurable (historique trop court)."} Jours d'événement courts (Noël, réveillon, 1er janvier, Pâques…) : chaque produit suit ce qu'il a vendu le même jour d'événement l'an dernier, ajusté à son niveau actuel ; un jour habituellement fermé est prévu ouvert s'il l'était l'an dernier avec un vrai volume. Quantité à préparer = borne haute du jour. Calcul du {list.run?.run_at} sur les données jusqu'au {list.run?.data_end}. API : /api/forecast/products/{sel.product_id}.
                </ExpertNote>
              </>
            )}
          </div>
          {sel && detail && (
            <div className="side-col" style={{ alignSelf: "start" }}>
            <div className="cc kpi-card">
              <div className="kpi-card-t">{tr("Chiffres clés", "Key figures")}</div>
              {[
                { l: tr(`Prévu sur ${h} jours`, `Forecast over ${h} days`), v: u(tot),
                  s: usualH ? tr(`habituellement ${u(usualH)}`, `usually ${u(usualH)}`) : euro ? tr("chiffre d'affaires", "revenue") : tr("pièces", "pieces") },
                { l: dsel && dsel.ds !== peak?.ds ? tr("Jour choisi", "Selected day") : tr("Jour le plus chargé", "Busiest day"), v: focus ? dayLbl(focus.ds) : "—",
                  s: focus ? (
                    focus.is_ferme ? tr("boutique fermée ce jour-là", "shop closed that day") : (
                      <>
                        {tr(`${qty(focus.yhat)} prévu${euro ? "s" : "es"}`, `${qty(focus.yhat)} forecast`)}<br />{tr(`entre ${fmt(focus.yhat_lower)} et ${u(focus.yhat_upper)}`, `between ${fmt(focus.yhat_lower)} and ${u(focus.yhat_upper)}`)}
                        {focus.last_year != null && <><br />{tr(`l'an dernier, même jour : ${u(focus.last_year)}`, `last year, same weekday: ${u(focus.last_year)}`)}</>}
                        {dsel && (
                          <><br /><button type="button" className="kpi-reset" onClick={() => setDay(null)}>× {tr("revenir au jour le plus chargé", "back to the busiest day")}</button></>
                        )}
                      </>
                    )) : "" },
                { l: tr("À préparer ce jour-là", "To prepare that day"), v: prep != null && !focus?.is_ferme ? tr(`${fmt(prep)} pièces`, `${fmt(prep)} pcs`) : "—",
                  s: tr("prévision + petite marge, sans gaspiller", "forecast + small margin, without waste") },
              ].map((k: any, i: number) => (
                <div key={i} className={`kpi-line${i > 0 && dsel ? " kpi-focus" : ""}`}>
                  <div className="kpi-top"><span className="kpi-ic">{[<IcSum key="a" />, <IcCal key="b" />, <IcBox key="c" />][i]}</span>{k.l}</div>
                  <div className="kpi-v num">{k.v}</div>
                  <span className="kpi-d">{k.s}</span>
                </div>
              ))}
            </div>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Petites icônes des chiffres clés (même style que la prévision globale)
const ic = (d: React.ReactNode) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
function IcSum() { return ic(<><path d="M3 17l6-6 4 4 8-8" /><path d="M14 7h7v7" /></>); }
function IcCal() { return ic(<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>); }
function IcBox() { return ic(<><path d="M21 8 12 3 3 8v8l9 5 9-5Z" /><path d="m3 8 9 5 9-5M12 13v8" /></>); }
