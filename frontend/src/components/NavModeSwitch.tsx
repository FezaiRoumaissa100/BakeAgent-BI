"use client";

import React, { useEffect, useState } from "react";
import { NavMode, getNavMode, setNavMode } from "@/lib/navMode";
import { tr } from "@/lib/i18n";

// Petit sélecteur discret en bas de l'écran : « Barre d'icônes » ou « Menu caché ».
// Il reste transparent et petit, et devient net au survol.
export function NavModeSwitch() {
  const [mode, setMode] = useState<NavMode>("rail");

  useEffect(() => {
    setMode(getNavMode());
  }, []);

  const choose = (m: NavMode) => {
    setMode(m);
    setNavMode(m);
    window.dispatchEvent(new Event("nav-change"));
  };

  return (
    <div className="nav-mode-switch" role="group" aria-label={tr("Affichage du menu", "Menu display")}>
      <button className={mode === "rail" ? "on" : ""} aria-pressed={mode === "rail"} onClick={() => choose("rail")}>
        {tr("Barre d'icônes", "Icon bar")}
      </button>
      <button className={mode === "hidden" ? "on" : ""} aria-pressed={mode === "hidden"} onClick={() => choose("hidden")}>
        {tr("Menu caché", "Hidden menu")}
      </button>
    </div>
  );
}
