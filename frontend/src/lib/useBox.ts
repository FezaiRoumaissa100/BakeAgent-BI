"use client";

// Taille réelle d'un graphique : les graphiques SVG dessinent à la taille de leur place à l'écran
// (largeur × hauteur mesurées), au lieu d'un format fixe réduit ou étiré. Le texte et les axes gardent
// ainsi leur taille réelle, quelle que soit la mise en page (carte pleine largeur ou à côté d'une autre).
import { useLayoutEffect, useRef, useState, RefObject } from "react";

export function useBox<T extends Element = SVGSVGElement>(defW: number, defH: number, existing?: RefObject<T | null>) {
  const own = useRef<T | null>(null);
  const ref = existing || own;
  const [size, setSize] = useState({ w: defW, h: defH });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r && r.width > 40 && r.height > 40) {
        const w = Math.round(r.width), h = Math.round(r.height);
        setSize((s) => (s.w === w && s.h === h ? s : { w, h }));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return [ref, size.w, size.h] as const;
}