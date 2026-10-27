import {initializeApp} from 'firebase/app';
import {getAuth} from 'firebase/auth';
import {getFirestore} from 'firebase/firestore';

const firebaseConfig={
 apiKey:import.meta.env.VITE_FIREBASE_API_KEY,
 authDomain:import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
 projectId:import.meta.env.VITE_FIREBASE_PROJECT_ID,
 appId:import.meta.env.VITE_FIREBASE_APP_ID,
};
const app=initializeApp(firebaseConfig);
export const auth=getAuth(app);
export const db=getFirestore(app);
export const HOST_UID=import.meta.env.VITE_HOST_UID;
export const PARTNER_UID=import.meta.env.VITE_PARTNER_UID;
export const HOST_EMAIL=import.meta.env.VITE_HOST_EMAIL;
export const PARTNER_EMAIL=import.meta.env.VITE_PARTNER_EMAIL;
