import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('framer-motion')) return 'vendor-motion';
          if (id.includes('lucide-react')) return 'vendor-icons';
          if (id.includes('react') || id.includes('scheduler')) return 'vendor-react';
          return 'vendor-utilities';
        }
      }
    }
  }
});
