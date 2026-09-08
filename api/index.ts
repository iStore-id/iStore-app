import app, { initServerLogic } from "../server";

// Ensure Express routes & background workers are initialized for Serverless
let isInitialized = false;

export default async function handler(req: any, res: any) {
  if (!isInitialized) {
    await initServerLogic();
    isInitialized = true;
  }
  return app(req, res);
}
