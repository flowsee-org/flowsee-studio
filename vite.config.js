import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  for (const [key, value] of Object.entries(env)) if (key.startsWith("STUDIO_") || key.startsWith("SMTP_")) process.env[key] ??= value;
  const { localBackendPlugin } = await import("./backend/local-backend.mjs");
  return {
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  plugins: [react(), localBackendPlugin()],
};
});
