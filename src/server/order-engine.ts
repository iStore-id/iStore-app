import { PricingService } from "./pricing-service.js";
import { SupabaseCatalogRepository } from "./supabase/catalog-repository.js";
import { DynamicCatalogService } from "./dynamic-catalog-service.js";
import { OrderRepository } from "./supabase/order-repository.js";
import { getStoreConfiguration } from "./core-service.js";
import { checkMidtransStatus } from "./midtrans.js";
import { PaymentRouter } from "./payment-router.js";
import { AuthenticatedRequest } from "./middleware.js";
import { ProviderService } from "./provider-service.js";
import { transitionOrderState } from "./state-machine.js";
import { dispatchFulfillment } from "./fulfillment-dispatcher.js";
import { safeRecordPaymentReceived } from "./ledger-service.js";
import { PromoService } from "./promo-service.js";
import { FlashSaleService } from "./flash-sale-service.js";
import { NotificationService } from "./notification-service.js";
import { LoyaltyService } from "./loyalty-service.js";
import { calculateCheckoutTotal, calculateLoyaltyRedemption, isConfirmedPaymentFailure } from "./checkout-calculations.js";

const providerService = ProviderService.getInstance();
const dynamicCatalogService = DynamicCatalogService.getInstance();
const pricingService = PricingService.getInstance();
const promoService = PromoService.getInstance();
const flashSaleService = FlashSaleService.getInstance();
const notificationService = NotificationService.getInstance();
const loyaltyService = LoyaltyService.getInstance();

export async function processCheckout(req: AuthenticatedRequest, res: any) {
  let orderId: string | null = null;
  let loyaltyRedeemed = false;
  let loyaltyRedemptionUncertain = false;
  let paymentDispatchStarted = false;
  let paymentFailureConfirmed = false;
  let stockReserved = false;
  let gatewayCode = "midtrans";
  const userId = req.user ? (req.user.uid || req.user.id) : null;
  try {
    // 0. Operational Gate
    const storeConfig = await getStoreConfiguration();
    if (storeConfig && storeConfig.operationalStatus && storeConfig.operationalStatus !== "open") {
      const defaultClosed = "Maaf, toko sedang tutup sementara. Silakan kembali beberapa saat lagi.";
      const defaultMaintenance = "iStore sedang dalam maintenance. Layanan akan kembali normal setelah proses selesai.";
      return res.status(409).json({ 
        success: false, 
        message: storeConfig.operationalStatus === "maintenance" 
          ? (storeConfig.maintenanceMessage?.trim() || defaultMaintenance)
          : (storeConfig.closedMessage?.trim() || defaultClosed)
      });
    }

    const { productId, variantId, customerInput, promoCode, referralCode, paymentMethod, pointsToUse } = req.body;
    gatewayCode = await PaymentRouter.getInstance().getActiveGateway();

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
    const adminFee = Math.max(0, Math.round(Number((variant as any).adminFee) || 0));
    
    if (subtotal <= 0 && variant.status === "active") {
      return res.status(400).json({ success: false, message: "Harga produk tidak valid" });
    }

    // 4. Payment Provider Dispatch & Native Method Validation
    let validatedPaymentMethod: string | undefined = undefined;

    if (gatewayCode === "doit") {
      const doitAllowedMethods = [
        "qris",
        "mandiri_va",
        "bni_va",
        "bri_va",
        "bsi_va",
        "cimb_va",
        "permata_va",
        "maybank_va",
        "danamon_va"
      ];
      if (typeof paymentMethod !== "string" || !doitAllowedMethods.includes(paymentMethod)) {
        return res.status(400).json({
          success: false,
          message: "Metode pembayaran Doit tidak valid atau belum dipilih."
        });
      }
      validatedPaymentMethod = paymentMethod;
    } else {
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
      validatedPaymentMethod = typeof paymentMethod === "string" && allowedPaymentMethods.includes(paymentMethod) ? paymentMethod : undefined;
    }

    // 2.0 FLASH SALE & PROMO VALIDATION
    orderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
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
        const consumedFs = await flashSaleService.consumeQuotaAndLimit(activeFlashSale.id!, userId || "guest", orderId);
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

    // 2.0.5 LOYALTY REDEMPTION
    let loyaltyDiscount = 0;
    let pointsToRedeem = Math.max(0, Math.floor(Number(pointsToUse) || 0));

    if (pointsToRedeem > 0 && userId) {
      const loyaltyConfig = await loyaltyService.getConfig();
      if (!loyaltyConfig.enabled) {
        return res.status(400).json({ success: false, message: "Sistem loyalty sedang tidak aktif." });
      }
      const balance = await loyaltyService.getCustomerBalance(userId);
      if (pointsToRedeem > balance) {
        return res.status(400).json({ success: false, message: `Poin tidak cukup. Saldo: ${balance}` });
      }

      try {
        const redemption = calculateLoyaltyRedemption({
          requestedPoints: pointsToRedeem,
          redeemRateIdr: loyaltyConfig.redeemRateIdr,
          minRedeemPoints: loyaltyConfig.minRedeemPoints,
          maxRedeemPercent: loyaltyConfig.maxRedeemPercent,
          remainingAmount: Math.max(0, baseAmount - discount)
        });
        pointsToRedeem = redemption.pointsToRedeem;
        loyaltyDiscount = redemption.discountAmount;
      } catch (redemptionValidationError: any) {
        return res.status(400).json({ success: false, message: redemptionValidationError.message });
      }
    }

    const { finalAmount, totalToPay } = calculateCheckoutTotal(baseAmount, discount, loyaltyDiscount, adminFee);

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
    if (stock && stock.status === 'active') {
      try {
        await inventoryService.reserveStock(orderId!, variantId, 1);
        stockReserved = true;
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
      loyaltyPointsUsed: pointsToRedeem,
      loyaltyDiscountAmount: loyaltyDiscount,
      referralCode: referralCode || null,
      totalAmount: totalToPay,
      paymentStatus: "pending",
      transactionStatus: "pending",
      paymentGatewayCode: gatewayCode,
      idempotencyKey: `${orderId}-INIT`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const orderRepo = OrderRepository.getInstance();
    await orderRepo.createOrder(orderData as any);

    // Redeem after the order exists because point_transactions.order_id references orders.id.
    if (pointsToRedeem > 0 && userId) {
      try {
        const redemption = await loyaltyService.redeemPoints(userId, pointsToRedeem, orderId);
        // Mark the ledger mutation before validating its returned amount so any mismatch
        // is rolled back safely before a payment request is dispatched.
        loyaltyRedeemed = true;
        if (Number(redemption.discountAmount) !== loyaltyDiscount) {
          throw new Error("Nilai diskon penukaran poin tidak cocok dengan perhitungan checkout. Pesanan perlu direkonsiliasi.");
        }
      } catch (redemptionError) {
        // The RPC can commit while the client receives a timeout/network error.
        // Reconcile the append-only ledger before deciding whether points need reversal.
        try {
          loyaltyRedeemed = await loyaltyService.hasRedeemedPoints(orderId, userId);
        } catch (reconcileError) {
          // Fail closed: if the redemption cannot be checked, keep the order pending
          // for reconciliation rather than marking it failed and risking point loss.
          console.error("[Loyalty Recovery] Could not confirm redemption state; keeping order pending.", reconcileError);
          loyaltyRedemptionUncertain = true;
          throw new Error("Status penukaran poin belum dapat dipastikan. Pesanan perlu direkonsiliasi.");
        }
        if (loyaltyRedeemed) {
          await transitionOrderState(orderId, "FAILED", {}, "Loyalty redemption response was ambiguous before payment initialization").catch(console.error);
        } else {
          await transitionOrderState(orderId, "FAILED", {}, "Loyalty redemption failed before payment initialization").catch(console.error);
        }
        throw redemptionError;
      }
    }

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
      try {
        await promoService.incrementUsage(promoId, userId || undefined, orderId);
      } catch (promoIncErr: any) {
        // Rollback strategy: In a real production system, we might want to cancel the order here.
        // For now, we'll log it and let the checkout continue but warn.
        // Ideally, incrementUsage should be called BEFORE createOrder or inside a transaction.
        console.error(`[Promo Error] Failed to increment promo usage: ${promoIncErr.message}`);
      }
    }

    const provider = PaymentRouter.getInstance().getProvider(gatewayCode);
    paymentDispatchStarted = true;
    const paymentResult = await provider.createPayment({
      orderId: orderId,
      grossAmount: totalToPay,
      customerDetails: {
        first_name: customerInput?.buyerName || customerInput?.buyer_name || (userId ? "Customer" : "Guest"),
        email: customerInput?.email || "customer@istore.id",
        phone: customerInput?.whatsapp || customerInput?.phone || "08123456789"
      },
      itemDetails: [{
        id: (variant.id || variantId).substring(0, 50),
        price: totalToPay,
        quantity: 1,
        name: `${product.name} - ${variant.displayName || variant.name}`.substring(0, 50)
      }],
      paymentMethod: validatedPaymentMethod
    });

    if (!paymentResult.success || (!paymentResult.redirectUrl && !paymentResult.qrImage && !paymentResult.vaNumber)) {
      throw new Error(paymentResult.message || "Payment initialization failed: No presentation URL, QR, or VA.");
    }

    const isMidtrans = gatewayCode === "midtrans";

    // Save token & native presentation to order for future retries if needed
    const rawRes = paymentResult.rawResponse?.data || paymentResult.rawResponse || {};
    const resQrContent = rawRes.qr_content || rawRes.qr_string || rawRes.qrContent;
    const resVaNumber = paymentResult.vaNumber || rawRes.va_number || rawRes.vaNumber;
    const resVaBank = paymentResult.vaBank || rawRes.va_bank || rawRes.vaBank;
    const resRail = paymentResult.rail || rawRes.rail || validatedPaymentMethod;

    await orderRepo.updateOrder(orderId, {
      snapToken: isMidtrans ? paymentResult.token : (paymentResult.token || null),
      paymentUrl: paymentResult.redirectUrl || null,
      gatewayPaymentType: resRail || null,
      gatewayResponse: {
        rail: resRail || null,
        vaNumber: resVaNumber || null,
        vaBank: resVaBank || null,
        qrImage: paymentResult.qrImage || null,
        qrContent: resQrContent || null,
        totalAmount: paymentResult.totalAmount || totalToPay,
        expiresAt: paymentResult.expiresAt || null,
        paymentUrl: paymentResult.redirectUrl || null
      },
      updatedAt: new Date().toISOString()
    });

    return res.status(200).json({
      success: true,
      orderId,
      gatewayCode,
      snapToken: isMidtrans ? paymentResult.token : (paymentResult.token || null),
      paymentUrl: paymentResult.redirectUrl,
      qrImage: paymentResult.qrImage,
      rail: paymentResult.rail,
      vaNumber: paymentResult.vaNumber,
      vaBank: paymentResult.vaBank,
      totalAmount: paymentResult.totalAmount || totalToPay,
      expiresAt: paymentResult.expiresAt
    });

  } catch (error: any) {
    console.error("[Checkout Error]", error);
    
    // Attempt recovery if orderId exists
    if (orderId) {
      try {
        if (gatewayCode === 'midtrans') {
          const status = await checkMidtransStatus(orderId);
          if (status && isConfirmedPaymentFailure(gatewayCode, status.transaction_status)) {
            paymentFailureConfirmed = true;
            await transitionOrderState(orderId, 'FAILED', {}, "Midtrans confirmed payment initialization failure").catch(console.error);
          }
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
        } else if (gatewayCode === 'doit') {
          try {
            const doitProvider = PaymentRouter.getInstance().getProvider('doit');
            const doitStatus = await doitProvider.getPaymentStatus({ orderId });
            if (doitStatus && isConfirmedPaymentFailure(gatewayCode, doitStatus.transactionStatus)) {
              paymentFailureConfirmed = true;
            }
            if (doitStatus && doitStatus.transactionStatus === 'settlement') {
              try {
                await transitionOrderState(orderId, 'PAID', { gatewayTransactionId: doitStatus.rawData?.id }, "Reconciled after Doit create failure");
              } catch (stateErr: any) {
                if (!stateErr.message.includes("INVALID_STATE_TRANSITION")) throw stateErr;
              }
              const orderRepo = OrderRepository.getInstance();
              const refreshedOrderData = await orderRepo.getOrderById(orderId);
              if (refreshedOrderData && refreshedOrderData.paymentStatus === 'paid') {
                await safeRecordPaymentReceived(orderId, refreshedOrderData as any, "SYSTEM", { source: "Checkout Recovery Retry (Doit)" });
                if (refreshedOrderData.transactionStatus === 'pending') {
                  await dispatchFulfillment(orderId);
                }
              }
              return res.status(200).json({ success: true, message: "Order reconciled & dispatch started" });
            }
          } catch (doitRecErr) {
            console.error("[Doit Recovery Error]", doitRecErr);
          }
          if (paymentFailureConfirmed) {
            await transitionOrderState(orderId, 'FAILED', {}, "Doit confirmed payment initialization failure").catch(console.error);
          } else {
            console.warn(`[Doit Recovery] Payment status for ${orderId} is uncertain; leaving order pending for reconciliation.`);
          }
        } else if (gatewayCode === 'ipaymu') {
          // No authoritative status check is available in this recovery path.
          // Keep the order pending and points reserved until reconciliation confirms failure.
          console.warn(`[iPaymu Recovery] Payment status for ${orderId} is uncertain; leaving order pending for reconciliation.`);
        }
      } catch (recoveryError) {
        console.error("[Recovery Error]", recoveryError);
      }
    }
    
    // Reverse points only before payment dispatch or after an authoritative status confirms failure.
    // A timeout or missing gateway response is not proof that payment creation failed.
    const canSafelyReverseRedeemedPoints = !loyaltyRedemptionUncertain && (!paymentDispatchStarted || paymentFailureConfirmed);
    if (orderId && loyaltyRedeemed && userId && canSafelyReverseRedeemedPoints) {
      try {
        await loyaltyService.reverseRedeemedPoints(orderId, userId);
      } catch (pointsRollbackError: any) {
        console.error(`[Loyalty Cleanup] Failed to reverse redeemed points for ${orderId}:`, pointsRollbackError.message);
      }
    }

    // Release reservations only when no provider request was dispatched or the provider
    // authoritatively confirmed failure. A timeout/unknown status must keep the order's
    // stock and flash-sale quota reserved until reconciliation prevents overselling.
    const canReleaseCheckoutReservations = !loyaltyRedemptionUncertain && (!paymentDispatchStarted || paymentFailureConfirmed);
    if (orderId && canReleaseCheckoutReservations) {
      try {
        const { PromoService } = await import('./promo-service.js');
        await PromoService.getInstance().releaseUsage(orderId);
      } catch {}
      try {
        const { FlashSaleService } = await import('./flash-sale-service.js');
        await FlashSaleService.getInstance().releaseQuota(orderId);
      } catch {}
      try {
        const { InventoryService } = await import('./inventory-service.js');
        if (stockReserved) {
          await InventoryService.getInstance().releaseReservation(orderId);
        }
      } catch (err: any) {
        console.error(`[Inventory Cleanup] Failed to release reservation for ${orderId}:`, err.message);
      }
    } else if (orderId) {
      console.warn(`[Checkout Recovery] Keeping reservations for ${orderId} until payment status is reconciled.`);
    }
    
    return res.status(500).json({ success: false, message: error.message });
  }
}
