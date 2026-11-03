import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../public/firebase-messaging-sw.js", import.meta.url), "utf8");

function harness(persisted = new Map()) {
  const events = {};
  const shown = [];
  const order = [];
  let background;
  let closed = 0;
  let focused = 0;
  let opened = 0;
  const db = {
    createObjectStore() {},
    transaction() {
      const tx = {
        objectStore: () => ({
          get(key) {
            const request = {};
            queueMicrotask(() => { request.result = structuredClone(persisted.get(key)); request.onsuccess?.(); });
            return request;
          },
          put(value, key) {
            persisted.set(key, structuredClone(value));
            queueMicrotask(() => tx.oncomplete?.());
          },
        }),
      };
      return tx;
    },
  };
  const self = {
    registration: {
      scope: "https://example.github.io/zinger/",
      showNotification: async (title, options) => { shown.push({ title, ...options }); },
      getNotifications: async () => shown.slice(-1).map(() => ({ close: () => { closed++; } })),
    },
    clients: {
      matchAll: async () => [{ url: "https://example.github.io/zinger/", focus: () => { focused++; } }],
      openWindow: () => { opened++; }, claim: async () => {},
    },
    skipWaiting: async () => {},
    addEventListener: (name, handler) => { events[name] = handler; order.push(name); },
    ZINGER_FIREBASE_CONFIG: {}, ZINGER_FIREBASE_SDK_VERSION: "12.19.0",
  };
  vm.runInNewContext(source, {
    self, console, Date,
    importScripts: () => { order.push("importScripts"); },
    firebase: { initializeApp() {}, messaging: () => ({ onBackgroundMessage: (handler) => { background = handler; } }) },
    indexedDB: { open() {
      const request = {};
      queueMicrotask(() => { request.result = db; request.onsuccess?.(); });
      return request;
    } },
  });
  const message = (data) => new Promise((resolve, reject) => events.message({
    data, source: { url: "https://example.github.io/zinger/" }, ports: [],
    waitUntil: (promise) => promise.then(resolve, reject),
  }));
  const offer = (extra = {}) => background({ data: {
    type: "beauty-offer", unreadCount: "1", readAt: "0", latestMessageAt: String(Date.now() - 100),
    revision: String(Date.now()), eventId: "new:1", ...extra,
  } });
  return { shown, message, offer, events, order, persisted, stats: () => ({ closed, focused, opened }) };
}

test("worker requires successful registration, replaces offers, and deduplicates replays", async () => {
  const h = harness();
  await h.offer();
  assert.equal(h.shown.length, 0);
  await h.message({ type: "ZINGER_PUSH_STATE", enabled: true });
  await h.offer();
  await h.offer();
  assert.equal(h.shown.length, 1);
  assert.equal(h.shown[0].title, "Beauty Deals • 20% OFF 💗");
  assert.equal(h.shown[0].body, "1 product waiting for you! ✨");
  await h.offer({ unreadCount: "2", eventId: "new:2" });
  assert.equal(h.shown[1].body, "2 products waiting for you! ✨");
  assert.equal(h.shown[0].tag, h.shown[1].tag);
  await h.offer({ unreadCount: "NaN", eventId: "bad" });
  assert.equal(h.shown.length, 2);
});

test("reading closes the existing notification and suppresses delayed already-read pushes", async () => {
  const h = harness();
  const readAt = Date.now();
  await h.message({ type: "ZINGER_PUSH_STATE", enabled: true });
  await h.offer({ latestMessageAt: String(readAt - 100) });
  await h.message({ type: "ZINGER_READ", readAt });
  await h.offer({ latestMessageAt: String(readAt - 100), eventId: "late" });
  assert.equal(h.shown.length, 1);
  assert.ok(h.stats().closed > 0);
});

test("logout stays disabled across service-worker restarts", async () => {
  const h = harness();
  await h.message({ type: "ZINGER_PUSH_STATE", enabled: true });
  await h.message({ type: "ZINGER_PUSH_STATE", enabled: false });
  const restarted = harness(h.persisted);
  await restarted.offer();
  assert.equal(restarted.shown.length, 0);
});

test("read-reset push closes offers and older revisions cannot recreate them", async () => {
  const h = harness();
  const now = Date.now();
  await h.message({ type: "ZINGER_PUSH_STATE", enabled: true });
  await h.offer({ revision: String(now - 10) });
  await h.offer({ type: "beauty-read", unreadCount: "0", readAt: String(now), revision: String(now) });
  await h.offer({ revision: String(now - 5), eventId: "old" });
  assert.equal(h.shown.length, 1);
  assert.ok(h.stats().closed > 0);
});

test("custom click handler is installed before FCM and focuses only the app scope", async () => {
  const h = harness();
  assert.ok(h.order.indexOf("notificationclick") < h.order.indexOf("importScripts"));
  await new Promise((resolve, reject) => h.events.notificationclick({
    stopImmediatePropagation() {}, notification: { close() {}, data: { url: "https://untrusted.example/" } },
    waitUntil: (promise) => promise.then(resolve, reject),
  }));
  assert.deepEqual(h.stats(), { closed: 0, focused: 1, opened: 0 });
});
