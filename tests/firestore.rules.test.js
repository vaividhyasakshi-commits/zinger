import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, serverTimestamp, Timestamp, updateDoc } from "firebase/firestore";
import { HOST_UID, PARTNER_UID } from "../notification-server/config.js";

const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
let environment;
before(async () => {
  if (!enabled) return;
  environment = await initializeTestEnvironment({
    projectId: "demo-zinger",
    firestore: { rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8") },
  });
});
after(async () => { await environment?.cleanup(); });
const ruleTest = (name, callback) => test(name, { skip: enabled ? false : "Run using the local Firestore emulator (see README)." }, callback);
const db = (uid) => uid ? environment.authenticatedContext(uid).firestore() : environment.unauthenticatedContext().firestore();

ruleTest("rules: only participants read messages and authors cannot spoof another role or UID", async () => {
  const host = db(HOST_UID);
  const message = { text: "rule test", role: "host", authorUid: HOST_UID, createdAt: serverTimestamp() };
  await assertSucceeds(setDoc(doc(host, "messages", "valid"), message));
  await assertSucceeds(getDoc(doc(db(PARTNER_UID), "messages", "valid")));
  await assertFails(getDoc(doc(db("stranger"), "messages", "valid")));
  await assertFails(getDoc(doc(db(), "messages", "valid")));
  await assertFails(setDoc(doc(db(PARTNER_UID), "messages", "spoof"), message));
  await assertFails(setDoc(doc(host, "messages", "wrong-role"), { ...message, role: "partner" }));
  await assertFails(updateDoc(doc(host, "messages", "valid"), { text: "edited" }));
});

ruleTest("rules: reply validation remains strict", async () => {
  const host = db(HOST_UID);
  const message = { text: "reply", role: "host", authorUid: HOST_UID, createdAt: serverTimestamp(), replyTo: { id: "valid", role: "partner", text: "quoted" } };
  await assertSucceeds(setDoc(doc(host, "messages", "reply"), message));
  await assertFails(setDoc(doc(host, "messages", "bad-reply"), { ...message, replyTo: { ...message.replyTo, text: "x".repeat(161) } }));
  await assertFails(setDoc(doc(host, "messages", "extra-reply"), { ...message, replyTo: { ...message.replyTo, extra: true } }));
});

ruleTest("rules: own read receipts and presence accept server timestamps; cross-user writes fail", async () => {
  const host = db(HOST_UID);
  await assertSucceeds(setDoc(doc(host, "readStatus", HOST_UID), { uid: HOST_UID, lastSeenAt: serverTimestamp() }));
  await assertFails(setDoc(doc(host, "readStatus", PARTNER_UID), { uid: PARTNER_UID, lastSeenAt: serverTimestamp() }));
  await assertFails(setDoc(doc(host, "readStatus", HOST_UID), { uid: HOST_UID, lastSeenAt: Timestamp.fromMillis(0) }));
  const presence = doc(host, "presence", HOST_UID);
  await assertSucceeds(setDoc(presence, { uid: HOST_UID, active: true, typing: true, updatedAt: serverTimestamp(), lastActiveAt: serverTimestamp() }));
  await assertSucceeds(setDoc(presence, { active: false, typing: false, updatedAt: serverTimestamp() }, { merge: true }));
  const data = (await getDoc(presence)).data();
  assert.ok(data.lastActiveAt);
  await assertFails(setDoc(doc(host, "presence", PARTNER_UID), { uid: PARTNER_UID, active: true, typing: false, updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(presence, { lastActiveAt: Timestamp.fromMillis(0), updatedAt: serverTimestamp() }));
});

ruleTest("rules: tokens are owner-only and notification job state is server-only", async () => {
  const partner = db(PARTNER_UID);
  await assertSucceeds(setDoc(doc(partner, "pushTokens", PARTNER_UID), { uid: PARTNER_UID, token: "test-token", enabled: true, updatedAt: serverTimestamp() }));
  await assertFails(getDoc(doc(db(HOST_UID), "pushTokens", PARTNER_UID)));
  await assertFails(setDoc(doc(db(HOST_UID), "pushTokens", PARTNER_UID), { uid: PARTNER_UID, token: "spoof", enabled: true, updatedAt: serverTimestamp() }));
  for (const collection of ["_notificationJobs", "_notificationState", "unrelated"]) {
    await assertFails(setDoc(doc(partner, collection, "test"), { status: "complete" }));
    await assertFails(getDoc(doc(partner, collection, "test")));
  }
});
