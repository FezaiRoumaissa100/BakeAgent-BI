"use client";

// « L'histoire en bref » : bandeau en haut des pages d'analyse (Performance, Produits, Prévisions).
// Une phrase titre, 3 à 4 constats courts, une action à faire, et des liens vers les pages liées.
// Les phrases sont calculées par chaque page à partir de ses propres données (rien d'écrit à la main).

import React from "react";
import Link from "next/link";
import { tr } from "@/lib/i18n";

export type StoryPoint = { icon: React.ReactNode; label: string; text: React.ReactNode; value?: React.ReactNode };

/* Bandeau « L'histoire en bref » : un titre, 3-4 chiffres clés avec une ligne d'explication,
   et l'action à faire. Fond coloré pour qu'on le repère tout de suite, hauteur réduite. */
export function PageStory({ kicker, headline, points, todo, note, links }: {
  kicker?: string;
  headline: React.ReactNode;
  points: StoryPoint[];
  todo?: React.ReactNode;
  note?: React.ReactNode;
  links?: { href: string; label: string }[];
}) {
  if (!headline) return null;
  return (
    <div className="sw">
      <section className="band">
        <div className="band-top">
          <div style={{ minWidth: 0 }}>
            <div className="band-kicker">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4Z" /></svg>
              {kicker || tr("L'histoire en bref", "The story in short")}
            </div>
            <h2 className="band-head">{headline}</h2>
          </div>
          {links && links.length > 0 && (
            <div className="band-links">
              {links.map((l) => <Link key={l.href} href={l.href} className="band-link">{l.label} →</Link>)}
            </div>
          )}
        </div>
        {points.length > 0 && (
          <div className="band-facts">
            {points.map((p, i) => (
              <div key={i} className="band-fact">
                <span className="band-ic" aria-hidden="true">{p.icon}</span>
                <div style={{ minWidth: 0 }}>
                  <div className="band-lbl">{p.label}</div>
                  {p.value != null && <div className="band-val num">{p.value}</div>}
                  <div className="band-txt">{p.text}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        {todo && (
          <div className="band-todo">
            <span className="band-todo-k">{tr("À faire", "To do")}</span>
            <span>{todo}</span>
          </div>
        )}
        {note && (
          <div className="band-todo band-note">
            <span className="band-todo-k">{tr("À savoir", "Good to know")}</span>
            <span>{note}</span>
          </div>
        )}
      </section>
    </div>
  );
}

// Petites icônes des constats (traits, couleur du texte)
const I = (d: React.ReactNode) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);
export const StoryIcons = {
  money: I(<><path d="M12 2v20" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>),
  calendar: I(<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>),
  clock: I(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  star: I(<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z" />),
  trend: I(<><path d="M3 17l6-6 4 4 8-8" /><path d="M14 7h7v7" /></>),
  down: I(<><path d="M3 7l6 6 4-4 8 8" /><path d="M14 17h7v-7" /></>),
  basket: I(<><path d="M5 11h14l-1.5 9h-11Z" /><path d="m9 11 3-6 3 6" /></>),
  link: I(<><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></>),
  target: I(<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>),
  shield: I(<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6Z" />),
};
