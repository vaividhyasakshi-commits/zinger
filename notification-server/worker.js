import { randomUUID } from "node:crypto";
import { HISTORY_LIMIT, MESSAGE_TTL_MS, timestampMillis, unreadMessages } from "../shared/chatState.js";
import { HOST_UID, PARTNER_UID } from "./config.js";

const INVALID_TOKEN = new Set(["messaging/registration-token-not-registered", "messaging/invalid-registration-token"]);
const TRANSIENT = new Set([
  "messaging/server-unavailable", "messaging/internal-error", "messaging/unknown-error",
  "messaging/quota-exceeded", "messaging/message-rate-exceeded", "messaging/device-message-rate-exceeded",
  "unavailable", "deadline-exceeded", "resource-exhausted", "aborted", 14, 4, 8, 10,
]);

export function unreadSummary(messages, lastSeenAt, now = Date.now()) {
  const incoming = unreadMessages(messages.filter((m) => m.role === "host" && m.authorUid === HOST_UID), "partner", lastSeenAt, now);
  const latest = incoming.reduce((a, b) => timestampMillis(b.createdAt) > timestampMillis(a?.createdAt) ? b : a, null);
  const readAt = timestampMillis(lastSeenAt);
  return {
    type: incoming.length ? "beauty-offer" : "beauty-read",
    unreadCount: String(incoming.length),
    readAt: String(readAt),
    latestMessageAt: String(timestampMillis(latest?.createdAt)),
    eventId: `${latest?.id || "read"}:${readAt}:${incoming.length}`,
    revision: String(now),
  };
}

export function createJobProcessor({ db, messaging, now = Date.now, owner = randomUUID(), log = console }) {
  return async function processJob(jobId) {
    const ref = db.collection("_notificationJobs").doc(jobId);
    const claimed = await db.runTransaction(async (transaction) => {
      const previous = (await transaction.get(ref)).data();
      if (previous?.status === "complete") return { skipped: true };
      if (previous?.leaseUntil > now()) return { retryAfter: previous.leaseUntil - now() + 100 };
      const attempt = (previous?.attempt || 0) + 1;
      transaction.set(ref, { status: "processing", owner, attempt, leaseUntil: now() + 120000 });
      return attempt;
    });
    if (typeof claimed !== "number") return claimed;
    let token;
    const tokenRef = db.collection("pushTokens").doc(PARTNER_UID);
    try {
      const [tokenSnapshot, readSnapshot, messagesSnapshot] = await Promise.all([
        tokenRef.get(),
        db.collection("readStatus").doc(PARTNER_UID).get(),
        db.collection("messages").orderBy("createdAt", "desc").limit(HISTORY_LIMIT).get(),
      ]);
      const tokenData = tokenSnapshot.data();
      token = tokenData?.token;
      if (tokenData?.enabled && token) {
        const data = unreadSummary(messagesSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })), readSnapshot.data()?.lastSeenAt, now());
        if (Number(data.unreadCount) > 0) {
          await messaging.send({
            token,
            data,
            // Data-only messages: the service worker is the sole notification renderer.
            webpush: { headers: { Urgency: "high", TTL: "3600", Topic: "zinger-beauty-offer" } },
          });
          log.info("Notification state sent", { jobId, unreadCount: data.unreadCount });
        }
        // Chrome web push requires user-visible effects. Do not send silent zero-count
        // pushes: the authenticated page clears its own notifications when reads update.
      }
      await ref.set({ status: "complete", owner, attempt: claimed, completedAt: now() });
      return { complete: true };
    } catch (error) {
      const code = error.code || "unknown";
      if (INVALID_TOKEN.has(code)) {
        // Never delete a replacement token registered while this delivery was in flight.
        await db.runTransaction(async (transaction) => {
          const current = (await transaction.get(tokenRef)).data();
          if (current?.token === token) transaction.delete(tokenRef);
        });
        await ref.set({ status: "complete", outcome: "invalid-token", completedAt: now() });
        log.warn("Removed an invalid notification token", { code });
        return { complete: true };
      }
      const transient = TRANSIENT.has(code);
      const retryAfter = Math.min(300000, (String(code).includes("rate") || String(code).includes("quota") ? 60000 : 2000) * 2 ** Math.min(claimed - 1, 7));
      await ref.set({ status: transient ? "pending" : "complete", outcome: code, attempt: claimed, leaseUntil: 0 });
      log.error("Notification processing failed", { code, retrying: transient });
      return transient ? { retryAfter } : { complete: true };
    }
  };
}

export async function startNotificationWorker({ db, messaging, Timestamp, onFatal, log = console }) {
  const startedAt = Date.now();
  const stateRef = db.collection("_notificationState").doc(PARTNER_UID);
  const watchFrom = await db.runTransaction(async (transaction) => {
    const stored = (await transaction.get(stateRef)).data();
    if (stored?.watchFrom) return Math.max(timestampMillis(stored.watchFrom), startedAt - MESSAGE_TTL_MS);
    transaction.set(stateRef, { watchFrom: Timestamp.fromMillis(startedAt) });
    return startedAt;
  });
  const processJob = createJobProcessor({ db, messaging, log });
  const queue = new Map();
  const retryTimers = new Set();
  let stopped = false;
  let draining = null;
  const enqueue = (jobId) => {
    if (stopped) return;
    queue.set(jobId, true);
    if (draining) return;
    draining = (async () => {
      while (queue.size && !stopped) {
        const id = queue.keys().next().value;
        queue.delete(id);
        let result;
        try { result = await processJob(id); }
        catch (error) {
          log.error("Notification job storage unavailable", { code: error.code || "unknown" });
          result = { retryAfter: 10000 };
        }
        if (result.retryAfter && !stopped) {
          const timer = setTimeout(() => { retryTimers.delete(timer); enqueue(id); }, result.retryAfter);
          retryTimers.add(timer);
        }
      }
    })().finally(() => { draining = null; });
  };
  const fail = (error) => {
    log.error("Firestore notification listener stopped", { code: error.code || "unknown" });
    onFatal?.();
  };
  const stopMessages = db.collection("messages")
    .where("createdAt", ">=", Timestamp.fromMillis(watchFrom))
    .orderBy("createdAt", "asc")
    .onSnapshot((snapshot) => {
      for (const change of snapshot.docChanges()) {
        const message = change.doc.data();
        if (change.type === "added" && message.role === "host" && message.authorUid === HOST_UID && timestampMillis(message.createdAt) + MESSAGE_TTL_MS > Date.now()) enqueue(`message-${change.doc.id}`);
      }
    }, fail);
  let initialRead = true;
  const stopReads = db.collection("readStatus").doc(PARTNER_UID).onSnapshot((snapshot) => {
    // A historical read receipt on startup must not trigger an old offer.
    if (initialRead) { initialRead = false; return; }
    const readAt = timestampMillis(snapshot.data()?.lastSeenAt);
    if (readAt) enqueue(`read-${readAt}`);
  }, fail);
  log.info("Notification worker listening; message contents and credentials are never logged.");
  return {
    async stop() {
      stopped = true;
      stopMessages();
      stopReads();
      retryTimers.forEach(clearTimeout);
      queue.clear();
      await draining;
    },
  };
}
