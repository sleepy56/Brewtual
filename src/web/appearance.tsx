'use client';

export const appearances = [
  { id: 'midnight', name: 'Solaris', description: 'Violet nights. A little electric.', symbol: '✧' },
  { id: 'cozy', name: 'Cozy', description: 'Warm coffee. Good company.', symbol: '♡' },
];

export function ThemePicker({ theme, setTheme, compact = false }: {
  theme: string; setTheme: (value: string) => void; compact?: boolean;
}) {
  return <div className={`appearance-picker ${compact ? 'appearance-compact' : ''}`} role="group" aria-label="Appearance">
    {appearances.map(item => <button key={item.id} className={`appearance-option appearance-${item.id}`} aria-pressed={theme === item.id} onClick={() => setTheme(item.id)}>
      <span className="appearance-swatch" aria-hidden="true">{item.symbol}</span>
      <span><strong>{item.name}</strong>{!compact && <small>{item.description}</small>}</span>
      {!compact && <span className="appearance-check" aria-hidden="true">{theme === item.id ? '✓' : ''}</span>}
    </button>)}
  </div>;
}
