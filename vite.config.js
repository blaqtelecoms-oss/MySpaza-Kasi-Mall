import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Same `@/…` → `src/…` mapping declared in jsconfig.json.
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // Sandbox preview (BASE44_PREVIEW_MODE=1): serve on a public interface so the
  // preview proxy can reach the dev server, and trust the preview host, which
  // arrives as `<port>-<sandbox id>.<sandbox domain>`. Unset locally, so
  // `npm run dev` keeps its default localhost-only binding and host checks.
  server: {
    ...(process.env.BASE44_PREVIEW_MODE === '1'
      ? {
          host: '0.0.0.0',
          port: 5173,
          strictPort: true,
          allowedHosts: process.env.BASE44_SANDBOX_HOST_DOMAIN
            ? ['localhost', `.${process.env.BASE44_SANDBOX_HOST_DOMAIN}`]
            : ['localhost'],
        }
      : {}),
    // Employee invitations are sent by the email service (server/). Proxying
    // `/api` keeps the browser on a single origin in development, which is how
    // the app is served in production too (same paths, same domain).
    proxy: {
      '/api': {
        target: process.env.EMAIL_API_TARGET || 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
});
