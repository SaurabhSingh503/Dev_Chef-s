import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

/**
 * MANAK frontend build config.
 *
 * `@shared` points at the repo-level `shared/` directory so the frontend and
 * backend consume literally the same type declarations. That folder sits above
 * this project root, hence `server.fs.allow`.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('../shared', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    fs: {
      // Required because `@shared` resolves outside the Vite root.
      allow: ['..'],
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
