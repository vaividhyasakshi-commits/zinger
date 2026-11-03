import assert from "node:assert/strict";
import test from "node:test";
import { createPushRegistration } from "../src/pushRegistration.js";

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

function setup(overrides = {}) {
  const calls = [];
  const deps = {
    currentUid: () => "partner", permission: () => "granted",
    requestPermission: async () => { calls.push("prompt"); return "granted"; },
    prepare: async () => ({}), token: async () => "token",
    save: async () => { calls.push("save"); },
    setEnabled: async (enabled) => { calls.push(enabled ? "on" : "off"); },
    remove: async () => { calls.push("remove"); }, revoke: async () => { calls.push("revoke"); },
    ...overrides,
  };
  return { client: createPushRegistration(deps), calls };
}

test("automatic restore never prompts, including when permission is default or denied", async () => {
  for (const permission of ["default", "denied", "unsupported"]) {
    const { client, calls } = setup({ permission: () => permission });
    await assert.rejects(client.enable({ uid: "partner" }));
    assert.deepEqual(calls, []);
  }
});

test("button prompt and concurrent registration are performed once", async () => {
  const gate = deferred();
  const { client, calls } = setup({ permission: () => "default", prepare: () => gate.promise });
  const first = client.enable({ uid: "partner" }, { requestPermission: true });
  const second = client.enable({ uid: "partner" }, { requestPermission: true });
  gate.resolve({});
  await Promise.all([first, second]);
  assert.deepEqual(calls, ["prompt", "save", "on"]);
});

test("logout cancels an in-flight token lookup before it can save or enable alerts", async () => {
  const gate = deferred();
  const reached = deferred();
  const { client, calls } = setup({ token: () => { reached.resolve(); return gate.promise; } });
  const enabling = client.enable({ uid: "partner" });
  const rejected = assert.rejects(enabling, /cancelled/);
  await reached.promise;
  const disabling = client.disable({ uid: "partner" });
  gate.resolve("token");
  await Promise.all([rejected, disabling]);
  assert.ok(!calls.includes("save"));
  assert.ok(!calls.includes("on"));
  assert.ok(calls.includes("remove") && calls.includes("revoke"));
});

test("logout removes a token saved just before registration was cancelled", async () => {
  const gate = deferred();
  const reached = deferred();
  const { client, calls } = setup({ save: () => { reached.resolve(); return gate.promise; } });
  const enabling = client.enable({ uid: "partner" });
  const rejected = assert.rejects(enabling, /cancelled/);
  await reached.promise;
  const disabling = client.disable({ uid: "partner" });
  gate.resolve();
  await Promise.all([rejected, disabling]);
  assert.ok(!calls.includes("on"));
  assert.ok(calls.includes("remove"));
});

test("cleanup still revokes browser delivery if server-token removal fails", async () => {
  const { client, calls } = setup({ remove: async () => { throw new Error("offline"); } });
  await assert.rejects(client.disable({ uid: "partner" }), /offline/);
  assert.ok(calls.includes("revoke"));
  assert.equal(calls.filter((call) => call === "off").length, 2);
});

test("immediate logout cannot deadlock registration, and rapid re-login waits for revocation", async () => {
  const gate = deferred();
  const { client, calls } = setup({ revoke: async () => { await gate.promise; calls.push("revoke"); } });
  const old = client.enable({ uid: "partner" });
  const rejected = assert.rejects(old, /cancelled/);
  const closing = client.disable({ uid: "partner" });
  client.cancel();
  const fresh = client.enable({ uid: "partner" });
  gate.resolve();
  await Promise.all([rejected, closing, fresh]);
  assert.ok(calls.lastIndexOf("revoke") < calls.lastIndexOf("save"));
  assert.equal(calls.at(-1), "on");
});
