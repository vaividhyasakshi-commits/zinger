
// Firebase Web Push Service Worker
// Replace every REPLACE_* value with your PUBLIC Firebase web config.

importScripts(
  "https://www.gstatic.com/firebasejs/12.4.0/firebase-app-compat.js"
);

importScripts(
  "https://www.gstatic.com/firebasejs/12.4.0/firebase-messaging-compat.js"
);

firebase.initializeApp({
  apiKey: "REPLACE_FIREBASE_API_KEY",
  authDomain: "REPLACE_FIREBASE_AUTH_DOMAIN",
  projectId: "REPLACE_FIREBASE_PROJECT_ID",
  appId: "REPLACE_FIREBASE_APP_ID",
  messagingSenderId: "REPLACE_MESSAGING_SENDER_ID",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const unreadCount = Number(payload.data?.unreadCount || 1);
  const count = Math.max(1, unreadCount);

  const title = "Beauty Deals • 20% OFF 💗";

  const body =
    count === 1
      ? "1 product waiting for you! ✨"
      : `${count} products waiting for you! ✨`;

  const base = self.registration.scope;

  self.registration.showNotification(title, {
    body,
    tag: "zinger-beauty-offer",
    renotify: false,
    silent: true,
    icon: `${base}favicon.svg`,
    badge: `${base}favicon.svg`,
    data: {
      url: base,
    },
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url =
    event.notification.data?.url ||
    self.registration.scope;

  event.waitUntil(
    clients
      .matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      .then(async (windows) => {
        for (const client of windows) {
          if (client.url.startsWith(url)) {
            return client.focus();
          }
        }

        return clients.openWindow(url);
      })
  );
});
