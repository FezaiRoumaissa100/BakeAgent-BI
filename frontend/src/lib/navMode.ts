// Menu de gauche : deux façons de l'afficher, au choix de l'utilisateur (sélecteur en bas de l'écran).
//   "rail"   : barre fine avec les icônes ; un clic sur le logo ouvre le menu complet.
//   "hidden" : menu caché ; un clic sur le logo de l'en-tête le fait glisser par-dessus la page.
// L'état est posé sur la balise <html> (data-nav, data-nav-open) et la mise en page
// est faite en CSS (app/globals.css, section « Menu de gauche »). Le choix est mémorisé.

export type NavMode = "rail" | "hidden";

const KEY_MODE = "dashboard-nav-mode";
const KEY_OPEN = "dashboard-nav-open";

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
  // En mode « barre d'icônes », on se souvient si le menu était ouvert.
  if (getNavMode() === "rail") {
    try { localStorage.setItem(KEY_OPEN, open ? "1" : "0"); } catch {}
  }
}

export function setNavMode(mode: NavMode) {
  root().dataset.nav = mode;
  root().dataset.navOpen = "0";
  try {
    localStorage.setItem(KEY_MODE, mode);
    localStorage.setItem(KEY_OPEN, "0");
  } catch {}
}

// Exécuté avant l'affichage (voir app/layout.tsx) pour éviter que le menu « saute » au chargement.
export const navInitScript = `(function(){try{var d=document.documentElement;var m=localStorage.getItem("${KEY_MODE}")==="hidden"?"hidden":"rail";d.dataset.nav=m;d.dataset.navOpen=(m==="rail"&&localStorage.getItem("${KEY_OPEN}")==="1")?"1":"0";}catch(e){}})();`;
