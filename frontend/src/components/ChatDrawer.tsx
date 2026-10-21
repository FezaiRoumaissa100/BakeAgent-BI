"use client";

import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from 'react-markdown';
import { queryAgentWithMetadata } from "@/lib/api";
import { useChat } from "@/contexts/ChatContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { tr } from "@/lib/i18n";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface ChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  initialMessage?: string;
  initialMetadata?: Record<string, any>;
  useContext?: boolean; // Si true, utilise le contexte global pour les messages
}

export function ChatDrawer({ isOpen, onClose, initialMessage, initialMetadata, useContext = false }: ChatDrawerProps) {
  const chatContext = useChat();
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const messages = useContext ? chatContext.messages : localMessages;
  const setMessages = useContext ? chatContext.setMessages : setLocalMessages;
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const [pendingMetadata, setPendingMetadata] = useState<Record<string, any> | null>(null);
  const { notify } = useNotifications();
  // Le panneau peut être fermé pendant que l'assistant réfléchit : la réponse arrive quand même,
  // et une notification s'affiche dans la cloche si le panneau est fermé à ce moment-là.
  const isOpenRef = useRef(isOpen);
  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Close drawer when clicking outside (but not when clicking inside)
  // Désactivé temporairement - utilise uniquement le bouton X pour fermer
  /* useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(event.target as Node)) {
        console.log("Click outside detected, closing drawer");
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]); */

  // Handle initial message with chart metadata - just pre-fill input, don't auto-send
  useEffect(() => {
    if (isOpen && initialMessage && initialMetadata) {
      // Pré-remplir le champ de saisie avec @titre
      setInputValue(initialMessage);
      setPendingMetadata(initialMetadata);
    }
  }, [isOpen, initialMessage, initialMetadata]);

  // Quand on ferme, vider l'input mais garder les messages
  useEffect(() => {
    if (!isOpen) {
      setInputValue("");
      setPendingMetadata(null);
    }
  }, [isOpen]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      role: "user",
      content: inputValue,
      timestamp: new Date(),
    };

    const question = inputValue;
    const metadataToSend = pendingMetadata || {};
    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);
    setIsThinking(true);
    if (useContext) chatContext.setAgentBusy(true);
    setPendingMetadata(null); // Clear metadata after first message

    try {
      // Appel à l'agent ADK via la fonction centralisée de api.ts
      // (gestion timeout, session unique par onglet, erreurs réseau/429)
      const assistantContent = await queryAgentWithMetadata(question, metadataToSend);

      const assistantMessage: Message = {
        role: "assistant",
        content: assistantContent,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      if (!isOpenRef.current) {
        const plain = assistantContent.replace(/[#*_`>|]/g, "").replace(/\s+/g, " ").trim();
        const q = question.length > 60 ? question.slice(0, 60) + "…" : question;
        notify({
          id: `assistant-${Date.now()}`, kind: "assistant", openChat: true, time: new Date().toISOString(),
          title: [`L'assistant a répondu : « ${q} »`, `The assistant answered: "${q}"`],
          body: [plain.slice(0, 140) + (plain.length > 140 ? "…" : ""), plain.slice(0, 140) + (plain.length > 140 ? "…" : "")],
        });
      }
    } catch (error: any) {
      console.error("Erreur ChatDrawer:", error);

      const errorMessage = "Service temporarily unavailable. Please try again later.";

      const errorResponse: Message = {
        role: "assistant",
        content: errorMessage,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorResponse]);
      if (!isOpenRef.current) notify({
        id: `assistant-err-${Date.now()}`, kind: "assistant_error", openChat: true, time: new Date().toISOString(),
        title: ["L'assistant n'a pas pu répondre", "The assistant could not answer"],
        body: ["Le service est momentanément indisponible. Réessayez plus tard.", "The service is temporarily unavailable. Please try again later."],
      });
    } finally {
      setIsLoading(false);
      setIsThinking(false);
      if (useContext) chatContext.setAgentBusy(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isOpen) return null;

  const suggestions = [
    tr("Comment s'est passée cette journée ?", "How did this day go?"),
    tr("Quels produits rapportent le plus ?", "Which products earn the most?"),
    tr("Que prévoit-on pour les 7 prochains jours ?", "What is forecast for the next 7 days?"),
  ];

  return (
    <div ref={drawerRef} onClick={(e) => e.stopPropagation()} className="chat-panel" role="dialog"
      aria-label={tr("Assistant IA", "AI Assistant")}>
      {/* En-tête : même style de titre en deux couleurs que les pages */}
      <div className="chat-head">
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <div className="chat-head-ic">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
            </svg>
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="chat-title">{tr("Assistant ", "AI ")}<span>{tr("IA", "Assistant")}</span></div>
            <div className="chat-sub">{tr("Posez une question sur vos chiffres", "Ask a question about your numbers")}</div>
          </div>
        </div>
        <button type="button" className="chat-close" onClick={onClose} aria-label={tr("Fermer", "Close")}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 6 6 18" /><path d="m6 6 12 12" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="chat-body">
        {messages.length === 0 && !isThinking && (
          <div className="chat-empty">
            <div className="chat-empty-ic">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <b>{tr("Que voulez-vous savoir ?", "What would you like to know?")}</b>
            <p>{tr("Ou cliquez sur ✦ en haut d'un graphique pour le faire expliquer.", "Or click ✦ at the top of a chart to have it explained.")}</p>
            <div className="chat-suggest">
              {suggestions.map((q) => (
                <button key={q} type="button" onClick={() => setInputValue(q)}>{q}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message, index) => (
          <div key={index} className={`chat-msg ${message.role === "user" ? "user" : "bot"}`}>
            <div className="chat-bubble">
              {message.role === "assistant" ? (
                <ReactMarkdown>{message.content}</ReactMarkdown>
              ) : (
                message.content
              )}
            </div>
            <div className="chat-time">
              {new Date(message.timestamp).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
        ))}

        {isThinking && (
          <div className="chat-msg bot">
            <div className="chat-bubble chat-thinking">
              <span style={{ display: "flex", gap: 4 }}>
                <span className="chat-dot" /><span className="chat-dot" /><span className="chat-dot" />
              </span>
              {tr("L'assistant réfléchit…", "The assistant is thinking…")}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Saisie */}
      <div className="chat-foot">
        <div className="chat-input-wrap">
          <textarea
            className="chat-input"
            rows={1}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={tr("Posez votre question…", "Ask your question…")}
            disabled={isLoading}
          />
          <button type="button" className="chat-send" onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading} aria-label={tr("Envoyer", "Send")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" />
            </svg>
          </button>
        </div>
        <div className="chat-hint">{tr("Entrée pour envoyer · Maj + Entrée pour aller à la ligne", "Enter to send · Shift + Enter for a new line")}</div>
      </div>
    </div>
  );
}

// Hook pour contrôler l'ouverture du drawer depuis l'extérieur
export function useChatDrawer() {
  const [isOpen, setIsOpen] = useState(false);

  return {
    isOpen,
    openChat: () => setIsOpen(true),
    closeChat: () => setIsOpen(false),
    toggleChat: () => setIsOpen((prev) => !prev),
  };
}
