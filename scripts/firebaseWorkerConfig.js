import { getFirebaseWebConfig } from "../src/config.js";

export function workerConfigSource(env, sdkVersion) {
  // Explicit allowlist: never serialize process.env or any service-account fields.
  return `self.ZINGER_FIREBASE_CONFIG = ${JSON.stringify(getFirebaseWebConfig(env))};\n` +
    `self.ZINGER_FIREBASE_SDK_VERSION = ${JSON.stringify(sdkVersion)};\n`;
}

export function firebaseWorkerConfig(env, sdkVersion) {
  const source = workerConfigSource(env, sdkVersion);
  return {
    name: "zinger-firebase-worker-config",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split("?")[0] !== `${server.config.base}firebase-config.js`) return next();
        res.setHeader("Content-Type", "application/javascript");
        res.setHeader("Cache-Control", "no-store");
        res.end(source);
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "firebase-config.js", source });
    },
  };
}
