"use client";

import { useEffect, useState } from "react";
import { DailyKPIs } from "@/types/kpis";
import { fetchDailyKPIs } from "@/lib/api";
import { Hero, AnalyticsSections } from "@/components/Dashboard";

export default function Page() {
  const [kpis, setKpis] = useState<DailyKPIs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDailyKPIs()
      .then((data) => {
        setKpis(data);
        setLoading(false);
      })
      .catch(() => {
        setError("Impossible de contacter le backend Python (http://127.0.0.1:8000).");
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: "#f2ede6" }}>
        <div className="flex items-center gap-3 text-base font-bold" style={{ color: "#E8734A" }}>
          <div className="w-5 h-5 rounded-full border-2 border-[#E8734A] border-t-transparent animate-spin" />
          Chargement du tableau de bord…
        </div>
      </main>
    );
  }

  if (error || !kpis) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 text-center" style={{ background: "#f2ede6" }}>
        <div className="bg-white rounded-2xl p-6 shadow-lg max-w-md">
          <div className="text-2xl mb-2">⚠️</div>
          <div className="text-sm font-bold text-red-600 mb-2">{error}</div>
          <p className="text-xs text-gray-500 mb-4">Vérifiez que le serveur FastAPI tourne sur le port 8000.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow"
            style={{ background: "#E8734A" }}
          >
            Réessayer
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen" style={{ background: "#f2ede6" }}>
      {/* 
        Le composant Hero contient exactement la structure Streamlit :
        .outer (580px) -> .hero (380px) + .cards-row (270px en bas chevauchant)
      */}
      <Hero kpis={kpis} />

      {/* 
        Sections analytiques : Rythme de la journée, CA Horaire, Top produits, Mix et catégories
      */}
      <AnalyticsSections kpis={kpis} />
    </main>
  );
}
