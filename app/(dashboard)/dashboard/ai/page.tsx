'use client';

import { useRouter } from 'next/navigation';
import { Sparkles, ArrowRight } from 'lucide-react';

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

// ─── Component ───────────────────────────────────────────────────────────────

const F = "var(--font-inter),'Inter',sans-serif";

export default function AIAssistantPage() {
  const router = useRouter();

  function handleTemplate(t: TemplateAction) {
    router.push(t.route);
    setTimeout(() => highlightElement(t.elementId), 600);
  }

  return (
    <div style={{ padding: '24px 20px', maxWidth: 480, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
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
        <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.5, margin: 0, fontFamily: F }}>
          I can help you navigate your dashboard. Tap a question below to get started.
        </p>
      </div>

      {/* Template question cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
            {/* Emoji icon */}
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: '#FEF3E8',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, flexShrink: 0,
            }}>
              {t.emoji}
            </div>

            {/* Text */}
            <span style={{ flex: 1, fontSize: 15, fontWeight: 500, color: '#374151' }}>
              {t.question}
            </span>

            {/* Arrow */}
            <ArrowRight size={18} color="#9CA3AF" strokeWidth={2} style={{ flexShrink: 0 }} />
          </button>
        ))}
      </div>

      {/* Footer hint */}
      <p style={{
        textAlign: 'center', fontSize: 13, color: '#9CA3AF',
        marginTop: 32, fontFamily: F, lineHeight: 1.5,
      }}>
        More smart features coming soon — weather alerts, premium tips, and claim predictions.
      </p>
    </div>
  );
}
