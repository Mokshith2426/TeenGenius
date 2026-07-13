import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      cssCodeSplit: true,
      chunkSizeWarningLimit: 1200,
      minify: 'esbuild',
      rollupOptions: {
        output: {
          // Split large, stable vendor libraries into their own long-lived chunks
          // so the app shell downloads less up front and browser caches survive
          // app-code deploys. Route screens are already lazy-loaded separately.
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            if (id.includes('firebase') || id.includes('@firebase') || id.includes('@grpc') || id.includes('protobufjs')) {
              return 'firebase';
            }
            if (
              id.includes('react-markdown') || id.includes('katex') ||
              id.includes('remark') || id.includes('rehype') || id.includes('micromark') ||
              id.includes('mdast') || id.includes('hast') || id.includes('unist') ||
              id.includes('unified') || id.includes('vfile') || id.includes('property-information')
            ) {
              return 'markdown';
            }
            if (
              id.includes('/react/') || id.includes('/react-dom/') ||
              id.includes('/react-router') || id.includes('/scheduler/')
            ) {
              return 'react-vendor';
            }
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
