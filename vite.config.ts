import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api/17lands': {
        target: 'https://www.17lands.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/17lands/, ''),
      },
    },
  },
});
