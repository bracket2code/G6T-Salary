/// <reference lib="WebWorker" />
import { clientsClaim } from 'workbox-core';
import {
  cleanupOutdatedCaches,
  precacheAndRoute,
  type ManifestEntry,
} from 'workbox-precaching';
import { registerRoute, setCatchHandler } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<ManifestEntry>;
};

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({
    cacheName: 'html-cache',
    networkTimeoutSeconds: 5,
  }),
);

registerRoute(
  ({ request }) => ['style', 'script', 'worker'].includes(request.destination),
  new StaleWhileRevalidate({
    cacheName: 'static-resources',
  }),
);

registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'image-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 60 * 60 * 24 * 30,
      }),
    ],
  }),
);

setCatchHandler(async ({ event }) => {
  if (event.request.destination === 'document') {
    return caches.match('/index.html');
  }
  return Response.error();
});

self.addEventListener('push', (event) => {
  const data = event.data?.json?.() ?? {};
  const title = data.title ?? 'G6T-Salary';
  const body =
    data.body ?? 'Nueva notificación disponible incluso sin conexión.';

  const options: NotificationOptions = {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url ?? '/',
      dateOfArrival: Date.now(),
    },
    actions: [
      {
        action: 'explore',
        title: 'Ver detalles',
        icon: '/icon-192.png',
      },
      {
        action: 'close',
        title: 'Cerrar',
        icon: '/icon-192.png',
      },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl =
    event.notification.data?.url ||
    (event.action === 'explore' ? '/' : event.notification.tag) ||
    '/';

  if (event.action === 'close') {
    return;
  }

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      const matchingClient = allClients.find((client) => {
        return 'url' in client && client.url.includes(new URL(targetUrl, self.location.origin).pathname);
      });

      if (matchingClient && 'focus' in matchingClient) {
        return matchingClient.focus();
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })(),
  );
});

export {};
