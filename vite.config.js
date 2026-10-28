import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The Base44 -> Supabase migration API runs beside the dev backend. Proxying it
// through the dev server keeps the browser on a single origin (no CORS, no
// cookie attribute juggling) for the admin migration screen.
const migrationApiTarget = process.env.MIGRATION_API_URL || 'http://127.0.0.1:8000';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    base44({
      // Support for legacy code that imports the base44 SDK with @/integrations, @/entities, etc.
      // can be removed if the code has been updated to use the new SDK imports from @base44/sdk
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true,
      navigationNotifier: true,
      analyticsTracker: true,
      visualEditAgent: true
    }),
    react(),
  ],
  // Sandbox preview (BASE44_PREVIEW_MODE=1): serve on a public interface so the
  // preview proxy can reach the dev server. Unset locally, so `npm run dev`
  // keeps its default localhost-only binding.
  server: {
    proxy: {
      '/migration-api': {
        target: migrationApiTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/migration-api/, ''),
      },
    },
    ...(process.env.BASE44_PREVIEW_MODE === '1'
      ? { host: '0.0.0.0', port: 5173, strictPort: true }
      : {}),
  },
});
