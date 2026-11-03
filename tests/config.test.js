import assert from "node:assert/strict";
import test from "node:test";
import { requiredClientVariables, validateClientConfig, normalizeBasePath } from "../src/config.js";
import { workerConfigSource } from "../scripts/firebaseWorkerConfig.js";
import { readFileSync } from "node:fs";

const configured = {
  VITE_FIREBASE_API_KEY: `AIza${"a".repeat(35)}`,
  VITE_FIREBASE_AUTH_DOMAIN: "test-project.firebaseapp.com",
  VITE_FIREBASE_PROJECT_ID: "test-project",
  VITE_FIREBASE_APP_ID: "1:123:web:abc",
  VITE_FIREBASE_MESSAGING_SENDER_ID: "123",
  VITE_FIREBASE_VAPID_KEY: `B${"a".repeat(86)}`,
  VITE_HOST_UID: "host-uid",
  VITE_PARTNER_UID: "partner-uid",
  VITE_HOST_EMAIL: "host@example.com",
  VITE_PARTNER_EMAIL: "partner@example.com",
};

test("reports every missing Actions variable before Firebase starts", () => {
  assert.deepEqual(validateClientConfig({}), requiredClientVariables);
});

test("rejects empty Actions values even when other values are configured", () => {
  for (const name of requiredClientVariables) {
    assert.deepEqual(validateClientConfig({ ...configured, [name]: "  " }), [name]);
  }
});

test("rejects an invalid key or an unfilled UID placeholder", () => {
  assert.deepEqual(
    validateClientConfig({ ...configured, VITE_FIREBASE_API_KEY: "invalid-key" }),
    ["VITE_FIREBASE_API_KEY"]
  );
  assert.deepEqual(
    validateClientConfig({ ...configured, VITE_HOST_UID: "REPLACE_HOST_UID" }),
    ["VITE_HOST_UID"]
  );
});

test("accepts complete client configuration without requiring a base path", () => {
  assert.deepEqual(validateClientConfig(configured), []);
});

test("rejects missing push configuration and a sender from another Firebase project", () => {
  assert.deepEqual(validateClientConfig({ ...configured, VITE_FIREBASE_VAPID_KEY: "" }), ["VITE_FIREBASE_VAPID_KEY"]);
  assert.deepEqual(validateClientConfig({ ...configured, VITE_FIREBASE_VAPID_KEY: "not-a-vapid-key" }), ["VITE_FIREBASE_VAPID_KEY"]);
  assert.deepEqual(validateClientConfig({ ...configured, VITE_FIREBASE_MESSAGING_SENDER_ID: "456" }), ["VITE_FIREBASE_MESSAGING_SENDER_ID"]);
});

test("missing push settings do not disable existing authentication locally", () => {
  assert.deepEqual(validateClientConfig({ ...configured, VITE_FIREBASE_MESSAGING_SENDER_ID: "", VITE_FIREBASE_VAPID_KEY: "" }, { requirePush: false }), []);
});

test("normalizes GitHub Pages paths and rejects unsafe paths", () => {
  assert.equal(normalizeBasePath(), "/zinger/");
  assert.equal(normalizeBasePath(" /zinger "), "/zinger/");
  assert.equal(normalizeBasePath("/"), "/");
  for (const path of ["https://example.com/", "//example.com/", "/../other/", "/zinger/?x"]) assert.throws(() => normalizeBasePath(path));
});

test("service-worker config contains only public web fields and uses the installed SDK version", () => {
  const source = workerConfigSource({ ...configured, FIREBASE_SERVICE_ACCOUNT_JSON: "PRIVATE_SERVER_ONLY", VITE_OTHER_SECRET: "DO_NOT_EMIT" }, "12.19.0");
  assert.ok(source.includes('"messagingSenderId":"123"'));
  assert.ok(source.includes('"12.19.0"'));
  assert.ok(!source.includes("PRIVATE_SERVER_ONLY"));
  assert.ok(!source.includes("DO_NOT_EMIT"));
});

test("actual Pages workflow passes every required client setting into the build", () => {
  const workflow = readFileSync(new URL("../.github/workflows/deploy.yml", import.meta.url), "utf8");
  for (const name of requiredClientVariables) assert.match(workflow, new RegExp(`${name}: \\$\\{\\{ vars\\.${name}`));
});
