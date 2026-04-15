'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, ArrowRight, Send, Loader2, Mic, MicOff, Volume2 } from 'lucide-react';

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

// ─── Language options ────────────────────────────────────────────────────────

const LANGUAGES = [
  { code: 'en', label: 'English', bcp47: 'en-IN' },
  { code: 'hi', label: 'हिन्दी', bcp47: 'hi-IN' },
  { code: 'te', label: 'తెలుగు', bcp47: 'te-IN' },
  { code: 'ta', label: 'தமிழ்', bcp47: 'ta-IN' },
  { code: 'ml', label: 'മലയാളം', bcp47: 'ml-IN' },
] as const;

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

const F = "var(--font-inter),'Inter',sans-serif";

// ─── Simple markdown renderer ────────────────────────────────────────────────

function renderMarkdown(text: string): React.ReactNode {
  // Split into lines
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let listOrdered = false;

  function flushList() {
    if (listItems.length === 0) return;
    const Tag = listOrdered ? 'ol' : 'ul';
    elements.push(
      <Tag key={`list-${elements.length}`} style={{
        margin: '6px 0', paddingLeft: 20,
        listStyleType: listOrdered ? 'decimal' : 'disc',
      }}>
        {listItems.map((item, i) => (
          <li key={i} style={{ marginBottom: 3 }}>{inlineFormat(item)}</li>
        ))}
      </Tag>
    );
    listItems = [];
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Unordered list item
    const ulMatch = trimmed.match(/^[-*]\s+(.*)/);
    if (ulMatch) {
      if (listItems.length > 0 && listOrdered) flushList();
      listOrdered = false;
      listItems.push(ulMatch[1]);
      continue;
    }

    // Ordered list item
    const olMatch = trimmed.match(/^\d+[.)]\s+(.*)/);
    if (olMatch) {
      if (listItems.length > 0 && !listOrdered) flushList();
      listOrdered = true;
      listItems.push(olMatch[1]);
      continue;
    }

    // Non-list line — flush any pending list
    flushList();

    // Empty line
    if (trimmed === '') {
      elements.push(<div key={`br-${i}`} style={{ height: 6 }} />);
      continue;
    }

    // Regular paragraph
    elements.push(
      <p key={`p-${i}`} style={{ margin: '2px 0' }}>{inlineFormat(trimmed)}</p>
    );
  }

  flushList();
  return <>{elements}</>;
}

function inlineFormat(text: string): React.ReactNode {
  // Process **bold** and split into segments
  const parts: React.ReactNode[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <strong key={match.index} style={{ fontWeight: 700, color: '#1A1A1A' }}>
        {match[1]}
      </strong>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AIAssistantPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState('en');
  const [listening, setListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  function toggleMic() {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMessages((prev) => [...prev, { role: 'ai', text: 'Voice input is not supported in this browser. Please use Chrome on Android or Desktop.' }]);
      return;
    }

    const recognition = new SpeechRecognition();
    const langEntry = LANGUAGES.find((l) => l.code === lang);
    recognition.lang = langEntry?.bcp47 || 'en-IN';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInput(transcript);
      // If we got a final result, stop listening
      if (event.results[event.results.length - 1].isFinal) {
        setListening(false);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('[SpeechRecognition] Error:', event.error);
      setListening(false);
      if (event.error === 'not-allowed') {
        setMessages((prev) => [...prev, { role: 'ai', text: 'Microphone access was denied. Please allow microphone permission in your browser settings and try again.' }]);
      } else if (event.error === 'no-speech') {
        setMessages((prev) => [...prev, { role: 'ai', text: 'No speech detected. Please tap the mic and speak clearly.' }]);
      }
    };

    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;

    try {
      recognition.start();
      setListening(true);
    } catch (err) {
      console.error('[SpeechRecognition] Start failed:', err);
      setListening(false);
    }
  }

  function speakText(text: string) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    // Strip markdown formatting for cleaner speech
    const clean = text.replace(/\*\*/g, '').replace(/^[-*]\s+/gm, '').replace(/^\d+[.)]\s+/gm, '');
    const utterance = new SpeechSynthesisUtterance(clean);
    const langEntry = LANGUAGES.find((l) => l.code === lang);
    utterance.lang = langEntry?.bcp47 || 'en-IN';
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  }

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
        body: JSON.stringify({ message: text, lang }),
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

      {/* Language selector pills */}
      <div style={{
        display: 'flex', gap: 6, justifyContent: 'center',
        flexWrap: 'wrap', marginBottom: hasChat ? 16 : 24,
      }}>
        {LANGUAGES.map((l) => (
          <button
            key={l.code}
            onClick={() => setLang(l.code)}
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              border: lang === l.code ? '1.5px solid #F07820' : '1px solid #E5E7EB',
              background: lang === l.code ? '#FEF3E8' : '#ffffff',
              color: lang === l.code ? '#F07820' : '#6B7280',
              fontSize: 13,
              fontWeight: lang === l.code ? 700 : 500,
              cursor: 'pointer',
              fontFamily: F,
              transition: 'all 0.15s',
            }}
          >
            {l.label}
          </button>
        ))}
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
              {m.role === 'ai' ? renderMarkdown(m.text) : m.text}
              {m.role === 'ai' && (
                <button
                  onClick={() => speakText(m.text)}
                  aria-label="Read aloud"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    marginTop: 8, padding: '4px 10px',
                    borderRadius: 8, border: '1px solid #E5E7EB',
                    background: '#F9FAFB', cursor: 'pointer',
                    fontSize: 11, color: '#6B7280', fontFamily: F,
                    transition: 'border-color 0.15s, color 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#F07820'; e.currentTarget.style.color = '#F07820'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.color = '#6B7280'; }}
                >
                  <Volume2 size={12} strokeWidth={2} />
                  Listen
                </button>
              )}
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
              <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes pulse-mic { 0%,100% { transform: scale(1); } 50% { transform: scale(1.1); } }
              `}</style>
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
          placeholder={listening ? 'Listening... speak now' : 'Ask anything about your account...'}
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
        {/* Mic button */}
        <button
          onClick={toggleMic}
          disabled={loading}
          aria-label={listening ? 'Stop listening' : 'Start voice input'}
          style={{
            width: 40, height: 40, borderRadius: '50%',
            background: listening ? '#FEE2E2' : '#F3F4F6',
            border: listening ? '1.5px solid #EF4444' : '1px solid #E5E7EB',
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.18s',
            flexShrink: 0,
            animation: listening ? 'pulse-mic 1.2s ease-in-out infinite' : 'none',
          }}
        >
          {listening
            ? <MicOff size={18} color="#EF4444" strokeWidth={2} />
            : <Mic size={18} color="#6B7280" strokeWidth={2} />
          }
        </button>

        {/* Send button */}
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
