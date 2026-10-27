import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { validateClientConfig } from "./config.js";

function initializeFirebase() {
  const unavailable = {
    auth: null,
    db: null,
    firebaseError:
      "Sign-in is unavailable because the workspace configuration is incomplete. Please contact the workspace owner.",
  };

  if (validateClientConfig(import.meta.env).length > 0) {
    return unavailable;
  }

  try {
    const app = initializeApp({
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY.trim(),
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN.trim(),
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID.trim(),
      appId: import.meta.env.VITE_FIREBASE_APP_ID.trim(),
    });

    return { auth: getAuth(app), db: getFirestore(app), firebaseError: "" };
  } catch (error) {
    console.error("Firebase initialization failed:", error.code || error.name);
    return unavailable;
  }
}

export const { auth, db, firebaseError } = initializeFirebase();
export const HOST_UID = import.meta.env.VITE_HOST_UID?.trim();
export const PARTNER_UID = import.meta.env.VITE_PARTNER_UID?.trim();
export const HOST_EMAIL = import.meta.env.VITE_HOST_EMAIL?.trim();
export const PARTNER_EMAIL = import.meta.env.VITE_PARTNER_EMAIL?.trim();
