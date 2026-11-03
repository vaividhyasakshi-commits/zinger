import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { createRequire } from "node:module";
import { normalizeBasePath, validateClientConfig } from "./src/config.js";
import { firebaseWorkerConfig } from "./scripts/firebaseWorkerConfig.js";

const sdkVersion = createRequire(import.meta.url)("firebase/package.json").version;

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const issues = validateClientConfig(env);

  if (command === "build" && issues.length > 0) {
    throw new Error(
      `Missing or invalid client configuration: ${issues.join(", ")}. ` +
        "Set these values in .env locally or in GitHub Actions repository variables before deploying."
    );
  }

  return {
    plugins: [react(), firebaseWorkerConfig(env, sdkVersion)],
    base: normalizeBasePath(env.VITE_BASE_PATH),
    server: {
      host: "0.0.0.0",
    },
  };
});
