// Registre des graphiques affichés : chaque bouton ✦ (ChartAssistantButton) s'y inscrit tant qu'il est à l'écran.
// Quand on écrit une question dans le chat SANS passer par un bouton ✦, on joint à la question :
//  - la page affichée, le jour et la période choisis dans la barre du haut ;
//  - la liste des graphiques de la page (titre + type) ;
//  - les données du ou des graphiques dont parle la question (ou de tous, si on demande « tous les graphiques »).
// Ainsi l'assistant peut expliquer n'importe quel graphique, qu'on clique sur ✦ ou qu'on lui pose la question.

import { getSelectedDay, getSelectedPeriod } from "@/lib/selectedDay";

type Entry = { el: HTMLElement | null; chartType: string; chartName: string; getData: () => any };
const entries = new Set<Entry>();

export function registerChart(e: Entry): () => void {
  entries.add(e);
  return () => { entries.delete(e); };
}

const PAGES: Record<string, string> = {
  "/": "Vue du Jour",
  "/alertes": "Alertes & Stock",
  "/performance": "Performance",
  "/produits": "Produits",
  "/previsions": "Prévisions",
  "/stock": "Saisie du stock",
};

/** Titre affiché du graphique : le titre de sa carte (sans le texte des bulles d'aide). */
function titleOf(el: HTMLElement | null): string {
  const card = el?.closest(".cc, .bc, .bento-card, .al-season, .al-today, .story, .band") as HTMLElement | null;
  const t = card?.querySelector(".ct, h2, h3") as HTMLElement | null;
  if (!t) return "";
  let s = "";
  t.childNodes.forEach((n) => { if (n.nodeType === Node.TEXT_NODE) s += n.textContent || ""; else if (n instanceof HTMLElement && !n.matches("[role=tooltip], .tip, .al-info, button")) s += n.innerText || ""; });
  return s.replace(/\s+/g, " ").trim().slice(0, 120);
}

function visible(el: HTMLElement | null): boolean {
  if (!el || !el.isConnected) return false;
  const card = (el.closest(".cc, .bc, .bento-card, .al-season, .al-today") as HTMLElement | null) || el;
  // Dans un « Voir le détail » replié, le graphique n'est pas vu : on le garde dans la liste mais signalé
  return card.getClientRects().length > 0;
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ");
const STOP = new Set(("le la les un une des de du d l au aux et ou en a ce cet cette ces sur par pour avec dans que qui quoi est sont mon ma mes ton ta tes " +
  "explique expliquer explique-moi moi peux tu vous graphique graphe chart carte the a an of on in for to and or is are this that what explain me can you please " +
  "jour journee day page").split(" "));
const words = (s: string) => norm(s).split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));

// Mots-clés FR/EN par graphique, pour reconnaître une question écrite dans l'autre langue que les titres
const KEYWORDS: Record<string, string> = {
  day_moments: "moment matin midi apres-midi clients venus customers came morning midday afternoon",
  day_drivers: "meilleur produit produits top habitude best products made revenue",
  hourly_bar: "heure heures horaire hour hours hourly revenue",
  vitesse_gauge: "cadence vitesse rythme pace speed",
  day_pairs: "ensemble paires pairs together",
  next_7_days_forecast: "prochains jours semaine prevision next days week forecast",
  day_top_products_qty: "produits vendus quantite pieces products sold quantity",
  prep_list: "preparer demain liste plus moins prepare tomorrow list more less",
  alerts_demande_risque: "saison season",
  alerts_detail_operationnel: "saison detail season daily",
  days_to_watch: "surveiller jours watch days",
  daily_month: "mois jour par jour month daily days",
  evolution_ca: "evolution mois mensuel month monthly trend",
  comparison_2024_2025: "annee comparaison derniere year comparison last",
  top_products_revenue: "classement top produits ranking products best",
  category_performance_hbar: "familles classement categories families ranking",
  day_of_week_bars: "semaine lundi mardi weekday week days",
  hourly_dual: "heure heures tickets hour hours",
  product_decision_matrix: "matrice decision star niche dormant appel matrix groupes jamais manquer habitues revoir attire groups never regulars review",
  matrix_stars_hourly: "stars heure star hour",
  penetration_ranking: "penetration presence clients tickets customers",
  penetration_status_distribution: "statut statuts leader coeur status",
  penetration_weekly_trend: "semaine evolution presence weekly trend",
  penetration_category_avg: "famille presence family categories",
  category_revenue_share: "part categorie famille share category family",
  penetration_product_trend: "produit selectionne evolution selected product",
  penetration_recommendations: "recommandations faire recommendations",
  velocity_dow: "vitesse semaine jour velocity weekday",
  velocity_hourly_distribution: "heure articles vitesse hour items velocity",
  velocity_hourly_concentration: "concentres plage heure concentrated hour",
  velocity_hourly_monitoring: "vitesse pointe surveillance velocity peak",
  ticket_role_distribution: "panier role generateur accessoire basket role",
  ticket_contribution_top20: "contribution ticket panier basket",
  frequency_top20: "regularite semaines regulier regular weeks frequency",
  frequency_distribution: "regularite quotidien cyclique sporadique frequency regularity",
  frequency_by_category: "regularite famille categorie frequency category",
  association_top12: "ensemble associations paires lift together pairs",
  associations_table: "associations faire plan action",
  forecast: "prevision ventes recentes forecast recent sales",
  forecast_decomposition: "decomposition tendance saisonnalite evenements trend seasonality events",
  seasonal: "saison prochaine season next",
  product_forecast_detail: "prevision produit product forecast",
};

const ALL_RE = /(tous|toutes|chaque|all|every|each)\s+(les\s+|the\s+)?(graphiques|graphes|charts|cartes|graphs)|cette page|this page|la page|the page/i;

export type ScreenChart = { titre: string; type: string; nom: string; visible: boolean; data?: any };

export function screenCharts(): ScreenChart[] {
  const out: ScreenChart[] = [];
  const seen = new Set<string>();
  const list = [...entries].filter((e) => e.el && e.el.isConnected)
    .sort((a, b) => (a.el!.compareDocumentPosition(b.el!) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  list.forEach((e) => {
    const key = e.chartType + "|" + e.chartName;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ titre: titleOf(e.el), type: e.chartType, nom: e.chartName, visible: visible(e.el), data: (() => { try { return e.getData(); } catch { return undefined; } })() });
  });
  return out;
}

/** Ligne commune : page affichée, jour et période choisis dans la barre du haut.
    Jointe à toutes les questions (bouton ✦ ou question écrite), pour que l'assistant parle du bon jour / de la bonne période. */
export function screenHeader(): string {
  if (typeof window === "undefined") return "";
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  const page = PAGES[path] || path;
  const day = getSelectedDay();
  const per = getSelectedPeriod();
  const all = per.annee === "Toutes" && per.mois === "Tous";
  const periode = all ? "toutes les données (aucune période choisie)"
    : `année ${per.annee === "Toutes" ? "toutes" : per.annee}, mois ${per.mois === "Tous" ? "tous" : per.mois}`;
  // Performance et Produits suivent la période ; Vue du Jour et Saisie du stock suivent le jour choisi ;
  // Alertes et Prévisions partent toujours du dernier jour des données.
  const consigne = path === "/performance"
    ? (all ? "Cette page couvre toutes les données." : "Cette page est filtrée sur cette période : réponds pour cette période-là.")
    : path === "/produits"
      ? "Page Produits : l'onglet « Produits clés » suit l'année choisie (pas le mois) ; « Rythme des ventes » et « Ce qui se vend ensemble » portent sur tout l'historique. Le champ « periode_du_graphique » des données dit ce que couvre chaque graphique : c'est lui qui compte."
    : (path === "/" || path === "/stock")
      ? "Cette page suit le jour choisi : réponds pour ce jour-là."
      : "Cette page part du dernier jour des données (prévisions à venir) : le jour choisi ne la change pas.";
  return `[CONTEXTE DE L'ÉCRAN — page affichée : « ${page} » ; jour choisi : ${day || "dernier jour des données"} ; ` +
    `période choisie : ${periode}. ${consigne}]`;
}

/** Bloc de contexte joint à une question écrite à la main (sans bouton ✦). */
export function buildScreenContext(question: string, compact: (x: any) => any): string {
  if (typeof window === "undefined") return "";
  const charts = screenCharts();

  const qw = new Set(words(question));
  const scored = charts.map((c) => {
    const tw = words(c.titre + " " + c.type.replace(/_/g, " ") + " " + (KEYWORDS[c.type] || ""));
    const hit = tw.filter((w) => qw.has(w) || [...qw].some((q) => q.length > 4 && (w.startsWith(q.slice(0, 5)) || q.startsWith(w.slice(0, 5))))).length;
    return { c, hit };
  });
  const wantAll = ALL_RE.test(question);
  let picked: ScreenChart[] = [];
  if (wantAll) picked = charts.filter((c) => c.visible);
  else {
    const best = Math.max(0, ...scored.map((s) => s.hit));
    if (best >= 1) picked = scored.filter((s) => s.hit === best).map((s) => s.c).slice(0, 2);
  }

  const lines: string[] = [];
  lines.push(screenHeader());
  if (charts.length) {
    lines.push("Graphiques présents sur cette page (titre affiché — type) :");
    charts.forEach((c) => lines.push(`- « ${c.titre || c.nom} » — ${c.type}${c.visible ? "" : " (replié, pas visible)"}`));
  }
  if (picked.length) {
    const limit = picked.length > 1 ? Math.max(2500, Math.floor(16000 / picked.length)) : 12000;
    picked.forEach((c) => {
      let json = "";
      try { json = JSON.stringify(compact(c.data)); } catch { json = ""; }
      if (!json) return;
      if (json.length > limit) json = json.slice(0, limit) + " …(tronqué)";
      lines.push(`[DONNÉES DU GRAPHIQUE AFFICHÉ — graphique « ${c.titre || c.nom} » (${c.type}). Ce sont exactement les données visibles à l'écran.]\n${json}`);
    });
  }
  return lines.join("\n");
}
