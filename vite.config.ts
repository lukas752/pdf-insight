import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The app is served from https://<user>.github.io/pdf-insight/, so every asset URL
// (including the pdf.js worker imported with `?url`) must be prefixed with this base.
export default defineConfig({
  base: '/pdf-insight/',
  plugins: [react()],
});
