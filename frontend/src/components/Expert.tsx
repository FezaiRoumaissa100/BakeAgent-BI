"use client";

// Mode expert caché : affiche les termes techniques et les formules sous les graphiques.
// Activer : ajouter ?expert=1 à l'adresse (ex. http://localhost:3000/produits?expert=1).
// Désactiver : ?expert=0. Le choix est gardé pendant la session du navigateur.
// Sans ce paramètre, le client ne voit que les libellés métier.

import React, { useEffect, useState } from "react";

const KEY = "dashboard-expert";

export function useExpert(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    // 1) L'adresse décide en premier (?expert=1 / ?expert=0)
    let p: string | null = null;
    try { p = new URLSearchParams(window.location.search).get("expert"); } catch {}
    // 2) Sinon, le choix gardé pour la session (peut être indisponible : fenêtre privée, etc.)
    let stored = false;
    try {
      if (p === "1") sessionStorage.setItem(KEY, "1");
      if (p === "0") sessionStorage.removeItem(KEY);
      stored = sessionStorage.getItem(KEY) === "1";
    } catch {}
    setOn(p === "1" ? true : p === "0" ? false : stored);
  }, []);
  return on;
}

/** Bloc visible uniquement en mode expert : terme technique, formule, champ du backend. */
export function ExpertNote({ children }: { children: React.ReactNode }) {
  const on = useExpert();
  if (!on) return null;
  return (
    <div
      style={{
        marginTop: 10,
        padding: "8px 12px",
        borderRadius: 8,
        border: "1px dashed var(--dk-muted, #6E756F)",
        background: "var(--dk-soft, #F5F6F1)",
        fontSize: ".72rem",
        lineHeight: 1.5,
        color: "var(--dk-ink2, #4A524C)",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
      }}
    >
      <strong style={{ fontFamily: "inherit" }}>Mode expert · </strong>
      {children}
    </div>
  );
}

/** Petit badge affiché dans l'en-tête quand le mode expert est actif. */
export function ExpertBadge() {
  const on = useExpert();
  if (!on) return null;
  return (
    <span
      title="Termes techniques et formules affichés sous les graphiques. Désactiver : ?expert=0"
      style={{
        fontSize: ".62rem",
        fontWeight: 800,
        padding: "3px 8px",
        borderRadius: 99,
        border: "1px dashed var(--dk-chrome-ink, #1E2420)",
        color: "var(--dk-chrome-ink, #1E2420)",
        whiteSpace: "nowrap",
      }}
    >
      Mode expert
    </span>
  );
}
