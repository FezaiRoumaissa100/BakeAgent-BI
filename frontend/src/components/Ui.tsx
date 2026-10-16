"use client";

// Briques communes de mise en page :
//  - <RetainProvider> + <Takeaway> + <RetainCard> : les phrases « à retenir » écrites sous les graphiques
//    sont regroupées dans UNE carte « À retenir » par page (au lieu d'une phrase sous chaque graphique).
//    Hors d'un <RetainProvider>, <Takeaway> s'affiche simplement sous le graphique, comme avant.
//  - <Details> : section repliée « Voir le détail » qui s'ouvre au clic (tableaux détaillés).

import React, { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import { tr } from "@/lib/i18n";

type RetainApi = { set: (id: string, text: string) => void; remove: (id: string) => void; items: string[] };
const RetainCtx = createContext<RetainApi | null>(null);

export function RetainProvider({ children }: { children: React.ReactNode }) {
  const map = useRef(new Map<string, string>());
  const [items, setItems] = useState<string[]>([]);
  const flush = useCallback(() => setItems(Array.from(map.current.values())), []);
  const set = useCallback((id: string, text: string) => {
    if (map.current.get(id) === text) return;
    map.current.set(id, text);
    flush();
  }, [flush]);
  const remove = useCallback((id: string) => {
    if (!map.current.has(id)) return;
    map.current.delete(id);
    flush();
  }, [flush]);
  const api = useMemo(() => ({ set, remove, items }), [set, remove, items]);
  return <RetainCtx.Provider value={api}>{children}</RetainCtx.Provider>;
}

// Texte d'un nœud React (les phrases sont des chaînes ou des fragments simples)
function textOf(n: React.ReactNode): string {
  if (n == null || typeof n === "boolean") return "";
  if (typeof n === "string" || typeof n === "number") return String(n);
  if (Array.isArray(n)) return n.map(textOf).join("");
  if (React.isValidElement(n)) return textOf((n.props as any)?.children);
  return "";
}

/** Phrase « à retenir ». Dans une page avec <RetainProvider>, elle rejoint la carte « À retenir ». */
export function Takeaway({ children, accent }: { children: React.ReactNode; accent?: string }) {
  const ctx = useContext(RetainCtx);
  const id = useId();
  const text = textOf(children).trim();
  useEffect(() => {
    if (!ctx || !text) return;
    ctx.set(id, text);
  }, [ctx?.set, id, text]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => ctx?.remove(id), [ctx?.remove, id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (ctx) return null;
  return (
    <div style={{ marginTop: 10, fontSize: ".8rem", color: "var(--dk-ink)", lineHeight: 1.5, borderLeft: `3px solid ${accent || "var(--dk-accent)"}`, paddingLeft: 10 }}>
      {children}
    </div>
  );
}

/** Carte « À retenir » : les phrases clés de la page, numérotées. */
export function RetainCard({ max = 5, style }: { max?: number; style?: React.CSSProperties }) {
  const ctx = useContext(RetainCtx);
  const [all, setAll] = useState(false);
  const items = ctx?.items || [];
  if (!items.length) return null;
  const shown = all ? items : items.slice(0, max);
  return (
    <div className="cc retain" style={style}>
      <div className="ct" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="retain-ic" aria-hidden="true">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V17h6v-.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2Z" /></svg>
        </span>
        {tr("À retenir", "Key takeaways")}
      </div>
      <div className="cs">{tr("Ce que disent les graphiques de cette page", "What this page's charts say")}</div>
      <ol className="retain-list">
        {shown.map((t, i) => (
          <li key={i}><span className="retain-n">{i + 1}</span><span>{t}</span></li>
        ))}
      </ol>
      {items.length > max && (
        <button className="link-btn" onClick={() => setAll((v) => !v)}>
          {all ? tr("Afficher moins", "Show less") : tr(`Afficher les ${items.length} points`, `Show all ${items.length} points`)}
        </button>
      )}
    </div>
  );
}

/** Section repliée « Voir le détail » (s'ouvre au clic). */
export function Details({ label, children, defaultOpen = false }: { label?: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="more" open={defaultOpen}>
      <summary>
        <svg className="more-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
        {label || tr("Voir le détail", "See details")}
      </summary>
      <div className="more-body">{children}</div>
    </details>
  );
}
