import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

/**
 * Load .env from monorepo root (Pricewise/) so VITE_* vars live next to backend keys.
 * Never inject secret keys here — only VITE_* is exposed to the client.
 *
 * Dev / HMR: With host 0.0.0.0, Safari/WebKit often shows "an error occurred trying to load the resource"
 * when the HMR WebSocket targets the wrong host. Set VITE_DEV_SERVER_HOST to your LAN IP when testing
 * from a phone (same host you type in the browser). Or DISABLE_HMR=true to turn HMR off.
 */
export default defineConfig({
  envDir: path.resolve(__dirname, '..'),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    port: 3000,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    hmr:
      process.env.DISABLE_HMR === 'true'
        ? false
        : (() => {
            const publicHost = process.env.VITE_DEV_SERVER_HOST?.trim();
            const clientPort = Number(process.env.VITE_DEV_CLIENT_PORT || 3000);
            return {
              ...(publicHost ? { host: publicHost } : {}),
              port: 3000,
              clientPort,
              protocol: (process.env.VITE_DEV_HMR_PROTOCOL as 'ws' | 'wss' | undefined) || 'ws',
            };
          })(),
  },
});
