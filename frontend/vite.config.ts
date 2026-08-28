import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react-swc';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { consoleForwardPlugin } from './vite-plugins/consoleForwardPlugin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isAnalyze = process.env.ANALYZE === 'true';
const pkg = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8')) as {
  version: string;
};

export default defineConfig({
  base: '/',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      onwarn(warning, warn) {
        // eval внутри lottie-web / vm-browserify (полифиллы) — шум, не наш код
        if (warning.code === 'EVAL' && warning.id?.includes('node_modules')) {
          return;
        }
        // @peculiar/webcrypto импортирует process.version, shim полифилла его не экспортирует
        if (
          warning.code === 'MISSING_EXPORT' &&
          warning.message.includes('"version"') &&
          warning.message.includes('process')
        ) {
          return;
        }
        warn(warning);
      },
      output: {
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
  plugins: [
    consoleForwardPlugin(),
    react(),
    nodePolyfills({
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      protocolImports: true,
    }),
    isAnalyze &&
      visualizer({
        filename: 'dist/bundle-report.html',
        gzipSize: true,
        brotliSize: true,
        template: 'treemap',
        open: false,
      }),
    isAnalyze &&
      visualizer({
        filename: 'dist/bundle-stats.json',
        gzipSize: true,
        template: 'raw-data',
        open: false,
      }),
  ].filter(Boolean),
});
