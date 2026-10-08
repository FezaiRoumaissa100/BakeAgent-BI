"use client";

import React, { useEffect, useState } from "react";
import { readStoredMode, saveMode, applyMode } from "@/lib/themeMode";
import { t } from "@/lib/texts";

// Bouton unique soleil / lune dans l'en-tête.
// - Au premier lancement, le tableau de bord suit le réglage clair / sombre de l'ordinateur.
// - L'icône montre le mode actuel : soleil = mode clair, lune = mode sombre.
// - Un clic passe à l'autre mode, et ce choix est mémorisé.
export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [followsComputer, setFollowsComputer] = useState(true);

  // Lecture de l'état réel après le premier affichage (évite un écart serveur / navigateur).
  useEffect(() => {
    setDark(document.documentElement.dataset.theme === "dark");
    setFollowsComputer(readStoredMode() === "system");
  }, []);

  // Tant que l'utilisateur n'a rien choisi, on suit en direct un changement du réglage de l'ordinateur.
  useEffect(() => {
    if (!followsComputer || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      applyMode("system");
      setDark(mq.matches);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [followsComputer]);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    setFollowsComputer(false);
    saveMode(next ? "dark" : "light");
  };

  const label = dark ? t.theme.toLight : t.theme.toDark;

  return (
    <button
      onClick={toggle}
      aria-label={label}
      title={label}
      style={{
        width: "40px",
        height: "40px",
        borderRadius: "50%",
        background: "var(--dk-chrome-chip, #FBF6F0)",
        border: "1px solid var(--dk-chrome-chip-line, #EADFD3)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        color: "var(--dk-chrome-ink, #1C1410)",
        transition: "all 0.2s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--dk-chrome-hover, #F3E9DE)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "var(--dk-chrome-chip, #FBF6F0)";
      }}
    >
      {dark ? (
        // Lune : mode sombre actif
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      ) : (
        // Soleil : mode clair actif
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      )}
    </button>
  );
}
