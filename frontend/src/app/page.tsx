"use client";

import { useEffect, useState } from "react";
import { DailyKPIs } from "@/types/kpis";
import { fetchDailyKPIs, fetchForecast } from "@/lib/api";
import { AnalyticsRhythm, AnalyticsDetails } from "@/components/Dashboard";
import { DayStory } from "@/components/DayStory";
import { RetainProvider } from "@/components/Ui";
import { IconAlert } from "@/components/Icons";
import { tr } from "@/lib/i18n";
import { useChat } from "@/contexts/ChatContext";
import { useSelectedDay, setSelectedDay, dayLong } from "@/lib/selectedDay";

export default function Page() {
  const [kpis, setKpis] = useState<DailyKPIs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Prévision boutique (7 prochains jours) pour l'en-tête ; chargée à part pour ne pas retarder la page
  const [forecast, setForecast] = useState<any | null>(null);

  // Jour choisi dans la barre du haut (vide = dernier jour des données)
  const [day, , dayReady] = useSelectedDay();
  useEffect(() => {
    if (!dayReady) return;
    setLoading(true);
    fetchDailyKPIs(day)
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
  }, [day, dayReady]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: "var(--dk-page, #F1EEF9)" }}>
        <div className="flex items-center gap-3 text-base font-bold" style={{ color: "var(--ch-1)" }}>
          <div className="w-5 h-5 rounded-full border-2 border-[color:var(--ch-1)] border-t-transparent animate-spin" />
          {tr("Chargement du tableau de bord…", "Loading dashboard…")}
        </div>
      </main>
    );
  }

  if (error || !kpis) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 text-center" style={{ background: "var(--dk-page, #F1EEF9)" }}>
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
    <main className="min-h-screen" style={{ background: "var(--dk-page, #F1EEF9)" }}>
      {/* Mise en page compacte : 1) en-tête + 4 indicateurs  2) rythme de la journée + « À retenir »
          3) les 7 prochains jours + produits du jour  4) le détail, replié */}
      <RetainProvider>
        {(kpis as any).sans_vente ? (
          <div className="sw" style={{ paddingTop: 24 }}>
            <div className="cc" style={{ textAlign: "center", padding: "36px 20px" }}>
              <div className="page-eyebrow">{dayLong(String((kpis as any).date), tr("fr-FR", "en-GB"))}</div>
              <h1 className="page-h1" style={{ marginTop: 6 }}>{tr("Pas de vente ce jour-là", "No sales that day")}</h1>
              <p className="cs" style={{ margin: "8px auto 16px", maxWidth: 520 }}>{tr("La boutique était fermée ce jour-là, ou la date est en dehors des données. Choisissez un autre jour dans la barre du haut.", "The shop was closed that day, or the date is outside the data. Pick another day in the top bar.")}</p>
              <button type="button" className="ask-btn" onClick={() => setSelectedDay(null)}>{tr("Revenir au dernier jour", "Back to the last day")}</button>
            </div>
          </div>
        ) : (<>
        <DayStory kpis={kpis} forecast={forecast} isLast={!day || day === (kpis as any).dernier_jour}>
          <AnalyticsRhythm kpis={kpis} />
        </DayStory>
        <AnalyticsDetails kpis={kpis} />
        </>)}
      </RetainProvider>
    </main>
  );
}
