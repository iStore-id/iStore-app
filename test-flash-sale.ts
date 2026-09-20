
import { FlashSaleService } from "./src/server/flash-sale-service";
import dotenv from "dotenv";

dotenv.config();

async function test() {
  const flashSaleService = FlashSaleService.getInstance();
  try {
    console.log("Testing getActiveFlashSaleForVariant...");
    const result = await flashSaleService.getActiveFlashSaleForVariant("any-variant-id");
    console.log("Result:", result);
  } catch (error: any) {
    console.error("Caught error:", error.message);
    if (error.stack) console.error(error.stack);
  }
}

test();
