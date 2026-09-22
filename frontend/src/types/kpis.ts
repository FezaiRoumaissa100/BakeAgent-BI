// Types pour l'API
export interface HourlyData {
  hour: number;
  heure: string;
  ca: number;
  tkt: number;
  qte: number;
  panier_h: number;
  ca_cum: number;
}

export interface ProductRow {
  article: string;
  quantity?: number;
  total_revenue?: number;
  nb_tkt?: number;
}

export interface CategoryRow {
  category: string;
  total_revenue: number;
}

export interface PairRow {
  pa: string;
  pb: string;
  cnt: number;
}

export interface DailyKPIs {
  ca_jour: number;
  tickets: number;
  panier: number;
  qte_jour: number;
  hourly_data: HourlyData[];
  heures_act: number;
  vitesse: number;
  peak_h: number;
  peak_qte_h: number;
  ca_moy_global: number;
  delta_vs_moy: number;
  top_qte: ProductRow[];
  top_ca: ProductRow[];
  top_tkt: ProductRow[];
  categories: CategoryRow[];
  top_pairs: PairRow[];
  nb_multi: number;
  nb_mono: number;
  pct_m: number;
  alerts_count: number;
  date_str: string;
  jour_str: string;
  total_lignes: number;
}
