import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor loads this file with Node (see https://capacitorjs.com/docs/config).
 *
 * Live reload (device/emulator hits your dev machine):
 *   CAPACITOR_DEV_SERVER_URL=http://YOUR_LAN_IP:3000 npx cap sync
 * Then run `npm run dev` (Vite on 0.0.0.0:3000) and open the native project.
 * Android requires cleartext for http:// in dev.
 */
const rawDevServer = process.env.CAPACITOR_DEV_SERVER_URL?.trim();
const devServer = rawDevServer
  ? rawDevServer.replace('://0.0.0.0', '://localhost')
  : undefined;

const config: CapacitorConfig = {
  appId: 'com.pricewise.app',
  appName: 'Pricewise',
  webDir: 'dist',
  ...(devServer
    ? {
        server: {
          url: devServer,
          cleartext: true,
        },
      }
    : {}),
};

export default config;
