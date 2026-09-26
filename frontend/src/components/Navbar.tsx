"use client";

import { usePathname } from "next/navigation";
import React, { useState, useEffect } from "react";
import {
  IconAlert,
  IconSparkline,
  IconMapPin,
  IconCalendar,
} from "./Icons";
import { fetchDailyKPIs } from "@/lib/api";
import { siteConfig, formatTodayDate } from "@/lib/siteConfig";

export function Navbar() {
  const pathname = usePathname();
  const [alertsCount, setAlertsCount] = useState(0);
  const [todayLabel, setTodayLabel] = useState<string>("");

  useEffect(() => {
    setTodayLabel(formatTodayDate("fr-FR"));
  }, []);

  // Fetch alerts count for Vue du Jour page
  useEffect(() => {
    if (pathname === "/") {
      fetchDailyKPIs()
        .then((data) => {
          setAlertsCount(data.alerts_count || 0);
        })
        .catch(() => {
          setAlertsCount(0);
        });
    }
  }, [pathname]);

  return (
    <nav
      style={{
        height: "101px",
        background: "#1C1410",
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
        {/* Location + Bakery name */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "10px 14px",
            borderRadius: "14px",
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          <div
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "50%",
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.10)",
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
                color: "white",
                letterSpacing: "-0.02em",
                whiteSpace: "nowrap",
              }}
            >
              {siteConfig.bakeryName}
            </div>
            <div
              style={{
                fontSize: "0.68rem",
                color: "rgba(242,237,230,0.55)",
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
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
          className="hidden md:flex"
        >
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.10)",
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
                color: "rgba(242,237,230,0.65)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                lineHeight: 1,
                marginBottom: "3px",
              }}
            >
              Aujourd'hui
            </div>
            <div
              style={{
                fontSize: "0.85rem",
                fontWeight: 800,
                color: "white",
                whiteSpace: "nowrap",
                lineHeight: 1,
              }}
            >
              {todayLabel || "Chargement…"}
            </div>
          </div>
        </div>
      </div>

      {/* Right: Action Icons */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        {/* Alert Icon with badge */}
        <div style={{ position: "relative" }}>
          <button
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "all 0.2s ease"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.15)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.08)";
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
          </button>
          {alertsCount > 0 && (
            <div style={{
              position: "absolute",
              top: "-2px",
              right: "-2px",
              width: "18px",
              height: "18px",
              background: "#E8734A",
              borderRadius: "50%",
              color: "white",
              fontSize: "10px",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid #1C1410"
            }}>
              {alertsCount}
            </div>
          )}
        </div>
        
        {/* Chat/Copilot Icon */}
        <button
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "all 0.2s ease"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.15)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.08)";
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
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