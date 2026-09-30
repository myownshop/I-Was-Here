import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

// Clean up any global __dirname injected by tsx to prevent breakage in ESM libraries
if (typeof (globalThis as Record<string, unknown>).__dirname !== 'undefined') {
  delete (globalThis as Record<string, unknown>).__dirname;
}

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon.svg'],
        manifest: {
          id: '/',
          name: 'IWasHere Attendance',
          short_name: 'IWasHere',
          description: 'Multi-tenant location-based attendance with geofencing and facial verification.',
          theme_color: '#0a0c10',
          background_color: '#0a0c10',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('.', import.meta.url)),
      },
    },
    server: {
      // HMR is conditionally disabled via DISABLE_HMR
      hmr: false as const,
      ws: false as const,
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    define: {
      'import.meta.env.VITE_FIREBASE_API_KEY': JSON.stringify(
        process.env.VITE_FIREBASE_API_KEY || 'AIzaSyCkNMjZN-Gd28I6Zt-d2TrJBbbhOoG8xTk'
      ),
      'import.meta.env.VITE_FIREBASE_AUTH_DOMAIN': JSON.stringify(
        process.env.VITE_FIREBASE_AUTH_DOMAIN || 'gen-lang-client-0333885172.firebaseapp.com'
      ),
      'import.meta.env.VITE_FIREBASE_PROJECT_ID': JSON.stringify(
        process.env.VITE_FIREBASE_PROJECT_ID || 'gen-lang-client-0333885172'
      ),
      'import.meta.env.VITE_FIREBASE_STORAGE_BUCKET': JSON.stringify(
        process.env.VITE_FIREBASE_STORAGE_BUCKET || 'gen-lang-client-0333885172.firebasestorage.app'
      ),
      'import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(
        process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '907614203605'
      ),
      'import.meta.env.VITE_FIREBASE_APP_ID': JSON.stringify(
        process.env.VITE_FIREBASE_APP_ID || '1:907614203605:web:e023dea66b7bfd80d5bc5c'
      ),
      'import.meta.env.VITE_FIREBASE_DATABASE_ID': JSON.stringify(
        process.env.VITE_FIREBASE_DATABASE_ID || 'ai-studio-ca7b28f3-1445-4796-a4ef-7a4db6a02fa8'
      ),
      'import.meta.env.VITE_GOOGLE_MAPS_API_KEY': JSON.stringify(
        process.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyBxdz7MaSL2Wl_25YymlEiNsickJNBoHyo'
      ),
    },
  };
});
