const authVariables = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_APP_ID",
  "VITE_HOST_UID",
  "VITE_PARTNER_UID",
  "VITE_HOST_EMAIL",
  "VITE_PARTNER_EMAIL",
];

export const requiredClientVariables = [
  ...authVariables,
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_VAPID_KEY",
];

export function validateClientConfig(env, { requirePush = true } = {}) {
  const required = requirePush ? requiredClientVariables : authVariables;
  const issues = required.filter((name) => {
    const value = env[name]?.trim();
    return !value || /^(REPLACE_|YOUR_|PASTE_)/i.test(value);
  });

  const apiKey = env.VITE_FIREBASE_API_KEY?.trim();
  if (
    apiKey &&
    !/^AIza[\w-]{35}$/.test(apiKey) &&
    !issues.includes("VITE_FIREBASE_API_KEY")
  ) {
    issues.push("VITE_FIREBASE_API_KEY");
  }

  if (requirePush) {
    const sender = env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim();
    const vapid = env.VITE_FIREBASE_VAPID_KEY?.trim();
    if (sender && !/^\d+$/.test(sender) && !issues.includes("VITE_FIREBASE_MESSAGING_SENDER_ID")) {
      issues.push("VITE_FIREBASE_MESSAGING_SENDER_ID");
    }
    // An uncompressed P-256 public key is 65 bytes (87 unpadded base64url characters).
    if (vapid && !/^B[A-Za-z0-9_-]{86}=?$/.test(vapid) && !issues.includes("VITE_FIREBASE_VAPID_KEY")) {
      issues.push("VITE_FIREBASE_VAPID_KEY");
    }
    const appSender = env.VITE_FIREBASE_APP_ID?.trim().match(/^1:(\d+):web:/)?.[1];
    if (appSender && sender && appSender !== sender && !issues.includes("VITE_FIREBASE_MESSAGING_SENDER_ID")) {
      issues.push("VITE_FIREBASE_MESSAGING_SENDER_ID");
    }
  }

  return issues;
}

export function getFirebaseWebConfig(env) {
  return Object.fromEntries([
    ["apiKey", "VITE_FIREBASE_API_KEY"],
    ["authDomain", "VITE_FIREBASE_AUTH_DOMAIN"],
    ["projectId", "VITE_FIREBASE_PROJECT_ID"],
    ["appId", "VITE_FIREBASE_APP_ID"],
    ["messagingSenderId", "VITE_FIREBASE_MESSAGING_SENDER_ID"],
  ].map(([key, name]) => [key, env[name]?.trim() || ""]));
}

export function normalizeBasePath(value = "/zinger/") {
  const path = value.trim() || "/zinger/";
  if (!path.startsWith("/") || path.startsWith("//") || /[?#\\]/.test(path) || path.split("/").includes("..")) {
    throw new Error("VITE_BASE_PATH must be a site path such as /zinger/ or /.");
  }
  return path === "/" ? "/" : `${path.replace(/\/+$/, "")}/`;
}
