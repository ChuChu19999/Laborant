import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  base: '/',
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  plugins: [
    react(),
    nodePolyfills({
      // Включаем полифиллы для модулей, используемых @peculiar/webcrypto
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      // Полифиллы для Node.js модулей
      protocolImports: true,
    }),
  ],
});
