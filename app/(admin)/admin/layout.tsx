import AdminNav from '@/components/admin/AdminNav';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <AdminNav />
      <main className="flex-1 ml-64 p-6" style={{ background: 'var(--cream)', color: 'var(--ink)' }}>
        {children}
      </main>
    </div>
  );
}
