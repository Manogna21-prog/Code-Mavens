'use client';

import { useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { X, Sparkles } from 'lucide-react';

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
  void el.offsetWidth;
  el.classList.add('ai-highlight');
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });

  setTimeout(() => el.classList.remove('ai-highlight'), 2800);
}

// ─── Component ───────────────────────────────────────────────────────────────

interface AIChatPanelProps {
  open: boolean;
  onClose: () => void;
}

const F = "var(--font-inter),'Inter',sans-serif";

export default function AIChatPanel({ open, onClose }: AIChatPanelProps) {
  const router = useRouter();
  const pathname = usePathname();

  const handleTemplate = useCallback((t: TemplateAction) => {
    const needsNav = pathname !== t.route;

    if (needsNav) {
      router.push(t.route);
      setTimeout(() => highlightElement(t.elementId), 600);
    } else {
      highlightElement(t.elementId);
    }

    setTimeout(() => onClose(), needsNav ? 900 : 500);
  }, [pathname, router, onClose]);

  if (!open) return null;

  return (
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
          <span style={{ fontSize: 16, fontWeight: 700, color: '#1A1A1A', fontFamily: F }}>
            SafeShift AI
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: 4, borderRadius: 8, display: 'flex',
          }}
        >
          <X size={18} color="#9CA3AF" />
        </button>
      </div>

      {/* Intro text */}
      <div style={{ padding: '14px 18px' }}>
        <p style={{ fontSize: 14, color: '#6B7280', margin: 0, lineHeight: 1.5, fontFamily: F }}>
          Hi! I can help you navigate your dashboard. Try one of these:
        </p>
      </div>

      {/* Template chips */}
      <div
        style={{
          padding: '0 18px 18px',
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
              fontFamily: F,
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
  );
}
