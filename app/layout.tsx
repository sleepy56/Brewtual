import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'brewtual — Grow together',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'brewtual' },
  icons: { apple: '/icon-192.png' },
  description: 'A shared space for little routines, thoughtful rewards, and progress together.',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#08090b' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
