import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'md-editor': ['md-editor-v3'],
        },
      },
    },
  },
  server: {
    port: 5173,
  },
});
