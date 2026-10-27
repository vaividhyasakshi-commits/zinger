import assert from "node:assert/strict";
import test from "node:test";
import { requiredClientVariables, validateClientConfig } from "../src/config.js";

const configured = {
  VITE_FIREBASE_API_KEY: `AIza${"a".repeat(35)}`,
  VITE_FIREBASE_AUTH_DOMAIN: "test-project.firebaseapp.com",
  VITE_FIREBASE_PROJECT_ID: "test-project",
  VITE_FIREBASE_APP_ID: "1:123:web:abc",
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
