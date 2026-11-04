import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, serverTimestamp, Timestamp, updateDoc } from "firebase/firestore";

const HOST_UID = "J7Q21mlsF5NcPUJrA9llqasbt0y1";
const PARTNER_UID = "yvc9aqXcYUYTh9LcLcyAVgn3xLj1";
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
