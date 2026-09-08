/**
 * Sumber Konfigurasi Tunggal & Mandiri untuk Firebase iStore.
 * 
 * Kebijakan Integritas Arsitektur:
 * 1. Project ID client dan server WAJIB "gen-lang-client-0242466730".
 * 2. Firestore Database ID WAJIB "ai-studio-87fb2045-b22d-4bfd-b0c1-fba1b790d9b0".
 * 3. Konfigurasi ini sepenuhnya mandiri dan kebal terhadap file provisioning otomatis.
 */

export const ISTORE_PROJECT_ID = "gen-lang-client-0242466730";
export const ISTORE_FIRESTORE_DATABASE_ID = "ai-studio-87fb2045-b22d-4bfd-b0c1-fba1b790d9b0";
export const ISTORE_AUTH_DOMAIN = `${ISTORE_PROJECT_ID}.firebaseapp.com`;
export const ISTORE_STORAGE_BUCKET = `${ISTORE_PROJECT_ID}.firebasestorage.app`;

export interface IStoreFirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
  firestoreDatabaseId: string;
}

// Ambil dari Environment Variables (Vite client-side maupun Node.js test environment)
const envApiKey = (typeof import.meta !== "undefined" && import.meta.env?.VITE_FIREBASE_API_KEY) || 
  (typeof process !== "undefined" && process.env?.VITE_FIREBASE_API_KEY) || "";
const envAppId = (typeof import.meta !== "undefined" && import.meta.env?.VITE_FIREBASE_APP_ID) || 
  (typeof process !== "undefined" && process.env?.VITE_FIREBASE_APP_ID) || "";
const envSenderId = (typeof import.meta !== "undefined" && import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID) || 
  (typeof process !== "undefined" && process.env?.VITE_FIREBASE_MESSAGING_SENDER_ID) || "";

// Fallback logic for AI Studio Preview if env vars are missing
// Values are retrieved from firebase-applet-config.json which is safe for client-side Firebase Web SDK
const finalApiKey = envApiKey || "AIzaSyCrRf86QxXVNFnWPJavMBGbOac2y6N8ZC8";
const finalAppId = envAppId || "1:414429211625:web:caa336940b9a68753a3978";
const finalSenderId = envSenderId || "414429211625";

console.log("Firebase Config Diagnostic:", {
  projectId: ISTORE_PROJECT_ID,
  hasEnvApiKey: !!envApiKey,
  hasEnvAppId: !!envAppId,
  usingFallback: !envApiKey,
  timestamp: new Date().toISOString()
});

export const istoreFirebaseConfig: IStoreFirebaseConfig = {
  projectId: ISTORE_PROJECT_ID,
  authDomain: ISTORE_AUTH_DOMAIN,
  storageBucket: ISTORE_STORAGE_BUCKET,
  firestoreDatabaseId: ISTORE_FIRESTORE_DATABASE_ID,
  apiKey: finalApiKey,
  appId: finalAppId,
  messagingSenderId: finalSenderId,
  measurementId: ""
};

export const isFirebaseConfigured = Boolean(
  istoreFirebaseConfig &&
  istoreFirebaseConfig.apiKey &&
  istoreFirebaseConfig.projectId === ISTORE_PROJECT_ID
);

