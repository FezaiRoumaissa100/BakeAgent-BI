"use client";
import { HourlyData } from "@/types/kpis";
import { useEffect, useRef } from "react";

const ORANGE = "#E8734A";
const PEACH  = "#F0A882";
const LIGHT  = "#FAD4C4";
const MUTED  = "#9a8070";

function sparkline(canvas: HTMLCanvasElement, data: number[], color: string) {
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
  ctx.fillStyle = color.replace(")", ", 0.12)").replace("rgb", "rgba");
  ctx.fill();
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
