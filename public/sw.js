/* iStore PWA service worker.
 * Intentionally no fetch handler or response cache in this first release:
 * live account, catalog, checkout, and payment data must remain network-backed.
 */
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
