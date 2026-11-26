// Núcleo padrão: service worker dos apps web. Só o "casco" (arquivos do próprio app) fica em cache; nenhuma resposta do servidor é guardada.
// Uso no app:  self.NUCLEO_SW = { cache: 'meu-app-v1', casco: ['./', 'index.html', ...] };  importScripts('nucleo/nucleo_web_sw.js');
// FONTE: nucleo_padrao/web. Não edite a cópia dentro do app.
'use strict';

const { cache: CACHE, casco: CASCO } = self.NUCLEO_SW;
const PREFIXO = CACHE.replace(/-v\d+$/, '-');

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CASCO)).then(() => self.skipWaiting()));
});
// Apaga só as versões antigas DESTE app: os apps web dividem o mesmo endereço no GitHub, e o cache dos outros não pode ser mexido.
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith(PREFIXO) && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).then((r) => {
      if (r.ok) { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copia)); }
      return r;
    }).catch(() => caches.match(e.request).then((r) => r || caches.match('index.html'))),
  );
});
