'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Shield, FileText, User, Sparkles } from 'lucide-react';

const LEFT_ITEMS = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/dashboard/policy', label: 'Policy', icon: Shield },
];

const RIGHT_ITEMS = [
  { href: '/dashboard/claims', label: 'Claims', icon: FileText },
  { href: '/dashboard/profile', label: 'Profile', icon: User },
];

export default function BottomNav({ onAIClick }: { onAIClick?: () => void }) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href));

  const F = "var(--font-inter),'Inter',sans-serif";

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{ background: '#ffffff', borderTop: '1px solid #E5E7EB' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', height: 64, maxWidth: 480, margin: '0 auto', padding: '0 8px' }}>
        {/* Left items */}
        {LEFT_ITEMS.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 2, padding: '6px 12px', borderRadius: 8, textDecoration: 'none',
                color: active ? '#F07820' : '#9CA3AF', minWidth: 56,
              }}
            >
              <Icon size={22} strokeWidth={active ? 2.2 : 1.5} />
              <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, fontFamily: F }}>
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* Center AI button — raised */}
        <button
          onClick={onAIClick}
          aria-label="AI Assistant"
          style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'linear-gradient(135deg, #F07820, #d96010)',
            border: '3px solid #ffffff',
            boxShadow: '0 -2px 16px rgba(240,120,32,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', marginTop: -18, flexShrink: 0,
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.08)';
            e.currentTarget.style.boxShadow = '0 -2px 24px rgba(240,120,32,0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 -2px 16px rgba(240,120,32,0.35)';
          }}
        >
          <Sparkles size={24} color="#fff" strokeWidth={2} />
        </button>

        {/* Right items */}
        {RIGHT_ITEMS.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 2, padding: '6px 12px', borderRadius: 8, textDecoration: 'none',
                color: active ? '#F07820' : '#9CA3AF', minWidth: 56,
              }}
            >
              <Icon size={22} strokeWidth={active ? 2.2 : 1.5} />
              <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, fontFamily: F }}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
