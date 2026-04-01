import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SafeShift — Parametric Insurance',
    short_name: 'SafeShift',
    description: 'AI-Powered Parametric Insurance for LCV Delivery Partners',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#f5f0e8',
    theme_color: '#f5f0e8',
    orientation: 'portrait',
    icons: [
      { src: '/favicon.ico', sizes: 'any', type: 'image/x-icon' },
      { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
