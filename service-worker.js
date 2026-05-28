





const CACHE_NAME = 'taskflow-cache-v1';
const CACHE_VERSION = 1;


const APP_SHELL_FILES = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];




self.addEventListener('install', (event) => {
  console.log('[SW] 🔧 INSTALL — Instalando Service Worker v' + CACHE_VERSION);

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] 📦 Abrindo cache:', CACHE_NAME);
        console.log('[SW] 📥 Armazenando arquivos do App Shell...');




        return cache.addAll(APP_SHELL_FILES);
      })
      .then(() => {
        console.log('[SW] ✅ App Shell cacheado com sucesso!');
        console.log('[SW] ⏳ Aguardando ativação...');

        
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] ❌ Falha no install:', error);
      })
  );
});




self.addEventListener('activate', (event) => {
  console.log('[SW] ⚡ ACTIVATE — Ativando Service Worker v' + CACHE_VERSION);

  event.waitUntil(

    caches.keys()
      .then((cacheNames) => {
        console.log('[SW] 🔍 Caches encontrados:', cacheNames);


        const cachesToDelete = cacheNames.filter((cacheName) => {
          return cacheName !== CACHE_NAME;
        });

        if (cachesToDelete.length > 0) {
          console.log('[SW] 🗑️  Removendo caches antigos:', cachesToDelete);
        } else {
          console.log('[SW] ✨ Nenhum cache antigo encontrado.');
        }


        return Promise.all(
          cachesToDelete.map((cacheName) => {
            console.log('[SW] 🗑️  Deletando cache:', cacheName);
            return caches.delete(cacheName);
          })
        );
      })
      .then(() => {
        console.log('[SW] ✅ Ativação completa! SW no controle.');
        
        return self.clients.claim();
      })
  );
});




self.addEventListener('fetch', (event) => {


  if (event.request.method !== 'GET') {
    return;
  }


  const url = new URL(event.request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }


  event.respondWith(cacheFirstStrategy(event.request));
});


async function cacheFirstStrategy(request) {
  try {

    const cachedResponse = await caches.match(request);

    if (cachedResponse) {


      console.log('[SW] 💾 Cache HIT:', request.url);
      return cachedResponse;
    }



    console.log('[SW] 🌐 Cache MISS — buscando na rede:', request.url);

    const networkResponse = await fetch(request);



    if (networkResponse && networkResponse.status === 200) {


      const responseToCache = networkResponse.clone();

      const cache = await caches.open(CACHE_NAME);
      cache.put(request, responseToCache);
      console.log('[SW] 📦 Novo recurso cacheado:', request.url);
    }

    return networkResponse;

  } catch (error) {


    console.warn('[SW] ⚠️  Offline e sem cache para:', request.url);



    if (request.destination === 'document') {
      const fallback = await caches.match('./index.html');
      if (fallback) {
        console.log('[SW] 📄 Retornando fallback: index.html');
        return fallback;
      }
    }


    return new Response(
      JSON.stringify({ error: 'Recurso não disponível offline' }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}




self.addEventListener('message', (event) => {
  console.log('[SW] 📨 Mensagem recebida:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] ⏩ Forçando atualização imediata...');
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_VERSION, cacheName: CACHE_NAME });
  }
});

