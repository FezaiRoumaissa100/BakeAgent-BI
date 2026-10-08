"use client";

import { usePathname } from "next/navigation";
import React, { useState, useEffect } from "react";
import {
  IconAlert,
  IconSparkline,
  IconMapPin,
  IconCalendar,
} from "./Icons";
import { siteConfig } from "@/lib/siteConfig";
import { t } from "@/lib/texts";
import { tr } from "@/lib/i18n";
import { ThemeToggle } from "./ThemeToggle";
import { LangToggle } from "./LangToggle";
import { toggleSidebar } from "./Sidebar";

export function Navbar() {
  // Compteur d'alertes masqué : le backend renvoie aujourd'hui une valeur fixe (5).
  // À réactiver quand le backend calculera le nombre réel d'alertes.

  return (
    <nav
      style={{
        height: "101px",
        background: "var(--dk-chrome-bg, #FFFFFF)", // blanc en mode clair, brun en mode sombre
        borderBottom: "1px solid rgba(232,115,74,0.15)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        position: "sticky",
        top: 0,
        zIndex: 50,
        gap: "24px",
      }}
    >
      {/* Left: Location + Bakery name + Today date */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "20px",
          minWidth: 0,
          flexShrink: 0,
        }}
      >
        {/* Logo visible seulement en mode « menu caché » : ouvre le menu */}
        <button className="nav-float-logo" onClick={toggleSidebar} aria-label={tr("Ouvrir le menu", "Open menu")} title={tr("Ouvrir le menu", "Open menu")}>
          <IconSparkline size={22} color="#fff" strokeWidth={2.4} />
        </button>

        {/* Location + Bakery name */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "10px 14px",
            borderRadius: "14px",
            background: "var(--dk-chrome-chip, #FBF6F0)",
            border: "1px solid var(--dk-chrome-chip-line, #EADFD3)",
          }}
        >
          <div
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "50%",
              background: "var(--dk-chrome-chip, #FBF6F0)",
              border: "1px solid var(--dk-chrome-chip-line, #EADFD3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <IconMapPin size={17} color="#E8734A" strokeWidth={2.2} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: "0.9rem",
                fontWeight: 800,
                color: "var(--dk-chrome-ink, #1C1410)",
                letterSpacing: "-0.02em",
                whiteSpace: "nowrap",
              }}
            >
              {siteConfig.bakeryName}
            </div>
            <div
              style={{
                fontSize: "0.68rem",
                color: "var(--dk-chrome-muted, #9a8070)",
                fontWeight: 500,
                marginTop: "1px",
              }}
            >
              {siteConfig.bakeryLocation}
            </div>
          </div>
        </div>

        {/* Today date */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "9px",
            padding: "10px 14px",
            borderRadius: "14px",
            background: "var(--dk-chrome-chip, #FBF6F0)",
            border: "1px solid var(--dk-chrome-chip-line, #EADFD3)",
          }}
          className="hidden md:flex"
        >
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              background: "var(--dk-chrome-chip, #FBF6F0)",
              border: "1px solid var(--dk-chrome-chip-line, #EADFD3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <IconCalendar size={16} color="#E8734A" strokeWidth={2.2} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: "0.72rem",
                fontWeight: 700,
                color: "var(--dk-chrome-muted, #9a8070)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                lineHeight: 1,
                marginBottom: "3px",
              }}
            >
              {t.header.dataLabel}
            </div>
            <div
              style={{
                fontSize: "0.85rem",
                fontWeight: 800,
                color: "var(--dk-chrome-ink, #1C1410)",
                whiteSpace: "nowrap",
                lineHeight: 1,
              }}
            >
              {t.header.from} {siteConfig.dataStartLabel} {t.header.to} {siteConfig.dataEndLabel}
            </div>
          </div>
        </div>
      </div>

      {/* Right: Action Icons */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        {/* Langue : FR | EN */}
        <LangToggle />

        {/* Bouton soleil / lune : mode clair ou sombre */}
        <ThemeToggle />

        {/* Alert Icon with badge */}
        <div style={{ position: "relative" }}>
          <button
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
              transition: "all 0.2s ease"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--dk-chrome-hover, #F3E9DE)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--dk-chrome-chip, #FBF6F0)";
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
          </button>
        </div>
        
        {/* Chat/Copilot Icon */}
        <button
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
            transition: "all 0.2s ease"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--dk-chrome-hover, #F3E9DE)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--dk-chrome-chip, #FBF6F0)";
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
            <path d="M5 3v4" />
            <path d="M19 17v4" />
            <path d="M3 5h4" />
            <path d="M17 19h4" />
          </svg>
        </button>
      </div>
    </nav>
  );
}