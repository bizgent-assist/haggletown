import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5174,
      proxy: { '/api': { target: env.VITE_DEV_API_PROXY || 'http://localhost:4100', changeOrigin: true } },
    },
  };
});
