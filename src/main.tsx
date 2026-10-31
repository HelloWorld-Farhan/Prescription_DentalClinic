import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Intercept Vite dynamic module import failures caused by new deployments
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  const lastReload = sessionStorage.getItem('smileclinic_vite_preload_reload');
  const now = Date.now();
  if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
    sessionStorage.setItem('smileclinic_vite_preload_reload', String(now));
    console.warn('[Vite Preload] New deployment detected. Reloading application...');
    window.location.reload();
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
