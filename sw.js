// Service Worker para Gcoded CAM - Suporte Offline-First e Instalação PWA
const CACHE_NAME = 'gcoded-v0.10.1';
const CORE_ASSETS = [
  './',
  './index.html',
  './style.css',
  './src/app.js',
  './lib/clipper.js',
  './manifest.webmanifest',
  './favicon.svg',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png'
];

// Instalação: armazena os recursos essenciais da aplicação
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_ASSETS).catch((err) => {
        console.warn('[Gcoded SW] Falha ao pré-carregar alguns assets:', err);
      });
    })
  );
  // Não forçar skipWaiting() aqui para permitir que o navegador notifique a página
  // e exiba o popup de atualização amigável antes de recarregar.
});

// Permite que a página envie a mensagem para ativar a nova versão
self.addEventListener('message', (event) => {
  if (event.data && (event.data.action === 'skipWaiting' || event.data.type === 'SKIP_WAITING')) {
    self.skipWaiting();
  }
});

// Ativação: remove caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Gcoded SW] A remover cache antiga:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Interceção de pedidos de rede (Offline-First)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Tratamento especial para recursos locais vs CDNs externos
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Se já temos em cache, devolvemos imediatamente e tentamos atualizar em background
      if (cachedResponse) {
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse.clone());
              });
            }
          })
          .catch(() => {
            // Modo offline: cache continua válida
          });
        return cachedResponse;
      }

      // Se não temos em cache, busca na rede e guarda em cache (incluindo CDNs como Fabric.js e Three.js)
      return fetch(event.request)
        .then((networkResponse) => {
          if (!networkResponse || (networkResponse.status !== 200 && networkResponse.type !== 'opaque')) {
            return networkResponse;
          }

          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });

          return networkResponse;
        })
        .catch(() => {
          // Se for uma navegação HTML e a rede falhar, fallback para index.html
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
    })
  );
});
