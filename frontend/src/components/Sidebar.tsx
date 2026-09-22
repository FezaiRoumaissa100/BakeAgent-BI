"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

const NAV_ITEMS = [
  { href: "/", label: "Vue du Jour", sub: "Synthèse quotidienne", icon: "🥐" },
  { href: "/performance", label: "Performance", sub: "Activité commerciale", icon: "📊" },
  { href: "/produits", label: "Produits", sub: "Pénétration, paniers", icon: "🥖" },
  { href: "/previsions", label: "Prévisions", sub: "Demande & 14 jours", icon: "📈" },
  { href: "/alertes", label: "Alertes & Stock", sub: "Vigilance & gestion", icon: "🔔" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="shrink-0 flex flex-col justify-between"
      style={{
        width: "290px",
        height: "100vh",
        position: "sticky",
        top: 0,
        background: "#1C1410", // INK
        borderRight: "1px solid rgba(232,115,74,0.15)",
        color: "#f2ede6",
      }}
    >
      <div>
        {/* Brand */}
        <div style={{ padding: "32px 28px 24px", display: "flex", alignItems: "center", gap: "14px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div
            style={{
              width: "44px",
              height: "44px",
              background: "#E8734A",
              borderRadius: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.3rem",
              boxShadow: "0 4px 12px rgba(232,115,74,0.3)"
            }}
          >
            🥐
          </div>
          <div>
            <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "white", letterSpacing: "-0.02em" }}>
              Le Croisic <span style={{ fontSize: "0.6rem", background: "rgba(232,115,74,0.2)", color: "#F0A882", padding: "2px 6px", borderRadius: "4px", verticalAlign: "middle", marginLeft: "4px" }}>BI</span>
            </div>
            <div style={{ fontSize: "0.75rem", color: "#9a8070", fontWeight: 500, marginTop: "2px" }}>
              Retail Intelligence
            </div>
          </div>
        </div>

        {/* Navigation list */}
        <nav style={{ padding: "24px 16px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ padding: "0 12px 12px", fontSize: "0.65rem", fontWeight: 700, color: "#7a6a5a", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Espaces de Travail
          </div>
          {NAV_ITEMS.map((item) => {
            const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "16px",
                  padding: "14px 16px",
                  borderRadius: "14px",
                  background: isActive ? "rgba(232,115,74,0.12)" : "transparent",
                  border: isActive ? "1px solid rgba(232,115,74,0.25)" : "1px solid transparent",
                  transition: "all 0.2s ease"
                }}
              >
                <div style={{ fontSize: "1.2rem", filter: isActive ? "none" : "grayscale(100%) opacity(60%)" }}>
                  {item.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: isActive ? 800 : 600, color: isActive ? "white" : "rgba(242,237,230,0.7)", transition: "color 0.2s" }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: "0.68rem", color: isActive ? "#F0A882" : "#9a8070", marginTop: "2px" }}>
                    {item.sub}
                  </div>
                </div>
                {isActive && (
                  <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#E8734A" }} />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer info in Sidebar */}
      <div style={{ padding: "24px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#639922", boxShadow: "0 0 8px rgba(99,153,34,0.5)" }} />
          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "rgba(242,237,230,0.85)" }}>FastAPI Actif</span>
        </div>
        <div style={{ fontSize: "0.7rem", color: "#9a8070", lineHeight: 1.4 }}>
          Base : retail_data.pkl<br/>
          Données 2024–2025
        </div>
      </div>
    </aside>
  );
}
