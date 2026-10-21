"use client";

// Cloche de la barre du haut : ouvre la liste des notifications (au lieu d'aller sur la page Alertes).
import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { tr } from "@/lib/i18n";
import { useNotifications, Notif, NotifKind } from "@/contexts/NotificationContext";
import { useChat } from "@/contexts/ChatContext";

const KIND: Record<NotifKind, { tag: [string, string]; color: string; icon: React.ReactNode }> = {
  assistant:       { tag: ["Assistant", "Assistant"], color: "var(--dk-accent)", icon: <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" /> },
  assistant_error: { tag: ["Assistant", "Assistant"], color: "var(--dk-muted)", icon: <><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></> },
  risk:            { tag: ["Manque", "Shortage"], color: "var(--dk-alert)", icon: <><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></> },
  unsold:          { tag: ["Invendus", "Unsold"], color: "var(--ch-3)", icon: <><path d="M21 8 12 3 3 8v8l9 5 9-5Z" /><path d="M3 8l9 5 9-5M12 13v8" /></> },
  busy:            { tag: ["Affluence", "Busy day"], color: "var(--dk-warn)", icon: <><path d="M3 3v18h18" /><path d="m7 15 4-4 3 3 6-7" /></> },
  season:          { tag: ["Saison", "Season"], color: "var(--dk-warn)", icon: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></> },
  stock:           { tag: ["Stock", "Stock"], color: "var(--dk-accent-deep)", icon: <><path d="M21 8 12 3 3 8v8l9 5 9-5Z" /><path d="M3 8l9 5 9-5M12 13v8" /></> },
  forecast:        { tag: ["Prévision", "Forecast"], color: "var(--dk-moss)", icon: <><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></> },
};

function ago(iso?: string) {
  if (!iso) return "";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return tr("à l'instant", "just now");
  if (min < 60) return tr(`il y a ${min} min`, `${min} min ago`);
  const h = Math.round(min / 60);
  return h < 24 ? tr(`il y a ${h} h`, `${h} h ago`) : new Date(iso).toLocaleDateString();
}

export function NotificationBell() {
  const { items, unread, isRead, markRead, markAllRead } = useNotifications();
  const { openChat, agentBusy, isChatOpen } = useChat();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Fermer en cliquant ailleurs ou avec Échap
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const go = (n: Notif) => {
    markRead(n.id);
    setOpen(false);
    if (n.openChat) openChat("", {});
    else if (n.href) router.push(n.href);
  };

  const thinking = agentBusy && !isChatOpen;

  return (
    <div className="notif" ref={ref}>
      <button type="button" className="icon-chip" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="dialog"
        title={tr("Notifications", "Notifications")} aria-label={tr(`Notifications${unread ? ` (${unread} non lues)` : ""}`, `Notifications${unread ? ` (${unread} unread)` : ""}`)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && <span className="notif-badge">{unread > 9 ? "9+" : unread}</span>}
        {thinking && unread === 0 && <span className="notif-pulse" aria-hidden="true" />}
      </button>

      {open && (
        <div className="notif-panel" role="dialog" aria-label={tr("Notifications", "Notifications")}>
          <div className="notif-head">
            <div className="notif-title">{tr("Notifi", "Notifi")}<span>{tr("cations", "cations")}</span></div>
            {unread > 0 && <button type="button" className="notif-allread" onClick={markAllRead}>{tr("Tout marquer comme lu", "Mark all as read")}</button>}
          </div>

          {thinking && (
            <button type="button" className="notif-item notif-live" onClick={() => { setOpen(false); openChat("", {}); }}>
              <span className="notif-ic" style={{ color: "var(--dk-accent)" }}>
                <span style={{ display: "flex", gap: 3 }}><span className="chat-dot" /><span className="chat-dot" /><span className="chat-dot" /></span>
              </span>
              <span className="notif-txt">
                <b>{tr("L'assistant prépare sa réponse…", "The assistant is preparing its answer…")}</b>
                <span>{tr("Continuez à naviguer : vous serez prévenu ici dès qu'il aura répondu.", "Keep browsing: you will be told here as soon as it answers.")}</span>
              </span>
            </button>
          )}

          <div className="notif-list">
            {items.length === 0 && !thinking && (
              <div className="notif-empty">{tr("Aucune notification pour le moment.", "No notifications for now.")}</div>
            )}
            {items.map((n) => {
              const k = KIND[n.kind];
              const read = isRead(n.id);
              return (
                <button key={n.id} type="button" className={`notif-item${read ? "" : " unread"}`} onClick={() => go(n)}>
                  <span className="notif-ic" style={{ color: k.color, background: `color-mix(in srgb, ${k.color} 14%, transparent)` }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{k.icon}</svg>
                  </span>
                  <span className="notif-txt">
                    <span className="notif-meta">
                      <span style={{ color: k.color }}>{tr(k.tag[0], k.tag[1])}</span>
                      {n.time && <span>· {ago(n.time)}</span>}
                    </span>
                    <b>{tr(n.title[0], n.title[1])}</b>
                    {n.body && <span>{tr(n.body[0], n.body[1])}</span>}
                  </span>
                  {!read && <span className="notif-dot" aria-label={tr("non lu", "unread")} />}
                </button>
              );
            })}
          </div>

          <div className="notif-foot">
            <button type="button" onClick={() => { setOpen(false); router.push("/alertes"); }}>{tr("Voir Alertes & Stock →", "See Alerts & Stock →")}</button>
          </div>
        </div>
      )}
    </div>
  );
}
