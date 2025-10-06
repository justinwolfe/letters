import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react({
      // Enable Fast Refresh for HMR
      fastRefresh: true,
      // Exclude node_modules from transformation
      exclude: /node_modules/,
    }),
  ],
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    host: true, // Expose to local network
    // Enable HMR
    hmr: {
      overlay: true, // Show errors as overlay
    },
    // Watch for changes in these files
    watch: {
      usePolling: false,
      ignored: ['**/node_modules/**', '**/dist/**'],
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
});
