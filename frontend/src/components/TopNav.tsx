"use client";

import { useEffect, useState } from "react";
import { IconMapPin, IconCalendar } from "./Icons";
import { siteConfig, formatTodayDate } from "@/lib/siteConfig";

const ORANGE = "#E8734A";

const NAV = [
  { id: "dashboard", label: "Vue du Jour", active: true },
  { id: "analytics", label: "Analytique", active: false },
  { id: "alerts", label: "Alertes", active: false },
];

export function TopNav({
  jour,
  date,
  variant = "hero",
}: {
  jour: string;
  date: string;
  variant?: "hero" | "light";
}) {
  const onHero = variant === "hero";
  const [todayLabel, setTodayLabel] = useState<string>("");

  useEffect(() => {
    setTodayLabel(formatTodayDate("fr-FR"));
  }, []);

  return (
    <header className="relative z-20 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-bold shrink-0"
          style={
            onHero
              ? {
                  background: "rgba(255,255,255,0.16)",
                  backdropFilter: "blur(16px)",
                  WebkitBackdropFilter: "blur(16px)",
                  border: "1px solid rgba(255,255,255,0.28)",
                  color: "white",
                }
              : {
                  background: "white",
                  border: "1px solid rgba(0,0,0,0.06)",
                  color: "#1C1410",
                  boxShadow: "0 4px 14px rgba(60,30,8,0.06)",
                }
          }
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center"
            style={{ background: "rgba(232,115,74,0.14)" }}
          >
            <IconMapPin size={15} color={ORANGE} strokeWidth={2.3} />
          </div>
          {siteConfig.bakeryName}
        </div>

        <nav
          className="hidden md:flex items-center gap-1 rounded-xl p-1"
          style={
            onHero
              ? {
                  background: "rgba(0,0,0,0.22)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(255,255,255,0.12)",
                }
              : {
                  background: "rgba(255,255,255,0.85)",
                  border: "1px solid rgba(0,0,0,0.06)",
                }
          }
        >
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              style={
                item.active
                  ? {
                      background: onHero ? "white" : "#1C1410",
                      color: onHero ? "#1C1410" : "white",
                    }
                  : {
                      color: onHero ? "rgba(255,255,255,0.75)" : "#9a8070",
                      background: "transparent",
                    }
              }
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      <div
        className="flex items-center gap-3 text-xs font-semibold shrink-0"
        style={{ color: onHero ? "rgba(255,255,255,0.85)" : "#5a4a3a" }}
      >
        <div className="hidden lg:flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
          style={
            onHero
              ? { background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }
              : { background: "rgba(232,115,74,0.06)", border: "1px solid rgba(232,115,74,0.15)" }
          }
        >
          <IconCalendar size={14} color={ORANGE} strokeWidth={2.2} />
          <span style={{ fontWeight: 700, color: onHero ? "white" : "#1C1410" }}>
            {todayLabel || "Chargement…"}
          </span>
        </div>
        <span className="hidden sm:inline">
          {jour} · {date}
        </span>
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold"
          style={
            onHero
              ? {
                  background: "rgba(255,255,255,0.2)",
                  border: "1px solid rgba(255,255,255,0.35)",
                  color: "white",
                }
              : {
                  background: ORANGE,
                  color: "white",
                }
          }
        >
          MD
        </div>
      </div>
    </header>
  );
}
