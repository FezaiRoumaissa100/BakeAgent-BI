"use client";

// Vue du Jour — en-tête « bento » (maquette « texture & motif ») :
// carte héro (chiffre d'affaires du jour), l'essentiel, produits du jour, les 7 prochains jours, demain.
// Données : /api/daily-kpis (journée affichée) et /api/forecast (prévision boutique, articles par jour).

import React from "react";
import { DailyKPIs } from "@/types/kpis";
import { tr, locale, num } from "@/lib/i18n";
import { siteConfig } from "@/lib/siteConfig";
import { ChartAssistantButton } from "@/components/ChartAssistantButton";
import { useChat } from "@/contexts/ChatContext";

const fmt = (n: number, d = 0) =>
  Number(n || 0).toLocaleString(locale(), { minimumFractionDigits: d, maximumFractionDigits: d });

// Petit épi de blé (même dessin que le logo du menu)
function Wheat({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M12 22V8" />
      <ellipse cx="12" cy="6" rx="2.2" ry="3.4" />
      <ellipse cx="9" cy="11" rx="2" ry="3.2" transform="rotate(-35 9 11)" />
      <ellipse cx="15" cy="11" rx="2" ry="3.2" transform="rotate(35 15 11)" />
      <ellipse cx="9" cy="16" rx="2" ry="3.2" transform="rotate(-35 9 16)" />
      <ellipse cx="15" cy="16" rx="2" ry="3.2" transform="rotate(35 15 16)" />
    </svg>
  );
}

// Grand motif d'épis dans le coin de la carte héro
function HeroMotif() {
  return (
    <svg className="bento-hero-motif" aria-hidden="true" viewBox="0 0 200 260" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M70 270 C 80 200, 100 130, 140 40" />
      <path d="M120 270 C 128 210, 146 150, 178 90" />
      <ellipse cx="138" cy="56" rx="8" ry="18" transform="rotate(25 138 56)" />
      <ellipse cx="120" cy="82" rx="8" ry="18" transform="rotate(-30 120 82)" />
      <ellipse cx="146" cy="92" rx="8" ry="18" transform="rotate(40 146 92)" />
      <ellipse cx="112" cy="120" rx="8" ry="18" transform="rotate(-35 112 120)" />
      <ellipse cx="136" cy="128" rx="8" ry="18" transform="rotate(42 136 128)" />
      <ellipse cx="104" cy="158" rx="8" ry="18" transform="rotate(-35 104 158)" />
      <ellipse cx="176" cy="104" rx="7" ry="16" transform="rotate(30 176 104)" />
      <ellipse cx="160" cy="130" rx="7" ry="16" transform="rotate(-28 160 130)" />
      <ellipse cx="180" cy="142" rx="7" ry="16" transform="rotate(42 180 142)" />
    </svg>
  );
}

type FcDay = { ds: string; date_fr?: string; jour_semaine?: string; yhat: number; yhat_lower?: number; yhat_upper?: number; is_ferme?: number; last_year?: number | null };

const JOURS_COURTS_FR = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const JOURS_COURTS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function dayLabel(ds: string) {
  const d = new Date(ds + "T12:00:00");
  return `${tr(JOURS_COURTS_FR[d.getDay()], JOURS_COURTS_EN[d.getDay()])} ${d.getDate()}`;
}
function longDate(ds?: string) {
  if (!ds) return "";
  const d = new Date(ds + "T12:00:00");
  return d.toLocaleDateString(locale(), { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export function DayBento({ kpis, forecast }: { kpis: DailyKPIs; forecast: any | null }) {
  const { openChat } = useChat();

  const hasRef = Number(kpis.ca_ref || 0) > 0;
  const delta = Number(kpis.delta_vs_moy || 0);
  const deltaTxt = `${delta > 0 ? "+" : ""}${num(delta, 0)} %`;
  const refLabel = kpis.ref_label || tr("jours comparables", "comparable days");
  const panierRef = Number(kpis.tickets_ref || 0) > 0 ? Number(kpis.ca_ref || 0) / Number(kpis.tickets_ref) : 0;
  const pct = (cur: number, ref: number) => (ref > 0 ? ((cur - ref) / ref) * 100 : null);

  // Phrase clé (même règle que l'ancien bandeau : ±10 % = « dans la normale »)
  const headline = !hasRef
    ? tr("Journée sans point de comparaison.", "No comparable day.")
    : Math.abs(delta) < 10
    ? tr("Une journée dans la normale.", "A normal day.")
    : delta >= 90
    ? tr("Une journée deux fois plus forte que d'habitude.", "A day twice as strong as usual.")
    : delta > 0
    ? tr("Une journée plus forte que d'habitude.", "A stronger day than usual.")
    : tr("Une journée plus calme que d'habitude.", "A quieter day than usual.");
  const top = kpis.top_qte?.[0];
  const topCa = kpis.top_ca?.[0];
  const shareTop = topCa && kpis.ca_jour ? ((topCa.total_revenue || 0) / kpis.ca_jour) * 100 : 0;
  const peak = String(kpis.peak_h).padStart(2, "0");

  // Produits du jour (quantités)
  const prods = (kpis.top_qte || []).slice(0, 5);
  const maxQ = Math.max(1, ...prods.map((p) => p.quantity || 0));

  // Prévision : 7 prochains jours + demain
  const days: FcDay[] = (forecast?.forecast || []).slice(0, 7);
  const openDays = days.filter((d) => !d.is_ferme);
  const maxF = Math.max(1, ...openDays.map((d) => d.yhat || 0));
  const totalF = openDays.reduce((s, d) => s + (d.yhat || 0), 0);
  const peakF = openDays.reduce((m, d) => (d.yhat > (m?.yhat ?? -1) ? d : m), null as FcDay | null);
  const tomorrow = days[0];
  // Même jour de la semaine, 52 semaines plus tôt (pas la même date)
  // Le backend envoie last_year pour chaque jour prévu ; l'historique (60 derniers jours) ne sert que de secours.
  let lastYear: number | null = tomorrow && tomorrow.last_year != null ? Number(tomorrow.last_year) : null;
  if (lastYear === null && tomorrow && Array.isArray(forecast?.history)) {
    const t = new Date(tomorrow.ds + "T12:00:00");
    t.setDate(t.getDate() - 364);
    const key = t.toISOString().slice(0, 10);
    const h = forecast.history.find((x: any) => String(x.ds).slice(0, 10) === key);
    if (h && h.y != null) lastYear = Number(h.y);
  }
  const typicalOpen = openDays.length ? totalF / openDays.length : 0;
  const tomorrowWord = !tomorrow
    ? ""
    : tomorrow.is_ferme
    ? tr("boutique fermée", "shop closed")
    : tomorrow.yhat < typicalOpen * 0.6
    ? tr("journée calme", "quiet day")
    : tomorrow.yhat > typicalOpen * 1.3
    ? tr("journée chargée", "busy day")
    : tr("journée habituelle", "usual day");

  const journee = kpis.date_fr || kpis.date;

  return (
    <div className="bento-wrap">
      {/* En-tête de page */}
      <header className="bento-head">
        <div className="bento-eyebrow">
          {longDate(kpis.date) || journee}
          {hasRef ? tr(` · comparée ${refLabel.startsWith("moyenne") ? "à la" : "au"} ${refLabel}`, " · compared with the previous same weekdays") : ""}
        </div>
        <h1 className="page-h1">
          {tr("Vue du", "Daily")} <span style={{ color: "var(--dk-accent)" }}>{tr("Jour", "View")}</span>
        </h1>
      </header>

      <div className="bento">
        {/* Carte héro : chiffre d'affaires du jour */}
        <section className="bento-card bento-hero bento-span2">
          <ChartAssistantButton chartType="day_summary" chartData={{ journee, jour_semaine: kpis.jour_semaine, periode: "une seule journée (Vue du Jour)", ca_jour: kpis.ca_jour, ca_habituel: kpis.ca_ref, ecart_pct: delta, tickets: kpis.tickets, tickets_habituels: kpis.tickets_ref, articles: kpis.qte_jour, panier_moyen: kpis.panier, panier_habituel: panierRef, heure_de_pointe: kpis.peak_h, ca_heure_de_pointe: kpis.peak_ca_h, reference: refLabel }}
            chartName="DaySummary" userQuestion="Explique le résumé de cette journée" position="top-right" onOpenChat={openChat} />
          <HeroMotif />
          <div style={{ position: "relative" }}>
            <div className="bento-label bento-hero-muted">{tr("Chiffre d'affaires du jour", "Revenue of the day")}</div>
            <div className="bento-hero-row">
              <div className="bento-hero-big num">{fmt(kpis.ca_jour)} €</div>
              {hasRef && <div className="bento-chip">{deltaTxt} {tr("vs habitude", "vs usual")}</div>}
            </div>
          </div>
          <div className="bento-hero-stats">
            {[
              { l: tr("Tickets", "Transactions"), v: fmt(kpis.tickets), d: pct(kpis.tickets, Number(kpis.tickets_ref || 0)) },
              { l: tr("Articles", "Items"), v: fmt(kpis.qte_jour), d: null },
              { l: tr("Panier moyen", "Average basket"), v: `${fmt(kpis.panier, 2)} €`, d: pct(kpis.panier, panierRef) },
              { l: tr("Pic", "Peak"), v: `${peak} h`, d: null },
            ].map((s) => (
              <div key={s.l}>
                <div className="bento-hero-muted" style={{ fontSize: ".82rem" }}>{s.l}</div>
                <div className="bento-hero-stat num">{s.v}</div>
                {s.d !== null && <div className="bento-hero-muted" style={{ fontSize: ".72rem", marginTop: 2 }}>{s.d >= 0 ? "+" : ""}{num(s.d, 0)} % {tr("vs hab.", "vs usual")}</div>}
              </div>
            ))}
          </div>
        </section>

        {/* L'essentiel */}
        <section className="bento-card bento-retain">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="bento-stamp"><Wheat size={20} /></span>
            <span className="bento-label" style={{ color: "var(--dk-accent)" }}>{tr("L'essentiel", "Key point")}</span>
          </div>
          <p className="bento-headline">{headline}</p>
          <p className="bento-text">
            {top ? tr(`${top.article} est le produit le plus vendu : ${fmt(top.quantity || 0)} pièces. `, `${top.article} is the best seller: ${fmt(top.quantity || 0)} units. `) : ""}
            {topCa && shareTop >= 1 ? tr(`${topCa.article} fait ${fmt(shareTop)} % du chiffre d'affaires. `, `${topCa.article} makes ${fmt(shareTop)}% of revenue. `) : ""}
            {tr(`Le pic arrive à ${peak} h.`, `The peak comes at ${peak}:00.`)}
          </p>
        </section>

        {/* Produits du jour */}
        <section className="bento-card">
          <ChartAssistantButton chartType="day_top_products_qty" chartData={{ journee, jour_semaine: kpis.jour_semaine, periode: "une seule journée (Vue du Jour)", produits: prods }}
            chartName="DayTopProducts" userQuestion="Explique les produits les plus vendus ce jour-là" position="top-right" onOpenChat={openChat} />
          <div className="bento-title-row">
            <h2 className="ct" style={{ margin: 0 }}>{tr("Produits du", "Products of the")} <span style={{ color: "var(--dk-accent)" }}>{tr("Jour", "Day")}</span></h2>
            <span className="cs" style={{ margin: 0 }}>{tr("quantités vendues", "units sold")}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
            {prods.length === 0 && <div className="cs">{tr("Aucune vente ce jour-là.", "No sales that day.")}</div>}
            {prods.map((p, i) => (
              <div key={p.article} title={`${p.article} : ${fmt(p.quantity || 0)}`}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: ".86rem" }}>
                  <span style={{ fontWeight: 700, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.article}</span>
                  <span className="num" style={{ fontWeight: 800 }}>{fmt(p.quantity || 0)}</span>
                </div>
                <div className="bento-track"><div style={{ width: `${((p.quantity || 0) / maxQ) * 100}%`, background: i === 0 ? "var(--ch-peak)" : "var(--ch-1)" }} /></div>
              </div>
            ))}
          </div>
        </section>

        {/* Les 7 prochains jours */}
        <section className="bento-card bento-span2">
          {days.length > 0 && (
            <ChartAssistantButton chartType="next_7_days_forecast" chartData={{ apres_la_journee: journee, prevision_articles_par_jour: days, total_jours_ouverts: totalF }}
              chartName="Next7Days" userQuestion="Explique la prévision des 7 prochains jours" position="top-right" onOpenChat={openChat} />
          )}
          <div className="bento-title-row">
            <h2 className="ct" style={{ margin: 0 }}>{tr("Les 7 Prochains", "The Next 7")} <span style={{ color: "var(--dk-accent)" }}>{tr("Jours", "Days")}</span></h2>
            {days.length > 0 && <span className="cs" style={{ margin: 0 }}>{tr(`articles prévus · ${fmt(totalF)} au total`, `items forecast · ${fmt(totalF)} in total`)}</span>}
          </div>
          {days.length === 0 ? (
            <div className="cs" style={{ marginTop: 14 }}>{forecast === null ? tr("Chargement de la prévision…", "Loading the forecast…") : tr("Prévision indisponible.", "Forecast unavailable.")}</div>
          ) : (
            <div className="bento-bars" role="img" aria-label={tr("Prévision des 7 prochains jours", "Forecast for the next 7 days")}>
              {days.map((d) => {
                const closed = !!d.is_ferme;
                const isPeak = !closed && peakF && d.ds === peakF.ds;
                return (
                  <div key={d.ds} className="bento-bar-col" title={closed ? tr("Boutique fermée", "Shop closed") : tr(`${fmt(d.yhat)} articles prévus (fourchette ${fmt(d.yhat_lower || 0)}–${fmt(d.yhat_upper || 0)})`, `${fmt(d.yhat)} items forecast (range ${fmt(d.yhat_lower || 0)}–${fmt(d.yhat_upper || 0)})`)}>
                    <div className="bento-bar-val num">{closed ? tr("fermé", "closed") : fmt(d.yhat)}</div>
                    <div className={`bento-bar${closed ? " closed" : ""}`}
                      style={closed ? undefined : { height: `${Math.max(8, (d.yhat / maxF) * 150)}px`, background: isPeak ? "var(--ch-peak)" : "var(--ch-1)" }} />
                    <div className="bento-bar-lbl">{dayLabel(d.ds)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Demain */}
        <section className="bento-card bento-tile bento-span2">
          <div className="bento-label bento-tile-muted">
            {tr("Demain", "Tomorrow")}{tomorrow ? ` · ${new Date(tomorrow.ds + "T12:00:00").toLocaleDateString(locale(), { weekday: "long", day: "numeric", month: "long" })}` : ""}
          </div>
          {tomorrow ? (
            <div>
              <div className="bento-tile-big num">{tomorrow.is_ferme ? tr("Fermé", "Closed") : fmt(tomorrow.yhat)}</div>
              <div className="bento-tile-muted" style={{ marginTop: 6, fontSize: ".9rem", lineHeight: 1.45 }}>
                {tomorrow.is_ferme
                  ? tr("La boutique est fermée ce jour-là.", "The shop is closed that day.")
                  : tr(`articles prévus — ${tomorrowWord}`, `items forecast — ${tomorrowWord}`)}
              </div>
              {!tomorrow.is_ferme && (
                <div className="bento-tile-stats">
                  <div>
                    <div className="bento-tile-muted">{tr("Fourchette probable", "Likely range")}</div>
                    <div className="bento-tile-val num">{fmt(tomorrow.yhat_lower || 0)} – {fmt(tomorrow.yhat_upper || 0)}</div>
                  </div>
                  <div>
                    <div className="bento-tile-muted">{tr("Moyenne des 7 jours", "7-day average")}</div>
                    <div className="bento-tile-val num">{fmt(typicalOpen)}</div>
                    {typicalOpen > 0 && <div className="bento-tile-muted bento-tile-sub">{`${tomorrow.yhat >= typicalOpen ? "+" : ""}${fmt(((tomorrow.yhat - typicalOpen) / typicalOpen) * 100)} %`}</div>}
                  </div>
                  <div>
                    <div className="bento-tile-muted">{tr("Il y a 52 semaines", "52 weeks earlier")}</div>
                    <div className="bento-tile-val num">{lastYear !== null ? fmt(lastYear) : "—"}</div>
                    <div className="bento-tile-muted bento-tile-sub">{tr("même jour de la semaine", "same weekday")}</div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bento-tile-muted">{forecast === null ? tr("Chargement…", "Loading…") : tr("Prévision indisponible.", "Forecast unavailable.")}</div>
          )}
        </section>
      </div>
      <div className="cs" style={{ margin: "10px 6px 0" }}>
        {siteConfig.bakeryName ? `${siteConfig.bakeryName} · ` : ""}{tr("Données de caisse et prévision boutique (articles par jour).", "Till data and shop forecast (items per day).")}
      </div>
    </div>
  );
}
