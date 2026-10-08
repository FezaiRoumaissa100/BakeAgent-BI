"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { Lang, readStoredLang, saveLang, setCurrentLang } from "@/lib/i18n";

// Fournit la langue à tout le tableau de bord.
// Quand la langue change, tout le contenu est ré-affiché (clé `key`),
// ce qui met à jour chaque texte écrit avec tr("…", "…").
const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({
  lang: "fr",
  setLang: () => {},
});

export function useLang() {
  return useContext(LangContext);
}

export function LangProvider({ children }: { children: React.ReactNode }) {
  // Premier affichage toujours en français (identique côté serveur et navigateur),
  // puis on applique la langue mémorisée.
  const [lang, setLangState] = useState<Lang>("fr");

  useEffect(() => {
    const stored = readStoredLang();
    if (stored !== "fr") {
      setCurrentLang(stored);
      setLangState(stored);
    }
  }, []);

  const setLang = (l: Lang) => {
    setCurrentLang(l);
    saveLang(l);
    setLangState(l);
  };

  return (
    <LangContext.Provider value={{ lang, setLang }}>
      <React.Fragment key={lang}>{children}</React.Fragment>
    </LangContext.Provider>
  );
}
