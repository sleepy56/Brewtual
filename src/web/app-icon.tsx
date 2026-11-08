import type { ReactNode } from 'react';

export function AppIcon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    today: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-8H9v8H4a1 1 0 0 1-1-1Z"/></>,
    goals: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5.5"/><circle cx="12" cy="12" r="2"/></>,
    market: <><path d="M3 8h18v4H3zM5 12v9h14v-9M12 8v13"/><path d="M12 8H8a3 3 0 1 1 3-3Zm0 0h4a3 3 0 1 0-3-3Z"/></>,
    together: <path d="M20.8 4.7a5.4 5.4 0 0 0-7.6 0L12 6l-1.2-1.3a5.4 5.4 0 0 0-7.6 7.6L12 21l8.8-8.7a5.4 5.4 0 0 0 0-7.6Z"/>,
    activity: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
    dailies: <><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.2 7a8 8 0 0 1 13.2-1L20 8M4 16l1.6 2A8 8 0 0 0 18.8 17"/></>,
    tasks: <><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M4 10h16M10 4v16"/></>,
    notes: <><path d="M5 3h14v18H5zM8 8h8M8 12h8M8 16h5"/></>,
    settings: <><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></>,
    menu: <path d="M4 6h16M4 12h16M4 18h16"/>,
    plus: <path d="M12 4v16M4 12h16"/>,
    check: <path d="m5 12 4 4L19 6"/>,
    token: <path d="m12 2 9 5v10l-9 5-9-5V7Z"/>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] ?? paths.tasks}</svg>;
}
