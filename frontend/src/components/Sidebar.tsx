"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import {
  IconSparkline, IconBarsGrouped, IconGrid, IconTrendUp, IconAlert
} from "./Icons";
import { siteConfig } from "@/lib/siteConfig";
import { tr } from "@/lib/i18n";

// Fonction (et non constante) : les libellés sont traduits au moment du rendu.
const getNavItems = () => [
  { href: "/",          label: tr("Vue du Jour", "Daily view"),     icon: <IconSparkline size={20} color="#fff" strokeWidth={2.1}/> },
  { href: "/performance",label: tr("Performance", "Performance"),   icon: <IconBarsGrouped size={20} color="#fff" strokeWidth={2.1}/> },
  { href: "/produits",  label: tr("Produits", "Products"),        icon: <IconGrid size={20} color="#fff" strokeWidth={2.1}/> },
  { href: "/previsions",label: tr("Prévisions", "Forecasts"),      icon: <IconTrendUp size={20} color="#fff" strokeWidth={2.1}/> },
  { href: "/alertes",   label: tr("Alertes & Stock", "Alerts & Stock"), icon: <IconAlert size={20} color="#fff" strokeWidth={2.1}/> },
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
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.3rem",
              boxShadow: "0 4px 12px rgba(232,115,74,0.3)"
            }}
          >
            <IconSparkline size={22} color="#fff" strokeWidth={2.4} />
          </div>
          <div>
            <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "white", letterSpacing: "-0.02em" }}>
              {tr("Tableau de Bord", "Dashboard")}
            </div>
          </div>
        </div>

        {/* Navigation list */}
        <nav style={{ padding: "24px 16px", display: "flex", flexDirection: "column", gap: "8px" }}>
          {getNavItems().map((item) => {
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
                <div style={{
                  display: "flex", alignItems:"center", justifyContent:"center",
                  width:"36px", height:"36px",
                  borderRadius:"50%",
                  background: isActive ? "rgba(232,115,74,0.22)" : "rgba(255,255,255,0.04)",
                  border: isActive ? "1px solid rgba(232,115,74,0.35)" : "1px solid rgba(255,255,255,0.05)",
                  opacity: isActive ? 1 : 0.72,
                  flexShrink:0
                }}>
                  {item.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: isActive ? 800 : 600, color: isActive ? "white" : "rgba(242,237,230,0.7)", transition: "color 0.2s" }}>
                    {item.label}
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
    </aside>
  );
}
