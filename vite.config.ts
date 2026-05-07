import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    exclude: ['@solvera/pace-core', 'react-router-dom'],
  },
  resolve: {
    dedupe: ['react', 'react-dom', 'react-router-dom'],
  },
});
