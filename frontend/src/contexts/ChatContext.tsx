"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface ChatContextType {
  isChatOpen: boolean;
  initialMessage: string | null;
  initialMetadata: Record<string, any> | null;
  messages: Message[];
  openChat: (message: string, metadata: Record<string, any>) => void;
  closeChat: () => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [initialMessage, setInitialMessage] = useState<string | null>(null);
  const [initialMetadata, setInitialMetadata] = useState<Record<string, any> | null>(null);

  // Initialiser les messages depuis sessionStorage au chargement
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('agent-chat-messages');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          // Restaurer les timestamps (JSON ne garde pas les objets Date)
          return parsed.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }));
        } catch (e) {
          console.error('Erreur lors de la restauration des messages:', e);
          return [];
        }
      }
    }
    return [];
  });

  // Sauvegarder automatiquement dans sessionStorage à chaque changement
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('agent-chat-messages', JSON.stringify(messages));
    }
  }, [messages]);

  const openChat = (message: string, metadata: Record<string, any>) => {
    setInitialMessage(message);
    setInitialMetadata(metadata);
    setIsChatOpen(true);
  };

  const closeChat = () => {
    setIsChatOpen(false);
    setInitialMessage(null);
    setInitialMetadata(null);
    // Ne PAS vider les messages - garder l'historique
  };

  const addMessage = (message: Message) => {
    setMessages((prev) => [...prev, message]);
  };

  return (
    <ChatContext.Provider value={{ isChatOpen, initialMessage, initialMetadata, messages, openChat, closeChat, setMessages, addMessage }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}
