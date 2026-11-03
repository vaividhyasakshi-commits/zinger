import { doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { getMessaging, getToken, deleteToken, isSupported, onMessage } from "firebase/messaging";
import { app, auth, db, PARTNER_UID } from "./firebase.js";
import { validateClientConfig } from "./config.js";
import { createPushRegistration } from "./pushRegistration.js";

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY?.trim();
const baseUrl = new URL(import.meta.env.BASE_URL, window.location.origin);
let messagingInstance;
let workerRegistration;

function withTimeout(promise, message, ms = 20000) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms); }),
  ]).finally(() => clearTimeout(timer));
}

async function getPushMessaging() {
  if (!app || !db) throw new Error("Firebase is not initialized.");
  if (!window.isSecureContext || !(await isSupported())) throw new Error("Web push requires a supported browser on HTTPS (or localhost).");
  return messagingInstance ||= getMessaging(app);
}

async function activeWorker(registration) {
  const worker = registration.installing || registration.waiting || registration.active;
  if (!worker) throw new Error("The notification service worker is unavailable.");
  if (worker.state === "activated") return worker;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error("Notification service worker activation timed out.")), 20000);
    const finish = (error) => {
      clearTimeout(timer);
      worker.removeEventListener("statechange", change);
      error ? reject(error) : resolve();
    };
    const change = () => {
      if (worker.state === "activated") finish();
      else if (worker.state === "redundant") finish(new Error("Notification service worker installation failed."));
    };
    worker.addEventListener("statechange", change);
    change();
  });
  return worker;
}

async function sendWorkerMessage(data, registration = workerRegistration) {
  if (!("serviceWorker" in navigator)) return;
  registration ||= await navigator.serviceWorker.getRegistration(baseUrl.href);
  if (!registration) return;
  const worker = await activeWorker(registration);
  if (!worker.scriptURL.startsWith(new URL("firebase-messaging-sw.js", baseUrl).href)) return;
  const channel = new MessageChannel();
  await new Promise((resolve, reject) => {
    const finish = (error) => {
      clearTimeout(timer);
      channel.port1.close();
      error ? reject(error) : resolve();
    };
    const timer = setTimeout(() => finish(new Error("Notification service worker did not respond.")), 5000);
    channel.port1.onmessage = (event) => finish(event.data?.ok ? null : new Error("Notification state could not be saved."));
    worker.postMessage(data, [channel.port2]);
  });
}

const registration = createPushRegistration({
  currentUid: () => auth?.currentUser?.uid === PARTNER_UID ? PARTNER_UID : null,
  permission: getPushPermission,
  requestPermission: () => Notification.requestPermission(),
  async prepare() {
    const issues = validateClientConfig(import.meta.env).filter((name) => name.includes("MESSAGING_SENDER") || name.includes("VAPID"));
    if (issues.length) throw new Error(`Missing or invalid ${issues.join(", ")}. Add the GitHub Actions variables and redeploy.`);
    const messaging = await getPushMessaging();
    workerRegistration = await withTimeout(navigator.serviceWorker.register(
      new URL("firebase-messaging-sw.js", baseUrl).href,
      { scope: baseUrl.pathname, updateViaCache: "none" },
    ), "Notification service worker registration timed out.");
    await activeWorker(workerRegistration);
    return { messaging, registration: workerRegistration };
  },
  token: ({ messaging, registration }) => withTimeout(getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  }), "FCM token registration timed out. Check your connection and try again."),
  save: (user, token) => withTimeout(setDoc(doc(db, "pushTokens", user.uid), {
    uid: user.uid, token, enabled: true, updatedAt: serverTimestamp(),
  }), "Could not save notification registration. Check your connection and Firestore rules."),
  setEnabled: (enabled, context) => sendWorkerMessage({ type: "ZINGER_PUSH_STATE", enabled }, context?.registration),
  remove: (user) => db && auth?.currentUser?.uid === user.uid
    ? withTimeout(deleteDoc(doc(db, "pushTokens", user.uid)), "Could not remove the server notification token.", 8000)
    : Promise.resolve(),
  revoke: () => messagingInstance
    ? withTimeout(deleteToken(messagingInstance), "Could not revoke the local FCM token.", 8000)
    : Promise.resolve(),
});

export const enableZingerPush = registration.enable;
export const disableZingerPush = registration.disable;
export const cancelZingerPush = registration.cancel;

export function getPushPermission() {
  return "Notification" in window ? Notification.permission : "unsupported";
}

export function clearBeautyNotifications(readAt) {
  return sendWorkerMessage({ type: "ZINGER_READ", readAt });
}

export async function listenForForegroundPush(user, handler) {
  const messaging = await getPushMessaging();
  return onMessage(messaging, (payload) => {
    if (auth?.currentUser?.uid !== user.uid) return;
    handler?.(payload.data);
    // Foreground messages already update through Firestore. Only bridge a visibility race.
    if (document.visibilityState !== "visible" || payload.data?.type === "beauty-read") {
      sendWorkerMessage({ type: "ZINGER_PUSH", payload: payload.data }).catch(() => {});
    }
  });
}
