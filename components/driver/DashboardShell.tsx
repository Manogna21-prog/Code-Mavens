'use client';

import { useState, useCallback } from 'react';
import BottomNav from './BottomNav';
import AIChatPanel from './AIChatPanel';

export default function DashboardShell() {
  const [chatOpen, setChatOpen] = useState(false);

  const openChat = useCallback(() => setChatOpen(true), []);
  const closeChat = useCallback(() => setChatOpen(false), []);

  return (
    <>
      <BottomNav onAIClick={openChat} />
      <AIChatPanel open={chatOpen} onClose={closeChat} />
    </>
  );
}
