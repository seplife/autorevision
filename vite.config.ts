import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // « prompt » : la nouvelle version n'est activée qu'avec l'accord de l'utilisateur,
      // pour ne jamais interrompre une évaluation en cours ni une synchronisation.
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icons/favicon.svg', 'robots.txt'],
      manifest: {
        id: '/',
        name: 'Réussite Scolaire CI',
        short_name: 'Réussite CI',
        description: 'Apprendre, s’entraîner, réussir — révisions pour la 3e et les Terminales A et D.',
        lang: 'fr-CI',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#f8fafc',
        theme_color: '#0b2a5b',
        categories: ['education'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Coquille applicative précachée : l'application s'ouvre sans réseau.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        // Les appels à Supabase ne passent jamais par le cache du Service Worker :
        // les données structurées hors ligne vivent dans IndexedDB (module 8).
        navigateFallbackDenylist: [/^\/auth\//, /^\/rest\//, /^\/storage\//, /^\/functions\//],
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  server: { port: 5173 },
  build: { target: 'es2020', sourcemap: true },
});
