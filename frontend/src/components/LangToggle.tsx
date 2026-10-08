"use client";

import React from "react";
import { useLang } from "./LangProvider";
import { tr } from "@/lib/i18n";

// Sélecteur de langue dans l'en-tête : FR | EN (la langue active est en orange).
export function LangToggle() {
  const { lang, setLang } = useLang();

  const btn = (code: "fr" | "en", label: string, title: string) => {
    const active = lang === code;
    return (
      <button
        onClick={() => !active && setLang(code)}
        aria-pressed={active}
        title={title}
        style={{
          minWidth: "36px",
          height: "32px",
          padding: "0 8px",
          borderRadius: "999px",
          border: "none",
          cursor: active ? "default" : "pointer",
          background: active ? "#E8734A" : "transparent",
          color: active ? "#fff" : "rgba(255,255,255,0.7)",
          fontSize: "0.75rem",
          fontWeight: 800,
          letterSpacing: "0.04em",
          transition: "background 0.2s ease, color 0.2s ease",
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <div
      role="group"
      aria-label={tr("Langue", "Language")}
      style={{
        display: "flex",
        gap: "2px",
        padding: "3px",
        borderRadius: "999px",
        background: "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.12)",
      }}
    >
      {btn("fr", "FR", "Afficher en français")}
      {btn("en", "EN", "Show in English")}
    </div>
  );
}
