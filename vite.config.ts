/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Hosted at the root of a Cloudflare Pages domain, so base stays '/'.
// If this ever moves to a sub-path (e.g. GitHub Pages /dough-app/), change base to match.
export default defineConfig({
  base: '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      // Step reminders: push and notification-tap handlers (public/push-sw.js).
      workbox: { importScripts: ['push-sw.js'], navigateFallbackDenylist: [/^\/api\//] },
      manifest: {
        name: 'Dough',
        short_name: 'Dough',
        description: 'Pizza dough calculator and bake log',
        theme_color: '#b5482b',
        background_color: '#faf6ef',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
