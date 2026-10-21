"use client";

// « L'histoire en bref » : bandeau en haut des pages d'analyse (Performance, Produits, Prévisions).
// Une phrase titre, 3 à 4 constats courts, une action à faire, et des liens vers les pages liées.
// Les phrases sont calculées par chaque page à partir de ses propres données (rien d'écrit à la main).

import React from "react";
import Link from "next/link";
import { tr } from "@/lib/i18n";

export type StoryPoint = { icon: React.ReactNode; label: string; text: React.ReactNode };

export function PageStory({ kicker, headline, points, todo, links }: {
  kicker?: string;
  headline: React.ReactNode;
  points: StoryPoint[];
  todo?: React.ReactNode;
  links?: { href: string; label: string }[];
}) {
  if (!headline) return null;
  return (
    <div className="sw">
      <section className="story">
        <div className="story-kicker">{kicker || tr("L'histoire en bref", "The story in short")}</div>
        <h2 className="story-headline">{headline}</h2>
        {points.length > 0 && (
          <div className="story-points">
            {points.map((p, i) => (
              <div key={i} className="story-point">
                <span className="story-ic" aria-hidden="true">{p.icon}</span>
                <div>
                  <div className="story-lbl">{p.label}</div>
                  <div className="story-txt">{p.text}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        {(todo || (links && links.length > 0)) && (
          <div className="story-foot">
            {todo && (
              <div className="story-todo">
                <span className="story-todo-k">{tr("À faire", "To do")}</span>
                <span>{todo}</span>
              </div>
            )}
            {links && links.length > 0 && (
              <div className="story-links">
                {links.map((l) => <Link key={l.href} href={l.href} className="story-link">{l.label} →</Link>)}
              </div>
            )}
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
