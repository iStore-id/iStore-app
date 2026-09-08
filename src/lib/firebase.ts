import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import {
  istoreFirebaseConfig,
  isFirebaseConfigured,
  ISTORE_PROJECT_ID,
  ISTORE_FIRESTORE_DATABASE_ID
} from "./istore-firebase-config";

export const firebaseConfig = {
  apiKey: istoreFirebaseConfig.apiKey,
  authDomain: istoreFirebaseConfig.authDomain,
  projectId: istoreFirebaseConfig.projectId,
  storageBucket: istoreFirebaseConfig.storageBucket,
  messagingSenderId: istoreFirebaseConfig.messagingSenderId,
  appId: istoreFirebaseConfig.appId,
};

export { isFirebaseConfigured, istoreFirebaseConfig, ISTORE_PROJECT_ID, ISTORE_FIRESTORE_DATABASE_ID };

let app;
try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
} catch (e) {
  console.error("Firebase Initialization Failure:", e);
  // Create a dummy app-like object if needed, or let auth/db handles it
  app = { options: firebaseConfig } as any; 
}

let auth: any = null;
let db: any = null;

if (app && firebaseConfig.apiKey) {
  try {
    auth = getAuth(app);
    // Specify the database ID for Firestore
    db = getFirestore(app, ISTORE_FIRESTORE_DATABASE_ID);
    console.log(`Firebase Services initialized successfully. Database: ${ISTORE_FIRESTORE_DATABASE_ID}`);
  } catch (e) {
    console.error("Firebase Services Initialization Failure:", e);
  }
} else {
  console.warn("Firebase Services skipped: app or apiKey missing", {
    hasApp: !!app,
    hasApiKey: !!firebaseConfig.apiKey
  });
}

export { auth, db, app };
export default app;
