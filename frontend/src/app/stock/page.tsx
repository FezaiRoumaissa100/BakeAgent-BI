"use client";

// Page « Saisie du stock » : le boulanger saisit, produit par produit, ce qu'il a PRÉPARÉ
// et ce qui RESTE le soir. Les ventes de la caisse sont déjà connues : on en déduit les vrais invendus
// (en articles et en euros), la part de la production vendue et les produits épuisés.
// API : GET/POST /api/production, GET /api/production/summary (backend/engines/production_engine.py).

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchProduction, saveProduction, fetchProductionSummary } from "@/lib/api";
import { tr, trData, locale } from "@/lib/i18n";
import { ExpertNote } from "@/components/Expert";
import { TrayEditor } from "@/components/TrayEditor";
import { planTrays, piecesToTrays, traysToPieces, TrayInfo } from "@/lib/trays";
import { useSelectedDay } from "@/lib/selectedDay";

type Row = { product_id: number; article: string; category: string; sold: number; usual: number | null; suggested: number | null;
  prix: number | null; produced: number | null; leftover: number | null; tray: TrayInfo | null };
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
  // Saisie en plaques : les produits qui ont une taille de plaque se saisissent en plaques, les autres restent en pièces.
  // Les valeurs tapées sont dans l'unité affichée ; tout calcul et l'enregistrement passent en pièces.
  const [inTrays, setInTrays] = useState(false);
  const trayMode = useRef(false);

  const load = useCallback((date?: string) => {
    setData(null); setError(null); setStatus(null);
    fetchProduction(date).then((d) => {
      if (d?.ok === false) { setError(d.message); return; }
      setData(d); setDs(d.date);
      const e: Record<number, Entry> = {};
      const show = (r: Row, v: number | null) => (v == null ? "" : String(trayMode.current && r.tray && r.tray.rounding !== "none" ? piecesToTrays(v, r.tray.pieces) : v));
      (d.items || []).forEach((r: Row) => { e[r.product_id] = { produced: show(r, r.produced), leftover: show(r, r.leftover) }; });
      setEntries(e); setDirty(false);
    }).catch(() => setError(tr("Impossible de contacter le backend. Vérifiez qu'il est lancé (start-all.ps1).", "Cannot reach the backend. Check that it is running (start-all.ps1).")));
  }, []);
  const loadSummary = useCallback(() => { fetchProductionSummary(14).then(setSummary).catch(() => setSummary(null)); }, []);

  // Jour choisi dans la barre du haut : la saisie s'ouvre sur ce jour (sauf s'il reste des saisies non enregistrées)
  const [selDay, , selReady] = useSelectedDay();
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;
  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => { if (!selReady || dirtyRef.current) return; load(selDay || undefined); }, [load, selDay, selReady]);

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

  // Plaque utilisée pour saisir cette ligne (null = pièces) : seulement en mode « plaques » et si le produit en a une
  const trayOf = (r: Row): TrayInfo | null => (r.tray && r.tray.rounding !== "none" ? r.tray : null);
  const unitTray = (r: Row): TrayInfo | null => (inTrays ? trayOf(r) : null);
  const toPieces = (r: Row, v: number | null) => { const t = unitTray(r); return v == null || isNaN(v) || !t ? v : traysToPieces(v, t.pieces); };

  // Quantité proposée pour « Préparé » : la quantité conseillée si une prévision existe pour ce jour,
  // sinon au moins ce qui a été vendu en caisse (et l'habitude du jour). En plaques : plaques entières selon l'arrondi du produit.
  const proposal = (r: Row) => Math.ceil(r.suggested ?? Math.max(r.sold || 0, r.usual || 0));
  const proposalText = (r: Row) => {
    const v = proposal(r), t = unitTray(r);
    if (!(v > 0)) return "";
    return String(t ? (planTrays(v, t)?.trays ?? piecesToTrays(v, t.pieces)) : v);
  };
  const fillSuggested = () => {
    setEntries((p) => {
      const n = { ...p };
      shown.forEach((r) => { if (!n[r.product_id]?.produced) { const v = proposalText(r); if (v) n[r.product_id] = { ...(n[r.product_id] || { leftover: "" }), produced: v }; } });
      return n;
    });
    setDirty(true); setStatus(null);
  };

  // Passer de pièces à plaques (et inversement) : les valeurs déjà tapées sont converties, pas perdues
  const toggleUnit = () => {
    const next = !inTrays;
    setEntries((p) => {
      const n = { ...p };
      items.forEach((r) => {
        const t = trayOf(r), e = n[r.product_id];
        if (!t || !e) return;
        const conv = (s: string) => { const v = num(s); return v == null || isNaN(v) ? s : String(next ? piecesToTrays(v, t.pieces) : traysToPieces(v, t.pieces)); };
        n[r.product_id] = { produced: conv(e.produced), leftover: conv(e.leftover) };
      });
      return n;
    });
    trayMode.current = next; setInTrays(next);
  };

  // Une taille de plaque vient d'être changée dans l'éditeur : mettre la ligne à jour et garder la saisie en cours juste
  const onTrayChanged = (pid: number, before: TrayInfo | null, after: TrayInfo | null) => {
    const usesBefore = inTrays && before && before.rounding !== "none" ? before : null;
    const usesAfter = inTrays && after && after.rounding !== "none" ? after : null;
    setEntries((p) => {
      const e = p[pid];
      if (!e || (!usesBefore && !usesAfter)) return p;
      const conv = (s: string) => {
        const v = num(s); if (v == null || isNaN(v)) return s;
        const pieces = usesBefore ? traysToPieces(v, usesBefore.pieces) : v;
        return String(usesAfter ? piecesToTrays(pieces, usesAfter.pieces) : pieces);
      };
      return { ...p, [pid]: { produced: conv(e.produced), leftover: conv(e.leftover) } };
    });
    setData((d: any) => d ? { ...d, items: d.items.map((i: Row) => i.product_id === pid ? { ...i, tray: after } : i) } : d);
  };

  // Calculs en direct
  const lineOf = (r: Row) => {
    const e = entries[r.product_id] || { produced: "", leftover: "" };
    const p = toPieces(r, num(e.produced)), l = toPieces(r, num(e.leftover));   // toujours en pièces
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
        window.dispatchEvent(new Event("stock-saved"));   // menu de gauche : le bouton « Stock du soir » passe à « fait »
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
        <p className="page-lead">
          <span className="page-lead-ic" aria-hidden="true"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.3-2.4 3.6M12 17h.01" /></svg></span>
          <span>
          {tr("Chaque soir : ce qui a été préparé et ce qui reste. Le tableau de bord en déduit les invendus et les ruptures.", "Each evening: what was made and what is left. The dashboard works out unsold items and sell-outs.")}
          </span>
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
            {items.some((r) => trayOf(r)) && (
              <button type="button" className="prep-print-btn" onClick={toggleUnit} aria-pressed={inTrays}>
                {inTrays ? tr("Saisie en plaques : oui", "Entry in trays: on") : tr("Saisir en plaques", "Enter in trays")}
              </button>
            )}
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
                            <td className="num">
                              {r.suggested != null ? fmt(Math.ceil(r.suggested)) : "—"}
                              {trayOf(r) && r.suggested != null && planTrays(Math.ceil(r.suggested), trayOf(r)) && (
                                <small style={{ display: "block", color: "var(--dk-muted)" }}>{`= ${fmt(planTrays(Math.ceil(r.suggested), trayOf(r))!.trays)} ${tr("pl.", "tr.")}`}</small>
                              )}
                            </td>
                            <td><input className="stock-in" inputMode="decimal" value={e.produced} onChange={(ev) => set(r.product_id, "produced", ev.target.value)} placeholder={proposalText(r)} aria-label={tr(`Préparé : ${r.article}`, `Made: ${r.article}`)} />{unitTray(r) && <small style={{ marginLeft: 4, color: "var(--dk-muted)" }}>{tr("pl.", "tr.")}</small>}</td>
                            <td><input className="stock-in" inputMode="decimal" value={e.leftover} onChange={(ev) => set(r.product_id, "leftover", ev.target.value)} placeholder="0" aria-label={tr(`Restant : ${r.article}`, `Left: ${r.article}`)} />{unitTray(r) && <small style={{ marginLeft: 4, color: "var(--dk-muted)" }}>{tr("pl.", "tr.")}</small>}</td>
                            <td>{res}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <ExpertNote>
                Table daily_production (date_id, product_id, produced, leftover), créée automatiquement par le backend. Vendu (caisse) = SUM(quantity) de fact_ticket_lines ce jour-là. D'habitude = médiane des 8 derniers mêmes jours de semaine ouverts. Conseillé = quantité anti-gaspillage de la prévision par produit (backend/engines/quantity_engine.py : niveau 1 − coût / prix, corrigé par cette saisie), seulement pour les jours couverts par la dernière prévision. Invendus € = restant × prix moyen des 90 derniers jours de ventes. Une ligne vidée est effacée à l'enregistrement. Saisie en plaques : pour les produits qui ont une taille de plaque (table product_tray_sizes), les quantités tapées sont des plaques et sont converties en pièces (plaques × pièces par plaque) à l'enregistrement ; daily_production reste en pièces.
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

          <TrayEditor onChanged={onTrayChanged} />

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
