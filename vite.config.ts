import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  // Base path is deployment-aware so the SAME source tree can ship to two hosts:
  //   - Netlify (teengenius.site) and local dev  -> '/'            (unchanged)
  //   - GitHub Pages (mokshith2426.github.io)   -> '/TeenGenius/'
  // Vite exposes the resolved value to the app as import.meta.env.BASE_URL, which
  // the React Router basename, manifest, and service worker all key off.
  const isGitHubPages = process.env.GITHUB_ACTIONS === 'true';
  const pagesBase = (process.env.GITHUB_PAGES_BASE || '/TeenGenius/').replace(/\/*$/, '/');

  return {
    // Netlify keeps serving from the domain root; only Actions builds get a subpath.
    base: isGitHubPages ? pagesBase : '/',
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
          // Split stable vendor libraries so repeated visits hit cache,
          // and release deploys only invalidate app code.
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
            'vendor-motion': ['motion'],
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
