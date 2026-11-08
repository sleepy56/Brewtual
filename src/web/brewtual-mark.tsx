export function BrewtualMark() {
  return (
    <svg className="brew-mark" viewBox="0 0 64 64" width="1em" height="1em" aria-hidden="true" focusable="false">
      <path d="M20 15C4 22 4 45 20 53" fill="none" stroke="var(--brand-main, currentColor)" strokeWidth="7" strokeLinecap="round" />
      <path d="M36 15c16 7 16 30 0 38M48 28h3c9 0 9 12 0 12h-3" fill="none" stroke="var(--brand-secondary, currentColor)" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="28" cy="11" r="4.5" fill="var(--action, currentColor)" />
    </svg>
  );
}
