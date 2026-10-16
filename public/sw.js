const CACHE_NAME = 'unwind-room-v1';
const APP_ROOT = new URL('./', self.registration.scope);

self.addEventListener('install', (event) => {
  event.waitUntil(
    fetch(new URL('precache-manifest.json', APP_ROOT))
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Could not load precache manifest: ${response.status}`);
        }
        return response.json();
      })
      .then((files) => {
        if (!Array.isArray(files) || !files.every((file) => typeof file === 'string')) {
          throw new Error('The precache manifest has an invalid format.');
        }
        const urls = [
          APP_ROOT.pathname,
          new URL('manifest.webmanifest', APP_ROOT).pathname,
          new URL('icon-192.png', APP_ROOT).pathname,
          new URL('icon-512.png', APP_ROOT).pathname,
          ...files.map((file) => new URL(file, APP_ROOT).pathname),
        ];
        return caches.open(CACHE_NAME).then((cache) => cache.addAll(urls));
      })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('unwind-room-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  if (
    event.request.method !== 'GET' ||
    requestUrl.origin !== APP_ROOT.origin ||
    !requestUrl.pathname.startsWith(APP_ROOT.pathname)
  ) {
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            event.waitUntil(
              caches
                .open(CACHE_NAME)
                .then((cache) => cache.put(APP_ROOT.pathname, response.clone())),
            );
          }
          return response;
        })
        .catch(() => caches.match(APP_ROOT.pathname)),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(event.request).then((response) => {
        if (response.ok) {
          event.waitUntil(
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(event.request, response.clone())),
          );
        }
        return response;
      });
    }),
  );
});
