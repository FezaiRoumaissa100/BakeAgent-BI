"use client";
import { HourlyData } from "@/types/kpis";
import { useEffect, useRef } from "react";

const ORANGE = "var(--ch-1, #2E7D4F)";
const PEACH  = "var(--ch-soft, #8EB08A)";
const LIGHT  = "var(--dk-accent-pale, #D6E1D3)";
const MUTED  = "var(--dk-muted, #6E756F)";

// Le canvas ne comprend pas var(--x) : on lit la vraie couleur du thème (clair ou sombre)
function resolveColor(c: string): string {
  const m = /^var\((--[\w-]+)(?:,\s*([^)]+))?\)$/.exec(c.trim());
  if (!m || typeof window === "undefined") return c;
  const v = getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim();
  return v || (m[2] || "#2E7D4F").trim();
}

function sparkline(canvas: HTMLCanvasElement, data: number[], colorIn: string) {
  const color = resolveColor(colorIn);
  const ctx = canvas.getContext("2d");
  if (!ctx || data.length < 2) return;
  const w = canvas.width, h = canvas.height;
  const max = Math.max(...data) || 1;
  ctx.clearRect(0, 0, w, h);
  ctx.beginPath();
  data.forEach((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - (v / max) * h * 0.85;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;
  ctx.stroke();
  // fill under
  ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = color;
  ctx.fill();
  ctx.globalAlpha = 1;
}

interface Props {
  data: HourlyData[];
  type: "ca" | "qte" | "tkt" | "panier_h";
  color?: string;
  height?: number;
  showAxes?: boolean;
}

export default function MiniChart({ data, type, color = ORANGE, height = 60, showAxes = false }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const values = data.map(d => Number(d[type]) || 0);

  useEffect(() => {
    if (ref.current) {
      ref.current.width  = ref.current.offsetWidth;
      ref.current.height = height;
      sparkline(ref.current, values, color);
    }
  }, [values, color, height]);

  if (!showAxes) {
    return <canvas ref={ref} className="w-full" style={{ height }} />;
  }

  const max = Math.max(...values, 1);
  const labels = data.map(d => d.heure);

  return (
    <div className="relative w-full" style={{ height: height + 24 }}>
      <canvas ref={ref} className="absolute inset-x-0 top-0 w-full" style={{ height }} />
      <div className="absolute bottom-0 left-0 right-0 flex justify-between">
        {labels.filter((_, i) => i % Math.ceil(labels.length / 5) === 0).map((l, i) => (
          <span key={i} className="text-[9px]" style={{ color: MUTED }}>{l}</span>
        ))}
      </div>
    </div>
  );
}
