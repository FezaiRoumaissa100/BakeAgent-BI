"use client";

import React from "react";
import { usePathname } from "next/navigation";

// Fondu léger à chaque changement de page (désactivé si l'ordinateur demande moins d'animations).
export function PageFade({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="page-fade">
      {children}
    </div>
  );
}
