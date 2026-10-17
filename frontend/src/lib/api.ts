import { DailyKPIs } from "@/types/kpis";

const API_BASE = "http://127.0.0.1:8000/api";

export async function fetchDailyKPIs(): Promise<DailyKPIs> {
  const res = await fetch(`${API_BASE}/daily-kpis`, { cache: "no-store" });
  if (!res.ok) throw new Error("Erreur API daily-kpis");
  return res.json();
}

export async function fetchPerformance(params?: {
  annee?: string;
  saison?: string;
  mois?: string;
  categorie?: string;
  evenement?: string;
}): Promise<any> {
  const query = new URLSearchParams();
  if (params?.annee) query.append("annee", params.annee);
  if (params?.saison) query.append("saison", params.saison);
  if (params?.mois) query.append("mois", params.mois);
  if (params?.categorie) query.append("categorie", params.categorie);
  if (params?.evenement) query.append("evenement", params.evenement);

  const res = await fetch(`${API_BASE}/performance?${query.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Erreur API performance");
  return res.json();
}

export async function fetchPenetration(params?: {
  search?: string;
  categories?: string[];
  statuts?: string[];
  year?: string;
}): Promise<any> {
  const query = new URLSearchParams();
  if (params?.search) query.append("search", params.search);
  if (params?.categories) {
    params.categories.forEach((c) => query.append("categories", c));
  }
  if (params?.statuts) {
    params.statuts.forEach((s) => query.append("statuts", s));
  }
  if (params?.year) query.append("year", params.year);

  const res = await fetch(`${API_BASE}/products/penetration?${query.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Erreur API penetration");
  return res.json();
}

export async function fetchVelocity(): Promise<any> {
  const res = await fetch(`${API_BASE}/products/velocity`, { cache: "no-store" });
  if (!res.ok) throw new Error("Erreur API velocity");
  return res.json();
}

export async function fetchTicketContribution(): Promise<any> {
  const res = await fetch(`${API_BASE}/products/ticket-contribution`, { cache: "no-store" });
  if (!res.ok) throw new Error("Erreur API ticket-contribution");
  return res.json();
}

export async function fetchFrequency(): Promise<any> {
  const res = await fetch(`${API_BASE}/products/frequency`, { cache: "no-store" });
  if (!res.ok) throw new Error("Erreur API frequency");
  return res.json();
}

export async function fetchAssociations(sortBy = "Lift ↓", topN = 20): Promise<any> {
  const query = new URLSearchParams({ sort_by: sortBy, top_n: String(topN) });
  const res = await fetch(`${API_BASE}/products/associations?${query.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Erreur API associations");
  return res.json();
}

export async function fetchForecast(params?: {
  horizon?: number;
  forecast_type?: string;
  product?: string;
  category?: string;
  season?: string;
  event?: string;
  history_period?: string;
}): Promise<any> {
  const query = new URLSearchParams();
  if (params?.horizon) query.append("horizon", String(params.horizon));
  if (params?.forecast_type) query.append("forecast_type", params.forecast_type);
  if (params?.product) query.append("product", params.product);
  if (params?.category) query.append("category", params.category);
  if (params?.season) query.append("season", params.season);
  if (params?.event) query.append("event", params.event);
  if (params?.history_period) query.append("history_period", params.history_period);

  const res = await fetch(`${API_BASE}/forecast?${query.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Erreur API forecast");
  return res.json();
}

export async function fetchAlerts(mois = "Tout"): Promise<any> {
  const query = new URLSearchParams({ mois });
  const res = await fetch(`${API_BASE}/alerts?${query.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Erreur API alerts");
  return res.json();
}

export async function fetchMatrix(year = "Toutes"): Promise<any> {
  const query = new URLSearchParams({ year });
  const res = await fetch(`${API_BASE}/products/matrix?${query.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Erreur API matrix");
  return res.json();
}

// Période couverte par les ventes (dates min / max et années présentes)
export async function fetchDataPeriod(): Promise<{ date_debut_fr: string | null; date_fin_fr: string | null; annees: number[] }> {
  const res = await fetch(`${API_BASE}/data-period`, { cache: "no-store" });
  if (!res.ok) throw new Error("Erreur API data-period");
  return res.json();
}

// ── Prévision par produit (résultats de forecasting/pipeline.py) ──
export async function fetchProductForecasts(): Promise<any> {
  const res = await fetch(`${API_BASE}/forecast/products`, { cache: "no-store" });
  if (!res.ok) throw new Error("Erreur API forecast/products");
  return res.json();
}

export async function fetchProductForecast(productId: number): Promise<any> {
  const res = await fetch(`${API_BASE}/forecast/products/${productId}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Erreur API forecast/products/id");
  return res.json();
}

export async function fetchProductAlerts(days = 14): Promise<any> {
  const res = await fetch(`${API_BASE}/alerts/products?days=${days}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Erreur API alerts/products");
  return res.json();
}

const AGENT_API_BASE = "http://127.0.0.1:8001";
export const AGENT_APP_NAME = "agent";
export const AGENT_USER_ID = "web_user";

/**
 * Timeout controller : abandonne la requête après le délai indiqué.
 */
function withTimeout(ms: number) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error("TIMEOUT")), ms);
  return { signal: ctrl.signal, clear: () => clearTimeout(timer) };
}

/**
 * Crée une nouvelle session sur le serveur ADK et retourne son identifiant.
 * À appeler avant /run si le session_id n'existe pas (sinon 404).
 */
export async function createAgentSession(customSessionId?: string): Promise<string> {
  const timeoutMs = 30_000;
  const { signal, clear } = withTimeout(timeoutMs);
  try {
    const session_id =
      customSessionId ??
      "session_" + Math.random().toString(36).slice(2, 10) + "_" + Date.now().toString(36);

    const url = `${AGENT_API_BASE}/apps/${encodeURIComponent(AGENT_APP_NAME)}/users/${encodeURIComponent(AGENT_USER_ID)}/sessions`;

    // ADK /sessions accepte un POST avec le session_id dans le corps (ou vide)
    // La spec ADK: POST /apps/{app}/users/{uid}/sessions, body: { session_id?: string }
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({ session_id }),
    });

    if (!res.ok) {
      let detail = "";
      try {
        const j = await res.json();
        detail = j?.detail ?? j?.message ?? JSON.stringify(j);
      } catch {
        try { detail = await res.text(); } catch { /* ignore */ }
      }
      throw new Error(`Création session agent échouée (${res.status}): ${detail || "inconnu"}`);
    }

    // L'API renvoie souvent { session_id } ou l'objet de session créé.
    let newSid: string | undefined;
    try {
      const j = await res.json();
      newSid = j?.session_id;
    } catch {
      /* non-JSON ok */
    }
    return newSid ?? session_id;
  } catch (err: any) {
    if (err?.name === "AbortError" || err?.message === "TIMEOUT") {
      const to = new Error("Délai dépassé lors de la création de la session agent.");
      to.name = "TimeoutError";
      throw to;
    }
    if (typeof err === "object" && err !== null && !err.name) {
      const net = new Error(
        "Connexion impossible au serveur agent (création de session). Vérifiez http://127.0.0.1:8001 (" +
          (err?.message || "erreur réseau") +
          ")"
      );
      net.name = "NetworkError";
      throw net;
    }
    throw err;
  } finally {
    clear();
  }
}

/**
 * Garantit qu'une session existe (la crée en cas de 404 Session not found) puis
 * exécute la requête /run avec le même session_id.
 */
async function runWithSessionGuarantee(
  sessionId: string,
  payload: any,
  timeoutMs: number,
  retryOnMissing = 2
): Promise<any> {
  const { signal, clear } = withTimeout(timeoutMs);
  try {
    const res = await fetch(`${AGENT_API_BASE}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify(payload),
    });

    if (res.status === 404 && retryOnMissing > 0) {
      let detail = "";
      try {
        const j = await res.json();
        detail = (j?.detail || "").toString();
      } catch { /* ignore */ }
      // Si 404 pour session non trouvée OU erreur de session, recréer et réessayer
      if (detail.toLowerCase().includes("session not found") || detail.toLowerCase().includes("session")) {
        console.log("Session ADK perdue ou invalide, recréation...");
        // Session inconnue : la créer puis retenter.
        await createAgentSession(sessionId);
        return runWithSessionGuarantee(sessionId, payload, timeoutMs, retryOnMissing - 1);
      }
    }

    if (!res.ok) {
      let detail = "";
      try {
        const errJson = await res.json();
        detail = errJson?.detail || errJson?.message || JSON.stringify(errJson);
      } catch {
        try { detail = await res.text(); } catch { /* ignore */ }
      }

      if (res.status === 429) {
        const err = new Error("Quota dépassé : " + (detail || "trop de requêtes. Réessayez dans quelques instants."));
        err.name = "QuotaExceededError";
        throw err;
      }
      if (res.status === 503) {
        const err = new Error("Service indisponible : " + (detail || "le modèle Gemini est surchargé. Réessayez dans quelques instants."));
        err.name = "ServiceUnavailableError";
        throw err;
      }
      if (res.status === 401 || res.status === 403) {
        const err = new Error("Erreur d'authentification agent : " + (detail || "clé API invalide"));
        err.name = "AuthError";
        throw err;
      }
      if (res.status === 404) {
        const err = new Error(`Session agent introuvable (${res.status}): ${detail || "session inexistante"}`);
        err.name = "AgentHttpError";
        throw err;
      }
      const err = new Error(`Erreur agent (${res.status}): ${detail || "appel échoué"}`);
      err.name = "AgentHttpError";
      throw err;
    }

    return await res.json();
  } finally {
    clear();
  }
}

/* Données du graphique, compactées pour le modèle : nombres arrondis, listes longues raccourcies,
   champs graphiques inutiles retirés, taille plafonnée. */
const CHART_DROP_KEYS = new Set(["spark", "color", "colors", "icon", "Icon", "c", "bg"]);
function compactForModel(v: any, depth = 0): any {
  if (v == null) return v;
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
  if (typeof v === "string") return v.length > 300 ? v.slice(0, 300) + "…" : v;
  if (typeof v === "boolean") return v;
  if (depth > 6) return undefined;
  if (Array.isArray(v)) {
    const max = 60;
    const arr = v.slice(0, max).map((x) => compactForModel(x, depth + 1));
    if (v.length > max) arr.push(`… ${v.length - max} éléments de plus non affichés`);
    return arr;
  }
  if (typeof v === "object") {
    const o: Record<string, any> = {};
    for (const [k, x] of Object.entries(v)) {
      if (CHART_DROP_KEYS.has(k) || typeof x === "function") continue;
      const c = compactForModel(x, depth + 1);
      if (c !== undefined) o[k] = c;
    }
    return o;
  }
  return undefined;
}
export function buildChartContext(meta?: Record<string, any>): string {
  if (!meta || !meta.chart_data) return "";
  let json = "";
  try { json = JSON.stringify(compactForModel(meta.chart_data)); } catch { return ""; }
  const LIMIT = 14000;
  if (json.length > LIMIT) json = json.slice(0, LIMIT) + " …(tronqué)";
  return `[DONNÉES DU GRAPHIQUE AFFICHÉ — graphique « ${meta.chart_name || ""} » (${meta.chart_type || ""}). ` +
    `Ce sont exactement les données visibles à l'écran : utilise-les en priorité et décris cette période-là.]\n${json}`;
}

export async function queryAgentWithMetadata(
  userMessage: string,
  customMetadata?: Record<string, any>,
  opts?: { sessionId?: string; timeoutMs?: number }
): Promise<string> {
  const timeoutMs = opts?.timeoutMs ?? 180_000; // Augmenté à 3 minutes
  const sessionId = opts?.sessionId ?? defaultAgentSessionId();

  // Les données du graphique sont ajoutées au texte envoyé à Gemini : sans cela, le modèle ne les voit pas
  // (custom_metadata est seulement rangé dans la session). La bulle du chat, elle, n'affiche que la question.
  const chartBlock = buildChartContext(customMetadata);
  const payload = {
    app_name: AGENT_APP_NAME,
    user_id: AGENT_USER_ID,
    session_id: sessionId,
    new_message: {
      role: "user" as const,
      parts: [{ text: chartBlock ? `${userMessage}\n\n${chartBlock}` : userMessage }],
    },
    custom_metadata: customMetadata,
  };

  try {
    const data = await runWithSessionGuarantee(sessionId, payload, timeoutMs);

    // Extraire la réponse de l'assistant
    const assistantContent = Array.isArray(data)
      ? data
          .filter((event: any) => event.content?.parts?.[0]?.text)
          .map((event: any) => event.content.parts[0].text)
          .join("")
      : typeof data === "string"
      ? data
      : "";

    return assistantContent || "Désolé, je n'ai pas pu répondre.";
  } catch (err: any) {
    if (err?.name === "AbortError" || err?.message === "TIMEOUT") {
      const to = new Error("Le délai de réponse de l'agent a été dépassé. Réessayez.");
      to.name = "TimeoutError";
      throw to;
    }
    if (typeof err === "object" && err !== null && !err.name) {
      // TypeError: Failed to fetch ou équivalent => erreur de connexion
      const net = new Error(
        "Connexion impossible au serveur agent. Vérifiez que le serveur ADK démarre bien sur http://127.0.0.1:8001 (" +
          (err?.message || "erreur réseau") +
          ")"
      );
      net.name = "NetworkError";
      throw net;
    }
    throw err;
  }
}

/**
 * Génère / récupère un identifiant de session unique pour le chat courant.
 * Stocké en sessionStorage pour survivre au HMR, mais distinct par onglet.
 */
export function defaultAgentSessionId(): string {
  if (typeof window === "undefined") return "session_server";
  const KEY = "visshop_agent_session_id";
  let sid = window.sessionStorage.getItem(KEY);
  if (!sid) {
    sid = "session_" + Math.random().toString(36).slice(2, 10) + "_" + Date.now().toString(36);
    window.sessionStorage.setItem(KEY, sid);
  }
  return sid;
}

export const AGENT_ENDPOINTS = {
  BASE: AGENT_API_BASE,
  RUN: `${AGENT_API_BASE}/run`,
  DOCS: `${AGENT_API_BASE}/docs`,
  SESSIONS: `${AGENT_API_BASE}/apps/${AGENT_APP_NAME}/users/${AGENT_USER_ID}/sessions`,
};
