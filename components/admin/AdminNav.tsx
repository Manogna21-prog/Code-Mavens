'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Map, Zap, Shield, FileText, DollarSign } from 'lucide-react';

const navItems = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/risk-map', label: 'Risk Map & Forecast', icon: Map },
  { href: '/admin/triggers', label: 'Triggers', icon: Zap },
  { href: '/admin/policies', label: 'Policy Center', icon: Shield },
  { href: '/admin/claims', label: 'Claim Center', icon: FileText },
  { href: '/admin/billing', label: 'Billing Center', icon: DollarSign },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <aside className="w-64 text-white min-h-screen fixed left-0 top-0" style={{ background: 'var(--ink)' }}>
      <div className="p-4" style={{ borderBottom: '1px solid var(--ink-60)' }}>
        <h1 className="serif text-lg font-bold" style={{ color: 'var(--cream)' }}>SafeShift Admin</h1>
        <p className="mono text-xs" style={{ color: 'rgba(245,240,232,0.4)' }}>Insurance Management</p>
      </div>

      <nav className="p-2 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/admin' && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors"
              style={
                isActive
                  ? { background: 'var(--teal)', color: '#fff' }
                  : { color: 'rgba(245,240,232,0.6)' }
              }
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'rgba(245,240,232,0.08)'; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
