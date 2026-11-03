
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFirebaseWebConfig, validateClientConfig } from "./config.js";

function initializeFirebase() {
  const unavailable = {
    app: null,
    auth: null,
    db: null,
    firebaseError:
      "Sign-in is unavailable because Firebase configuration is incomplete.",
  };

  if (validateClientConfig(import.meta.env, { requirePush: false }).length > 0) {
    return unavailable;
  }

  try {
    const app = initializeApp(getFirebaseWebConfig(import.meta.env));

    return {
      app,
      auth: getAuth(app),
      db: getFirestore(app),
      firebaseError: "",
    };
  } catch (error) {
    console.error("Firebase initialization failed:", error.code || error.name);
    return unavailable;
  }
}

export const {
  app,
  auth,
  db,
  firebaseError,
} = initializeFirebase();

export const HOST_UID =
  import.meta.env.VITE_HOST_UID?.trim();

export const PARTNER_UID =
  import.meta.env.VITE_PARTNER_UID?.trim();

export const HOST_EMAIL =
  import.meta.env.VITE_HOST_EMAIL?.trim();

export const PARTNER_EMAIL =
  import.meta.env.VITE_PARTNER_EMAIL?.trim();
