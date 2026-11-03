import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { startNotificationWorker } from "../notification-server/worker.js";
import { HOST_UID, PARTNER_UID } from "../notification-server/config.js";

test("emulator: real worker observes new messages, clears reads, and resumes without replaying processed jobs", {
  skip: process.env.FIRESTORE_EMULATOR_HOST ? false : "Run using the local Firestore emulator (see README).",
  timeout: 30000,
}, async () => {
  const require = createRequire(new URL("../notification-server/package.json", import.meta.url));
  const { initializeApp, deleteApp } = require("firebase-admin/app");
  const { getFirestore, Timestamp, FieldValue } = require("firebase-admin/firestore");
  const app = initializeApp({ projectId: "demo-zinger" }, "zinger-worker-test");
  const db = getFirestore(app);
  const sent = [];
  const log = { info() {}, warn() {}, error() {} };
  const messaging = { send: async (payload) => { sent.push(payload); return "emulator-fake-fcm"; } };
  let worker;
  const waitFor = async (condition) => {
    const deadline = Date.now() + 8000;
    while (!await condition()) {
      if (Date.now() > deadline) throw new Error("Timed out waiting for emulated notification processing.");
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  };
  const hostMessage = (id) => db.collection("messages").doc(id).set({
    role: "host", authorUid: HOST_UID, text: "PRIVATE_TEST_CONTENT", createdAt: FieldValue.serverTimestamp(),
  });
  try {
    await db.collection("pushTokens").doc(PARTNER_UID).set({ token: "fake-emulator-token", enabled: true });
    await hostMessage("historical");
    worker = await startNotificationWorker({ db, messaging, Timestamp, log });
    await hostMessage("first");
    await waitFor(() => sent.length === 1);
    // Historical messages contribute to unread count, but did not create an old-message job.
    assert.equal(sent[0].data.unreadCount, "2");
    assert.equal((await db.collection("_notificationJobs").doc("message-historical").get()).exists, false);
    await hostMessage("second");
    await waitFor(() => sent.length === 2);
    assert.equal(sent[1].data.unreadCount, "3");
    await db.collection("readStatus").doc(PARTNER_UID).set({ uid: PARTNER_UID, lastSeenAt: FieldValue.serverTimestamp() });
    const readAt = (await db.collection("readStatus").doc(PARTNER_UID).get()).data().lastSeenAt.toMillis();
    await waitFor(async () => (await db.collection("_notificationJobs").doc(`read-${readAt}`).get()).data()?.status === "complete");
    assert.equal(sent.length, 2);
    assert.ok(!JSON.stringify(sent).includes("PRIVATE_TEST_CONTENT"));
    await worker.stop();
    const beforeRestart = sent.length;
    await hostMessage("during-restart");
    worker = await startNotificationWorker({ db, messaging, Timestamp, log });
    await waitFor(() => sent.length === beforeRestart + 1);
    assert.equal(sent.at(-1).data.unreadCount, "1");
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.equal(sent.length, beforeRestart + 1);
  } finally {
    await worker?.stop();
    for (const collection of await db.listCollections()) await db.recursiveDelete(collection);
    await deleteApp(app);
  }
});
