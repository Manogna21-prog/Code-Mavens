import BottomNav from '@/components/driver/BottomNav';
import AIChatPanel from '@/components/driver/AIChatPanel';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen" style={{ background: '#F6F7F9', color: 'var(--ink)' }}>
      <main className="pb-20 max-w-lg mx-auto">
        {children}
      </main>
      <BottomNav />
      <AIChatPanel />
    </div>
  );
}
