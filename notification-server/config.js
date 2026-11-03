import { existsSync } from "node:fs";

export const HOST_UID = "J7Q21mlsF5NcPUJrA9llqasbt0y1";
export const PARTNER_UID = "yvc9aqXcYUYTh9LcLcyAVgn3xLj1";

export function loadServerConfig(env = process.env) {
  const raw = env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (raw) {
    let account;
    try { account = JSON.parse(raw); }
    catch { throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON must contain valid service-account JSON."); }
    if (!account.project_id || !account.client_email || !account.private_key?.includes("BEGIN PRIVATE KEY")) {
      throw new Error("Service-account JSON must contain project_id, client_email, and private_key.");
    }
    if (env.FIREBASE_PROJECT_ID && env.FIREBASE_PROJECT_ID !== account.project_id) {
      throw new Error("FIREBASE_PROJECT_ID does not match the service-account project.");
    }
    return { projectId: account.project_id, account };
  }
  if (!env.GOOGLE_APPLICATION_CREDENTIALS || !existsSync(env.GOOGLE_APPLICATION_CREDENTIALS)) {
    throw new Error("Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS to a service-account file outside the repository.");
  }
  return { projectId: env.FIREBASE_PROJECT_ID || undefined, account: null };
}
