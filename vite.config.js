import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Set VITE_BASE_PATH=/repository-name/ in GitHub Actions or use a custom-domain root.
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react()],
  build: { outDir: 'docs', emptyOutDir: true },
  test: { environment: 'jsdom', globals: true, setupFiles: './src/test/setup.js' },
});
