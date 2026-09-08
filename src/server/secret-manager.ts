import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import { ISTORE_PROJECT_ID } from "./firebase-admin";

const client = new SecretManagerServiceClient();

export class SecretManagerService {
  private static instance: SecretManagerService;
  private cache: Map<string, { value: string, version: string }> = new Map();

  private constructor() {}

  public static getInstance(): SecretManagerService {
    if (!SecretManagerService.instance) {
      SecretManagerService.instance = new SecretManagerService();
    }
    return SecretManagerService.instance;
  }

  async getSecret(secretName: string): Promise<string> {
    if (this.cache.has(secretName)) {
      return this.cache.get(secretName)!.value;
    }

    try {
      const projectId = ISTORE_PROJECT_ID;
      const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;
      const [version] = await client.accessSecretVersion({ name });
      const payload = version.payload?.data?.toString();
      
      if (!payload) throw new Error(`Secret ${secretName} is empty`);
      
      this.cache.set(secretName, { value: payload, version: version.name! });
      return payload;
    } catch (error) {
      console.error(`Failed to fetch secret ${secretName} from project ${ISTORE_PROJECT_ID}:`, error);
      throw error;
    }
  }

  async updateSecret(secretName: string, value: string): Promise<void> {
    const projectId = ISTORE_PROJECT_ID;
    const name = `projects/${projectId}/secrets/${secretName}`;
    await client.addSecretVersion({
      parent: name,
      payload: { data: Buffer.from(value, 'utf8') },
    });
    this.cache.delete(secretName);
  }
}
