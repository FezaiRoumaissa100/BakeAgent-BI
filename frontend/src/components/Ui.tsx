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
export function Details({ label, children, defaultOpen = false, soft = false }: { label?: string; children: React.ReactNode; defaultOpen?: boolean; soft?: boolean }) {
  return (
    <details className={`more${soft ? " more-soft" : ""}`} open={defaultOpen}>
      <summary>
        <svg className="more-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
        {label || tr("Voir le détail", "See details")}
      </summary>
      <div className="more-body">{children}</div>
    </details>
  );
}

/* « Ce que montre ce graphique » : période couverte, calcul (total, moyenne par jour…) et unité,
   en petites étiquettes sous le titre, pour qu'on sache toujours de quoi parle un chiffre. */
export function Scope({ period, calc, unit, style }: { period?: React.ReactNode; calc?: React.ReactNode; unit?: React.ReactNode; style?: React.CSSProperties }) {
  const chip = (icon: React.ReactNode, text: React.ReactNode, strong = false) => (
    <span className={"scope-chip" + (strong ? " strong" : "")}>
      <span aria-hidden="true" className="scope-ic">{icon}</span>{text}
    </span>
  );
  const cal = (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
  );
  const sig = (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M18 5H6l6 7-6 7h12" /></svg>
  );
  const ruler = (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M4 18h16M7 18v-4M12 18v-6M17 18v-3" /></svg>
  );
  return (
    <div className="scope" style={style}>
      {period ? chip(cal, period, true) : null}
      {calc ? chip(sig, calc) : null}
      {unit ? chip(ruler, unit) : null}
    </div>
  );
}

/* ── Liste déroulante de filtre (même style partout) : bouton « Libellé · valeur ⌄ » + menu ──
   Remplace les longues rangées de boutons (années, mois) et les <select> du navigateur. */
export function FilterDrop({ label, icon, value, options, onChange, allValue, cols = 1 }: {
  label: string;
  icon?: React.ReactNode;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  allValue?: string;          // valeur « tout » : le bouton n'est pas mis en avant quand elle est choisie
  cols?: number;              // colonnes du menu (ex. 3 pour les mois)
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  const cur = options.find((o) => o.value === value);
  const active = allValue !== undefined && value !== allValue;
  return (
    <div className="fd" ref={ref}>
      <button type="button" className={`fd-btn${active ? " on" : ""}${open ? " open" : ""}`} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}>
        {icon && <span className="fd-ic" aria-hidden="true">{icon}</span>}
        <span className="fd-lbl">{label}{tr(" :", ":")}</span>
        <span className="fd-val">{cur ? cur.label : value}</span>
        <svg className="fd-chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
        <div className="fd-pop" role="listbox" aria-label={label} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, minWidth: cols > 1 ? cols * 118 : undefined }}>
          {options.map((o) => (
            <button key={o.value} type="button" role="option" aria-selected={o.value === value}
              className={`fd-opt${o.value === value ? " on" : ""}${allValue !== undefined && o.value === allValue ? " all" : ""}`}
              onClick={() => { onChange(o.value); setOpen(false); }}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
