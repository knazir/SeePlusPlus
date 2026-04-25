import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Proxy target for /api:
//   - In the docker compose stack: VITE_BACKEND_URL=http://backend:3000
//     (service-name DNS inside the compose network).
//   - On the host: falls through to BACKEND_PORT or 3000 on localhost,
//     matching what ./localdev.sh up exposes.
const backendUrl =
  process.env.VITE_BACKEND_URL || `http://localhost:${process.env.BACKEND_PORT ?? 3000}`;

// HMR polling opt-in. Docker-on-macOS doesn't propagate FS events reliably
// through bind mounts, so the compose service sets CHOKIDAR_USEPOLLING=true.
// On a host-side `npm run dev` this stays false and we use native watchers.
const usePolling = process.env.CHOKIDAR_USEPOLLING === 'true';

// Inject the gtag snippet into index.html only when VITE_GA_MEASUREMENT_ID
// is set at build time. Keeps dev / no-id builds free of any analytics
// script and avoids a 404'ing gtag URL when the var is unset.
function googleAnalyticsPlugin(): Plugin {
  return {
    name: 'spp-google-analytics',
    transformIndexHtml(html) {
      const id = process.env.VITE_GA_MEASUREMENT_ID;
      if (!id) return html;
      const tag = `
    <script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${id}');
    </script>`;
      return html.replace('</head>', `${tag}\n  </head>`);
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), googleAnalyticsPlugin()],
  server: {
    host: true, // bind 0.0.0.0 so the container port-forward works
    port: 4000,
    strictPort: false,
    watch: usePolling ? { usePolling: true, interval: 500 } : undefined,
    proxy: {
      '/api': {
        target: backendUrl,
        changeOrigin: true,
      },
    },
  },
});
