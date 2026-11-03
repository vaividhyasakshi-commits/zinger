import assert from "node:assert/strict";
import test from "node:test";
import { createJobProcessor, unreadSummary } from "../notification-server/worker.js";
import { loadServerConfig, HOST_UID, PARTNER_UID } from "../notification-server/config.js";
import { MESSAGE_TTL_MS } from "../shared/chatState.js";

const now = 2 * MESSAGE_TTL_MS;
const quiet = { info() {}, warn() {}, error() {} };

function fixture(send = async () => "sent") {
  const storage = new Map([
    [`pushTokens/${PARTNER_UID}`, { token: "original", enabled: true }],
    [`readStatus/${PARTNER_UID}`, { lastSeenAt: now - 1000 }],
  ]);
  const history = [
    { id: "new", role: "host", authorUid: HOST_UID, createdAt: now - 100 },
    { id: "own", role: "partner", authorUid: PARTNER_UID, createdAt: now - 50 },
  ];
  const sent = [];
  const snapshot = (path) => ({ data: () => storage.get(path), exists: storage.has(path) });
  const ref = (path) => ({
    path, get: async () => snapshot(path),
    set: async (data) => storage.set(path, structuredClone(data)),
  });
  const db = {
    collection(name) {
      const query = {
        doc: (id) => ref(`${name}/${id}`),
        orderBy: () => query,
        limit: (limit) => { assert.equal(limit, 200); return query; },
        get: async () => ({ docs: history.map((data) => ({ id: data.id, data: () => data })) }),
      };
      return query;
    },
    runTransaction: (callback) => callback({
      get: async (doc) => snapshot(doc.path),
      set: (doc, data) => storage.set(doc.path, structuredClone(data)),
      delete: (doc) => storage.delete(doc.path),
    }),
  };
  const process = createJobProcessor({ db, now: () => now, log: quiet, messaging: { send: async (payload) => { sent.push(payload); return send(payload, storage); } } });
  return { process, storage, sent, history };
}

test("backend sends only counts and delivery metadata, and persists processing deduplication", async () => {
  const { process, sent, storage } = fixture();
  await process("new");
  await process("new");
  assert.equal(sent.length, 1);
  assert.equal(sent[0].data.unreadCount, "1");
  assert.equal(sent[0].notification, undefined);
  assert.deepEqual(Object.keys(sent[0].data).sort(), ["eventId", "latestMessageAt", "readAt", "revision", "type", "unreadCount"]);
  assert.equal(sent[0].webpush.headers.Topic, "zinger-beauty-offer");
  assert.equal(storage.get("_notificationJobs/new").status, "complete");
});

test("actual unread count excludes already-read, expired, own, and spoofed messages", () => {
  const host = (id, at, authorUid = HOST_UID) => ({ id, role: "host", authorUid, createdAt: at, text: "MUST_NOT_LEAK" });
  const summary = unreadSummary([
    host("read", now - 1000), host("1", now - 100), host("2", now - 50),
    host("old", now - MESSAGE_TTL_MS - 1), host("spoof", now - 20, "wrong"),
    { id: "own", role: "partner", authorUid: PARTNER_UID, createdAt: now },
  ], now - 500, now);
  assert.equal(summary.unreadCount, "2");
  assert.ok(!JSON.stringify(summary).includes("MUST_NOT_LEAK"));
  assert.equal(unreadSummary([host("read", now - 100)], now, now).type, "beauty-read");
});

test("temporary FCM failure is scheduled for retry and can then succeed", async () => {
  let fail = true;
  const { process, storage } = fixture(async () => {
    if (fail) throw Object.assign(new Error("temporary"), { code: "messaging/server-unavailable" });
  });
  assert.equal((await process("job")).retryAfter, 2000);
  assert.equal(storage.get("_notificationJobs/job").status, "pending");
  fail = false;
  assert.equal((await process("job")).complete, true);
});

test("invalid-token cleanup preserves a newly registered replacement token", async () => {
  const { process, storage } = fixture(async (_, data) => {
    data.set(`pushTokens/${PARTNER_UID}`, { token: "replacement", enabled: true });
    throw Object.assign(new Error("invalid"), { code: "messaging/registration-token-not-registered" });
  });
  await process("job");
  assert.equal(storage.get(`pushTokens/${PARTNER_UID}`).token, "replacement");
});

test("confirmed invalid tokens are removed; disabled tokens are not sent", async () => {
  const invalid = fixture(async () => { throw Object.assign(new Error("invalid"), { code: "messaging/invalid-registration-token" }); });
  await invalid.process("job");
  assert.equal(invalid.storage.has(`pushTokens/${PARTNER_UID}`), false);
  const disabled = fixture();
  disabled.storage.set(`pushTokens/${PARTNER_UID}`, { token: "token", enabled: false });
  await disabled.process("job");
  assert.equal(disabled.sent.length, 0);
});

test("a crashed worker's lease is retried after expiry rather than losing the job", async () => {
  const { process, storage } = fixture();
  storage.set("_notificationJobs/leased", { status: "processing", leaseUntil: now + 1000 });
  assert.equal((await process("leased")).retryAfter, 1100);
});

test("reading resets the count without sending a silent zero-count web push", async () => {
  const { process, storage, sent } = fixture();
  storage.set(`readStatus/${PARTNER_UID}`, { lastSeenAt: now });
  await process("read-job");
  assert.equal(sent.length, 0);
  assert.equal(storage.get("_notificationJobs/read-job").status, "complete");
});

test("backend rejects missing and malformed credentials without echoing them", () => {
  assert.throws(() => loadServerConfig({}), /Set FIREBASE_SERVICE_ACCOUNT_JSON/);
  assert.throws(() => loadServerConfig({ FIREBASE_SERVICE_ACCOUNT_JSON: "PRIVATE_INVALID_VALUE" }), (error) => !error.message.includes("PRIVATE_INVALID_VALUE"));
  assert.throws(() => loadServerConfig({ FIREBASE_SERVICE_ACCOUNT_JSON: "{}" }), /project_id/);
});
