// Service worker mínimo da F1: cacheia o app shell para instalabilidade e
// para a UI nunca ficar bloqueada por falta de internet (CLAUDE.md, regra 8).
// Estratégias de cache mais elaboradas (por rota, por tipo de recurso) entram
// nas fases seguintes conforme o app ganha mais telas.

const CACHE_NAME = "fazenda-shell-v1";
const APP_SHELL = ["/", "/manifest.json", "/icons/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((nomes) =>
        Promise.all(
          nomes
            .filter((nome) => nome !== CACHE_NAME)
            .map((nome) => caches.delete(nome))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cacheado) => {
      const rede = fetch(event.request)
        .then((resposta) => {
          if (resposta.ok) {
            const clone = resposta.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return resposta;
        })
        .catch(() => cacheado);

      return cacheado || rede;
    })
  );
});
