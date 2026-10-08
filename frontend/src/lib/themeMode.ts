// Mode d'affichage du tableau de bord : clair, sombre, ou « comme l'ordinateur ».
// Le choix est mémorisé dans le navigateur (localStorage) et appliqué en posant
// data-theme="light" ou "dark" sur la balise <html>. Les couleurs du mode sombre
// sont définies dans app/globals.css.

export type ThemeMode = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "dashboard-theme";

export function readStoredMode(): ThemeMode {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {}
  return "system"; // par défaut : on suit le réglage de l'ordinateur
}

export function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyMode(mode: ThemeMode) {
  const dark = mode === "dark" || (mode === "system" && systemPrefersDark());
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

export function saveMode(mode: ThemeMode) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {}
  applyMode(mode);
}

// Petit script exécuté avant l'affichage de la page (voir app/layout.tsx),
// pour éviter un flash blanc quand le mode sombre est actif.
export const themeInitScript = `(function(){try{var m=localStorage.getItem("${THEME_STORAGE_KEY}");if(m!=="light"&&m!=="dark")m="system";var d=m==="dark"||(m==="system"&&window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light";}catch(e){}})();`;
