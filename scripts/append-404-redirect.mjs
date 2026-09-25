#!/usr/bin/env node
/**
 * Injects the GitHub Pages SPA fallback redirect into a built 404.html.
 *
 * GitHub Pages cannot rewrite unknown paths to index.html the way Netlify's
 * `/* -> /index.html` redirect does. Instead it serves `404.html` for any
 * request it cannot match, so we hand the app the original path and let the
 * React Router (mounted with `basename={import.meta.env.BASE_URL}`) take over.
 *
 * The base path is derived at runtime from this file's own URL, so the same
 * artifact works at `/` (Netlify) and `/TeenGenius/` (GitHub Pages).
 *
 * Usage: node scripts/append-404-redirect.mjs dist/404.html
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const target = process.argv[2];
if (!target) {
  console.error('Usage: node scripts/append-404-redirect.mjs <path-to-404.html>');
  process.exit(1);
}

const html = await readFile(path.resolve(target), 'utf8');

if (html.includes('GitHub Pages SPA fallback')) {
  console.log('SPA fallback redirect already present; leaving 404.html unchanged.');
  process.exit(0);
}

// Vite bakes the deployment base into the built HTML, so read it back from the
// module entry instead of guessing at runtime. Deriving it from `location`
// would be wrong: `new URL('.', location.pathname)` is not a valid absolute URL,
// and resolving against the *current* directory would yield the app subfolder
// rather than the deployment root.
const entry = html.match(/<script[^>]+src="([^"]*?)\/assets\/[^"]*"/);
if (!entry) {
  console.error(`Could not locate the Vite module entry in ${target}; cannot derive the base path.`);
  process.exit(1);
}
const base = entry[1].replace(/\/*$/, '/');
if (!base.startsWith('/')) {
  console.error(`Derived base path "${base}" is not root-absolute; refusing to inject a redirect.`);
  process.exit(1);
}

const script = `
<!-- GitHub Pages SPA fallback: hand the requested path to the app router. -->
<script>
(function () {
  var l = window.location;
  var base = ${JSON.stringify(base)};
  // The deployment root is already served by index.html, so only deep paths need
  // rewriting. Requests outside the base belong to Pages itself, not this app.
  if (l.pathname === base || l.pathname.indexOf(base) !== 0) return;
  // base already ends in '/', so restore the leading slash on the remainder.
  var requested = '/' + l.pathname.slice(base.length) + l.search + l.hash;
  l.replace(base + '?__tg_path=' + encodeURIComponent(requested));
})();
</script>
`;

const updated = html.includes('</body>')
  ? html.replace('</body>', `${script}</body>`)
  : html + script;

await writeFile(path.resolve(target), updated, 'utf8');
console.log(`Injected SPA fallback redirect into ${target} (base: ${base})`);
