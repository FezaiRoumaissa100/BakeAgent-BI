"use client";

import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from 'react-markdown';
import { queryAgentWithMetadata } from "@/lib/api";
import { useChat } from "@/contexts/ChatContext";

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
    } catch (error: any) {
      console.error("Erreur ChatDrawer:", error);

      const errorMessage = "Service temporarily unavailable. Please try again later.";

      const errorResponse: Message = {
        role: "assistant",
        content: errorMessage,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorResponse]);
    } finally {
      setIsLoading(false);
      setIsThinking(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop semi-transparent */}
      {/* Commenté temporairement pour tester */}
      {/* <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.3)",
          zIndex: 998,
        }}
        onClick={onClose}
      /> */}

      {/* Drawer */}
      <div
        ref={drawerRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          width: "450px",
          height: "100vh",
          background: "var(--dk-chrome-bg, #FFFFFF)",
          boxShadow: "-4px 0 20px rgba(0, 0, 0, 0.15)",
          zIndex: 999,
          display: "flex",
          flexDirection: "column",
          animation: "slideIn 0.3s ease-out",
        }}
      >
        {/* Header */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--dk-chrome-chip-line, #EADFD3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--dk-chrome-bg, #FFFFFF)",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "1.1rem",
                fontWeight: 700,
                color: "var(--dk-chrome-ink, #1C1410)",
              }}
            >
              Ask Your baker AI assistant
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              border: "none",
              background: "var(--dk-chrome-chip, #FBF6F0)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--dk-chrome-hover, #F3E9DE)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--dk-chrome-chip, #FBF6F0)";
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: "var(--dk-chrome-ink, #1C1410)" }}
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px 24px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          {messages.length === 0 && (
            <div
              style={{
                textAlign: "center",
                color: "var(--dk-chrome-muted, #9a8070)",
                marginTop: "60px",
              }}
            >
              <div style={{ fontSize: "3rem", marginBottom: "16px" }}>💬</div>
              <div style={{ fontSize: "0.9rem", fontWeight: 500 }}>
                Ask a question about your data
              </div>
              <div style={{ fontSize: "0.8rem", marginTop: "8px" }}>
                Ex: "What is the penetration rate?"
              </div>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              style={{
                maxWidth: "85%",
                alignSelf: message.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              <div
                style={{
                  padding: "12px 16px",
                  borderRadius: "12px",
                  background:
                    message.role === "user"
                      ? "#E8734A"
                      : "var(--dk-chrome-chip, #FBF6F0)",
                  color: message.role === "user" ? "white" : "var(--dk-chrome-ink, #1C1410)",
                  fontSize: "0.9rem",
                  lineHeight: "1.5",
                  wordBreak: "break-word",
                }}
              >
                {message.role === "assistant" ? (
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <div style={{ marginBottom: "8px" }}>{children}</div>,
                      strong: ({ children }) => <strong style={{ fontWeight: 700 }}>{children}</strong>,
                      em: ({ children }) => <em style={{ fontStyle: "italic" }}>{children}</em>,
                      ul: ({ children }) => <ul style={{ margin: "8px 0", paddingLeft: "20px" }}>{children}</ul>,
                      ol: ({ children }) => <ol style={{ margin: "8px 0", paddingLeft: "20px" }}>{children}</ol>,
                      li: ({ children }) => <li style={{ marginBottom: "4px" }}>{children}</li>,
                      code: ({ children }) => (
                        <code style={{
                          background: "rgba(0,0,0,0.05)",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          fontFamily: "monospace",
                          fontSize: "0.85em"
                        }}>{children}</code>
                      ),
                      h1: ({ children }) => <h1 style={{ fontSize: "1.2em", fontWeight: 700, marginBottom: "8px" }}>{children}</h1>,
                      h2: ({ children }) => <h2 style={{ fontSize: "1.1em", fontWeight: 700, marginBottom: "6px" }}>{children}</h2>,
                      h3: ({ children }) => <h3 style={{ fontSize: "1em", fontWeight: 700, marginBottom: "4px" }}>{children}</h3>,
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                ) : (
                  <div style={{ whiteSpace: "pre-wrap" }}>{message.content}</div>
                )}
              </div>
              <div
                style={{
                  fontSize: "0.7rem",
                  color: "var(--dk-chrome-muted, #9a8070)",
                  marginTop: "4px",
                  textAlign: message.role === "user" ? "right" : "left",
                }}
              >
                {message.timestamp.toLocaleTimeString("fr-FR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          ))}

          {isThinking && (
            <div
              style={{
                maxWidth: "85%",
                alignSelf: "flex-start",
              }}
            >
              <div
                style={{
                  padding: "12px 16px",
                  borderRadius: "12px",
                  background: "var(--dk-chrome-chip, #FBF6F0)",
                  color: "var(--dk-chrome-muted, #9a8070)",
                  fontSize: "0.9rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: "4px",
                  }}
                >
                  <div
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: "#E8734A",
                      animation: "bounce 1.4s infinite ease-in-out both",
                    }}
                  />
                  <div
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: "#E8734A",
                      animation: "bounce 1.4s infinite ease-in-out both 0.2s",
                    }}
                  />
                  <div
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: "#E8734A",
                      animation: "bounce 1.4s infinite ease-in-out both 0.4s",
                    }}
                  />
                </div>
                Thinking...
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            padding: "20px 24px",
            borderTop: "1px solid var(--dk-chrome-chip-line, #EADFD3)",
            background: "var(--dk-chrome-bg, #FFFFFF)",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "12px",
              alignItems: "flex-end",
            }}
          >
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Ask your question..."
              disabled={isLoading}
              style={{
                flex: 1,
                padding: "12px 16px",
                borderRadius: "12px",
                border: "1px solid var(--dk-chrome-chip-line, #EADFD3)",
                background: "var(--dk-chrome-chip, #FBF6F0)",
                color: "var(--dk-chrome-ink, #1C1410)",
                fontSize: "0.9rem",
                resize: "none",
                minHeight: "48px",
                maxHeight: "120px",
                outline: "none",
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#E8734A";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--dk-chrome-chip-line, #EADFD3)";
              }}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isLoading}
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                border: "none",
                background: inputValue.trim() && !isLoading ? "#E8734A" : "var(--dk-chrome-muted, #9a8070)",
                color: "white",
                cursor: inputValue.trim() && !isLoading ? "pointer" : "not-allowed",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background 0.2s",
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m22 2-7 20-4-9-9-4Z" />
                <path d="M22 2 11 13" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }

        @keyframes bounce {
          0%, 80%, 100% {
            transform: scale(0);
          }
          40% {
            transform: scale(1);
          }
        }
      `}</style>
    </>
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
