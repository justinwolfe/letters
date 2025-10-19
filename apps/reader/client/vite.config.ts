import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  root: '.',
  base: mode === 'production' ? '/letters/app/' : '/',
  define: {
    // Set API base for GitHub Pages static JSON in production, empty for local dev
    'import.meta.env.VITE_API_BASE': JSON.stringify(
      mode === 'production' ? '/letters' : ''
    ),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'markdown-vendor': ['react-markdown', 'marked'],
        },
      },
    },
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
  // Make sure public directory assets are copied
  publicDir: 'public',
}));
