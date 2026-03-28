const CACHE_NAME = "assetly-static-v3";
const PUBLIC_STATIC_ASSET_REGEX =
  /\.(?:css|js|mjs|png|jpg|jpeg|webp|avif|svg|gif|ico|woff2?|ttf)$/i;
const EXCLUDED_PATH_PREFIXES = ["/api/", "/_next/data/", "/_next/image", "/_next/webpack-hmr"];

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isStaticAssetRequest(request, url) {
  if (request.method !== "GET") return false;
  if (request.mode === "navigate" || request.destination === "document") return false;
  if (url.origin !== self.location.origin) return false;
  if (url.pathname === "/sw.js" || url.pathname === "/manifest.webmanifest") return false;
  if (EXCLUDED_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) return false;

  return url.pathname.startsWith("/_next/static/") || PUBLIC_STATIC_ASSET_REGEX.test(url.pathname);
}

async function fetchAndCache(request) {
  const response = await fetch(request);

  if (response.ok && response.type === "basic") {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }

  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (!isStaticAssetRequest(request, url)) return;

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const networkResponsePromise = fetchAndCache(request).catch(() => null);

      if (cachedResponse) {
        event.waitUntil(networkResponsePromise);
        return cachedResponse;
      }

      return networkResponsePromise.then((response) => response || Response.error());
    }),
  );
});
