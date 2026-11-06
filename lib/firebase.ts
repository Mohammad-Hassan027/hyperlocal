import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, signInAnonymously, type Auth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  connectFirestoreEmulator,
  type Firestore,
} from "firebase/firestore";

export function isFirebaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  );
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let authPromise: Promise<void> | undefined;

export function getFirebase(): { app: FirebaseApp; auth: Auth; db: Firestore } {
  if (!app) {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
    // Ignore undefined properties so Firestore writes don't crash when optional fields are undefined
    try {
      db = initializeFirestore(app, { ignoreUndefinedProperties: true });
    } catch {
      db = getFirestore(app);
    }

    if (process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST && db) {
      const [host, port] = process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST.split(":");
      connectFirestoreEmulator(db, host, Number(port || 8080));
    }
  }

  return { app, auth: auth!, db: db! };
}

export function ensureAnonymousAuth(auth: Auth, force = false): Promise<void> {
  if (!force && auth.currentUser) return Promise.resolve();
  if (force) authPromise = undefined;
  if (!authPromise) {
    authPromise = signInAnonymously(auth)
      .then(() => {})
      .catch((err) => {
        console.error("Firebase anonymous sign-in error:", err);
        authPromise = undefined;
        throw err;
      });
  }
  return authPromise;
}
