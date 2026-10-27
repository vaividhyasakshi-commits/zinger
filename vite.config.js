import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { validateClientConfig } from "./src/config.js";

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
    plugins: [react()],
    base: env.VITE_BASE_PATH?.trim() || "/zinger/",
    server: {
      host: "0.0.0.0",
    },
  };
});
