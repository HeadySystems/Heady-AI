import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3300',
      '/health': 'http://localhost:3300',
      '/metrics': 'http://localhost:3300',
      '/mcp': 'http://localhost:3300',
    },
  },
  build: {
    outDir: 'dist',
  },
});
