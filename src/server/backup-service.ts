import { adminDb, adminStorage, ISTORE_PROJECT_ID, ISTORE_FIRESTORE_DATABASE_ID } from "./firebase-admin";
import { logCoreAudit } from "./core-service";

export interface BackupStatus {
  projectId: string;
  databaseId: string;
  firestoreDetected: boolean;
  storageBucketDetected: boolean;
  pitrEnabled: boolean | 'unknown';
  scheduledBackupEnabled: boolean | 'unknown';
  lastKnownBackup: string | null;
  infrastructureStatus: 'HEALTHY' | 'NEEDS_CONFIGURATION' | 'UNKNOWN';
}

export async function getBackupStatus(actor: {uid: string, email: string}, role: string): Promise<BackupStatus> {
  let firestoreDetected = false;
  let storageBucketDetected = false;
  
  try {
    await adminDb.collection("systemConfigs").limit(1).get();
    firestoreDetected = true;
  } catch (e) {
    console.error("[BackupService] Firestore check failed", e);
  }

  try {
    const [exists] = await adminStorage.exists();
    storageBucketDetected = exists;
  } catch (e) {
    console.error("[BackupService] Storage check failed", e);
  }

  // Without @google-cloud/firestore admin SDK, we cannot verify PITR programmatically
  // We report it as unknown/needs configuration.
  await logCoreAudit(actor, role, "BACKUP_STATUS_CHECKED", "infrastructure/backup", null, null, "Checked backup readiness status");

  return {
    projectId: ISTORE_PROJECT_ID,
    databaseId: ISTORE_FIRESTORE_DATABASE_ID,
    firestoreDetected,
    storageBucketDetected,
    pitrEnabled: 'unknown',
    scheduledBackupEnabled: 'unknown',
    lastKnownBackup: null,
    infrastructureStatus: 'NEEDS_CONFIGURATION'
  };
}

export async function triggerManualBackup(actor: {uid: string, email: string}, role: string) {
  await logCoreAudit(actor, role, "BACKUP_TRIGGER_FAILED", "infrastructure/backup", null, null, "Manual backup triggered but external GCP infrastructure is required");
  throw new Error("Direct database export from application is disabled for security and performance. Please configure Scheduled Backups in Google Cloud Console.");
}
