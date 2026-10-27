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
