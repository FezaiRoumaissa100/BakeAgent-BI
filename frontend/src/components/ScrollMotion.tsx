"use client";

// Animations au défilement (toutes les pages) :
//  1. Les cartes arrivent quand on les atteint : elles montent un peu, passent du flou au net et prennent leur taille,
//     les unes après les autres (effet de vague). Une seule fois : remonter la page ne les rejoue pas.
//  2. Puis leur contenu s'anime : les barres poussent, les courbes se dessinent de gauche à droite,
//     les anneaux se remplissent comme une horloge, les points apparaissent, les grands chiffres défilent jusqu'à leur valeur.
//  3. La barre d'onglets (Performance, Produits) reste en haut de l'écran, en version fine, quand on descend.
//  4. Un bouton « Haut de page » apparaît en bas à droite après un long défilement.
// Tout est coupé si l'ordinateur demande moins d'animations (réglage d'accessibilité) : la page s'affiche telle quelle,
// la barre d'onglets reste en haut, et le bouton remonte d'un coup.
// Rien ne ralentit les données : les chiffres arrivent aussi vite qu'avant, l'animation se joue pendant qu'on lit.

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { tr } from "@/lib/i18n";

// Les cartes du tableau de bord (la plus extérieure seulement est animée)
const CARD = ".cc, .bc, .band, .kpi-strip, .kpi, .rep-tile, .rep-keep, .rep-head, .fc-sum, .story, .bento-card, .al-today, .al-w, .al-season";
const EASE = "cubic-bezier(.2,.7,.2,1)";
// Flou à l'arrivée des cartes (léger, et seulement pendant l'animation). Mettre false pour le retirer.
const BLUR = true;
const STICK_TOP = 76;  // la barre d'onglets se colle à 76 px du haut (sous la barre du haut de 68 px) : même valeur que .tabs-sticky dans globals.css

const reduceMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// ── Grands chiffres : défilement jusqu'à la valeur ───────────────────────────────
// Le texte doit être un seul nombre, avec ce qu'on veut autour : « 18 140 € », « 846,2 k€ », « +3,8 % », « 6,42 € ».
const NUM_RE = /^(\D*?)(-?\d{1,3}(?:[   ,]\d{3})+|-?\d+)([.,]\d+)?(\D*)$/;

function countUp(node: Text, delay: number) {
  const orig = node.nodeValue || "";
  const m = orig.match(NUM_RE);
  if (!m) return;
  const [, pre, intPart, decPart = "", post] = m;
  const sepMatch = intPart.match(/[   ,]/);
  // « 2025 » seul (une année) : on ne le fait pas défiler
  const digits = intPart.replace(/[^\d]/g, "");
  if (!sepMatch && !decPart && digits.length === 4 && +digits >= 1900 && +digits <= 2100) return;
  if (sepMatch && sepMatch[0] === "," && decPart.startsWith(",")) return;   // format ambigu : on laisse tel quel
  const sep = sepMatch ? sepMatch[0] : "";
  const decSep = decPart ? decPart[0] : "";
  const decimals = decPart ? decPart.length - 1 : 0;
  const neg = intPart.trim().startsWith("-");
  const target = parseFloat(digits + (decimals ? "." + decPart.slice(1) : "")) * (neg ? -1 : 1);
  if (!isFinite(target) || target === 0) return;
  const fmt = (v: number) => {
    const a = Math.abs(v).toFixed(decimals);
    let [i, d] = a.split(".");
    if (sep) i = i.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
    return pre + (v < 0 ? "-" : "") + i + (d ? decSep + d : "") + post;
  };
  let last = fmt(0);
  node.nodeValue = last;
  const dur = 800;
  const t0 = performance.now() + delay;
  const step = (now: number) => {
    // React a changé le texte entre-temps (nouvelles données) : on s'arrête et on garde sa valeur
    if (node.nodeValue !== last) return;
    const t = Math.min(1, Math.max(0, (now - t0) / dur));
    const e = 1 - Math.pow(1 - t, 3);
    last = t >= 1 ? orig : fmt(target * e);
    node.nodeValue = last;
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// Élément « grand chiffre » : texte seul (pas d'élément enfant), police d'au moins 20 px, hors graphique et hors tableau
function bigNumberNode(el: Element): Text | null {
  if (el.children.length || !el.firstChild) return null;
  if (el.closest("svg, table, input, select, textarea, button")) return null;
  const txt = el.textContent || "";
  if (txt.length > 24 || !/\d/.test(txt)) return null;
  const nodes = Array.from(el.childNodes).filter((n) => n.nodeType === 3) as Text[];
  const withDigits = nodes.filter((n) => /\d/.test(n.nodeValue || ""));
  if (withDigits.length !== 1) return null;
  if (parseFloat(getComputedStyle(el).fontSize) < 20) return null;
  return withDigits[0];
}

// ── Graphiques : le contenu prend vie ───────────────────────────────────────────
let sweepOk: boolean | null = null;
function canSweep() {
  if (sweepOk === null) {
    try { (CSS as any).registerProperty({ name: "--rv-sweep", syntax: "<angle>", inherits: false, initialValue: "360deg" }); sweepOk = true; }
    catch (e: any) { sweepOk = String(e?.name) === "InvalidModificationError"; }   // déjà enregistrée = utilisable
  }
  return sweepOk;
}

const visibleFill = (el: Element) => {
  const cs = getComputedStyle(el);
  if (cs.fill === "none" || /rgba\(\d+, \d+, \d+, 0\)|transparent/.test(cs.fill)) return false;
  return parseFloat(cs.fillOpacity || "1") > 0 && parseFloat(cs.opacity || "1") > 0;
};

function animateChart(svg: SVGSVGElement, delay: number) {
  const box = svg.getBoundingClientRect();
  if (box.width < 140 || box.height < 70) return;
  const W = box.width, H = box.height;
  const ratio = W / H;
  const opts = (d: number, dur: number): KeyframeAnimationOptions => ({ duration: dur, delay: d, easing: EASE, fill: "backwards" });

  // Anneau (camembert) : se remplit comme une horloge
  const arcs = Array.from(svg.querySelectorAll("path")).filter((p) => /[Aa]/.test(p.getAttribute("d") || ""));
  const dashCircles = Array.from(svg.querySelectorAll("circle")).filter((c) => c.getAttribute("stroke-dasharray"));
  if (ratio > 0.7 && ratio < 1.45 && (arcs.length >= 2 || dashCircles.length >= 2)) {
    if (canSweep()) {
      const mask = "conic-gradient(from 0deg, #000 var(--rv-sweep), transparent 0)";
      svg.style.setProperty("mask-image", mask);
      svg.style.setProperty("-webkit-mask-image", mask);
      const a = svg.animate([{ "--rv-sweep": "0deg", transform: "scale(.92)" } as any, { "--rv-sweep": "360deg", transform: "none" } as any], opts(delay, 950));
      a.onfinish = a.oncancel = () => { svg.style.removeProperty("mask-image"); svg.style.removeProperty("-webkit-mask-image"); };
    } else {
      svg.animate([{ opacity: 0, transform: "rotate(-40deg) scale(.9)" }, { opacity: 1, transform: "none" }], opts(delay, 800));
    }
    return;
  }

  // Courbes : se dessinent de gauche à droite (les lignes pointillées et les lignes de grille ne bougent pas)
  const strokes = Array.from(svg.querySelectorAll("path, polyline, line")) as SVGGeometryElement[];
  let lines = 0;
  for (const el of strokes) {
    const cs = getComputedStyle(el);
    if (cs.stroke === "none" || (cs.fill !== "none" && el.tagName !== "line")) continue;
    if (cs.strokeDasharray && cs.strokeDasharray !== "none") continue;
    const r = el.getBoundingClientRect();
    if (r.width < W * 0.35 || r.height < 3) continue;
    let len = 0;
    try { len = el.getTotalLength(); } catch { len = 0; }
    if (!len) continue;
    el.style.strokeDasharray = `${len} ${len}`;
    const a = el.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: 1100, delay: delay + lines * 120, easing: "cubic-bezier(.45,.05,.25,1)", fill: "backwards" });
    a.onfinish = a.oncancel = () => { el.style.strokeDasharray = ""; };
    lines++;
  }
  // Zones colorées sous les courbes : apparaissent en fondu
  if (lines) {
    for (const el of Array.from(svg.querySelectorAll("path")) as SVGPathElement[]) {
      const r = el.getBoundingClientRect();
      if (r.width >= W * 0.35 && r.height >= H * 0.15 && visibleFill(el)) el.animate([{ opacity: 0 }, { opacity: 1 }], opts(delay + 450, 700));
    }
  }

  // Barres : poussent depuis le bas (ou depuis la gauche pour les barres couchées), l'une après l'autre
  const rects = (Array.from(svg.querySelectorAll("rect")) as SVGRectElement[]).filter((rc) => {
    const r = rc.getBoundingClientRect();
    return r.width > 1 && r.height > 1 && visibleFill(rc) && !(r.width > W * 0.6 && r.height > H * 0.6);
  });
  if (rects.length && rects.length <= 160) {
    const vert: { el: SVGRectElement; k: number }[] = [], horiz: { el: SVGRectElement; k: number }[] = [];
    for (const el of rects) {
      const r = el.getBoundingClientRect();
      if (r.width <= W * 0.25 && r.height >= r.width * 0.5) vert.push({ el, k: r.left });
      else if (r.width >= r.height * 1.5 && r.height <= H * 0.3) horiz.push({ el, k: r.top });
    }
    const grow = (list: { el: SVGRectElement; k: number }[], dir: "y" | "x") => {
      list.sort((a, b) => a.k - b.k);
      const step = Math.min(35, 600 / Math.max(1, list.length));
      list.forEach(({ el }, i) => {
        el.style.transformBox = "fill-box";
        el.style.transformOrigin = dir === "y" ? "center bottom" : "left center";
        el.animate([{ transform: dir === "y" ? "scaleY(0)" : "scaleX(0)" }, { transform: "none" }], opts(delay + (lines ? 300 : 0) + i * step, 650));
      });
    };
    grow(vert, "y");
    grow(horiz, "x");
  }

  // Points (nuages de points, points sur les courbes) : apparaissent après le tracé
  const dots = (Array.from(svg.querySelectorAll("circle")) as SVGCircleElement[]).filter((c) => {
    const r = c.getBoundingClientRect();
    return r.width > 1 && r.width <= 28 && visibleFill(c);
  });
  if (dots.length) {
    dots.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
    const step = Math.min(14, 500 / dots.length);
    dots.forEach((c, i) => {
      c.style.transformBox = "fill-box";
      c.style.transformOrigin = "center";
      c.animate([{ transform: "scale(0)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 420, delay: delay + (lines ? 650 : 150) + i * step, easing: "cubic-bezier(.3,1.4,.5,1)", fill: "backwards" });
    });
  }

  // Textes du graphique (valeurs, étiquettes) : fondu, juste après
  for (const t of Array.from(svg.querySelectorAll("text"))) t.animate([{ opacity: 0 }, { opacity: 1 }], opts(delay + 250, 600));
}

// ── Le composant ────────────────────────────────────────────────────────────────
export function ScrollMotion() {
  const pathname = usePathname();
  const [showTop, setShowTop] = useState(false);

  // 1-2. Arrivée des cartes et animation de leur contenu
  useEffect(() => {
    if (reduceMotion() || typeof IntersectionObserver === "undefined") return;
    const root = document.querySelector("[data-rv-root]");
    if (!root) return;
    document.documentElement.classList.add("rv-on");

    const seen = new WeakSet<Element>();      // déjà pris en compte
    const done = new WeakSet<Element>();      // contenu déjà animé (graphique ou chiffre)
    const nums = new WeakMap<Element, Text>();

    const animateContent = (el: Element, delay: number) => {
      if (done.has(el)) return;
      done.add(el);
      io.unobserve(el);
      if (el instanceof SVGSVGElement) animateChart(el, delay);
      else { const n = nums.get(el); if (n) countUp(n, delay); }
    };
    const contentsOf = (card: Element) =>
      Array.from(card.querySelectorAll("svg, *")).filter((x) => (x instanceof SVGSVGElement || nums.has(x)) && !done.has(x));

    const io = new IntersectionObserver((entries) => {
      const hits = entries.filter((e) => e.isIntersecting).map((e) => e.target)
        .sort((a, b) => { const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return Math.abs(ra.top - rb.top) > 30 ? ra.top - rb.top : ra.left - rb.left; });
      // Cartes d'abord : arrivée en vague, puis leur contenu
      let k = 0;
      for (const el of hits) {
        if (el.getAttribute("data-rv") !== "0") continue;
        const delay = Math.min(k++, 6) * 75;
        el.setAttribute("data-rv", "1");
        io.unobserve(el);
        const from: Keyframe = { opacity: 0, transform: "translateY(22px) scale(.97)" };
        if (BLUR) from.filter = "blur(6px)";
        const to: Keyframe = { opacity: 1, transform: "none" };
        if (BLUR) to.filter = "blur(0px)";
        el.animate([from, to], { duration: 560, delay, easing: EASE, fill: "backwards" });
        for (const c of contentsOf(el)) animateContent(c, delay + 260);
      }
      // Graphiques et chiffres hors carte, ou arrivés après leur carte
      for (const el of hits) {
        if (el.hasAttribute("data-rv")) continue;
        const card = el.parentElement?.closest("[data-rv]");
        if (card && card.getAttribute("data-rv") === "0") continue;   // sa carte s'en chargera
        animateContent(el, 0);
      }
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0.06 });

    const scan = (base: Element) => {
      const list: Element[] = base.matches?.(CARD) ? [base] : [];
      list.push(...Array.from(base.querySelectorAll(CARD)));
      for (const el of list) {
        if (seen.has(el)) continue;
        seen.add(el);
        if (el.parentElement?.closest(CARD)) continue;      // carte dans une carte : la carte extérieure suffit
        if (el.closest("[data-rv='1']")) continue;
        el.setAttribute("data-rv", "0");
        io.observe(el);
      }
      const els: Element[] = [base, ...Array.from(base.querySelectorAll("svg, div, span, b, strong, p"))];
      for (const el of els) {
        if (seen.has(el) || el.hasAttribute("data-rv")) continue;
        if (el instanceof SVGSVGElement) {
          if (el.parentElement?.closest("svg")) { seen.add(el); continue; }
          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) continue;       // pas encore affiché : on réessaiera
          seen.add(el);
          if (r.width >= 140 && r.height >= 70) io.observe(el);
        } else if (!el.children.length && /\d/.test(el.textContent || "")) {
          seen.add(el);
          const n = bigNumberNode(el);
          if (n) { nums.set(el, n); io.observe(el); }
        }
      }
    };

    scan(root);
    let pending: Element[] = [];
    let raf = 0;
    const mo = new MutationObserver((muts) => {
      for (const m of muts) m.addedNodes.forEach((n) => { if (n.nodeType === 1) pending.push(n as Element); });
      if (pending.length && !raf) raf = requestAnimationFrame(() => {
        raf = 0;
        const batch = pending; pending = [];
        for (const n of batch) if (n.isConnected) scan(n);
      });
    });
    mo.observe(root, { childList: true, subtree: true });
    return () => {
      mo.disconnect(); io.disconnect(); cancelAnimationFrame(raf);
      root.querySelectorAll("[data-rv='0']").forEach((el) => el.setAttribute("data-rv", "1"));
    };
  }, [pathname]);

  // 3-4. Barre d'onglets collée en haut, et bouton « Haut de page »
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const y = window.scrollY;
      setShowTop(y > 700);
      document.querySelectorAll<HTMLElement>(".tabs-sticky").forEach((el) => {
        const stuck = y > 0 && el.getBoundingClientRect().top <= STICK_TOP + 1;
        if (stuck === el.classList.contains("is-stuck")) return;
        if (stuck) {
          // On garde la place de la barre normale : la page ne saute pas quand elle s'affine
          el.style.minHeight = el.offsetHeight + "px";
          el.classList.add("is-stuck");
        } else {
          el.classList.remove("is-stuck");
          el.style.minHeight = "";
        }
      });
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); cancelAnimationFrame(raf); };
  }, [pathname]);

  const toTop = () => window.scrollTo({ top: 0, behavior: reduceMotion() ? "auto" : "smooth" });

  return (
    <button type="button" className={`to-top${showTop ? " show" : ""}`} onClick={toTop}
      aria-label={tr("Revenir en haut de la page", "Back to top")} title={tr("Haut de page", "Back to top")} tabIndex={showTop ? 0 : -1}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    </button>
  );
}
