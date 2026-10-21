"use client";

// Page « Saisie du stock » : le boulanger saisit, produit par produit, ce qu'il a PRÉPARÉ
// et ce qui RESTE le soir. Les ventes de la caisse sont déjà connues : on en déduit les vrais invendus
// (en articles et en euros), la part de la production vendue et les produits épuisés.
// API : GET/POST /api/production, GET /api/production/summary (backend/engines/production_engine.py).

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { fetchProduction, saveProduction, fetchProductionSummary } from "@/lib/api";
import { tr, trData, locale } from "@/lib/i18n";
import { ExpertNote } from "@/components/Expert";

type Row = { product_id: number; article: string; category: string; sold: number; usual: number | null; suggested: number | null;
  prix: number | null; produced: number | null; leftover: number | null };
type Entry = { produced: string; leftover: string };

const fmt = (n: number, d = 0) => Number(n || 0).toLocaleString(locale(), { minimumFractionDigits: d, maximumFractionDigits: d });
const num = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));
const shift = (ds: string, k: number) => { const d = new Date(ds + "T12:00:00"); d.setDate(d.getDate() + k); return d.toISOString().slice(0, 10); };

export default function StockPage() {
  const [ds, setDs] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<Record<number, Entry>>({});
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [fam, setFam] = useState("Toutes");
  const [q, setQ] = useState("");
  const [summary, setSummary] = useState<any>(null);

  const load = useCallback((date?: string) => {
    setData(null); setError(null); setStatus(null);
    fetchProduction(date).then((d) => {
      if (d?.ok === false) { setError(d.message); return; }
      setData(d); setDs(d.date);
      const e: Record<number, Entry> = {};
      (d.items || []).forEach((r: Row) => { e[r.product_id] = { produced: r.produced != null ? String(r.produced) : "", leftover: r.leftover != null ? String(r.leftover) : "" }; });
      setEntries(e); setDirty(false);
    }).catch(() => setError(tr("Impossible de contacter le backend. Vérifiez qu'il est lancé (start-all.ps1).", "Cannot reach the backend. Check that it is running (start-all.ps1).")));
  }, []);
  const loadSummary = useCallback(() => { fetchProductionSummary(14).then(setSummary).catch(() => setSummary(null)); }, []);

  useEffect(() => { load(); loadSummary(); }, [load, loadSummary]);

  // Prévenir avant de quitter la page avec des saisies non enregistrées
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const items: Row[] = data?.items || [];
  const fams = useMemo(() => ["Toutes", ...Array.from(new Set(items.map((i) => i.category))).sort()], [items]);
  const shown = items.filter((i) => (fam === "Toutes" || i.category === fam) && (!q.trim() || i.article.toLowerCase().includes(q.trim().toLowerCase())));

  const set = (pid: number, k: keyof Entry, v: string) => {
    setEntries((p) => ({ ...p, [pid]: { ...(p[pid] || { produced: "", leftover: "" }), [k]: v } }));
    setDirty(true); setStatus(null);
  };

  // Quantité proposée pour « Préparé » : la quantité conseillée si une prévision existe pour ce jour,
  // sinon au moins ce qui a été vendu en caisse (et l'habitude du jour)
  const proposal = (r: Row) => Math.ceil(r.suggested ?? Math.max(r.sold || 0, r.usual || 0));
  const fillSuggested = () => {
    setEntries((p) => {
      const n = { ...p };
      shown.forEach((r) => { if (!n[r.product_id]?.produced) { const v = proposal(r); if (v > 0) n[r.product_id] = { ...(n[r.product_id] || { leftover: "" }), produced: String(v) }; } });
      return n;
    });
    setDirty(true); setStatus(null);
  };

  // Calculs en direct
  const lineOf = (r: Row) => {
    const e = entries[r.product_id] || { produced: "", leftover: "" };
    const p = num(e.produced), l = num(e.leftover);
    const bad = (p != null && (isNaN(p) || p < 0)) || (l != null && (isNaN(l) || l < 0)) || (p != null && l != null && l > p);
    return { p, l, bad };
  };
  const tot = items.reduce((a, r) => {
    const { p, l, bad } = lineOf(r);
    if (bad) { a.bad++; return a; }
    if (p != null || l != null) a.n++;
    if (p != null) a.p += p;
    if (l != null) { a.l += l; a.eur += l * (r.prix || 0); if (l === 0 && (p || 0) > 0) a.out++; }
    return a;
  }, { n: 0, p: 0, l: 0, eur: 0, out: 0, bad: 0 });

  const save = async () => {
    if (!ds || tot.bad) return;
    setSaving(true); setStatus(null);
    try {
      const rows = items.map((r) => { const { p, l } = lineOf(r); return { product_id: r.product_id, produced: p, leftover: l }; });
      const res = await saveProduction(ds, rows);
      if (res?.ok) {
        setDirty(false);
        setStatus({ ok: true, text: tr(`Enregistré : ${res.saved} produit(s), le ${res.updated_at}.`, `Saved: ${res.saved} product(s), on ${res.updated_at}.`) });
        loadSummary();
      } else {
        setStatus({ ok: false, text: res?.message || tr("Enregistrement refusé.", "Save refused.") });
      }
    } catch {
      setStatus({ ok: false, text: tr("Impossible d'enregistrer : le backend ne répond pas.", "Could not save: the backend does not respond.") });
    } finally { setSaving(false); }
  };

  const go = (date: string) => {
    if (dirty && !window.confirm(tr("Des saisies ne sont pas enregistrées. Changer de jour quand même ?", "Some entries are not saved. Change day anyway?"))) return;
    load(date);
  };
  const dayLong = (x: string) => { const t = new Date(x + "T12:00:00").toLocaleDateString(locale(), { weekday: "long", day: "numeric", month: "long", year: "numeric" }); return t.charAt(0).toUpperCase() + t.slice(1); };
  const lastDay: string | undefined = data?.last_sales_day;

  return (
    <div style={{ paddingBottom: 90 }}>
      <div style={{ marginBottom: 16, padding: "0 28px" }}>
        <h1 className="page-h1" style={{ margin: 0 }}>{tr("Saisie du ", "Stock ")}<span style={{ color: "var(--dk-accent)" }}>{tr("stock", "entry")}</span></h1>
        <p style={{ color: "var(--dk-muted)", fontSize: ".82rem", marginTop: 6, maxWidth: 680, lineHeight: 1.5 }}>
          {tr("Chaque soir, indiquez pour chaque produit ce qui a été préparé et ce qui reste à la fermeture. Les ventes viennent de la caisse : le tableau de bord calcule les vrais invendus, la part vendue et les produits épuisés.",
              "Each evening, enter for each product what was made and what is left at closing. Sales come from the till: the dashboard works out real unsold items, the share sold and sold-out products.")}
        </p>
      </div>

      {/* Jour + filtres */}
      <div className="sw">
        <div className="cc stock-bar">
          <div className="stock-day">
            <button type="button" className="stock-arrow" onClick={() => ds && go(shift(ds, -1))} aria-label={tr("Jour précédent", "Previous day")}>‹</button>
            <input type="date" value={ds || ""} onChange={(e) => e.target.value && go(e.target.value)} aria-label={tr("Jour", "Day")} />
            <button type="button" className="stock-arrow" onClick={() => ds && go(shift(ds, 1))} aria-label={tr("Jour suivant", "Next day")}>›</button>
            {lastDay && ds !== lastDay && <button type="button" className="link-btn" style={{ marginTop: 0 }} onClick={() => go(lastDay)}>{tr("Dernier jour de ventes", "Last sales day")}</button>}
          </div>
          <div className="stock-filters">
            <select value={fam} onChange={(e) => setFam(e.target.value)} aria-label={tr("Famille", "Family")}>
              {fams.map((f) => <option key={f} value={f}>{f === "Toutes" ? tr("Toutes les familles", "All families") : trData(f)}</option>)}
            </select>
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Chercher un produit…", "Search a product…")} />
            <button type="button" className="prep-print-btn" onClick={fillSuggested} disabled={!items.length}>{tr("Remplir « Préparé »", "Fill in “Made”")}</button>
          </div>
        </div>
      </div>

      {error && <div className="sw"><div className="cc" style={{ color: "var(--dk-alert)", fontWeight: 700 }}>{error}</div></div>}
      {!data && !error && <div className="sw"><div className="cc cs">{tr("Chargement…", "Loading…")}</div></div>}

      {data && (
        <>
          {/* Bilan du jour (calculé en direct) */}
          <div className="sw">
            <div className="prep-sum" style={{ margin: 0 }}>
              <div><span>{tr("Jour", "Day")}</span><b>{dayLong(data.date)}</b><small>{data.nb_saisis ? tr(`déjà saisi · ${data.updated_at}`, `already entered · ${data.updated_at}`) : tr("pas encore saisi", "not entered yet")}</small></div>
              <div><span>{tr("Préparé", "Made")}</span><b className="num">{fmt(tot.p)}</b><small>{tr(`${tot.n} produit(s) saisi(s)`, `${tot.n} product(s) entered`)}</small></div>
              <div><span>{tr("Restant le soir", "Left at closing")}</span><b className="num">{fmt(tot.l)}</b><small>{tot.p > 0 ? tr(`${fmt((1 - tot.l / tot.p) * 100)} % de la production vendue`, `${fmt((1 - tot.l / tot.p) * 100)}% of production sold`) : "—"}</small></div>
              <div><span>{tr("Invendus", "Unsold")}</span><b className="num" style={{ color: tot.eur ? "var(--ch-3)" : undefined }}>{tot.eur ? `≈ ${fmt(tot.eur)} €` : "—"}</b><small>{tr("valeur de vente", "at sale price")}</small></div>
              <div><span>{tr("Épuisés", "Sold out")}</span><b className="num" style={{ color: tot.out ? "var(--dk-alert)" : undefined }}>{fmt(tot.out)}</b><small>{tr("restant = 0 : la demande était peut-être plus forte", "left = 0: demand may have been higher")}</small></div>
            </div>
          </div>

          {/* Tableau de saisie */}
          <div className="sw">
            <div className="cc">
              {items.length === 0 ? (
                <div className="cs">{tr("Aucune vente en caisse dans les 4 semaines avant ce jour : rien à saisir. Choisissez un jour avec des ventes.", "No till sales in the 4 weeks before this day: nothing to enter. Pick a day with sales.")}</div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table className="prep-table stock-table">
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left" }}>{tr("Produit", "Product")}</th>
                        <th>{tr("Vendu (caisse)", "Sold (till)")}</th>
                        <th>{tr("D'habitude", "Usual")}</th>
                        <th>{tr("Conseillé", "Suggested")}</th>
                        <th>{tr("Préparé", "Made")}</th>
                        <th>{tr("Restant le soir", "Left at closing")}</th>
                        <th style={{ textAlign: "left" }}>{tr("Résultat", "Result")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shown.map((r) => {
                        const e = entries[r.product_id] || { produced: "", leftover: "" };
                        const { p, l, bad } = lineOf(r);
                        let res: React.ReactNode = <span style={{ color: "var(--dk-muted)" }}>—</span>;
                        if (bad) res = <span className="prep-chip" style={{ background: "var(--dk-alert)", color: "#fff" }}>{tr("Restant > préparé", "Left > made")}</span>;
                        else if (p != null && l != null && p > 0) res = l === 0
                          ? <span className="prep-chip" style={{ background: "var(--dk-alert)", color: "#fff" }}>{tr("Épuisé", "Sold out")}</span>
                          : <span>{tr(`${fmt((1 - l / p) * 100)} % vendu`, `${fmt((1 - l / p) * 100)}% sold`)}{r.prix ? <small style={{ color: "var(--dk-muted)" }}>{` · ${fmt(l * r.prix, 2)} €`}</small> : null}</span>;
                        return (
                          <tr key={r.product_id} className={bad ? "stock-bad" : undefined}>
                            <td><b>{r.article}</b><small>{trData(r.category)}</small></td>
                            <td className="num">{fmt(r.sold)}</td>
                            <td className="num">{r.usual ? fmt(r.usual) : "—"}</td>
                            <td className="num">{r.suggested != null ? fmt(Math.ceil(r.suggested)) : "—"}</td>
                            <td><input className="stock-in" inputMode="decimal" value={e.produced} onChange={(ev) => set(r.product_id, "produced", ev.target.value)} placeholder={String(proposal(r) || "")} aria-label={tr(`Préparé : ${r.article}`, `Made: ${r.article}`)} /></td>
                            <td><input className="stock-in" inputMode="decimal" value={e.leftover} onChange={(ev) => set(r.product_id, "leftover", ev.target.value)} placeholder="0" aria-label={tr(`Restant : ${r.article}`, `Left: ${r.article}`)} /></td>
                            <td>{res}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <ExpertNote>
                Table daily_production (date_id, product_id, produced, leftover), créée automatiquement par le backend. Vendu (caisse) = SUM(quantity) de fact_ticket_lines ce jour-là. D'habitude = médiane des 8 derniers mêmes jours de semaine ouverts. Conseillé = borne haute de la prévision par produit, seulement pour les jours couverts par la dernière prévision. Invendus € = restant × prix moyen des 90 derniers jours de ventes. Une ligne vidée est effacée à l'enregistrement.
              </ExpertNote>
            </div>
          </div>

          {/* Derniers jours saisis */}
          {summary?.available && summary.days?.length > 0 && (
            <>
              <div className="sec-title">{tr("Derniers jours saisis", "Last days entered")}</div>
              <div className="sw">
                <div className="cc">
                  <div style={{ overflowX: "auto" }}>
                    <table className="prep-table">
                      <thead><tr><th style={{ textAlign: "left" }}>{tr("Jour", "Day")}</th><th>{tr("Préparé", "Made")}</th><th>{tr("Restant", "Left")}</th><th>{tr("Part vendue", "Share sold")}</th><th>{tr("Invendus", "Unsold")}</th><th style={{ textAlign: "left" }}>{tr("Épuisés", "Sold out")}</th></tr></thead>
                      <tbody>
                        {[...summary.days].reverse().map((d: any) => (
                          <tr key={d.date} style={{ cursor: "pointer" }} onClick={() => go(d.date)}>
                            <td><b>{dayLong(d.date)}</b><small>{tr(`${d.nb_produits} produit(s)`, `${d.nb_produits} product(s)`)}</small></td>
                            <td className="num">{fmt(d.produced)}</td>
                            <td className="num">{fmt(d.leftover)}</td>
                            <td className="num">{d.part_vendue != null ? `${fmt(d.part_vendue * 100)} %` : "—"}</td>
                            <td className="num">{d.euros_invendus ? `≈ ${fmt(d.euros_invendus)} €` : "—"}</td>
                            <td style={{ fontSize: ".76rem" }}>{d.epuises.length ? d.epuises.slice(0, 3).join(", ") + (d.epuises.length > 3 ? tr(` +${d.epuises.length - 3}`, ` +${d.epuises.length - 3}`) : "") : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Barre d'enregistrement (toujours visible en bas) */}
          <div className="stock-save">
            <span className={status ? (status.ok ? "ok" : "err") : dirty ? "dirty" : ""}>
              {status ? status.text : tot.bad ? tr(`${tot.bad} ligne(s) à corriger (restant plus grand que préparé).`, `${tot.bad} line(s) to fix (left greater than made).`)
                : dirty ? tr("Modifications non enregistrées", "Unsaved changes") : tr("Rien à enregistrer", "Nothing to save")}
            </span>
            <button type="button" onClick={save} disabled={!dirty || saving || tot.bad > 0}>{saving ? tr("Enregistrement…", "Saving…") : tr("Enregistrer", "Save")}</button>
          </div>
        </>
      )}
    </div>
  );
}
