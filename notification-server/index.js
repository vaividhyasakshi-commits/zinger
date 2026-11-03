import { initializeApp, cert, applicationDefault, deleteApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { loadServerConfig } from "./config.js";
import { startNotificationWorker } from "./worker.js";

let serverApp;

try {
  try { process.loadEnvFile(".env"); }
  catch (error) { if (error.code !== "ENOENT") throw new Error("Could not read the notification server .env file."); }
  const config = loadServerConfig();
  const app = serverApp = initializeApp({
    credential: config.account ? cert(config.account) : applicationDefault(),
    ...(config.projectId ? { projectId: config.projectId } : {}),
  });
  if (process.argv.includes("--check-config")) {
    console.log("Server credential configuration parsed successfully. This is an offline check; Firebase access has not been tested.");
    await deleteApp(app);
  } else {
    let worker;
    let shuttingDown = false;
    const shutdown = async (code = 0) => {
      if (shuttingDown) return;
      shuttingDown = true;
      await worker?.stop();
      await deleteApp(app);
      process.exitCode = code;
    };
    worker = await startNotificationWorker({
      db: getFirestore(app), messaging: getMessaging(app), Timestamp,
      onFatal: () => { shutdown(1).catch(() => { process.exitCode = 1; }); },
    });
    process.on("SIGTERM", () => { shutdown().catch(() => { process.exitCode = 1; }); });
    process.on("SIGINT", () => { shutdown().catch(() => { process.exitCode = 1; }); });
  }
} catch (error) {
  // Configuration errors are curated; SDK error messages can contain sensitive request data.
  console.error("Notification server startup failed:", error.code || (error.name === "Error" ? error.message : error.name));
  if (serverApp) await deleteApp(serverApp).catch(() => {});
  process.exitCode = 1;
}
