// Menu de gauche : l'affichage s'adapte tout seul à la largeur de l'écran.
//   Grand écran (≥ 1280 px) → "rail"   : menu fixe, déplié par défaut ; la flèche ou le logo
//                                        le replient en barre d'icônes (choix mémorisé).
//   Petit écran (< 1280 px) → "hidden" : menu caché ; le bouton à trois traits de l'en-tête
//                                        le fait glisser par-dessus la page.
// L'état est posé sur la balise <html> (data-nav, data-nav-open) et la mise en page
// est faite en CSS (app/globals.css, section « Menu de gauche »).

export type NavMode = "rail" | "hidden";

export const NAV_BREAKPOINT = 1280;
const KEY_OPEN = "dashboard-nav-open-v2"; // menu fixe déplié ou replié (grand écran)

function root() {
  return document.documentElement;
}

export function getNavMode(): NavMode {
  return root().dataset.nav === "hidden" ? "hidden" : "rail";
}

export function isNavOpen(): boolean {
  return root().dataset.navOpen === "1";
}

export function setNavOpen(open: boolean) {
  root().dataset.navOpen = open ? "1" : "0";
  // Sur grand écran, on se souvient si le menu était déplié ou replié.
  if (getNavMode() === "rail") {
    try { localStorage.setItem(KEY_OPEN, open ? "1" : "0"); } catch {}
  }
}

/** Choisit le mode selon la largeur de la fenêtre (appelé au chargement et quand la fenêtre change de taille). */
export function applyNavForWidth() {
  const mode: NavMode = window.innerWidth < NAV_BREAKPOINT ? "hidden" : "rail";
  if (root().dataset.nav === mode) return false;
  root().dataset.nav = mode;
  let open = "0";
  if (mode === "rail") {
    try { open = localStorage.getItem(KEY_OPEN) === "0" ? "0" : "1"; } catch { open = "1"; }
  }
  root().dataset.navOpen = open;
  return true;
}

// Exécuté avant l'affichage (voir app/layout.tsx) pour éviter que le menu « saute » au chargement.
export const navInitScript = `(function(){try{var d=document.documentElement;var m=window.innerWidth<${NAV_BREAKPOINT}?"hidden":"rail";d.dataset.nav=m;d.dataset.navOpen=(m==="rail"&&localStorage.getItem("${KEY_OPEN}")!=="0")?"1":"0";}catch(e){}})();`;
