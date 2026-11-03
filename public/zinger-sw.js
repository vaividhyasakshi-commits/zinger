
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url;

  if (!targetUrl) return;

  event.waitUntil(
    clients
      .matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      .then(async (windows) => {
        for (const client of windows) {
          if (client.url === targetUrl) {
            return client.focus();
          }
        }

        return clients.openWindow(targetUrl);
      })
  );
});
