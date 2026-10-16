"use client";

import { useChat } from "@/contexts/ChatContext";
import { ChatDrawer } from "./ChatDrawer";

export function ChatDrawerWithContext() {
  const { isChatOpen, initialMessage, initialMetadata, closeChat } = useChat();

  return (
    <ChatDrawer
      isOpen={isChatOpen}
      onClose={closeChat}
      initialMessage={initialMessage || undefined}
      initialMetadata={initialMetadata || undefined}
      useContext={true}
    />
  );
}
