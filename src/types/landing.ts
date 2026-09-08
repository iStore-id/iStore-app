export type LandingStatus = 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'ENDED' | 'INACTIVE' | 'ARCHIVED';

export type LandingBlockType = 
  | 'HERO'
  | 'TEXT'
  | 'IMAGE'
  | 'CTA'
  | 'PRODUCT_HIGHLIGHT'
  | 'PROMO_HIGHLIGHT';

export interface HeroBlockData {
  title: string;
  subtitle?: string;
  mediaId?: string;
  mediaUrl?: string;
  badge?: string;
  ctaText?: string;
  ctaUrl?: string;
  alignment?: 'left' | 'center';
}

export interface TextBlockData {
  heading?: string;
  content: string;
  alignment?: 'left' | 'center';
}

export interface ImageBlockData {
  mediaId?: string;
  mediaUrl: string;
  caption?: string;
  altText?: string;
}

export interface CtaBlockData {
  title?: string;
  description?: string;
  buttonText: string;
  targetUrl: string;
  style?: 'primary' | 'secondary' | 'outline';
}

export interface ProductHighlightBlockData {
  gameId?: string;
  gameSlug?: string;
  productId?: string;
  customTitle?: string;
  customDescription?: string;
  layout?: 'grid' | 'card' | 'banner';
  resolvedGame?: {
    id: string;
    name: string;
    slug: string;
    image: string;
    description?: string;
  };
}

export interface PromoHighlightBlockData {
  promoId?: string;
  flashSaleId?: string;
  campaignId?: string;
  customTitle?: string;
  customDescription?: string;
  resolvedPromo?: {
    id: string;
    code: string;
    name: string;
    discountType: string;
    discountValue: number;
    minSpend?: number;
    maxDiscount?: number;
  };
  resolvedFlashSale?: {
    id: string;
    name: string;
    salePrice: number;
    startAt: string;
    endAt: string;
  };
  resolvedCampaign?: {
    id: string;
    title: string;
    description: string;
    mediaUrl?: string;
    slug?: string;
  };
}

export interface LandingBlock {
  id: string;
  type: LandingBlockType;
  order: number;
  data: HeroBlockData | TextBlockData | ImageBlockData | CtaBlockData | ProductHighlightBlockData | PromoHighlightBlockData | any;
}

export interface LandingPage {
  id: string;
  name: string; // Internal name for owner/admin
  title: string; // Public display title
  slug: string; // URL-safe slug
  description: string; // Meta and preview description
  seoTitle?: string;
  seoDescription?: string;
  mediaId?: string; // Reference to MediaLibrary
  mediaUrl?: string; // Cover image URL
  sections: LandingBlock[];
  ctaText?: string;
  ctaUrl?: string;
  campaignId?: string; // Optional relation to Campaign
  gameId?: string; // Optional relation to Game
  categoryId?: string; // Optional relation to Category
  productId?: string; // Optional relation to Product
  startAt?: string; // ISO datetime
  endAt?: string; // ISO datetime
  enabled: boolean;
  published: boolean;
  isArchived: boolean;
  status: LandingStatus;
  createdBy: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}
