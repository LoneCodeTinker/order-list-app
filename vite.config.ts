import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      'mc-nas.ddns.net'
    ],
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    cors: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api/, ''),
      }
    }
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
  }
});
