import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
 return { name: 'brewtual — Grow together', short_name: 'brewtual', description: 'Little routines. Shared joy.', start_url: '/', display: 'standalone', background_color: '#08090b', theme_color: '#08090b', icons: [{ src: '/app-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }, { src: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }] };
}
