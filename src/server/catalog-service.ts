import { adminDb } from "./firebase-admin";
import { Game, Category, Product, ProductVariant, ProviderMapping, CatalogStatus, AvailabilityStatus, PricingMethod } from "../types/core";
import { PricingService } from "./pricing-service";

const pricingService = PricingService.getInstance();

export class CatalogService {
  private static instance: CatalogService;

  private constructor() {}

  public static getInstance(): CatalogService {
    if (!CatalogService.instance) {
      CatalogService.instance = new CatalogService();
    }
    return CatalogService.instance;
  }

  // ===================
  // GAME MANAGEMENT
  // ===================

  async createGame(data: Partial<Game>, userId: string): Promise<Game> {
    const gamesRef = adminDb.collection("games");
    
    // Check slug uniqueness
    if (data.slug) {
      const existing = await gamesRef.where("slug", "==", data.slug).limit(1).get();
      if (!existing.empty) {
        throw new Error(`Game with slug '${data.slug}' already exists`);
      }
    }

    const docRef = gamesRef.doc();
    const game: Game = {
      name: data.name || "",
      slug: data.slug || "",
      description: data.description || "",
      image: data.image || "",
      icon: data.icon || "",
      categoryIds: data.categoryIds || [],
      labels: data.labels || [],
      status: data.status || "inactive",
      availability: data.availability || "unavailable",
      sortOrder: data.sortOrder ?? 0,
      searchKeywords: data.searchKeywords || [],
      metadata: data.metadata || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: userId,
      updatedBy: userId,
      ...data,
      id: docRef.id
    };

    await docRef.set(game);
    return game;
  }

  async updateGame(id: string, data: Partial<Game>, userId: string): Promise<void> {
    const docRef = adminDb.collection("games").doc(id);
    const game = await docRef.get();
    if (!game.exists) throw new Error("Game not found");

    if (data.slug && data.slug !== game.data()?.slug) {
      const existing = await adminDb.collection("games").where("slug", "==", data.slug).limit(1).get();
      if (!existing.empty) throw new Error(`Game with slug '${data.slug}' already exists`);
    }

    await docRef.update({
      ...data,
      updatedAt: new Date().toISOString(),
      updatedBy: userId
    });
  }

  // ===================
  // CATEGORY MANAGEMENT
  // ===================

  async createCategory(data: Partial<Category>, userId: string): Promise<Category> {
    const categoriesRef = adminDb.collection("categories");
    
    if (data.slug) {
      const existing = await categoriesRef.where("slug", "==", data.slug).limit(1).get();
      if (!existing.empty) throw new Error(`Category with slug '${data.slug}' already exists`);
    }

    const docRef = categoriesRef.doc();
    const category: Category = {
      name: data.name || "",
      slug: data.slug || "",
      description: data.description || "",
      icon: data.icon || "",
      status: data.status || "inactive",
      sortOrder: data.sortOrder ?? 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: userId,
      updatedBy: userId,
      ...data,
      id: docRef.id
    };

    await docRef.set(category);
    return category;
  }

  async updateCategory(id: string, data: Partial<Category>, userId: string): Promise<void> {
    const docRef = adminDb.collection("categories").doc(id);
    const catSnap = await docRef.get();
    if (!catSnap.exists) throw new Error("Category not found");

    if (data.slug && data.slug !== catSnap.data()?.slug) {
      const existing = await adminDb.collection("categories").where("slug", "==", data.slug).limit(1).get();
      if (!existing.empty) throw new Error(`Category with slug '${data.slug}' already exists`);
    }

    await docRef.update({
      ...data,
      updatedAt: new Date().toISOString(),
      updatedBy: userId
    });
  }

  async deleteGame(id: string, userId: string): Promise<void> {
    const docRef = adminDb.collection("games").doc(id);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error("Game not found");
    
    const productsSnap = await adminDb.collection("products").where("gameId", "==", id).limit(1).get();
    if (!productsSnap.empty) {
      throw new Error("Cannot delete game because it has associated products. Please deactivate or remove products first.");
    }

    await docRef.delete();
  }

  async deleteCategory(id: string, userId: string): Promise<void> {
    const docRef = adminDb.collection("categories").doc(id);
    const doc = await docRef.get();
    if (!doc.exists) throw new Error("Category not found");

    await docRef.delete();
  }

  // ===================
  // PRODUCT MANAGEMENT
  // ===================

  async createProduct(data: Partial<Product>, userId: string): Promise<Product> {
    const productsRef = adminDb.collection("products");
    
    if (data.slug) {
      const existing = await productsRef.where("slug", "==", data.slug).limit(1).get();
      if (!existing.empty) throw new Error(`Product with slug '${data.slug}' already exists`);
    }

    const docRef = productsRef.doc();
    const product: Product = {
      gameId: data.gameId || "",
      categoryIds: data.categoryIds || [],
      name: data.name || "",
      slug: data.slug || "",
      description: data.description || "",
      type: data.type || "other",
      image: data.image || "",
      status: data.status || "inactive",
      availability: data.availability || "unavailable",
      sortOrder: data.sortOrder ?? 0,
      searchKeywords: data.searchKeywords || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: userId,
      updatedBy: userId,
      ...data,
      id: docRef.id
    };

    await docRef.set(product);
    return product;
  }

  async updateProduct(id: string, data: Partial<Product>, userId: string): Promise<void> {
    const docRef = adminDb.collection("products").doc(id);
    const prodSnap = await docRef.get();
    if (!prodSnap.exists) throw new Error("Product not found");

    if (data.slug && data.slug !== prodSnap.data()?.slug) {
      const existing = await adminDb.collection("products").where("slug", "==", data.slug).limit(1).get();
      if (!existing.empty) throw new Error(`Product with slug '${data.slug}' already exists`);
    }

    await docRef.update({
      ...data,
      updatedAt: new Date().toISOString(),
      updatedBy: userId
    });
  }

  // ===================
  // VARIANT MANAGEMENT
  // ===================

  async createVariant(data: Partial<ProductVariant>, userId: string): Promise<ProductVariant> {
    const variantsRef = adminDb.collection("productVariants");
    
    // SKU Uniqueness
    if (data.sku) {
      const existing = await variantsRef.where("sku", "==", data.sku).limit(1).get();
      if (!existing.empty) throw new Error(`SKU '${data.sku}' already exists`);
    }

    const docRef = variantsRef.doc();
    
    const baseCost = data.pricing?.baseCost ?? 0;
    const method = data.pricing?.pricingMethod || 'fixed';
    const value = data.pricing?.sellingPrice ?? 0;

    const calculation = pricingService.calculatePrice(baseCost, method, value);

    const variant: ProductVariant = {
      productId: data.productId || "",
      name: data.name || "",
      displayName: data.displayName || data.name || "",
      sku: data.sku || "",
      status: data.status || "inactive",
      availability: data.availability || "unavailable",
      sortOrder: data.sortOrder ?? 0,
      pricing: {
        baseCost,
        sellingPrice: calculation.sellingPrice,
        currency: data.pricing?.currency || "IDR",
        margin: calculation.margin,
        marginPercentage: calculation.marginPercentage,
        pricingMethod: method,
        status: calculation.status,
        lastPriceUpdate: new Date().toISOString(),
        lastCostUpdate: new Date().toISOString()
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: userId,
      updatedBy: userId,
      ...data,
      id: docRef.id
    };

    await docRef.set(variant);
    
    // Log History
    await pricingService.logPriceHistory(docRef.id, { pricing: {} }, variant, { uid: userId, email: "" }, "Initial creation");
    
    return variant;
  }

  async updateVariant(id: string, data: Partial<ProductVariant>, userId: string): Promise<void> {
    const docRef = adminDb.collection("productVariants").doc(id);
    const variantSnap = await docRef.get();
    if (!variantSnap.exists) throw new Error("Variant not found");

    const existingVariant = { id: variantSnap.id, ...variantSnap.data() } as ProductVariant;

    if (data.sku && data.sku !== existingVariant.sku) {
      const existing = await adminDb.collection("productVariants").where("sku", "==", data.sku).limit(1).get();
      if (!existing.empty) throw new Error(`SKU '${data.sku}' already exists`);
    }

    const currentPricing = existingVariant.pricing || {} as any;
    const updatedPricingInput = data.pricing || {} as any;
    
    const baseCost = updatedPricingInput.baseCost !== undefined ? updatedPricingInput.baseCost : (currentPricing.baseCost || 0);
    const method = (updatedPricingInput.pricingMethod || currentPricing.pricingMethod || 'fixed') as PricingMethod;
    const value = updatedPricingInput.sellingPrice !== undefined ? updatedPricingInput.sellingPrice : (currentPricing.sellingPrice || 0);

    const calculation = pricingService.calculatePrice(baseCost, method, value);

    const newPricing = {
      ...currentPricing,
      ...updatedPricingInput,
      sellingPrice: calculation.sellingPrice,
      margin: calculation.margin,
      marginPercentage: calculation.marginPercentage,
      status: calculation.status,
      lastPriceUpdate: (updatedPricingInput.sellingPrice !== undefined || updatedPricingInput.pricingMethod !== undefined) ? new Date().toISOString() : (currentPricing.lastPriceUpdate || new Date().toISOString()),
      lastCostUpdate: updatedPricingInput.baseCost !== undefined ? new Date().toISOString() : (currentPricing.lastCostUpdate || new Date().toISOString())
    };

    const updates = {
      ...data,
      pricing: newPricing,
      updatedAt: new Date().toISOString(),
      updatedBy: userId
    };

    await docRef.update(updates);
    
    // Log History if price or cost changed
    if (currentPricing.sellingPrice !== newPricing.sellingPrice || currentPricing.baseCost !== newPricing.baseCost) {
      await pricingService.logPriceHistory(id, existingVariant, { pricing: newPricing }, { uid: userId, email: "" }, "Admin Update");
    }
  }

  // ===================
  // PUBLIC FETCHERS (Sanitized)
  // ===================

  async getPublicGames(): Promise<any[]> {
    const snapshot = await adminDb.collection("games")
      .where("status", "==", "active")
      .orderBy("sortOrder", "asc")
      .get();
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        slug: data.slug,
        description: data.description,
        image: data.image,
        icon: data.icon,
        categoryIds: data.categoryIds,
        labels: data.labels,
        status: data.status,
        availability: data.availability,
        sortOrder: data.sortOrder
      };
    });
  }

  async getPublicGameBySlug(slug: string): Promise<any | null> {
    const snapshot = await adminDb.collection("games")
      .where("slug", "==", slug)
      .where("status", "==", "active")
      .limit(1)
      .get();
    
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name,
      slug: data.slug,
      description: data.description,
      image: data.image,
      icon: data.icon,
      categoryIds: data.categoryIds,
      labels: data.labels,
      status: data.status,
      availability: data.availability
    };
  }

  async getPublicProductsByGameId(gameId: string): Promise<any[]> {
    const snapshot = await adminDb.collection("products")
      .where("gameId", "==", gameId)
      .where("status", "==", "active")
      .orderBy("sortOrder", "asc")
      .get();
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        gameId: data.gameId,
        categoryIds: data.categoryIds,
        name: data.name,
        slug: data.slug,
        description: data.description,
        type: data.type,
        image: data.image,
        status: data.status,
        availability: data.availability
      };
    });
  }

  async getPublicVariantsByProductId(productId: string): Promise<any[]> {
    const snapshot = await adminDb.collection("productVariants")
      .where("productId", "==", productId)
      .where("status", "==", "active")
      .orderBy("sortOrder", "asc")
      .get();
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        productId: data.productId,
        name: data.name,
        displayName: data.displayName,
        sku: data.sku,
        status: data.status,
        availability: data.availability,
        sortOrder: data.sortOrder,
        sellingPrice: data.pricing?.sellingPrice || data.sellingPrice || 0
      };
    });
  }

  async getPublicCategories(): Promise<any[]> {
    const snapshot = await adminDb.collection("categories")
      .where("status", "==", "active")
      .orderBy("sortOrder", "asc")
      .get();
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        slug: data.slug,
        description: data.description,
        icon: data.icon,
        status: data.status,
        sortOrder: data.sortOrder
      };
    });
  }
}
