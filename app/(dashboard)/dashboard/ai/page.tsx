'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, ArrowRight, Send, Loader2 } from 'lucide-react';

// ─── Template questions → navigation + highlight targets ─────────────────────

interface TemplateAction {
  question: string;
  route: string;
  elementId: string;
  emoji: string;
}

const TEMPLATES: TemplateAction[] = [
  {
    question: 'How many GigPoints do I have?',
    route: '/dashboard',
    elementId: 'card-gigpoints',
    emoji: '🪙',
  },
  {
    question: "What's my total earnings?",
    route: '/dashboard',
    elementId: 'card-savings',
    emoji: '💰',
  },
  {
    question: 'Show me my active policy',
    route: '/dashboard',
    elementId: 'card-policy',
    emoji: '🛡️',
  },
  {
    question: 'Show my claim history',
    route: '/dashboard/claims',
    elementId: 'card-claims-list',
    emoji: '📋',
  },
];

// ─── Highlight helper ────────────────────────────────────────────────────────

function highlightElement(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('ai-highlight');
  void el.offsetWidth;
  el.classList.add('ai-highlight');
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => el.classList.remove('ai-highlight'), 2800);
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

const F = "var(--font-inter),'Inter',sans-serif";

export default function AIAssistantPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  function handleTemplate(t: TemplateAction) {
    router.push(t.route);
    setTimeout(() => highlightElement(t.elementId), 600);
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setLoading(true);

    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

    try {
      const res = await fetch('/api/driver/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: 'ai', text: data.answer || 'No response received.' }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'ai', text: "I'm having trouble connecting. Please try again." }]);
    } finally {
      setLoading(false);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const hasChat = messages.length > 0;

  return (
    <div style={{ padding: '24px 20px', maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 120px)' }}>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: hasChat ? 20 : 32 }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'linear-gradient(135deg, #FEF3E8, #FDEBD0)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
        }}>
          <Sparkles size={28} color="#F07820" strokeWidth={2} />
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1A1A1A', letterSpacing: '-0.03em', margin: '0 0 8px', fontFamily: F }}>
          SafeShift AI
        </h1>
        {!hasChat && (
          <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.5, margin: 0, fontFamily: F }}>
            Ask me anything about your account, or tap a quick action below.
          </p>
        )}
      </div>

      {/* Template question cards — hide once chat starts */}
      {!hasChat && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          {TEMPLATES.map((t) => (
            <button
              key={t.elementId}
              onClick={() => handleTemplate(t)}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '16px 18px',
                borderRadius: 14,
                border: '1px solid #E5E7EB',
                background: '#ffffff',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: F,
                transition: 'border-color 0.18s, box-shadow 0.18s, transform 0.18s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#F07820';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(240,120,32,0.12)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#E5E7EB';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: '#FEF3E8',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, flexShrink: 0,
              }}>
                {t.emoji}
              </div>
              <span style={{ flex: 1, fontSize: 15, fontWeight: 500, color: '#374151' }}>
                {t.question}
              </span>
              <ArrowRight size={18} color="#9CA3AF" strokeWidth={2} style={{ flexShrink: 0 }} />
            </button>
          ))}
        </div>
      )}

      {/* Chat messages */}
      {hasChat && (
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                padding: '12px 16px',
                borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: m.role === 'user' ? '#F07820' : '#ffffff',
                color: m.role === 'user' ? '#fff' : '#374151',
                fontSize: 14,
                lineHeight: 1.55,
                fontFamily: F,
                border: m.role === 'ai' ? '1px solid #E5E7EB' : 'none',
                boxShadow: m.role === 'ai' ? '0 2px 8px rgba(0,0,0,0.04)' : 'none',
              }}
            >
              {m.role === 'ai' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <Sparkles size={12} color="#F07820" strokeWidth={2.5} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#F07820', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    SafeShift AI
                  </span>
                </div>
              )}
              {m.text}
            </div>
          ))}

          {/* Typing indicator */}
          {loading && (
            <div style={{
              alignSelf: 'flex-start', maxWidth: '85%',
              padding: '12px 16px', borderRadius: '16px 16px 16px 4px',
              background: '#ffffff', border: '1px solid #E5E7EB',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <Loader2 size={16} color="#F07820" strokeWidth={2} style={{ animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: 14, color: '#9CA3AF', fontFamily: F }}>Thinking...</span>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Input bar */}
      <div style={{
        display: 'flex', gap: 10, alignItems: 'center',
        padding: '12px 14px',
        background: '#ffffff',
        borderRadius: 16,
        border: '1px solid #E5E7EB',
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        marginTop: hasChat ? 0 : 'auto',
      }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything about your account..."
          disabled={loading}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            fontSize: 15,
            color: '#1A1A1A',
            background: 'transparent',
            fontFamily: F,
          }}
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          style={{
            width: 40, height: 40, borderRadius: '50%',
            background: input.trim() && !loading ? '#F07820' : '#E5E7EB',
            border: 'none',
            cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.18s',
            flexShrink: 0,
          }}
        >
          <Send size={18} color={input.trim() && !loading ? '#fff' : '#9CA3AF'} strokeWidth={2} />
        </button>
      </div>

      {/* Footer hint */}
      {!hasChat && (
        <p style={{
          textAlign: 'center', fontSize: 13, color: '#9CA3AF',
          marginTop: 20, fontFamily: F, lineHeight: 1.5,
        }}>
          Powered by AI — answers based on your real account data.
        </p>
      )}
    </div>
  );
}
