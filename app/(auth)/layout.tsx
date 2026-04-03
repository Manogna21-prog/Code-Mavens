export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--cream)' }}>
      <div className="w-full max-w-md mx-auto p-4">
        <div className="text-center mb-8">
          <h1 className="serif text-3xl font-bold" style={{ color: 'var(--ink)' }}>Safe<span style={{ color: 'var(--teal)' }}>Shift</span></h1>
          <p className="sans text-sm mt-1" style={{ color: 'var(--ink-60)' }}>
            AI-Powered Parametric Insurance for LCV Delivery Partners
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
