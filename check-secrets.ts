
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
const client = new SecretManagerServiceClient();
const projectId = "83842073289";

async function check(name: string) {
  try {
    const [secret] = await client.getSecret({
      name: `projects/${projectId}/secrets/${name}`,
    });
    console.log(`${name}: EXIST`);
  } catch (error: any) {
    if (error.code === 5) {
      console.log(`${name}: MISSING`);
    } else {
      console.log(`${name}: ERROR (${error.message})`);
    }
  }
}

async function run() {
  const secrets = [
    "apigames_merchant_id",
    "apigames_secret_key",
    "SESSION_SECRET",
    "CLOUDINARY_URL",
    "MIDTRANS_SERVER_KEY",
    "MIDTRANS_MERCHANT_ID",
    "TOKOVOUCHER_MEMBER_CODE",
    "TOKOVOUCHER_SECRET"
  ];
  for (const s of secrets) {
    await check(s);
  }
}

run();
