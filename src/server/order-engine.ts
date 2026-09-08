import { adminDb } from "./firebase-admin";
import { getStoreConfiguration } from "./core-service";
import { createMidtransTransaction, checkMidtransStatus } from "./midtrans";
import { AuthenticatedRequest } from "./middleware";
import { ProviderService } from "./provider-service";
import { transitionOrderState } from "./state-machine";
import { dispatchFulfillment } from "./fulfillment-dispatcher";
import { safeRecordPaymentReceived } from "./ledger-service";
import { PromoService } from "./promo-service";
import { FlashSaleService } from "./flash-sale-service";
import { NotificationService } from "./notification-service";

const providerService = ProviderService.getInstance();
const promoService = PromoService.getInstance();
const flashSaleService = FlashSaleService.getInstance();
const notificationService = NotificationService.getInstance();

export async function processCheckout(req: AuthenticatedRequest, res: any) {
  let orderId: string | null = null;
  try {
    // 0. Operational Gate
    const storeConfig = await getStoreConfiguration();
    if (storeConfig && storeConfig.operationalStatus && storeConfig.operationalStatus !== "open") {
      const defaultClosed = "Maaf, toko sedang tutup sementara. Silakan kembali beberapa saat lagi.";
      const defaultMaintenance = "iStore sedang dalam maintenance. Layanan akan kembali normal setelah proses selesai.";
      return res.status(503).json({ 
        success: false, 
        message: storeConfig.operationalStatus === "maintenance" 
          ? (storeConfig.maintenanceMessage?.trim() || defaultMaintenance)
          : (storeConfig.closedMessage?.trim() || defaultClosed)
      });
    }

    const { productId, variantId, customerInput, promoCode, referralCode } = req.body;
    
    // STRICT SECURITY: Trust token UID, do not trust req.body.userId
    const userId = req.user ? req.user.uid : "guest";

    if (!productId || !variantId || !customerInput) {
      return res.status(400).json({ success: false, message: "Incomplete data" });
    }

    // 1. Fetch Product
    const productRef = adminDb.collection("products").doc(productId);
    const productSnap = await productRef.get();
    if (!productSnap.exists) {
      return res.status(404).json({ success: false, code: "PRODUCT_NOT_FOUND", message: "Produk tidak ditemukan" });
    }

    const product = productSnap.data()!;
    if (product.status !== "active") {
      return res.status(400).json({ success: false, message: "Produk tidak aktif" });
    }

    // 2. Validate Variant & Price Engine from normalized collection
    const variantRef = adminDb.collection("productVariants").doc(variantId);
    const variantSnap = await variantRef.get();
    
    if (!variantSnap.exists) {
      return res.status(400).json({ success: false, message: "Varian tidak ditemukan" });
    }

    const variant = variantSnap.data()!;
    if (variant.productId !== productId) {
      return res.status(400).json({ success: false, message: "Varian tidak valid untuk produk ini" });
    }

    // Price calculation using Pricing Engine foundation in Catalog
    const pricing = variant.pricing || {};
    const subtotal = pricing.sellingPrice || variant.sellingPrice || 0;
    const adminFee = variant.adminFee || 0;
    
    if (subtotal <= 0 && variant.status === "active") {
      return res.status(400).json({ success: false, message: "Harga produk tidak valid" });
    }

    // 2.0 FLASH SALE & PROMO VALIDATION
    const activeFlashSale = await flashSaleService.getActiveFlashSaleForVariant(variantId);
    let baseAmount = subtotal;
    let discount = 0;
    let promoId: string | null = null;
    let promoSnapshot: any = null;
    let flashSaleSnapshot: any = null;

    if (activeFlashSale) {
      if (promoCode && typeof promoCode === "string" && promoCode.trim()) {
        return res.status(400).json({ success: false, message: "Kode promo tidak dapat digabungkan dengan produk Flash Sale." });
      }
      try {
        const consumedFs = await flashSaleService.consumeQuotaAndLimit(activeFlashSale.id!, userId);
        baseAmount = consumedFs.salePrice;
        flashSaleSnapshot = {
          id: consumedFs.id,
          name: consumedFs.name,
          originalPrice: subtotal,
          salePrice: consumedFs.salePrice,
          discount: Math.max(0, subtotal - consumedFs.salePrice)
        };
      } catch (fsErr: any) {
        return res.status(400).json({ success: false, message: fsErr.message || "Flash sale tidak tersedia" });
      }
    } else if (promoCode && typeof promoCode === "string" && promoCode.trim()) {
      try {
        const gameId = product.gameId || product.categoryId;
        const calc = await promoService.validateAndCalculateDiscount(
          promoCode,
          subtotal,
          userId,
          { gameId, productId, categoryId: product.categoryId }
        );
        discount = calc.discountAmount;
        promoId = calc.promoId;
        promoSnapshot = calc.promoSnapshot;
      } catch (promoErr: any) {
        return res.status(400).json({ success: false, message: promoErr.message || "Promo tidak valid" });
      }
    }

    const finalAmount = Math.max(0, baseAmount - discount);

    // 2.1 ROUTING ENGINE: Get best provider for this variant
    const routingDecision = await providerService.getRoutingDecision(variantId, { userId });
    if (routingDecision.code !== "SUCCESS") {
       console.warn(`[Routing] No mapping found for variant ${variantId}: ${routingDecision.reason}`);
    }

    // 2.2 STOCK & QUOTA VALIDATION
    const inventoryService = (await import('./inventory-service')).InventoryService.getInstance();
    const stock = await inventoryService.getStockForVariant(variantId);
    if (stock && stock.status === 'active') {
      if (stock.availableQuantity < 1) {
        return res.status(400).json({ success: false, message: "Stok produk tidak mencukupi" });
      }
    }

    // 3. Create Order in Firestore (Transaction Locking / Idempotency)
    const orderRef = adminDb.collection("orders").doc();
    orderId = orderRef.id;
    
    if (stock && stock.status === 'active') {
      try {
        await inventoryService.reserveStock(orderId, variantId, 1);
      } catch (err: any) {
        return res.status(400).json({ success: false, message: "Gagal mengamankan stok: " + err.message });
      }
    }
    
    const orderData = {
      id: orderId,
      invoice: orderId,
      userId: userId || "guest",
      customerData: customerInput,
      productId: product.id,
      productName: product.name,
      variantId: variantId,
      variantName: variant.displayName || variant.name,
      
      // Provider & Routing Engine Integration
      providerId: routingDecision.selectedProviderId || "manual",
      providerSkuId: routingDecision.selectedProviderSkuId || "",
      providerSku: routingDecision.selectedProviderSku || "",
      routingDecisionCode: routingDecision.code,
      
      quantity: 1,
      price: subtotal,
      adminFee,
      discount: activeFlashSale ? (subtotal - baseAmount) : discount,
      promoId: promoId || null,
      promoSnapshot: promoSnapshot || null,
      flashSaleSnapshot: flashSaleSnapshot || null,
      referralCode: referralCode || null,
      totalAmount: finalAmount,
      paymentStatus: "pending",
      transactionStatus: "pending",
      idempotencyKey: `${orderId}-INIT`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await orderRef.set(orderData);

    // Notify customer
    await notificationService.notifyCustomer(userId, 'ORDER_CREATED', 'Pesanan Dibuat', `Pesanan ${orderId} telah berhasil dibuat. Silakan selesaikan pembayaran.`, {
      relatedEntity: { type: 'ORDER', id: orderId! },
      actionUrl: `/transactions/${orderId}`,
      idempotencyKey: `order_created_${orderId}`
    });

    // Increment promo usage atomically if applied
    if (promoId) {
      await promoService.incrementUsage(promoId);
    }

    // 4. Generate Midtrans Snap Token
    const snapResult = await createMidtransTransaction({
      orderId: orderId,
      grossAmount: finalAmount,
      customerDetails: {
        first_name: userId === "guest" ? "Guest" : "Customer",
        email: "customer@istore.id", // Should take from input if available
        phone: "08123456789"
      },
      itemDetails: [{
        id: variant.id || variantId,
        price: finalAmount,
        quantity: 1,
        name: `${product.name} - ${variant.displayName || variant.name}`.substring(0, 50)
      }]
    });

    // Save token to order for future retries if needed
    await orderRef.update({
      snapToken: snapResult.token,
      paymentUrl: snapResult.redirectUrl,
      updatedAt: new Date().toISOString()
    });

    return res.status(200).json({
      success: true,
      orderId,
      snapToken: snapResult.token,
      paymentUrl: snapResult.redirectUrl
    });

  } catch (error: any) {
    console.error("[Checkout Error]", error);
    
    // Attempt recovery if orderId exists
    if (orderId) {
      try {
        const status = await checkMidtransStatus(orderId);
        if (status && (status.transaction_status === 'settlement' || status.transaction_status === 'capture')) {
           let transitionResult = false;
           try {
              const res = await transitionOrderState(orderId, 'PAID', {}, "Reconciled after Snap failure");
              transitionResult = !!res;
           } catch (stateErr: any) {
              if (stateErr.message.includes("INVALID_STATE_TRANSITION")) {
                 console.log(`[Checkout Recovery] Already transitioned to PAID, proceeding to check fulfillment.`);
              } else {
                 throw stateErr;
              }
           }

           // Ensure payment ledger entry is recorded and trigger dispatcher if fulfillment is pending
           const refreshedOrderSnap = await adminDb.collection("orders").doc(orderId).get();
           if (refreshedOrderSnap.exists) {
              const refreshedOrderData = refreshedOrderSnap.data()!;
              if (refreshedOrderData.paymentStatus === 'paid') {
                 await safeRecordPaymentReceived(orderId, refreshedOrderData, "SYSTEM", { source: "Checkout Recovery Retry" });
                 if (refreshedOrderData.transactionStatus === 'pending') {
                    console.log(`[Checkout Recovery] Triggering fulfillment dispatcher for reconciled order: ${orderId}`);
                    await dispatchFulfillment(orderId);
                 }
              }
           }
           return res.status(200).json({ success: true, message: "Order reconciled & dispatch started" });
        }
      } catch (recoveryError) {
        console.error("[Recovery Error]", recoveryError);
      }
    }
    
    return res.status(500).json({ success: false, message: error.message });
  }
}
