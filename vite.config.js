import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Project Pages serves this application from /sheet-machine/.
// Override VITE_BASE_PATH only when deploying it to a custom-domain root.
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/sheet-machine/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'pwa-icon.svg'],
      manifest: {
        name: 'Sheet Machine',
        short_name: 'Sheet Machine',
        description: 'Capture and organize personal events.',
        theme_color: '#6854d8',
        background_color: '#f6f7fb',
        display: 'standalone',
        start_url: '.',
        icons: [
          { src: 'pwa-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'pwa-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
    }),
  ],
  build: { outDir: 'docs', emptyOutDir: true },
  server: {
    headers: { 'Cross-Origin-Opener-Policy': 'same-origin-allow-popups' },
  },
  preview: {
    headers: { 'Cross-Origin-Opener-Policy': 'same-origin-allow-popups' },
  },
  test: { environment: 'jsdom', globals: true, setupFiles: './src/test/setup.js' },
});
