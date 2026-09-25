import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import 'katex/dist/katex.min.css';

// Register PWA service worker for offline operations and performance
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => {
        console.log('Service Worker registered successfully:', reg.scope);
        // Poll for a newer service worker version on page load
        reg.update().catch(() => {});
      })
      .catch((err) => console.warn('Service Worker registration failed:', err));

    // Notify the user when a new version of the app activates
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'SW_UPDATED') {
        showUpdateToast();
      }
    });
  });
}

function showUpdateToast() {
  if (document.getElementById('tg-update-toast')) return;
  const toast = document.createElement('div');
  toast.id = 'tg-update-toast';
  toast.setAttribute('role', 'status');
  toast.style.cssText = 'position:fixed;bottom:calc(84px + env(safe-area-inset-bottom,0px));left:50%;transform:translateX(-50%);background:#18181b;color:#fafafa;padding:12px 20px;border-radius:16px;font:600 13px/1.4 system-ui,sans-serif;z-index:10000;box-shadow:0 10px 30px rgba(0,0,0,.35);display:flex;gap:12px;align-items:center;max-width:calc(100vw - 32px);';
  toast.innerHTML = '<span>New version available</span>';
  const btn = document.createElement('button');
  btn.textContent = 'Refresh';
  btn.style.cssText = 'background:#2563eb;color:#fff;border:none;border-radius:10px;padding:6px 14px;font:700 12px system-ui;cursor:pointer;';
  btn.onclick = () => location.reload();
  toast.appendChild(btn);
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 15000);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
