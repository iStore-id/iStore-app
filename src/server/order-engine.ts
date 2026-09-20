import { PricingService } from "./pricing-service";
import { SupabaseCatalogRepository } from "./supabase/catalog-repository";
import { DynamicCatalogService } from "./dynamic-catalog-service";
import { OrderRepository } from "./supabase/order-repository";
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
const dynamicCatalogService = DynamicCatalogService.getInstance();
const pricingService = PricingService.getInstance();
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

    const { productId, variantId, customerInput, promoCode, referralCode, paymentMethod } = req.body;
    
    // STRICT SECURITY: Trust token UID, do not trust req.body.userId
    const userId = req.user ? (req.user.uid || req.user.id) : null;

    if (!productId || !variantId || !customerInput) {
      return res.status(400).json({ success: false, message: "Incomplete data" });
    }

    // 1. Fetch Product
    const product = await dynamicCatalogService.getProduct(productId);
    if (!product) {
      return res.status(404).json({ success: false, code: "PRODUCT_NOT_FOUND", message: "Produk tidak ditemukan" });
    }

    if (product.status !== "active") {
      return res.status(400).json({ success: false, message: "Produk tidak aktif" });
    }

    // 2. Validate Variant & Price Engine from normalized collection
    const variant = await dynamicCatalogService.getVariant(variantId);
    
    if (!variant) {
      return res.status(400).json({ success: false, message: "Varian tidak ditemukan" });
    }

    const isVirtual = dynamicCatalogService.isVirtualVariant(variantId);
    let isValidVariant = false;

    if (isVirtual) {
      // For virtual variants, verify ownership against product's game
      let productGameSlug = "";
      if (dynamicCatalogService.isVirtualProduct(productId)) {
        productGameSlug = productId.replace("virtual-product-", "");
      } else if (product.gameId) {
        const catalogRepo = SupabaseCatalogRepository.getInstance();
        const game = await catalogRepo.getGame(product.gameId);
        if (game) {
          productGameSlug = game.slug;
        }
      }
      if (!productGameSlug) {
        productGameSlug = product.slug;
      }

      const variantGameSlug = variant.productId.replace("virtual-product-", "");
      isValidVariant = Boolean(variantGameSlug && productGameSlug && variantGameSlug === productGameSlug);
    } else {
      isValidVariant = (variant.productId === productId);
    }

    if (!isValidVariant) {
      return res.status(400).json({ success: false, message: "Varian tidak valid untuk produk ini" });
    }

    // Price calculation using Pricing Engine foundation in Catalog
    const { finalPrice: effectivePrice } = await pricingService.resolveEffectivePrice(
      variant, 
      { userId: userId || undefined }, 
      product
    );
    const subtotal = effectivePrice;
    const adminFee = (variant as any).adminFee || 0;
    
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
        const consumedFs = await flashSaleService.consumeQuotaAndLimit(activeFlashSale.id!, userId || "guest");
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
        const gameId = product.gameId || product.categoryIds?.[0];
        const calc = await promoService.validateAndCalculateDiscount(
          promoCode,
          subtotal,
          userId || "guest",
          { gameId, productId, categoryId: product.categoryIds?.[0] }
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
    const inventoryService = (await import('./inventory-service.js')).InventoryService.getInstance();
    const stock = await inventoryService.getStockForVariant(variantId);
    if (stock && stock.status === 'active') {
      if (stock.availableQuantity < 1) {
        return res.status(400).json({ success: false, message: "Stok produk tidak mencukupi" });
      }
    }

    // 3. Create Order in Supabase
    orderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
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
      userId: userId,
      customerData: customerInput,
      productId: product.id,
      productName: product.name,
      variantId: variantId,
      variantName: variant.displayName || variant.name,
      
      // Provider & Routing Engine Integration
      providerId: routingDecision.selectedProviderId || "manual",
      providerSkuId: routingDecision.selectedProviderSkuId || null,
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

    const orderRepo = OrderRepository.getInstance();
    await orderRepo.createOrder(orderData as any);

    // Notify customer
    if (userId) {
      await notificationService.notifyCustomer(userId, 'ORDER_CREATED', 'Pesanan Dibuat', `Pesanan ${orderId} telah berhasil dibuat. Silakan selesaikan pembayaran.`, {
        relatedEntity: { type: 'ORDER', id: orderId! },
        actionUrl: `/transactions/${orderId}`,
        idempotencyKey: `order_created_${orderId}`
      });
    }

    // Increment promo usage atomically if applied
    if (promoId) {
      await promoService.incrementUsage(promoId);
    }

    // 4. Generate Midtrans Snap Token
    const allowedPaymentMethods = [
      "qris",
      "gopay",
      "shopeepay",
      "bca_va",
      "bni_va",
      "bri_va",
      "echannel",
      "permata_va",
      "other_va"
    ];
    const validatedPaymentMethod = typeof paymentMethod === "string" && allowedPaymentMethods.includes(paymentMethod) ? paymentMethod : undefined;

    const snapResult = await createMidtransTransaction({
      orderId: orderId,
      grossAmount: finalAmount,
      customerDetails: {
        first_name: customerInput?.buyerName || customerInput?.buyer_name || (userId ? "Customer" : "Guest"),
        email: customerInput?.email || "customer@istore.id",
        phone: customerInput?.whatsapp || customerInput?.phone || "08123456789"
      },
      itemDetails: [{
        id: (variant.id || variantId).substring(0, 50),
        price: finalAmount,
        quantity: 1,
        name: `${product.name} - ${variant.displayName || variant.name}`.substring(0, 50)
      }],
      paymentMethod: validatedPaymentMethod
    });

    // Save token to order for future retries if needed
    await orderRepo.updateOrder(orderId, {
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
           const orderRepo = OrderRepository.getInstance();
           const refreshedOrderData = await orderRepo.getOrderById(orderId);
           if (refreshedOrderData) {
              if (refreshedOrderData.paymentStatus === 'paid') {
                 await safeRecordPaymentReceived(orderId, refreshedOrderData as any, "SYSTEM", { source: "Checkout Recovery Retry" });
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
