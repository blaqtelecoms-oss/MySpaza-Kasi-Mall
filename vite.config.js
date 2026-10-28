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
  // preview proxy can reach the dev server. Unset locally, so `npm run dev`
  // keeps its default localhost-only binding.
  server: {
    ...(process.env.BASE44_PREVIEW_MODE === '1'
      ? { host: '0.0.0.0', port: 5173, strictPort: true }
      : {}),
  },
});
