"use client";

// Tailles de plaque (page Saisie du stock) : combien de pièces contient une plaque ou une fournée de chaque produit.
// Les ventes et prévisions restent en pièces ; la plaque sert à présenter « À préparer » et la saisie comme le boulanger travaille.
// API : GET /api/production/trays, PUT/DELETE /api/production/trays/{product_id} (backend/engines/tray_engine.py).

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { fetchTrays, saveTray, deleteTray } from "@/lib/api";
import { tr, trData, locale } from "@/lib/i18n";
import { Details } from "@/components/Ui";
import { Rounding, TrayInfo } from "@/lib/trays";

type Item = { product_id: number; article: string; category: string; sold: number; pieces_per_tray: number | null; rounding: Rounding | null; is_estimate: boolean | null };
type Draft = { pieces: string; rounding: Rounding };

const fmt = (n: number) => Number(n || 0).toLocaleString(locale(), { maximumFractionDigits: 0 });
const SHOWN = 15;

const toInfo = (i: Item | undefined): TrayInfo | null =>
  i && i.pieces_per_tray ? { pieces: i.pieces_per_tray, rounding: (i.rounding || "up") as Rounding, estimate: !!i.is_estimate } : null;

export function TrayEditor({ onChanged }: { onChanged: (productId: number, before: TrayInfo | null, after: TrayInfo | null) => void }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ pid: number; ok: boolean; text: string } | null>(null);
  const [all, setAll] = useState(false);
  const [q, setQ] = useState("");

  const load = useCallback(() => {
    fetchTrays().then((d) => { setItems(d.items || []); setError(null); })
      .catch(() => setError(tr("Impossible de charger les tailles de plaque.", "Could not load the tray sizes.")));
  }, []);
  useEffect(() => { load(); }, [load]);

  const draftOf = (i: Item): Draft => drafts[i.product_id] || { pieces: i.pieces_per_tray ? String(i.pieces_per_tray) : "", rounding: (i.rounding || "up") as Rounding };
  const setDraft = (i: Item, patch: Partial<Draft>) => { setDrafts((p) => ({ ...p, [i.product_id]: { ...draftOf(i), ...patch } })); setMsg(null); };

  const list = useMemo(() => {
    const f = q.trim().toLowerCase();
    const base = (items || []).filter((i) => !f || i.article.toLowerCase().includes(f));
    return all || f ? base : base.slice(0, SHOWN);
  }, [items, all, q]);

  const save = async (i: Item) => {
    const d = draftOf(i);
    setBusy(i.product_id); setMsg(null);
    try {
      const res = await saveTray(i.product_id, d.pieces, d.rounding);
      if (res?.ok) {
        const after: TrayInfo = { pieces: res.pieces_per_tray, rounding: res.rounding, estimate: false };
        onChanged(i.product_id, toInfo(i), after);
        setItems((p) => (p || []).map((x) => x.product_id === i.product_id ? { ...x, pieces_per_tray: res.pieces_per_tray, rounding: res.rounding, is_estimate: false } : x));
        setDrafts((p) => { const n = { ...p }; delete n[i.product_id]; return n; });
        setMsg({ pid: i.product_id, ok: true, text: tr("Enregistré", "Saved") });
      } else setMsg({ pid: i.product_id, ok: false, text: res?.message || tr("Refusé", "Refused") });
    } catch {
      setMsg({ pid: i.product_id, ok: false, text: tr("Le backend ne répond pas.", "The backend does not respond.") });
    } finally { setBusy(null); }
  };

  const remove = async (i: Item) => {
    setBusy(i.product_id); setMsg(null);
    try {
      const res = await deleteTray(i.product_id);
      if (res?.ok) {
        onChanged(i.product_id, toInfo(i), null);
        setItems((p) => (p || []).map((x) => x.product_id === i.product_id ? { ...x, pieces_per_tray: null, rounding: null, is_estimate: null } : x));
        setDrafts((p) => { const n = { ...p }; delete n[i.product_id]; return n; });
        setMsg({ pid: i.product_id, ok: true, text: tr("Retiré : ce produit reste en pièces", "Removed: this product stays in pieces") });
      }
    } catch {
      setMsg({ pid: i.product_id, ok: false, text: tr("Le backend ne répond pas.", "The backend does not respond.") });
    } finally { setBusy(null); }
  };

  const nWith = (items || []).filter((i) => i.pieces_per_tray).length;
  const nEst = (items || []).filter((i) => i.pieces_per_tray && i.is_estimate).length;

  return (
    <>
      <div className="sw">
        <Details label={tr("Voir le détail : tailles de plaque (réglage, une fois)", "See details: tray sizes (one-time setup)")}>
        <div className="cc">
          <p className="cs" style={{ marginTop: 0, maxWidth: 760 }}>
            {tr("Indiquez combien de pièces contient une plaque (ou une fournée) de chaque produit. La liste « À préparer » montre alors le nombre de plaques à faire, et la saisie du stock peut se faire en plaques. Les ventes et les prévisions restent en pièces. Un produit sans taille reste en pièces.",
                "Enter how many pieces one tray (or batch) of each product holds. The “To prepare” list then shows the trays to make, and stock entry can be done in trays. Sales and forecasts stay in pieces. A product without a size stays in pieces.")}
          </p>
          {nEst > 0 && (
            <p style={{ margin: "0 0 10px", fontSize: ".78rem", fontWeight: 700, color: "var(--dk-alert)" }}>
              {tr(`${nEst} taille(s) sont des estimations de départ, à confirmer par la boulangerie (réenregistrer la taille la confirme).`,
                  `${nEst} size(s) are starting estimates to be confirmed by the bakery (saving a size again confirms it).`)}
            </p>
          )}
          {error && <div style={{ color: "var(--dk-alert)", fontWeight: 700 }}>{error}</div>}
          {!items && !error && <div className="cs">{tr("Chargement…", "Loading…")}</div>}
          {items && (
            <>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", margin: "6px 0 10px" }}>
                <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Chercher un produit…", "Search a product…")} style={{ padding: "7px 12px", borderRadius: 999, border: "1px solid var(--dk-line)", background: "var(--dk-soft)", color: "var(--dk-ink)", fontSize: ".8rem" }} />
                <span className="cs">{tr(`${nWith} produit(s) en plaques sur ${items.length}`, `${nWith} product(s) in trays out of ${items.length}`)}</span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="prep-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left" }}>{tr("Produit", "Product")}</th>
                      <th>{tr("Vendu (90 j)", "Sold (90 d)")}</th>
                      <th>{tr("Pièces par plaque", "Pieces per tray")}</th>
                      <th>{tr("Arrondi", "Rounding")}</th>
                      <th style={{ textAlign: "left" }}>{tr("Statut", "Status")}</th>
                      <th style={{ textAlign: "left" }} />
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((i) => {
                      const d = draftOf(i);
                      const changed = d.pieces !== (i.pieces_per_tray ? String(i.pieces_per_tray) : "") || d.rounding !== ((i.rounding || "up") as Rounding);
                      return (
                        <tr key={i.product_id}>
                          <td><b>{i.article}</b><small>{trData(i.category)}</small></td>
                          <td className="num">{fmt(i.sold)}</td>
                          <td><input className="stock-in" inputMode="numeric" value={d.pieces} onChange={(e) => setDraft(i, { pieces: e.target.value })} placeholder="—" aria-label={tr(`Pièces par plaque : ${i.article}`, `Pieces per tray: ${i.article}`)} /></td>
                          <td>
                            <select value={d.rounding} onChange={(e) => setDraft(i, { rounding: e.target.value as Rounding })} aria-label={tr(`Arrondi : ${i.article}`, `Rounding: ${i.article}`)}>
                              <option value="up">{tr("Plaque entière au-dessus", "Round up to a whole tray")}</option>
                              <option value="nearest">{tr("Plaque la plus proche", "Nearest tray")}</option>
                              <option value="none">{tr("Pas de plaques (pièces)", "No trays (pieces)")}</option>
                            </select>
                          </td>
                          <td>
                            {i.pieces_per_tray
                              ? i.is_estimate
                                ? <span className="prep-chip" style={{ background: "#E9C46A", color: "#1E2A22" }}>{tr("estimation à confirmer", "estimate to confirm")}</span>
                                : <span className="prep-chip" style={{ background: "var(--dk-accent)", color: "#fff" }}>{tr("confirmée", "confirmed")}</span>
                              : <span style={{ color: "var(--dk-muted)" }}>—</span>}
                            {msg && msg.pid === i.product_id && <small style={{ display: "block", color: msg.ok ? "var(--dk-accent)" : "var(--dk-alert)", fontWeight: 700 }}>{msg.text}</small>}
                          </td>
                          <td style={{ whiteSpace: "nowrap" }}>
                            <button type="button" className="prep-print-btn" disabled={busy === i.product_id || !d.pieces.trim() || (!changed && !i.is_estimate)} onClick={() => save(i)}>
                              {i.pieces_per_tray && i.is_estimate && !changed ? tr("Confirmer", "Confirm") : tr("Enregistrer", "Save")}
                            </button>{" "}
                            {i.pieces_per_tray ? <button type="button" className="link-btn" style={{ marginTop: 0 }} disabled={busy === i.product_id} onClick={() => remove(i)}>{tr("Retirer", "Remove")}</button> : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {!q.trim() && items.length > SHOWN && (
                <button className="link-btn" onClick={() => setAll((v) => !v)}>
                  {all ? tr("Afficher moins", "Show less") : tr(`Voir les ${items.length} produits`, `See all ${items.length} products`)}
                </button>
              )}
            </>
          )}
        </div>
        </Details>
      </div>
    </>
  );
}
