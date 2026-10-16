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

  const getPositionStyles = () => {
    switch (position) {
      case "top-right":
        return { top: "4px", right: "4px" };
      case "top-left":
        return { top: "4px", left: "4px" };
      case "bottom-right":
        return { bottom: "4px", right: "4px" };
      case "bottom-left":
        return { bottom: "4px", left: "4px" };
      default:
        return { top: "4px", right: "4px" };
    }
  };

  return (
    <>
      {/* NOUVELLE VERSION: Simple icône sans fond */}
      <button
        onClick={handleButtonClick}
        style={{
          position: "absolute",
          ...getPositionStyles(),
          background: "transparent",
          border: "none",
          padding: "8px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.2s",
          zIndex: 50,
          pointerEvents: "auto",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.15)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
        }}
        title="Poser une question sur ce graphique"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#E8734A"
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

      {/* ANCIENNE VERSION (bouton avec fond) - COMMENTÉE POUR RÉSERVE */}
      {/*
      <button
        onClick={handleButtonClick}
        style={{
          position: "absolute",
          ...getPositionStyles(),
          width: "36px",
          height: "36px",
          borderRadius: "8px",
          border: "none",
          background: "var(--dk-chrome-chip, #FBF6F0)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.2s",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
          zIndex: 50,
          pointerEvents: "auto",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--dk-chrome-hover, #F3E9DE)";
          e.currentTarget.style.transform = "scale(1.05)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "var(--dk-chrome-chip, #FBF6F0)";
          e.currentTarget.style.transform = "scale(1)";
        }}
        title="Poser une question sur ce graphique"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#E8734A"
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
      */}
    </>
  );
}
