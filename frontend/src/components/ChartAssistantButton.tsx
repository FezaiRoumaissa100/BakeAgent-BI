"use client";

import React from "react";

interface ChartAssistantButtonProps {
  chartType: string;
  chartData: Record<string, any>;
  chartName: string;
  userQuestion?: string;
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
  onOpenChat: (message: string, metadata: Record<string, any>) => void;
}

/* Petit bouton « poser une question sur ce graphique » :
   pastille verte pâle aux couleurs du tableau de bord (clair et sombre),
   qui passe au vert plein au survol. */
export function ChartAssistantButton({
  chartType,
  chartData,
  chartName,
  userQuestion = "Explique ce graphique",
  position = "top-right",
  onOpenChat,
}: ChartAssistantButtonProps) {
  const handleButtonClick = () => {
    const message = `@${chartName}\n${userQuestion}`;
    const metadata = {
      chart_type: chartType,
      chart_data: chartData,
      chart_name: chartName,
    };
    onOpenChat(message, metadata);
  };

  const pos: React.CSSProperties =
    position === "top-left" ? { top: 10, left: 10 }
    : position === "bottom-right" ? { bottom: 10, right: 10 }
    : position === "bottom-left" ? { bottom: 10, left: 10 }
    : { top: 10, right: 10 };

  return (
    <button
      type="button"
      onClick={handleButtonClick}
      className="chart-ask"
      style={pos}
      title="Poser une question sur ce graphique"
      aria-label="Poser une question sur ce graphique à l'assistant"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
        <path d="M5 3v4" />
        <path d="M3 5h4" />
      </svg>
    </button>
  );
}
