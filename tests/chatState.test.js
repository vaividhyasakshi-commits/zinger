import assert from "node:assert/strict";
import test from "node:test";
import { createIncomingTracker, unreadMessages, presenceState, MESSAGE_TTL_MS } from "../shared/chatState.js";

test("sound ignores initial cache, initial server history, outgoing messages, and duplicate snapshots", () => {
  const tracker = createIncomingTracker();
  const old = { id: "old", role: "partner" };
  const history = { id: "history", role: "partner" };
  assert.equal(tracker.update([old], "host", { fromCache: true }).length, 0);
  assert.equal(tracker.update([old, history], "host").length, 0);
  const own = { id: "own", role: "host", pending: true };
  assert.equal(tracker.update([old, history, own], "host").length, 0);
  const incoming = { id: "new", role: "partner" };
  assert.deepEqual(tracker.update([old, history, incoming], "host"), [incoming]);
  assert.equal(tracker.update([old, history, incoming], "host").length, 0);
  assert.equal(tracker.update([old], "host", { fromCache: true }).length, 0);
  assert.equal(tracker.update([old, history, incoming], "host").length, 0);
});

test("unread count clears at the read watermark and excludes expired and own messages", () => {
  const now = 2 * MESSAGE_TTL_MS;
  const messages = [
    { role: "host", createdAt: now - 100 },
    { role: "host", createdAt: now - 20 },
    { role: "partner", createdAt: now - 10 },
    { role: "host", createdAt: now - MESSAGE_TTL_MS - 1 },
  ];
  assert.equal(unreadMessages(messages, "partner", 0, now).length, 2);
  assert.equal(unreadMessages(messages, "partner", now - 100, now).length, 1);
  assert.equal(unreadMessages(messages, "partner", now, now).length, 0);
});

test("presence expires after missed heartbeats and typing expires sooner", () => {
  const presence = { active: true, typing: true, updatedAt: 100000 };
  assert.deepEqual(presenceState(presence, 101000), { active: true, typing: true });
  assert.deepEqual(presenceState(presence, 106000), { active: true, typing: false });
  assert.deepEqual(presenceState(presence, 136000), { active: false, typing: false });
  assert.deepEqual(presenceState(null, 101000), { active: false, typing: false });
});
