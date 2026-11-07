"use client";

// Outils des graphiques (toutes les pages) : au survol d'une carte qui contient un graphique, trois petits boutons
// apparaissent en haut à droite, à côté du bouton ✦ de l'assistant :
//   ⤢ / ＋ : ouvre le graphique en grand dans une visionneuse (taille normale ou déjà zoomé), où l'on zoome et dézoome
//           (boutons － / ＋, molette, touches + / −) et où l'on se déplace en glissant ;
//   ⤓     : enregistre la carte (titre, graphique, légende) en image PNG ou en PDF.
// Bulle épinglée : un clic sur un point du graphique (barre, jour, part…) « photographie » la carte avec sa bulle
// de chiffres ; l'export PNG / PDF de cette carte reprend alors cette image. Une étiquette « Bulle épinglée ✕ » le rappelle.
// La bulle se retire avec ✕, Échap, un clic hors de la carte ou un changement de page. Sans clic, rien ne change.
// Rien n'est ajouté dans les pages elles-mêmes : la barre flotte au-dessus de la carte survolée, et la visionneuse
// montre une copie du graphique (le graphique de la page n'est jamais modifié).
// Pas de bibliothèque en plus : l'image est dessinée par le navigateur, le PDF est écrit à la main (une page, une image).

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { tr } from "@/lib/i18n";
import { siteConfig } from "@/lib/siteConfig";

const CARD = ".cc, .bc, .bento-card";
const MIN_W = 100, MIN_H = 60;
// Une carte « graphique » : elle a un bouton ✦ de l'assistant, ou une grande image SVG
const isChartCard = (c: Element) => !!c.querySelector(".chart-ask") || !!mainChart(c);

// Le graphique principal d'une carte : la plus grande image SVG (hors icônes)
function mainChart(card: Element): SVGSVGElement | null {
  let best: SVGSVGElement | null = null, area = 0;
  card.querySelectorAll("svg").forEach((s) => {
    if (s.parentElement?.closest("svg")) return;
    const r = s.getBoundingClientRect();
    if (r.width >= MIN_W && r.height >= MIN_H && r.width * r.height > area) { best = s as SVGSVGElement; area = r.width * r.height; }
  });
  return best;
}
// Titre de la carte : le texte propre du titre (sans les bulles d'aide qu'il contient)
function cardTitle(card: Element): string {
  const el = card.querySelector(".ct, h2, h3, .bento-title, .rep-head-t");
  if (!el) return tr("Graphique", "Chart");
  const own = Array.from(el.childNodes).filter((n) => n.nodeType === 3 || (n.nodeType === 1 && !(n as Element).querySelector("svg") && getComputedStyle(n as Element).position !== "absolute" && getComputedStyle(n as Element).display !== "none"))
    .map((n) => n.textContent || "").join("").replace(/\s+/g, " ").trim();
  return own || (el.textContent || "").trim() || tr("Graphique", "Chart");
}
const slug = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 60) || "graphique";

// ── Image de la carte : copie avec les styles calculés, dessinée dans un SVG (foreignObject) puis dans un canevas ──
const PROPS = ["display", "position", "top", "right", "bottom", "left", "z-index", "box-sizing", "width", "height", "min-width", "min-height", "max-width", "max-height",
  "margin-top", "margin-right", "margin-bottom", "margin-left", "padding-top", "padding-right", "padding-bottom", "padding-left",
  "border-top", "border-right", "border-bottom", "border-left", "border-radius", "background-color", "background-image", "background-size", "background-position", "background-repeat",
  "color", "font-family", "font-size", "font-weight", "font-style", "line-height", "letter-spacing", "text-align", "text-transform", "text-decoration-line", "white-space", "text-overflow",
  "overflow-x", "overflow-y", "opacity", "box-shadow", "flex-direction", "flex-wrap", "flex-grow", "flex-shrink", "flex-basis", "align-items", "align-self", "justify-content", "justify-items",
  "gap", "row-gap", "column-gap", "grid-template-columns", "grid-template-rows", "grid-column-start", "grid-column-end", "grid-row-start", "grid-row-end", "order", "vertical-align",
  "list-style-type", "transform", "transform-origin", "visibility", "object-fit",
  "fill", "fill-opacity", "stroke", "stroke-width", "stroke-opacity", "stroke-dasharray", "stroke-linecap", "stroke-linejoin", "font-variant-numeric", "text-anchor", "dominant-baseline"];

function inlineStyles(src: Element, dst: Element) {
  const cs = getComputedStyle(src);
  let txt = "";
  for (const p of PROPS) { const v = cs.getPropertyValue(p); if (v) txt += `${p}:${v};`; }
  // pas d'animation ni de transition dans l'image
  txt += "animation:none;transition:none;";
  (dst as HTMLElement).setAttribute("style", txt);
  // Première lettre en majuscule faite en CSS (::first-letter) : on l'écrit dans le texte de la copie
  try {
    if (getComputedStyle(src, "::first-letter").textTransform === "uppercase") {
      const tn = Array.from(dst.childNodes).find((n) => n.nodeType === 3 && /\S/.test(n.nodeValue || "")) as Text | undefined;
      if (tn) tn.nodeValue = (tn.nodeValue || "").replace(/^(\s*)(\S)/, (_m, sp, ch) => sp + ch.toUpperCase());
    }
  } catch { /* navigateur sans ::first-letter calculé */ }
  const a = src.children, b = dst.children;
  for (let i = 0; i < a.length && i < b.length; i++) inlineStyles(a[i], b[i]);
}

// Polices du tableau de bord, intégrées dans l'image (sinon le navigateur prend une police standard, un peu plus large)
let fontCss: Promise<string> | null = null;
function embeddedFonts(): Promise<string> {
  if (fontCss) return fontCss;
  fontCss = (async () => {
    const rules: { family: string; css: string; url: string }[] = [];
    for (const sh of Array.from(document.styleSheets)) {
      let list: CSSRuleList | null = null;
      try { list = sh.cssRules; } catch { continue; }          // feuille d'un autre site : illisible, ignorée
      for (const r of Array.from(list || [])) {
        if (!(r instanceof CSSFontFaceRule)) continue;
        const src = r.style.getPropertyValue("src");
        const m = src.match(/url\(["']?([^"')]+\.woff2[^"')]*)["']?\)/) || src.match(/url\(["']?([^"')]+)["']?\)/);
        if (!m) continue;
        rules.push({ family: r.style.getPropertyValue("font-family").replace(/["']/g, "").trim(), css: r.cssText, url: new URL(m[1], sh.href || location.href).href });
      }
    }
    // seulement les polices utilisées dans les pages (Next.js ajoute aussi des variantes inutilisées)
    const used = getComputedStyle(document.body).fontFamily + "," + getComputedStyle(document.querySelector("h1") || document.body).fontFamily;
    const out: string[] = [];
    for (const r of rules.filter((x) => used.includes(x.family)).slice(0, 12)) {
      try {
        const blob = await (await fetch(r.url)).blob();
        const data: string = await new Promise((ok) => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result)); fr.readAsDataURL(blob); });
        out.push(r.css.replace(/src:[^;]+;/, `src: url(${data});`));
      } catch { /* police introuvable : police standard */ }
    }
    return out.join("\n");
  })();
  return fontCss;
}

async function cardCanvas(card: HTMLElement, scale = 2): Promise<HTMLCanvasElement> {
  const r = card.getBoundingClientRect();
  const W = Math.ceil(r.width), H = Math.ceil(r.height);
  const clone = card.cloneNode(true) as HTMLElement;
  inlineStyles(card, clone);
  // sans le bouton de l'assistant, et posée à plat
  clone.querySelectorAll(".chart-ask").forEach((e) => e.remove());
  clone.style.margin = "0"; clone.style.transform = "none"; clone.style.width = W + "px"; clone.style.height = H + "px";
  clone.querySelectorAll("img").forEach((img) => img.remove());     // images externes : non autorisées dans l'image
  const bg = getComputedStyle(document.body).backgroundColor || "#fff";
  const xml = new XMLSerializer().serializeToString(clone);
  const fonts = await embeddedFonts().catch(() => "");
  const pad = 24;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W + pad * 2}" height="${H + pad * 2}">${fonts ? `<defs><style>${fonts.replace(/</g, "")}</style></defs>` : ""}<rect width="100%" height="100%" fill="${bg}"/><foreignObject x="${pad}" y="${pad}" width="${W}" height="${H}">${xml}</foreignObject></svg>`;
  const img = new Image();
  img.decoding = "sync";
  const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  await new Promise<void>((ok, ko) => { img.onload = () => ok(); img.onerror = () => ko(new Error("image")); img.src = url; });
  const c = document.createElement("canvas");
  c.width = (W + pad * 2) * scale; c.height = (H + pad * 2) * scale;
  const g = c.getContext("2d")!;
  g.scale(scale, scale);
  g.drawImage(img, 0, 0);
  return c;
}

function download(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// PDF d'une page contenant une image JPEG (écrit à la main : pas de bibliothèque à installer)
function pdfFromJpeg(jpeg: Uint8Array, wPx: number, hPx: number, title: string): Blob {
  const k = 0.75 / 2;                          // canevas en ×2 → points PDF
  const w = Math.round(wPx * k), h = Math.round(hPx * k);
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let len = 0;
  const push = (x: string | Uint8Array) => { const b = typeof x === "string" ? enc.encode(x) : x; parts.push(b); len += b.length; };
  const obj = (n: number, body: (string | Uint8Array)[]) => { offsets[n] = len; push(`${n} 0 obj\n`); body.forEach(push); push("\nendobj\n"); };
  const esc = (t: string) => t.replace(/[\\()]/g, "\\$&").replace(/[^\x20-\x7e]/g, "?");
  push("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n");
  obj(1, ["<< /Type /Catalog /Pages 2 0 R >>"]);
  obj(2, ["<< /Type /Pages /Kids [3 0 R] /Count 1 >>"]);
  obj(3, [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`]);
  obj(4, [`<< /Type /XObject /Subtype /Image /Width ${wPx} /Height ${hPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`, jpeg, "\nendstream"]);
  const content = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`;
  obj(5, [`<< /Length ${content.length} >>\nstream\n${content}\nendstream`]);
  obj(6, [`<< /Title (${esc(title)}) /Producer (${esc(siteConfig.productName)}) >>`]);
  const xref = len;
  push(`xref\n0 7\n0000000000 65535 f \n${offsets.slice(1).map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("")}`);
  push(`trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(parts as BlobPart[], { type: "application/pdf" });
}

// snap : image déjà prise (bulle épinglée) ; sinon la carte est photographiée maintenant
async function exportCard(card: HTMLElement, kind: "png" | "pdf", snap?: HTMLCanvasElement | null) {
  const title = cardTitle(card);
  const name = `${slug(siteConfig.bakeryName || siteConfig.productName)}-${slug(title)}-${new Date().toISOString().slice(0, 10)}`;
  const canvas = snap || await cardCanvas(card);
  if (kind === "png") {
    const blob: Blob | null = await new Promise((ok) => canvas.toBlob(ok, "image/png"));
    if (blob) download(blob, name + ".png");
    return;
  }
  const blob: Blob | null = await new Promise((ok) => canvas.toBlob(ok, "image/jpeg", 0.95));
  if (!blob) return;
  const jpeg = new Uint8Array(await blob.arrayBuffer());
  download(pdfFromJpeg(jpeg, canvas.width, canvas.height, title), name + ".pdf");
}

// Une bulle de chiffres est-elle affichée dans la carte (survol) ?
function bubbleShown(card: Element): boolean {
  return Array.from(card.querySelectorAll<HTMLElement>(".ch-tip, [class*='tip']:not(.side-tip):not(.al-info-tip), [class*='group-hover:opacity-100']")).some((t) => {
    if (t.closest(".chart-ask")) return false;
    const cs = getComputedStyle(t), r = t.getBoundingClientRect();
    return cs.display !== "none" && cs.visibility !== "hidden" && parseFloat(cs.opacity || "1") > 0.2 && r.width > 20 && r.height > 12;
  });
}
// Les clics sur les commandes (boutons, listes, liens…) ne servent pas à épingler
const CONTROL = "button, a, input, select, textarea, label, summary, .chart-ask, [role='tab'], [role='button']";

// ── Icônes ──
const Ic = ({ d }: { d: React.ReactNode }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);
const ZOOM_IN = <><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2M11 8.5v5M8.5 11h5" /></>;
const ZOOM_OUT = <><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2M8.5 11h5" /></>;
const EXPAND = <><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" /></>;
const PIN = <><path d="M9 4h6l-1 6 3 3H7l3-3-1-6z" /><path d="M12 13v7" /></>;
const PIN_SMALL = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginRight: 4 }}><path d="M9 4h6l-1 6 3 3H7l3-3-1-6z" /><path d="M12 13v7" /></svg>;
const DOWNLOAD = <><path d="M12 4v11M7 10.5l5 5 5-5" /><path d="M5 20h14" /></>;

// ── Visionneuse : le graphique en grand, zoom et déplacement ──
function Viewer({ card, startZoom, onClose, snap }: { card: HTMLElement; startZoom: number; onClose: () => void; snap?: HTMLCanvasElement | null }) {
  const stage = useRef<HTMLDivElement>(null);
  const holder = useRef<HTMLDivElement>(null);
  const [z, setZ] = useState(startZoom);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const title = cardTitle(card);

  // Copie du graphique (la carte de la page n'est pas touchée). Graphique fait en HTML (barres en blocs) : copie de la carte entière.
  useEffect(() => {
    const src = mainChart(card);
    if (!holder.current) return;
    if (!src) {
      const r = card.getBoundingClientRect();
      const c = card.cloneNode(true) as HTMLElement;
      c.querySelectorAll(".chart-ask").forEach((e) => e.remove());
      c.removeAttribute("data-rv");
      c.style.width = Math.round(r.width) + "px"; c.style.margin = "0"; c.style.boxShadow = "none"; c.style.animation = "none"; c.style.transform = "none";
      const wrap = document.createElement("div");
      wrap.className = "cv-html";
      wrap.appendChild(c);
      holder.current.innerHTML = "";
      holder.current.appendChild(wrap);
      return;
    }
    const r = src.getBoundingClientRect();
    const c = src.cloneNode(true) as SVGSVGElement;
    if (!c.getAttribute("viewBox")) c.setAttribute("viewBox", `0 0 ${Math.round(r.width)} ${Math.round(r.height)}`);
    c.removeAttribute("width"); c.removeAttribute("height");
    c.setAttribute("preserveAspectRatio", "xMidYMid meet");
    c.style.width = "100%"; c.style.height = "100%"; c.style.maxWidth = "none"; c.style.cursor = "inherit";
    c.style.removeProperty("mask-image"); c.style.removeProperty("-webkit-mask-image");
    holder.current.innerHTML = "";
    holder.current.appendChild(c);
  }, [card]);

  const clampZ = (v: number) => Math.min(6, Math.max(0.5, Math.round(v * 100) / 100));
  const zoomBy = useCallback((f: number) => setZ((v) => { const n = clampZ(v * f); if (n <= 1) setPos({ x: 0, y: 0 }); return n; }), []);
  const reset = () => { setZ(1); setPos({ x: 0, y: 0 }); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "+" || e.key === "=") zoomBy(1.25);
      else if (e.key === "-") zoomBy(0.8);
      else if (e.key === "0") reset();
    };
    window.addEventListener("keydown", onKey);
    const el = stage.current;
    const onWheel = (e: WheelEvent) => { e.preventDefault(); zoomBy(e.deltaY < 0 ? 1.12 : 0.89); };
    el?.addEventListener("wheel", onWheel, { passive: false });
    document.documentElement.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); el?.removeEventListener("wheel", onWheel); document.documentElement.style.overflow = ""; };
  }, [onClose, zoomBy]);

  const exp = async (kind: "png" | "pdf") => {
    setBusy(kind);
    try { await exportCard(card, kind, snap); } catch { /* le navigateur a refusé l'image */ } finally { setBusy(null); }
  };

  return createPortal(
    <div className="cv-veil" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} role="dialog" aria-modal="true" aria-label={title}>
      <div className="cv-box">
        <div className="cv-head">
          <b>{title}</b>
          <div className="cv-tools">
            <button type="button" onClick={() => zoomBy(0.8)} disabled={z <= 0.5} title={tr("Dézoomer (−)", "Zoom out (−)")} aria-label={tr("Dézoomer", "Zoom out")}><Ic d={ZOOM_OUT} /></button>
            <button type="button" className="cv-pct num" onClick={reset} title={tr("Taille normale (0)", "Normal size (0)")}>{Math.round(z * 100)} %</button>
            <button type="button" onClick={() => zoomBy(1.25)} disabled={z >= 6} title={tr("Zoomer (+)", "Zoom in (+)")} aria-label={tr("Zoomer", "Zoom in")}><Ic d={ZOOM_IN} /></button>
            <span className="cv-sep" />
            <button type="button" className="cv-txt" onClick={() => exp("png")} disabled={!!busy} title={snap ? tr("Avec la bulle épinglée", "With the pinned bubble") : undefined}>{busy === "png" ? "…" : snap ? <>{PIN_SMALL}PNG</> : "PNG"}</button>
            <button type="button" className="cv-txt" onClick={() => exp("pdf")} disabled={!!busy} title={snap ? tr("Avec la bulle épinglée", "With the pinned bubble") : undefined}>{busy === "pdf" ? "…" : snap ? <>{PIN_SMALL}PDF</> : "PDF"}</button>
            <span className="cv-sep" />
            <button type="button" onClick={onClose} title={tr("Fermer (Échap)", "Close (Esc)")} aria-label={tr("Fermer", "Close")}><Ic d={<path d="M6 6l12 12M18 6L6 18" />} /></button>
          </div>
        </div>
        <div ref={stage} className={`cv-stage${z > 1 ? " can-pan" : ""}${drag.current ? " panning" : ""}`}
          onPointerDown={(e) => { if (z <= 1) return; (e.target as Element).setPointerCapture?.(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y }; }}
          onPointerMove={(e) => { const d = drag.current; if (!d) return; setPos({ x: d.px + (e.clientX - d.x), y: d.py + (e.clientY - d.y) }); }}
          onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
          onDoubleClick={() => (z > 1 ? reset() : zoomBy(2))}>
          <div ref={holder} className="cv-chart" style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${z})` }} />
        </div>
        <div className="cv-hint">{tr("Molette ou + / − pour zoomer · glisser pour se déplacer · double-clic pour revenir", "Wheel or + / − to zoom · drag to move · double-click to reset")}</div>
      </div>
    </div>,
    document.body,
  );
}

// ── La barre de boutons, au survol des cartes ──
export function ChartTools() {
  const [card, setCard] = useState<HTMLElement | null>(null);
  const [box, setBox] = useState<{ top: number; right: number } | null>(null);
  const [menu, setMenu] = useState(false);
  const [viewer, setViewer] = useState<{ card: HTMLElement; zoom: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const bar = useRef<HTMLDivElement>(null);
  const hideT = useRef<number>(0);
  const pathname = usePathname();
  // Bulle épinglée : la carte, et son image prise au moment du clic
  const [pinned, setPinned] = useState<{ card: HTMLElement; snap: HTMLCanvasElement } | null>(null);
  const [pinBox, setPinBox] = useState<{ top: number; right: number } | null>(null);
  const pinRef = useRef(pinned);
  pinRef.current = pinned;
  const unpin = useCallback(() => {
    pinRef.current?.card.removeAttribute("data-pinned");
    setPinned(null);
  }, []);

  const place = useCallback((c: HTMLElement | null) => {
    if (!c || !c.isConnected) { setBox(null); return; }
    const r = c.getBoundingClientRect();
    const ask = Array.from(c.querySelectorAll<HTMLElement>(".chart-ask")).find((a) => {
      const ar = a.getBoundingClientRect();
      return ar.top - r.top < 30 && r.right - ar.right < 30;     // bouton ✦ en haut à droite
    });
    setBox({ top: r.top + 10, right: window.innerWidth - r.right + (ask ? 42 : 10) });
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const t = e.target as Element | null;
      if (!t || bar.current?.contains(t)) { window.clearTimeout(hideT.current); return; }
      const c = t.closest?.(CARD) as HTMLElement | null;
      // la carte la plus extérieure qui contient un graphique
      let target: HTMLElement | null = null;
      for (let el: HTMLElement | null = c; el; el = (el.parentElement?.closest(CARD) as HTMLElement | null)) if (isChartCard(el)) target = el;
      if (target) {
        window.clearTimeout(hideT.current);
        setCard((prev) => { if (prev !== target) { setMenu(false); place(target); } return target; });
      } else {
        window.clearTimeout(hideT.current);
        hideT.current = window.setTimeout(() => { setCard(null); setMenu(false); }, 250);
      }
    };
    document.addEventListener("pointermove", onMove, { passive: true });
    return () => document.removeEventListener("pointermove", onMove);
  }, [place]);

  // Épingler : clic sur un point du graphique pendant qu'une bulle est affichée.
  // La photo est prise AVANT que le graphique réagisse au clic (phase de capture), donc avec la bulle survolée.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const t = e.target as Element | null;
      if (!t || t.closest(".ct-bar, .ct-pin, .cv-veil")) return;
      let target: HTMLElement | null = null;
      for (let el = t.closest?.(CARD) as HTMLElement | null; el; el = (el.parentElement?.closest(CARD) as HTMLElement | null)) if (isChartCard(el)) target = el;
      if (!target) { if (pinRef.current) unpin(); return; }                       // clic hors des graphiques
      if (t.closest(CONTROL)) return;
      if (!bubbleShown(target)) return;
      const card = target;
      cardCanvas(card).then((snap) => {
        pinRef.current?.card.removeAttribute("data-pinned");
        card.setAttribute("data-pinned", "");
        setPinned({ card, snap });
      }).catch(() => { /* image refusée : pas d'épingle */ });
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && pinRef.current && !document.querySelector(".cv-veil")) unpin(); };
    document.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown, true); window.removeEventListener("keydown", onKey); };
  }, [unpin]);

  // Changement de page : on retire la bulle
  useEffect(() => { unpin(); }, [pathname, unpin]);

  // L'étiquette « Bulle épinglée » suit sa carte ; si la carte disparaît (autre onglet), la bulle est retirée
  useEffect(() => {
    if (!pinned) { setPinBox(null); return; }
    let raf = 0;
    const f = () => {
      raf = 0;
      if (!pinned.card.isConnected) { unpin(); return; }
      const r = pinned.card.getBoundingClientRect();
      const ask = pinned.card.querySelector(".chart-ask");
      setPinBox({ top: r.top + 10, right: window.innerWidth - r.right + (ask ? 42 : 10) + 3 * 30 + 4 });
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(f); };
    f();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    const iv = window.setInterval(on, 700);
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", on); window.clearInterval(iv); cancelAnimationFrame(raf); };
  }, [pinned, unpin]);

  // La barre suit la carte quand la page défile
  useEffect(() => {
    if (!card) return;
    const f = () => place(card);
    f();
    window.addEventListener("scroll", f, { passive: true });
    window.addEventListener("resize", f);
    return () => { window.removeEventListener("scroll", f); window.removeEventListener("resize", f); };
  }, [card, place]);

  const exp = async (kind: "png" | "pdf") => {
    if (!card) return;
    setBusy(true);
    const snap = pinned && pinned.card === card ? pinned.snap : null;
    try { await exportCard(card, kind, snap); } catch { /* le navigateur a refusé l'image */ } finally { setBusy(false); setMenu(false); }
  };

  return (
    <>
      {card && box && !viewer && createPortal(
        <div ref={bar} className="ct-bar" style={{ top: box.top, right: box.right }} onMouseEnter={() => window.clearTimeout(hideT.current)}>
          <button type="button" onClick={() => setViewer({ card, zoom: 1 })} title={tr("Voir en grand", "Open large")} aria-label={tr("Voir en grand", "Open large")}><Ic d={EXPAND} /></button>
          <button type="button" onClick={() => setViewer({ card, zoom: 1.6 })} title={tr("Zoomer", "Zoom in")} aria-label={tr("Zoomer", "Zoom in")}><Ic d={ZOOM_IN} /></button>
          <button type="button" className={menu ? "on" : ""} onClick={() => setMenu((v) => !v)} title={tr("Enregistrer (PNG ou PDF)", "Save (PNG or PDF)")} aria-label={tr("Enregistrer", "Save")} aria-expanded={menu}><Ic d={DOWNLOAD} /></button>
          {menu && (
            <div className="ct-menu" role="menu">
              {pinned?.card === card && <div className="ct-menu-note">{PIN_SMALL}{tr("Avec la bulle épinglée", "With the pinned bubble")}</div>}
              <button type="button" role="menuitem" onClick={() => exp("png")} disabled={busy}>{tr("Image PNG", "PNG image")}</button>
              <button type="button" role="menuitem" onClick={() => exp("pdf")} disabled={busy}>{tr("Document PDF", "PDF document")}</button>
            </div>
          )}
        </div>, document.body)}
      {pinned && pinBox && !viewer && createPortal(
        <div className="ct-pin" style={{ top: pinBox.top, right: pinBox.right }} role="status">
          <Ic d={PIN} />
          <span>{tr("Bulle épinglée", "Bubble pinned")}</span>
          <button type="button" onClick={unpin} title={tr("Retirer la bulle (Échap)", "Remove the bubble (Esc)")} aria-label={tr("Retirer la bulle", "Remove the bubble")}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>, document.body)}
      {viewer && <Viewer card={viewer.card} startZoom={viewer.zoom} onClose={() => setViewer(null)} snap={pinned && pinned.card === viewer.card ? pinned.snap : null} />}
    </>
  );
}
