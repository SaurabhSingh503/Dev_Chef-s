/**
 * Toolchain smoke test — replaced by the provider tree + router once the
 * contexts and pages land. Kept deliberately dependency-free so an early
 * `npm run build` validates Vite, Tailwind, the token layer and the `@shared`
 * alias in isolation.
 */
import type { LanguageCode } from '@shared/types';

const language: LanguageCode = 'en';

export default function App() {
  return (
    <main className="min-h-screen bg-background text-ink">
      <p className="font-devanagari text-wordmark manak-wordmark">मानक</p>
      <p className="font-display text-h1">Toolchain online ({language})</p>
    </main>
  );
}
