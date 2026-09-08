import { SecretManagerService } from "./src/server/secret-manager";

async function run() {
  const sm = SecretManagerService.getInstance();
  try {
    const merchantId = await sm.getSecret("apigames_merchant_id").catch(() => null);
    const secretKey = await sm.getSecret("apigames_secret_key").catch(() => null);
    console.log("Credentials Status:");
    console.log("- Merchant ID Configured:", !!merchantId);
    console.log("- Secret Key Configured:", !!secretKey);
  } catch (err: any) {
    console.log("Error querying Secret Manager:", err.message);
  }
}

run().catch(console.error);
