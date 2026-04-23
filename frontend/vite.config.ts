import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: Number(process.env.FRONTEND_PORT) || 4000,
    strictPort: false,
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.BACKEND_PORT ?? 3000}`,
        changeOrigin: true,
      },
    },
  },
});
