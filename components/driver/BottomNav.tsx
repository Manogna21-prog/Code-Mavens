'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Shield, FileText, Clock, User } from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/dashboard/policy', label: 'Policy', icon: Shield },
  { href: '/dashboard/claims', label: 'Claims', icon: FileText },
  { href: '/dashboard/history', label: 'History', icon: Clock },
  { href: '/dashboard/profile', label: 'Profile', icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50" style={{ background: 'var(--cream)', borderTop: '1px solid var(--rule)' }}>
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-lg transition-colors"
              style={{ color: isActive ? 'var(--teal)' : 'var(--ink-60)' }}
            >
              <Icon className="h-5 w-5" />
              <span className="mono text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
