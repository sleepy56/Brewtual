import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Pair Habits — Grow together',
  description: 'A shared space for little routines, thoughtful rewards, and progress together.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
