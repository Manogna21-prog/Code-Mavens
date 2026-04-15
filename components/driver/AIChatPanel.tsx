'use client';

import { useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { MessageCircle, X, Sparkles } from 'lucide-react';

// ─── Template questions → navigation + highlight targets ─────────────────────

interface TemplateAction {
  question: string;
  route: string;
  elementId: string;
  answer: string;
}

const TEMPLATES: TemplateAction[] = [
  {
    question: 'How many GigPoints do I have?',
    route: '/dashboard',
    elementId: 'card-gigpoints',
    answer: 'Here are your GigPoints — highlighted below!',
  },
  {
    question: "What's my total earnings?",
    route: '/dashboard',
    elementId: 'card-savings',
    answer: 'Your net savings card is highlighted below!',
  },
  {
    question: 'Show me my active policy',
    route: '/dashboard',
    elementId: 'card-policy',
    answer: 'Your active policy details are highlighted below!',
  },
  {
    question: 'Show my claim history',
    route: '/dashboard/claims',
    elementId: 'card-claims-list',
    answer: 'Taking you to your claims…',
  },
];

// ─── Highlight helper ────────────────────────────────────────────────────────

function highlightElement(id: string) {
  const el = document.getElementById(id);
  if (!el) return;

  el.classList.remove('ai-highlight');
  // Force reflow so re-adding the class restarts the animation
  void el.offsetWidth;
  el.classList.add('ai-highlight');
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });

  setTimeout(() => el.classList.remove('ai-highlight'), 2800);
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AIChatPanel() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const router = useRouter();
  const pathname = usePathname();

  const handleTemplate = useCallback((t: TemplateAction) => {
    // Show the Q+A in the chat
    setMessages((prev) => [
      ...prev,
      { role: 'user', text: t.question },
      { role: 'ai', text: t.answer },
    ]);

    const needsNav = pathname !== t.route;

    if (needsNav) {
      router.push(t.route);
      // Wait for page render, then highlight
      setTimeout(() => highlightElement(t.elementId), 600);
    } else {
      highlightElement(t.elementId);
    }

    // Auto-close panel after a beat
    setTimeout(() => setOpen(false), needsNav ? 900 : 500);
  }, [pathname, router]);

  return (
    <>
      {/* ── Floating trigger button ── */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open AI assistant"
          style={{
            position: 'fixed',
            bottom: 84,
            right: 20,
            zIndex: 100,
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #F07820, #d96010)',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 6px 24px rgba(240,120,32,0.4)',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.08)';
            e.currentTarget.style.boxShadow = '0 8px 32px rgba(240,120,32,0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 6px 24px rgba(240,120,32,0.4)';
          }}
        >
          <MessageCircle size={26} strokeWidth={2} />
        </button>
      )}

      {/* ── Chat panel (slides up from bottom-right) ── */}
      {open && (
        <div
          style={{
            position: 'fixed',
            bottom: 84,
            right: 16,
            zIndex: 110,
            width: 340,
            maxWidth: 'calc(100vw - 32px)',
            background: '#ffffff',
            borderRadius: 20,
            boxShadow: '0 12px 48px rgba(0,0,0,0.18)',
            border: '1px solid #E5E7EB',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            animation: 'dsh-up 0.28s ease both',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 18px',
              borderBottom: '1px solid #F3F4F6',
              background: 'linear-gradient(135deg, #FEF3E8, #ffffff)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={18} color="#F07820" strokeWidth={2} />
              <span style={{ fontSize: 16, fontWeight: 700, color: '#1A1A1A', fontFamily: "var(--font-inter),'Inter',sans-serif" }}>
                SafeShift AI
              </span>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: 4, borderRadius: 8, display: 'flex',
              }}
            >
              <X size={18} color="#9CA3AF" />
            </button>
          </div>

          {/* Message area */}
          <div style={{ padding: '14px 18px', maxHeight: 200, overflowY: 'auto' }}>
            {messages.length === 0 ? (
              <p style={{ fontSize: 14, color: '#6B7280', margin: 0, lineHeight: 1.5, fontFamily: "var(--font-inter),'Inter',sans-serif" }}>
                Hi! I can help you navigate your dashboard. Try one of these:
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {messages.map((m, i) => (
                  <div
                    key={i}
                    style={{
                      alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth: '85%',
                      padding: '8px 14px',
                      borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                      background: m.role === 'user' ? '#F07820' : '#F3F4F6',
                      color: m.role === 'user' ? '#fff' : '#374151',
                      fontSize: 14,
                      lineHeight: 1.45,
                      fontFamily: "var(--font-inter),'Inter',sans-serif",
                    }}
                  >
                    {m.text}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Template chips */}
          <div
            style={{
              padding: '12px 18px 18px',
              borderTop: '1px solid #F3F4F6',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {TEMPLATES.map((t) => (
              <button
                key={t.elementId}
                onClick={() => handleTemplate(t)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 14px',
                  borderRadius: 12,
                  border: '1px solid #E5E7EB',
                  background: '#FAFAFA',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: 14,
                  color: '#374151',
                  fontFamily: "var(--font-inter),'Inter',sans-serif",
                  transition: 'border-color 0.18s, background 0.18s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#F07820';
                  e.currentTarget.style.background = '#FEF3E8';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#E5E7EB';
                  e.currentTarget.style.background = '#FAFAFA';
                }}
              >
                <Sparkles size={14} color="#F07820" strokeWidth={2} style={{ flexShrink: 0 }} />
                {t.question}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
