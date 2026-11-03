export const HISTORY_LIMIT = 200;
export const MESSAGE_TTL_MS = 24 * 60 * 60 * 1000;
export const PRESENCE_STALE_MS = 35_000;

export function timestampMillis(value) {
  return typeof value === "number" ? value : value?.toMillis?.() || 0;
}

export function unreadMessages(messages, role, readAt, now = Date.now()) {
  return messages.filter((message) => {
    const at = timestampMillis(message.createdAt);
    return message.role !== role && at > timestampMillis(readAt) && at + MESSAGE_TTL_MS > now;
  });
}

export function createIncomingTracker() {
  let initialized = false;
  const seen = new Set();
  return {
    update(messages, role, { fromCache = false } = {}) {
      const incoming = initialized && !fromCache
        ? messages.filter((m) => m.role !== role && !m.pending && !seen.has(m.id))
        : [];
      for (const message of messages) if (!message.pending) seen.add(message.id);
      if (!fromCache) initialized = true;
      if (seen.size > HISTORY_LIMIT * 4) {
        seen.clear();
        for (const message of messages) if (!message.pending) seen.add(message.id);
      }
      return incoming;
    },
  };
}

export function presenceState(presence, now = Date.now()) {
  const age = now - timestampMillis(presence?.updatedAt);
  const active = Boolean(presence?.active && age >= -5000 && age < PRESENCE_STALE_MS);
  return { active, typing: Boolean(active && presence?.typing && age < 5000) };
}

export function lastSeenLabel(at, now = Date.now()) {
  if (!at) return "Offline";
  const minutes = Math.max(0, Math.floor((now - at) / 60000));
  if (minutes < 1) return "Last seen just now";
  if (minutes < 60) return `Last seen ${minutes} min ago`;
  if (minutes < 1440) return `Last seen ${Math.floor(minutes / 60)}h ago`;
  return `Last seen ${new Date(at).toLocaleDateString()}`;
}
