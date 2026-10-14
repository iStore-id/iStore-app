/// <reference types="vite/client" />
declare global {
  interface Window {
    snap: any;
  }
}

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';

console.log("main.tsx: Starting application");

window.onerror = function(message, source, lineno, colno, error) {
  console.error("Global Error Caught:", message, "at", source, ":", lineno, ":", colno, error);
  const root = document.getElementById('root');
  if (root && root.innerHTML === "") {
    root.innerHTML = `<div style="padding: 20px; color: red; font-family: sans-serif;">
      <h2>Fatal Error</h2>
      <p>${message}</p>
      <pre>${error?.stack || ""}</pre>
    </div>`;
  }
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
console.log("main.tsx: Render called");

// Register the PWA service worker only in production. It deliberately does not
// intercept or cache requests, so API, authentication, checkout, and payment
// responses continue to use the normal network path.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error) => {
      console.warn('PWA service worker registration failed:', error);
    });
  });
}
