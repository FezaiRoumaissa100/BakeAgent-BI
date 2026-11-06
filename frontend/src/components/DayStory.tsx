"use client";

// Vue du Jour, racontée en 3 temps (une seule lecture, de haut en bas) :
//  1) « La journée en bref » : le bandeau coloré (même style que les autres pages) avec les 4 chiffres clés
//     comparés à l'habitude — il remplace l'ancien titre + 4 tuiles ;
//  2) « Comment s'est passée la journée ? » : QUAND les clients sont venus (anneau matin / midi / après-midi)
//     et CE QUI a fait la journée (5 produits + familles) ;
//  3) « Et maintenant ? » : les 7 prochains jours et 3 actions concrètes.
// Le détail (paires, paniers, toutes les catégories) reste replié en bas de page.
// Données : /api/daily-kpis (journée affichée) et /api/forecast (prévision boutique, articles par jour).

import React from "react";
import Link from "next/link";
import { DailyKPIs } from "@/types/kpis";
import { tr, trData, locale, num } from "@/lib/i18n";
import { ChartAssistantButton } from "@/components/ChartAssistantButton";
import { useChat } from "@/contexts/ChatContext";
import { Scope } from "@/components/Ui";
import { PageStory, StoryIcons } from "@/components/PageStory";
import { useDay, longDate } from "@/components/DayBento";

const fmt = (n: number, d = 0) =>
  Number(n || 0).toLocaleString(locale(), { minimumFractionDigits: d, maximumFractionDigits: d });
const sign = (v: number | null) => (v === null || !isFinite(v) ? "" : `${v >= 0 ? "+" : "−"}${num(Math.abs(v), 0)} %`);

// Noms d'événements tels qu'enregistrés en base (sans accents) → affichage
const EVENT_NICE: Record<string, [string, string]> = {
  "Reveillon": ["Réveillon du Nouvel An", "New Year's Eve"], "Noel": ["Noël", "Christmas"], "Paques": ["Pâques", "Easter"],
  "Fete des Meres": ["Fête des Mères", "Mother's Day"], "Fete de la Musique": ["Fête de la Musique", "Music Day"],
  "Jour de l'An": ["Jour de l'An", "New Year's Day"], "Saint-Valentin": ["Saint-Valentin", "Valentine's Day"], "Toussaint": ["Toussaint", "All Saints' Day"],
};
function prettyEvent(n?: string | null) {
  if (!n) return "";
  const m = EVENT_NICE[n];
  return m ? tr(m[0], m[1]) : n;
}

/* ── Anneau simple (3 parts au plus) ── */
function Donut({ parts, size = 150, center, active = null, onHover }: { parts: { v: number; c: string; label: string }[]; size?: number; center?: React.ReactNode; active?: number | null; onHover?: (i: number | null) => void }) {
  const tot = parts.reduce((s, p) => s + p.v, 0) || 1;
  const r = size / 2 - 13, cx = size / 2, cy = size / 2, sw = 20;
  let a0 = -Math.PI / 2;
  const arc = (a1: number, a2: number) => {
    const large = a2 - a1 > Math.PI ? 1 : 0;
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  };
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} role="img" onMouseLeave={() => onHover?.(null)} aria-label={parts.map((p) => `${p.label} ${fmt((p.v / tot) * 100)} %`).join(", ")}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--dk-soft)" strokeWidth={sw} />
        {parts.map((p, i) => {
          const a1 = a0, a2 = a0 + (p.v / tot) * Math.PI * 2;
          a0 = a2;
          if (p.v <= 0) return null;
          // petit espace entre les parts
          const gap = parts.filter((x) => x.v > 0).length > 1 ? 0.03 : 0;
          const on = active === i, dim = active != null && !on;
          return (
            <path key={i} d={arc(a1 + gap, Math.max(a1 + gap, a2 - gap))} fill="none" stroke={p.c} strokeWidth={on ? sw + 6 : sw} strokeLinecap="butt"
              style={{ cursor: "pointer", opacity: dim ? 0.3 : 1, transition: "opacity .15s ease, stroke-width .15s ease" }}
              onMouseEnter={() => onHover?.(i)}>
              <title>{`${p.label} : ${fmt((p.v / tot) * 100)} %`}</title>
            </path>
          );
        })}
      </svg>
      {center && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", pointerEvents: "none" }}>
          {center}
        </div>
      )}
    </div>
  );
}

export function DayStory({ kpis, forecast, isLast = true, children }: { kpis: DailyKPIs; forecast: any | null; isLast?: boolean; children?: React.ReactNode }) {
  const { openChat } = useChat();
  const [hm, setHm] = React.useState<number | null>(null);   // moment survolé (anneau ou liste)
  const D = useDay(kpis, forecast);
  const t = D.tomorrow;
  const day = D.journee;

  // ── Moments de la journée (à partir des ventes heure par heure)
  const hours: any[] = (kpis as any).hourly_data || [];
  const sumBy = (f: (h: number) => boolean, k: "ca" | "tkt") => hours.filter((h) => f(h.hour)).reduce((s, h) => s + (Number(h[k]) || 0), 0);
  const moments = [
    { key: "matin", label: tr("Matin", "Morning"), sub: tr("avant 11 h", "before 11:00"), f: (h: number) => h < 11, c: "var(--ch-1)" },
    { key: "midi", label: tr("Midi", "Midday"), sub: tr("11 h – 14 h", "11:00 – 14:00"), f: (h: number) => h >= 11 && h < 14, c: "var(--ch-3)" },
    { key: "apm", label: tr("Après-midi", "Afternoon"), sub: tr("après 14 h", "after 14:00"), f: (h: number) => h >= 14, c: "var(--ch-2)" },
  ].map((m) => ({ ...m, ca: sumBy(m.f, "ca"), tkt: sumBy(m.f, "tkt") }));
  const caDay = Number(kpis.ca_jour) || moments.reduce((s, m) => s + m.ca, 0) || 1;

  // ── Ce qui a fait la journée
  const qtyOf = new Map((kpis.top_qte || []).map((p: any) => [p.article, p.quantity]));
  const topCa = (kpis.top_ca || []).slice(0, 5);
  const cats = [...(kpis.categories || [])].sort((a: any, b: any) => b.total_revenue - a.total_revenue);

  // ── Bandeau
  // Jour férié ou événement (Réveillon, Noël, Saint-Valentin…) : comparé au même jour l'an dernier (backend)
  const special = prettyEvent((kpis as any).jour_special);
  const refShort = String(D.refLabel || "").replace(/\s*\(.*\)\s*$/, "");
  const refNice = special ? prettyEvent(refShort.replace(/\s\d{4}$/, "")) + (refShort.match(/\s\d{4}$/)?.[0] || "") : refShort;
  const vsRef = special && (kpis as any).ref_dates?.length === 1 ? tr("vs même jour l'an dernier", "vs same day last year") : tr("vs habitude", "vs usual");
  const points = [
    { icon: StoryIcons.money, label: tr("Chiffre d'affaires", "Revenue"), value: `${fmt(kpis.ca_jour)} €`, text: D.hasRef ? `${sign(D.delta)} ${vsRef}` : tr("sans point de comparaison", "no comparison") },
    { icon: StoryIcons.basket, label: tr("Clients (tickets)", "Customers (tickets)"), value: fmt(kpis.tickets), text: D.pct(kpis.tickets, Number(kpis.tickets_ref || 0)) !== null ? `${sign(D.pct(kpis.tickets, Number(kpis.tickets_ref || 0)))} ${vsRef}` : "" },
    { icon: StoryIcons.target, label: tr("Panier moyen", "Average basket"), value: `${fmt(kpis.panier, 2)} €`, text: D.panierRef ? `${sign(D.pct(kpis.panier, D.panierRef))} ${vsRef}` : "" },
  ];
  // « les 4 mardis précédents » / « le mardi précédent ouvert » : de quoi « l'habitude » est faite
  const refPhrase = /^moyenne des /.test(String(D.refLabel)) ? `en moyenne les ${String(D.refLabel).replace(/^moyenne des /, "")}` : `le ${D.refLabel}`;
  const headline = special && D.hasRef
    ? tr(`${special} : ${fmt(kpis.ca_jour)} € de ventes, ${sign(D.delta)} par rapport ${(kpis as any).ref_dates?.length === 1 ? `au ${refNice}` : `à l'habitude`}.`,
         `${special}: €${fmt(kpis.ca_jour)} of sales, ${sign(D.delta)} vs ${(kpis as any).ref_dates?.length === 1 ? refNice : "usual"}.`)
    : D.hasRef
    ? tr(`${D.headline.replace(/\.$/, "")} : ${fmt(kpis.ca_jour)} € de ventes, contre ${fmt(Number(kpis.ca_ref || 0))} € ${refPhrase} (${sign(D.delta)}).`,
         `${D.headline.replace(/\.$/, "")}: €${fmt(kpis.ca_jour)} of sales, vs €${fmt(Number(kpis.ca_ref || 0))} on comparable days (${sign(D.delta)}).`)
    : tr(`${fmt(kpis.ca_jour)} € de ventes ce jour-là.`, `€${fmt(kpis.ca_jour)} of sales that day.`);

  // ── Actions « À faire » : calculées à partir des chiffres de la journée affichée.
  //    Chaque règle ne s'affiche que si les données la justifient ; on garde les 3 plus fortes (score).
  type Act = { score: number; icon: React.ReactNode; title: string; why: string; href?: string; cta?: string };
  const cand: Act[] = [];
  const pctOf = (v: number) => (v / caDay) * 100;
  // 1) Personnel : un moment de la journée concentre plus de la moitié des ventes
  const top = moments.reduce((a, b) => (b.ca > a.ca ? b : a), moments[0]);
  const topPct = pctOf(top.ca);
  if (topPct >= 50) {
    const when = top.key === "matin" ? tr("de l'ouverture à 11 h", "from opening to 11:00")
      : top.key === "midi" ? tr("de 11 h à 14 h", "from 11:00 to 14:00") : tr("après 14 h", "after 14:00");
    const moment = top.key === "matin" ? tr("le matin", "in the morning") : top.key === "midi" ? tr("le midi", "at midday") : tr("l'après-midi", "in the afternoon");
    cand.push({ score: topPct, icon: StoryIcons.clock, title: tr(`Renforcer le comptoir ${when}`, `Add counter staff ${when}`),
      why: tr(`${fmt(topPct)} % des ventes se font ${moment}.`, `${fmt(topPct)}% of sales happen ${moment}.`),
      href: "/performance", cta: tr("Voir les heures", "See the hours") });
  }
  // 2) et 3) Produits du top : la plus forte hausse et la plus forte baisse par rapport à d'habitude
  const withRef = topCa.filter((p: any) => p.ref_revenue != null).map((p: any) => {
    const ref = Number(p.ref_revenue) || 0, rev = Number(p.total_revenue) || 0;
    return { a: p.article, rev, ref, d: ref > 0 ? ((rev - ref) / ref) * 100 : null };
  });
  const ups = withRef.filter((x) => x.d === null ? x.rev > 0 : x.d >= 20).sort((x, y) => (y.d ?? 999) - (x.d ?? 999));
  if (ups[0]) {
    const u = ups[0];
    cand.push({ score: u.d === null ? 60 : Math.min(u.d, 200) / 2 + 20, icon: StoryIcons.trend,
      title: tr(`Prévoir assez de ${trData(u.a)} demain`, `Plan enough ${trData(u.a)} tomorrow`),
      why: u.d === null ? tr(`Pas vendu d'habitude, ${fmt(u.rev)} € ce jour-là.`, `Not usually sold, €${fmt(u.rev)} that day.`)
        : tr(`+${fmt(u.d)} % par rapport à d'habitude (${fmt(u.rev)} € contre ${fmt(u.ref)} €).`, `+${fmt(u.d)}% vs usual (€${fmt(u.rev)} vs €${fmt(u.ref)}).`),
      href: "/produits", cta: tr("Voir le produit", "See the product") });
  }
  const downs = withRef.filter((x) => x.d !== null && x.d <= -15).sort((x, y) => (x.d as number) - (y.d as number));
  if (downs[0]) {
    const w = downs[0];
    cand.push({ score: Math.min(Math.abs(w.d as number) * 1.5, 70), icon: StoryIcons.down,
      title: tr(`Préparer un peu moins de ${trData(w.a)}`, `Prepare a little less ${trData(w.a)}`),
      why: tr(`${fmt(w.d as number)} % par rapport à d'habitude (${fmt(w.rev)} € contre ${fmt(w.ref)} €).`, `${fmt(w.d as number)}% vs usual (€${fmt(w.rev)} vs €${fmt(w.ref)}).`),
      href: "/produits", cta: tr("Voir le produit", "See the product") });
  }
  // 4) Fin de journée calme : l'après-midi pèse très peu alors que la boutique est ouverte
  const apm = moments.find((m) => m.key === "apm");
  const apmPct = apm ? pctOf(apm.ca) : 0;
  if (apm && apm.tkt > 0 && apmPct < 12) {
    cand.push({ score: (12 - apmPct) * 4 + 10, icon: StoryIcons.calendar,
      title: tr("Réduire les fournées de l'après-midi", "Bake less for the afternoon"),
      why: tr(`Après 14 h : seulement ${fmt(apmPct)} % des ventes.`, `After 14:00: only ${fmt(apmPct)}% of sales.`),
      href: "/performance", cta: tr("Voir les heures", "See the hours") });
  }
  // 5) Vente ensemble : la paire la plus fréquente du jour (au moins 10 tickets)
  const pair = ((kpis as any).top_pairs || [])[0];
  if (pair && Number(pair.cnt) >= 10) {
    cand.push({ score: Math.min(Number(pair.cnt), 60) / 2 + 10, icon: StoryIcons.link,
      title: tr(`Proposer ${trData(pair.pb)} avec ${trData(pair.pa)} en caisse`, `Suggest ${trData(pair.pb)} with ${trData(pair.pa)} at the till`),
      why: tr(`Achetés ensemble ${fmt(pair.cnt)} fois ce jour-là.`, `Bought together ${fmt(pair.cnt)} times that day.`),
      href: "/produits", cta: tr("Voir les produits", "See products") });
  }
  const actions = cand.sort((a, b) => b.score - a.score).slice(0, 3);

  return (
    <>
      {/* 1 · Titre + bandeau */}
      <div className="sw">
        <header className="page-head">
          <div className="page-eyebrow">{longDate(kpis.date) || day}{special ? ` · ${special}` : ""}</div>
          <h1 className="page-h1">{tr("Vue du", "Daily")} <span style={{ color: "var(--dk-accent-deep, #43309E)" }}>{tr("Jour", "View")}</span></h1>
        </header>
      </div>
      <PageStory kicker={tr("La journée en bref", "The day in short")} headline={headline} points={points}
        links={isLast ? [{ href: "/previsions", label: tr("Voir les prévisions", "See forecasts") }, { href: "/performance", label: tr("Voir la performance", "See performance") }]
                      : [{ href: "/performance", label: tr("Voir le mois de ce jour", "See this day's month") }, { href: "/stock", label: tr("Stock de ce jour", "This day's stock") }]} />

      {/* 2 · Comment s'est passée la journée ? */}
      <div className="sec-title">{tr("Comment s'est passée la journée ?", "How did the day go?")}</div>
      <div className="sw">
        <div className="day-grid">
          {/* Quand les clients sont venus */}
          <section className="cc day-pie" style={{ display: "flex", flexDirection: "column" }}>
            <ChartAssistantButton chartType="day_moments" chartData={{ journee: day, moments: moments.map((m) => ({ moment: m.label, ca: m.ca, tickets: m.tkt })), heure_de_pointe: kpis.peak_h }}
              chartName="DayMoments" userQuestion="Explique à quel moment de la journée la boutique a vendu" position="top-right" onOpenChat={openChat} />
            <h2 className="ct">{tr("Quand les clients sont venus", "When customers came")}</h2>
            <Scope calc={tr("Part du CA par moment", "Revenue share by time")} unit="%" />
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 16, marginTop: 6, flex: 1 }}>
              <Donut size={112} parts={moments.map((m) => ({ v: m.ca, c: m.c, label: m.label }))} active={hm} onHover={setHm}
                center={hm != null ? <>
                  <span style={{ fontSize: ".6rem", fontWeight: 800, color: moments[hm].c, textTransform: "uppercase", letterSpacing: ".05em" }}>{moments[hm].label}</span>
                  <span className="num" style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--dk-ink)", lineHeight: 1.1 }}>{fmt((moments[hm].ca / caDay) * 100)} %</span>
                  <span className="num" style={{ fontSize: ".58rem", color: "var(--dk-muted)" }}>{fmt(moments[hm].ca)} €</span>
                </> : (() => {
                  // Par défaut : le moment le plus fort (l'heure de pointe est déjà sur le graphique heure par heure)
                  const top = moments.reduce((a, b) => (b.ca > a.ca ? b : a), moments[0]);
                  return <>
                    <span style={{ fontSize: ".6rem", fontWeight: 800, color: "var(--dk-muted)", textTransform: "uppercase", letterSpacing: ".05em" }}>{top.label}</span>
                    <span className="num" style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--dk-ink)", lineHeight: 1.1 }}>{fmt((top.ca / caDay) * 100)} %</span>
                  </>;
                })()} />
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                {moments.map((m, mi) => (
                  <div key={m.key} onMouseEnter={() => setHm(mi)} onMouseLeave={() => setHm(null)}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 6px", margin: "0 -6px", borderRadius: 8, cursor: "default",
                      background: hm === mi ? "var(--dk-soft)" : "transparent", opacity: hm != null && hm !== mi ? 0.5 : 1, transition: "opacity .15s ease, background .15s ease" }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: m.c, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: ".78rem", fontWeight: 800, color: "var(--dk-ink)" }}>{m.label} <span style={{ fontWeight: 600, color: "var(--dk-muted)", fontSize: ".68rem" }}>{m.sub}</span></div>
                      <div style={{ fontSize: ".68rem", color: "var(--dk-ink2)" }}>{tr(`${fmt(m.ca)} € · ${fmt(m.tkt)} clients`, `€${fmt(m.ca)} · ${fmt(m.tkt)} customers`)}</div>
                    </div>
                    <span className="num" style={{ fontSize: ".9rem", fontWeight: 800, color: "var(--dk-ink)" }}>{fmt((m.ca / caDay) * 100)} %</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Ce qui a fait la journée */}
          <section className="cc day-top">
            <ChartAssistantButton chartType="day_drivers" chartData={{ journee: day, produits: topCa, familles: cats }}
              chartName="DayDrivers" userQuestion="Explique quels produits et quelles familles ont fait la journée" position="top-right" onOpenChat={openChat} />
            <h2 className="ct">{tr("Ce qui a fait la journée", "What made the day")}</h2>
            <Scope calc={tr("Top 5 en CA", "Top 5 by revenue")} unit={tr("€ · vs habitude", "€ · vs usual")} />
            <div style={{ display: "flex", flexDirection: "column", marginTop: 4 }}>
              {topCa.map((p: any, i: number) => {
                const ref = Number(p.ref_revenue);
                const hasRef = p.ref_revenue != null;
                const d = hasRef && ref > 0 ? ((Number(p.total_revenue) - ref) / ref) * 100 : null;
                return (
                  <div key={p.article} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", borderBottom: i < topCa.length - 1 ? "1px solid var(--dk-line)" : "none" }}>
                    <span className="num" style={{ width: 14, fontSize: ".72rem", fontWeight: 800, color: "var(--dk-muted)" }}>{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: ".78rem", fontWeight: 700, color: "var(--dk-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{trData(p.article)}</div>
                      {qtyOf.get(p.article) != null && <div className="num" style={{ fontSize: ".66rem", color: "var(--dk-muted)" }}>{tr(`${fmt(qtyOf.get(p.article) as number)} pièces`, `${fmt(qtyOf.get(p.article) as number)} pcs`)}</div>}
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div className="num" style={{ fontSize: ".8rem", fontWeight: 800, color: "var(--dk-ink)" }}>{fmt(p.total_revenue)} €</div>
                      {d !== null ? (
                        <div className="num" title={tr(`${fmt(ref)} € d'habitude`, `€${fmt(ref)} usually`)} style={{ fontSize: ".66rem", fontWeight: 700, color: d >= 0 ? "var(--dk-ok)" : "var(--dk-alert)" }}>
                          {d >= 0 ? "▲ +" : "▼ "}{fmt(d)} %
                        </div>
                      ) : hasRef ? (
                        <div style={{ fontSize: ".66rem", fontWeight: 700, color: "var(--dk-accent)" }}>{tr("pas vendu d'habitude", "not usually sold")}</div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Rangée 2 : le chiffre d'affaires par heure sous l'anneau, « À faire » sous « Ce qui a fait la journée » */}
          {children}
          {(
            <section className="cc day-todo">
              <div className="day-todo-k">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4Z" /></svg>
                {tr("À faire", "To do")}
              </div>
              <div className="day-todo-t">{tr("Ce que cette journée dit pour la suite", "What this day means next")}</div>
              <ol className="day-todo-list">
                {actions.map((a, i) => (
                  <li key={i}>
                    <div className="day-todo-head">
                      <span className="day-todo-ic" aria-hidden="true">{a.icon}</span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="day-todo-txt">{a.title}</div>
                        <div className="day-todo-why">{a.why}</div>
                      </div>
                    </div>
                    {a.href && <Link href={a.href} className="day-todo-link">{a.cta} →</Link>}
                  </li>
                ))}
                {actions.length === 0 && (
                  <li><div className="day-todo-txt">{tr("Rien de particulier : la journée ressemble à d'habitude.", "Nothing special: the day looks like usual.")}</div></li>
                )}
              </ol>
              {isLast && t && (
                <Link href="/previsions" className="day-todo-more">{tr("Voir la prévision de demain →", "See tomorrow's forecast →")}</Link>
              )}
            </section>
          )}
        </div>
      </div>
    </>
  );
}
