/*
 * オフライン用のキャッシュ（Service Worker）。
 * 一度開いたあとは電波のない現場でも動くよう、アプリのファイルを端末に保存する。
 * アプリを更新したときは VERSION を上げる（古いキャッシュを削除して入れ替える）。
 */
var VERSION = "crane-plan-locked-1793430535951";
var FILES = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "icons/apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png"
];

// 仕様書 PDF（docs/・specs/）と PDF.js（vendor/）は大きいので、一度開いたものを別の入れ物に保存し、
// アプリを更新しても消さない（docs/ のファイル名は中身ごとに変わるので、古いものが残っても害はない）
var DOCS = "crane-plan-docs-v1";
function isDoc(url) { return /\/(docs|specs|vendor)\//.test(new URL(url).pathname); }

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(FILES); }));
  self.skipWaiting();
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== VERSION && k !== DOCS; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

// ネットにつながるときは最新を取りに行き、つながらないときは保存したものを使う
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  if (isDoc(e.request.url)) {
    e.respondWith(caches.open(DOCS).then(function (c) {
      return c.match(e.request, { ignoreSearch: true }).then(function (hit) {
        return hit || fetch(e.request).then(function (res) {
          if (res.ok) c.put(e.request, res.clone());
          return res;
        });
      });
    }));
    return;
  }
  e.respondWith(
    fetch(e.request).then(function (res) {
      if (res.ok && new URL(e.request.url).origin === location.origin) {
        var copy = res.clone();
        caches.open(VERSION).then(function (c) { c.put(e.request, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
        return hit || caches.match("index.html");
      });
    })
  );
});
