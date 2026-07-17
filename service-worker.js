const CACHE_NAME = 'wimp-drop-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/pages/shop.html',
  '/pages/product.html',
  '/pages/account.html',
  '/pages/order-success.html',
  '/css/styles.css',
  '/js/main.js',
  '/js/env.js',
  '/js/supabase.js',
  '/js/flutterwave.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).catch(() => {
        return caches.match('/index.html');
      });
    })
  );
});
