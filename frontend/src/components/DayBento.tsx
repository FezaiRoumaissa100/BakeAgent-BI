"use client";

// Vue du Jour, mise en page compacte :
//  - <DayHeader>  : titre, phrase clé et 4 indicateurs (CA, tickets, panier, demain), comparés à l'habitude ;
//  - <DayOutlook> : produits du jour + les 7 prochains jours (avec le détail de demain en pied de carte).
// <DayBento> affiche les deux à la suite (compatibilité).
// Données : /api/daily-kpis (journée affichée) et /api/forecast (prévision boutique, articles par jour).

import React from "react";
import { DailyKPIs } from "@/types/kpis";
import { tr, locale, num } from "@/lib/i18n";
import { siteConfig } from "@/lib/siteConfig";
import { ChartAssistantButton } from "@/components/ChartAssistantButton";
import { useChat } from "@/contexts/ChatContext";
import { Scope } from "@/components/Ui";

const fmt = (n: number, d = 0) =>
  Number(n || 0).toLocaleString(locale(), { minimumFractionDigits: d, maximumFractionDigits: d });

type FcDay = { ds: string; date_fr?: string; jour_semaine?: string; yhat: number; yhat_lower?: number; yhat_upper?: number; is_ferme?: number; last_year?: number | null };

const JOURS_COURTS_FR = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const JOURS_COURTS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export function dayLabel(ds: string) {
  const d = new Date(ds + "T12:00:00");
  return `${tr(JOURS_COURTS_FR[d.getDay()], JOURS_COURTS_EN[d.getDay()])} ${d.getDate()}`;
}
export function longDate(ds?: string) {
  if (!ds) return "";
  const d = new Date(ds + "T12:00:00");
  return d.toLocaleDateString(locale(), { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

// Calculs communs aux deux blocs
export function useDay(kpis: DailyKPIs, forecast: any | null) {

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
  return { hasRef, delta, deltaTxt, refLabel, panierRef, pct, headline, top, topCa, shareTop, peak, prods, maxQ,
    days, openDays, maxF, totalF, peakF, tomorrow, lastYear, typicalOpen, tomorrowWord, journee };
}

// Écart à l'habitude : flèche + pourcentage, vert si mieux, rouge si moins bien
function Delta({ v, label }: { v: number | null; label?: string }) {
  if (v === null || !isFinite(v)) return <span className="kpi-d">{label || tr("sans repère", "no reference")}</span>;
  const up = v >= 0;
  return (
    <span className={`kpi-d ${Math.abs(v) < 1 ? "" : up ? "up" : "down"}`}>
      {Math.abs(v) >= 1 && <span aria-hidden="true">{up ? "▲" : "▼"}</span>} {up ? "+" : "−"}{num(Math.abs(v), 0)} %{label ? ` ${label}` : ""}
    </span>
  );
}

const KpiIcon = ({ d }: { d: React.ReactNode }) => (
  <span className="kpi-ic" aria-hidden="true">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
  </span>
);

export function DayHeader({ kpis, forecast }: { kpis: DailyKPIs; forecast: any | null }) {
  const D = useDay(kpis, forecast);
  const t = D.tomorrow;
  return (
    <div className="sw">
      <header className="page-head">
        <div className="page-eyebrow">
          {longDate(kpis.date) || D.journee}
          {D.hasRef ? tr(` · comparée ${D.refLabel.startsWith("moyenne") ? "à la" : "au"} ${D.refLabel}`, " · compared with the previous same weekdays") : ""}
        </div>
        <h1 className="page-h1">{tr("Vue du Jour", "Daily View")}</h1>
        <p className="page-lede">
          <b>{D.headline}</b>{" "}
          {D.top ? tr(`${D.top.article} est le plus vendu (${fmt(D.top.quantity || 0)} pièces), pic d'activité à ${D.peak} h.`, `${D.top.article} is the best seller (${fmt(D.top.quantity || 0)} units), peak at ${D.peak}:00.`) : ""}
        </p>
      </header>
      <div className="kpi-row">
        <div className="kpi">
          <div className="kpi-top"><KpiIcon d={<><path d="M12 2v20" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>} />{tr("Chiffre d'affaires", "Revenue")}</div>
          <div className="kpi-v num">{fmt(kpis.ca_jour)} €</div>
          <Delta v={D.hasRef ? D.delta : null} label={tr("vs habitude", "vs usual")} />
        </div>
        <div className="kpi">
          <div className="kpi-top"><KpiIcon d={<><path d="M4 4h16v16l-3-2-3 2-2-2-2 2-3-2-3 2Z" /><path d="M8 9h8M8 13h5" /></>} />{tr("Tickets", "Transactions")}</div>
          <div className="kpi-v num">{fmt(kpis.tickets)}</div>
          <Delta v={D.pct(kpis.tickets, Number(kpis.tickets_ref || 0))} label={tr("vs habitude", "vs usual")} />
        </div>
        <div className="kpi">
          <div className="kpi-top"><KpiIcon d={<><path d="M5 11h14l-1.5 9h-11Z" /><path d="m9 11 3-6 3 6" /></>} />{tr("Panier moyen", "Average basket")}</div>
          <div className="kpi-v num">{fmt(kpis.panier, 2)} €</div>
          <Delta v={D.pct(kpis.panier, D.panierRef)} label={tr("vs habitude", "vs usual")} />
        </div>
        <div className="kpi">
          <div className="kpi-top"><KpiIcon d={<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>} />{tr("Demain", "Tomorrow")}</div>
          <div className="kpi-v num">{!t ? "—" : t.is_ferme ? tr("Fermé", "Closed") : `${fmt(t.yhat)}`}<span className="kpi-unit">{t && !t.is_ferme ? tr(" articles", " items") : ""}</span></div>
          <span className="kpi-d">{t ? D.tomorrowWord : forecast === null ? tr("chargement…", "loading…") : tr("prévision indisponible", "forecast unavailable")}</span>
        </div>
      </div>
    </div>
  );
}

export function DayOutlook({ kpis, forecast }: { kpis: DailyKPIs; forecast: any | null }) {
  const { openChat } = useChat();
  const D = useDay(kpis, forecast);
  const t = D.tomorrow;
  return (
    <div className="sw">
      <div className="grid-main stretch">
        {/* Les 7 prochains jours + détail de demain */}
        <section className="cc">
          {D.days.length > 0 && (
            <ChartAssistantButton chartType="next_7_days_forecast" chartData={{ apres_la_journee: D.journee, prevision_articles_par_jour: D.days, total_jours_ouverts: D.totalF }}
              chartName="Next7Days" userQuestion="Explique la prévision des 7 prochains jours" position="top-right" onOpenChat={openChat} />
          )}
          <div className="card-head">
            <h2 className="ct">{tr("Les 7 prochains jours", "The next 7 days")}</h2>
            {D.days.length > 0 && <span className="card-meta">{tr(`${fmt(D.totalF)} articles prévus`, `${fmt(D.totalF)} items forecast`)}</span>}
          </div>
          {D.days.length > 0 && (
            <Scope period={tr(`Prévision du ${dayLabel(D.days[0].ds)} au ${dayLabel(D.days[D.days.length - 1].ds)}`, `Forecast ${dayLabel(D.days[0].ds)} to ${dayLabel(D.days[D.days.length - 1].ds)}`)}
              calc={tr("Total prévu de chaque jour, tous produits", "Forecast total of each day, all products")} unit={tr("articles", "items")} />
          )}
          {D.days.length === 0 ? (
            <div className="cs">{forecast === null ? tr("Chargement de la prévision…", "Loading the forecast…") : tr("Prévision indisponible.", "Forecast unavailable.")}</div>
          ) : (
            <div className="bento-bars" role="img" aria-label={tr("Prévision des 7 prochains jours", "Forecast for the next 7 days")}>
              {D.days.map((d) => {
                const closed = !!d.is_ferme;
                const isPeak = !closed && D.peakF && d.ds === D.peakF.ds;
                return (
                  <div key={d.ds} className="bento-bar-col" title={closed ? tr("Boutique fermée", "Shop closed") : tr(`${fmt(d.yhat)} articles prévus (fourchette ${fmt(d.yhat_lower || 0)}–${fmt(d.yhat_upper || 0)})`, `${fmt(d.yhat)} items forecast (range ${fmt(d.yhat_lower || 0)}–${fmt(d.yhat_upper || 0)})`)}>
                    <div className="bento-bar-val num">{closed ? tr("fermé", "closed") : fmt(d.yhat)}</div>
                    <div className={`bento-bar${closed ? " closed" : ""}`}
                      style={closed ? undefined : { height: `${Math.max(6, (d.yhat / D.maxF) * 100)}px`, background: isPeak ? "var(--ch-peak)" : "var(--ch-1)" }} />
                    <div className="bento-bar-lbl">{dayLabel(d.ds)}</div>
                  </div>
                );
              })}
            </div>
          )}
          {t && !t.is_ferme && (
            <div className="mini-stats">
              <div><span>{tr("Demain, fourchette probable", "Tomorrow, likely range")}</span><b className="num">{fmt(t.yhat_lower || 0)} – {fmt(t.yhat_upper || 0)}</b></div>
              <div><span>{tr("Moyenne des 7 jours", "7-day average")}</span><b className="num">{fmt(D.typicalOpen)}</b></div>
              <div><span>{tr("Il y a 52 semaines", "52 weeks earlier")}</span><b className="num">{D.lastYear !== null ? fmt(D.lastYear) : "—"}</b></div>
            </div>
          )}
        </section>

        {/* Produits du jour */}
        <section className="cc">
          <ChartAssistantButton chartType="day_top_products_qty" chartData={{ journee: D.journee, jour_semaine: kpis.jour_semaine, periode: "une seule journée (Vue du Jour)", produits: D.prods }}
            chartName="DayTopProducts" userQuestion="Explique les produits les plus vendus ce jour-là" position="top-right" onOpenChat={openChat} />
          <div className="card-head">
            <h2 className="ct">{tr("Produits du jour", "Products of the day")}</h2>
          </div>
          <Scope period={tr(`Journée du ${D.journee}`, `Day of ${D.journee}`)} calc={tr("Quantité vendue ce jour-là", "Quantity sold that day")} unit={tr("pièces", "pieces")} />
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {D.prods.length === 0 && <div className="cs">{tr("Aucune vente ce jour-là.", "No sales that day.")}</div>}
            {D.prods.map((p, i) => (
              <div key={p.article} title={`${p.article} : ${fmt(p.quantity || 0)}`}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: ".8rem" }}>
                  <span style={{ fontWeight: 700, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.article}</span>
                  <span className="num" style={{ fontWeight: 800 }}>{fmt(p.quantity || 0)}</span>
                </div>
                <div className="bento-track"><div style={{ width: `${((p.quantity || 0) / D.maxQ) * 100}%`, background: i === 0 ? "var(--ch-peak)" : "var(--ch-1)" }} /></div>
              </div>
            ))}
          </div>
        </section>
      </div>
      <div className="cs" style={{ margin: "2px 4px 0" }}>
        {siteConfig.bakeryName ? `${siteConfig.bakeryName} · ` : ""}{tr("Données de caisse et prévision boutique (articles par jour).", "Till data and shop forecast (items per day).")}
      </div>
    </div>
  );
}

export function DayBento({ kpis, forecast }: { kpis: DailyKPIs; forecast: any | null }) {
  return (
    <>
      <DayHeader kpis={kpis} forecast={forecast} />
      <DayOutlook kpis={kpis} forecast={forecast} />
    </>
  );
}
