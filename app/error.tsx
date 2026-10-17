'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="center-page">
      <section className="auth-card">
        <h1>Something went wrong.</h1>
        <p>Your shared space could not open. Please try again.</p>
        <button onClick={reset}>Try again</button>
      </section>
    </main>
  );
}
