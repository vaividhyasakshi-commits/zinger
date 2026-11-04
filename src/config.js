export const requiredClientVariables = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_APP_ID",
  "VITE_HOST_UID",
  "VITE_PARTNER_UID",
  "VITE_HOST_EMAIL",
  "VITE_PARTNER_EMAIL",
];

export function validateClientConfig(env) {
  const issues = requiredClientVariables.filter((name) => {
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

  return issues;
}

export function getFirebaseWebConfig(env) {
  return Object.fromEntries([
    ["apiKey", "VITE_FIREBASE_API_KEY"],
    ["authDomain", "VITE_FIREBASE_AUTH_DOMAIN"],
    ["projectId", "VITE_FIREBASE_PROJECT_ID"],
    ["appId", "VITE_FIREBASE_APP_ID"],
  ].map(([key, name]) => [key, env[name]?.trim() || ""]));
}

export function normalizeBasePath(value = "/zinger/") {
  const path = value.trim() || "/zinger/";
  if (!path.startsWith("/") || path.startsWith("//") || /[?#\\]/.test(path) || path.split("/").includes("..")) {
    throw new Error("VITE_BASE_PATH must be a site path such as /zinger/ or /.");
  }
  return path === "/" ? "/" : `${path.replace(/\/+$/, "")}/`;
}
