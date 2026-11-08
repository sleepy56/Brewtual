'use client';
import { useId, useRef } from 'react';

export const defaultAppearance = 'brewtual';

export const appearances = [
  { id: 'brewtual', name: 'Daily Ritual', description: 'Espresso, oat milk, and a fresh start.', symbol: '◒', colors: ['#f4ebdf','#3c2923','#006c60'] },
  { id: 'garden', name: 'Secret Garden', description: 'Parchment, forest greens, and room to grow.', symbol: '❧', colors: ['#f1f0df','#294c3c','#993f57'] },
  { id: 'little-things', name: 'Little Things', description: 'Peach, lilac, and the joy of showing up.', symbol: '♡', colors: ['#fff4ee','#c9bae0','#215c64'] },
  { id: 'after-hours', name: 'After Hours', description: 'Espresso nights. A little copper glow.', symbol: '☾', colors: ['#19191d','#463139','#f2b378'] },
  { id: 'social-club', name: 'Social Club', description: 'Butter yellow, burnt orange, and bold blue.', symbol: '✳', colors: ['#fff5db','#b34c2f','#2449b7'] },
  { id: 'midnight', name: 'Solaris', description: 'Violet nights. A little electric.', symbol: '✧', colors: ['#171222','#63cad6','#f6ad91'] },
  { id: 'cozy', name: 'Cozy', description: 'Warm coffee. Good company.', symbol: '♡', colors: ['#faf3e9','#bd8c7a','#355b48'] },
];

export function ThemePicker({ theme, setTheme, compact = false }: {
  theme: string; setTheme: (value: string) => void; compact?: boolean;
}) {
  if (compact) return <AppearanceMenu theme={theme} setTheme={setTheme}/>;
  return <div className="appearance-picker" role="group" aria-label="Appearance">
    {appearances.map(item => <button key={item.id} className={`appearance-option appearance-${item.id}`} aria-pressed={theme === item.id} onClick={() => setTheme(item.id)}>
      <span className="appearance-swatch" aria-hidden="true" style={{backgroundColor:item.colors[0],color:item.colors[1]}}><span>{item.symbol}</span><i style={{backgroundColor:item.colors[1]}}/><i style={{backgroundColor:item.colors[2]}}/></span>
      <span><strong>{item.name}</strong><small>{item.description}</small></span>
      <span className="appearance-check" aria-hidden="true">{theme === item.id ? '✓' : ''}</span>
    </button>)}
  </div>;
}

function AppearanceMenu({theme,setTheme}:{theme:string;setTheme:(value:string)=>void}) {
  const id=useId();
  const popup=useRef<HTMLDivElement>(null);
  const current=appearances.find(item=>item.id===theme) ?? appearances[0];
  return <>
    <button className="appearance-trigger subtle" popoverTarget={id} aria-label="Change appearance"><span aria-hidden="true">{current.symbol}</span><span>{current.name}</span><span aria-hidden="true">⌄</span></button>
    <div ref={popup} id={id} popover="auto" className="appearance-popover" role="dialog" aria-label="Choose your atmosphere">
      <div className="row between"><div><p className="eyebrow">MAKE YOURSELF AT HOME</p><h2>Choose your atmosphere.</h2></div><button className="subtle" popoverTarget={id} popoverTargetAction="hide" aria-label="Close appearance chooser">×</button></div>
      <p className="muted small">Seven moods. The same little rituals.</p>
      <ThemePicker theme={theme} setTheme={value=>{setTheme(value);popup.current?.hidePopover();}}/>
    </div>
  </>;
}
