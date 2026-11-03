
import { doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import {
  getMessaging,
  getToken,
  deleteToken,
  isSupported,
} from "firebase/messaging";

import { app, db, PARTNER_UID } from "./firebase.js";

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

let messagingInstance = null;
let workerRegistration = null;

async function getPushMessaging() {
  if (!app || !db) {
    throw new Error("Firebase is not initialized.");
  }

  if (!(await isSupported())) {
    throw new Error("FCM is unsupported in this browser.");
  }

  if (!messagingInstance) {
    messagingInstance = getMessaging(app);
  }

  return messagingInstance;
}

export async function enableZingerPush(user) {
  if (!user || user.uid !== PARTNER_UID) {
    throw new Error("Partner login required.");
  }

  if (!VAPID_KEY) {
    throw new Error("Missing VITE_FIREBASE_VAPID_KEY.");
  }

  if (!("serviceWorker" in navigator)) {
    throw new Error("Service workers are unsupported.");
  }

  if (!("Notification" in window)) {
    throw new Error("Notifications are unsupported.");
  }

  // Must be called from a real button click.
  const permission = await Notification.requestPermission();

  if (permission !== "granted") {
    throw new Error("Notification permission was not granted.");
  }

  const messaging = await getPushMessaging();

  const workerUrl =
    `${import.meta.env.BASE_URL}firebase-messaging-sw.js`;

  workerRegistration = await navigator.serviceWorker.register(
    workerUrl,
    { scope: import.meta.env.BASE_URL }
  );

  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: workerRegistration,
  });

  if (!token) {
    throw new Error("FCM could not generate a registration token.");
  }

  await setDoc(
    doc(db, "pushTokens", user.uid),
    {
      uid: user.uid,
      token,
      enabled: true,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return true;
}

export async function disableZingerPush(user) {
  if (!user || !db || user.uid !== PARTNER_UID) return;

  // Revoke stored delivery target before logging out.
  await deleteDoc(doc(db, "pushTokens", user.uid));

  try {
    const messaging = await getPushMessaging();
    await deleteToken(messaging);
  } catch (error) {
    console.warn("FCM token cleanup:", error);
  }
}

export function getPushPermission() {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}
