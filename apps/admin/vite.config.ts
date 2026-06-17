import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          codemirror: ['vue-codemirror6'],
          codemirrorLang: ['@codemirror/lang-markdown'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/preview': {
        changeOrigin: true,
        target: process.env.VITE_WEB_PROXY_TARGET ?? 'http://localhost:3000',
      },
      '/_next': {
        changeOrigin: true,
        target: process.env.VITE_WEB_PROXY_TARGET ?? 'http://localhost:3000',
      },
    },
  },
});
