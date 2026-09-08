import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";

export const ISTORE_PROJECT_ID = "gen-lang-client-0242466730";
export const ISTORE_FIRESTORE_DATABASE_ID = "ai-studio-87fb2045-b22d-4bfd-b0c1-fba1b790d9b0";
export const ISTORE_STORAGE_BUCKET = `${ISTORE_PROJECT_ID}.firebasestorage.app`;

// Tentukan Project ID resmi iStore
export const appProjectId = ISTORE_PROJECT_ID;
const databaseId = ISTORE_FIRESTORE_DATABASE_ID;

if (getApps().length === 0) {
  try {
    const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (serviceAccountStr && serviceAccountStr.startsWith("{")) {
      const serviceAccount = JSON.parse(serviceAccountStr);
      initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id || appProjectId,
        storageBucket: ISTORE_STORAGE_BUCKET
      });
      console.log(`[iStore Firebase Admin] Connected with Service Account to: ${serviceAccount.project_id || appProjectId}`);
    } else {
      // In Google environments, initializeApp() with projectId is sufficient for ADC
      initializeApp({
        projectId: appProjectId,
        storageBucket: ISTORE_STORAGE_BUCKET
      });
      console.log(`[iStore Firebase Admin] Connected with Project ID: ${appProjectId}`);
    }
  } catch (error) {
    console.warn("[iStore Firebase Admin] Initialization notice:", error);
  }
}

// For specific database, we MUST call getFirestore(databaseId)
export const adminDb = getFirestore(databaseId);
adminDb.settings({ ignoreUndefinedProperties: true });
export const adminAuth = getAuth();
export const adminStorage = getStorage().bucket(ISTORE_STORAGE_BUCKET);


