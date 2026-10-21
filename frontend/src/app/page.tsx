"use client";

import { useEffect, useState } from "react";
import { DailyKPIs } from "@/types/kpis";
import { fetchDailyKPIs, fetchForecast } from "@/lib/api";
import { AnalyticsSections } from "@/components/Dashboard";
import { DayBento } from "@/components/DayBento";
import { IconAlert } from "@/components/Icons";
import { tr } from "@/lib/i18n";
import { useChat } from "@/contexts/ChatContext";

export default function Page() {
  const [kpis, setKpis] = useState<DailyKPIs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Prévision boutique (7 prochains jours) pour l'en-tête ; chargée à part pour ne pas retarder la page
  const [forecast, setForecast] = useState<any | null>(null);

  useEffect(() => {
    fetchDailyKPIs()
      .then((data) => {
        setKpis(data);
        setLoading(false);
      })
      .catch(() => {
        setError(tr("Impossible de contacter le backend Python (http://127.0.0.1:8000).", "Cannot reach the Python backend (http://127.0.0.1:8000)."));
        setLoading(false);
      });
    fetchForecast({ horizon: 7, forecast_type: "articles", history_period: "all" })
      .then(setForecast)
      .catch(() => setForecast({ forecast: [] }));
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: "var(--dk-page, #F1F1EC)" }}>
        <div className="flex items-center gap-3 text-base font-bold" style={{ color: "var(--ch-1)" }}>
          <div className="w-5 h-5 rounded-full border-2 border-[color:var(--ch-1)] border-t-transparent animate-spin" />
          {tr("Chargement du tableau de bord…", "Loading dashboard…")}
        </div>
      </main>
    );
  }

  if (error || !kpis) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 text-center" style={{ background: "var(--dk-page, #F1F1EC)" }}>
        <div className="bg-white rounded-2xl p-6 shadow-lg max-w-md">
          <div className="flex justify-center mb-3">
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "50%",
                background: "rgba(220,38,38,0.10)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <IconAlert size={24} color="var(--dk-red, #C0392B)" strokeWidth={2.2} />
            </div>
          </div>
          <div className="text-sm font-bold text-red-600 mb-2">{error}</div>
          <p className="text-xs text-gray-500 mb-4">{tr("Vérifiez que le serveur FastAPI tourne sur le port 8000.", "Check that the FastAPI server is running on port 8000.")}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow"
            style={{ background: "var(--ch-1)" }}
          >
            {tr("Réessayer", "Retry")}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen" style={{ background: "var(--dk-page, #F1F1EC)" }}>
      {/* En-tête bento : chiffre d'affaires du jour, l'essentiel, produits, 7 prochains jours, demain */}
      <DayBento kpis={kpis} forecast={forecast} />

      {/* Sections analytiques : Rythme de la journée, CA Horaire, Top produits, Mix et catégories */}
      <AnalyticsSections kpis={kpis} />
    </main>
  );
}
