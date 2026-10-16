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
