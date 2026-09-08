export type BlogStatus = 'PUBLISHED' | 'SCHEDULED' | 'DRAFT' | 'ENDED' | 'INACTIVE' | 'ARCHIVED';

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string; // Sanitized markdown or structured text
  coverMediaId?: string;
  coverMediaUrl?: string;
  category: string;
  tags: string[];
  author: string;
  readTime: number; // minutes
  published: boolean;
  enabled: boolean;
  isArchived: boolean;
  publishedAt?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  seoTitle?: string;
  seoDescription?: string;
  relatedGameId?: string;
  relatedPromoId?: string;
  relatedCampaignId?: string;
  relatedLandingId?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  status?: BlogStatus;
}

export interface PublicBlogItem {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  coverMediaUrl?: string;
  category: string;
  tags: string[];
  author: string;
  readTime: number;
  publishedAt: string;
  status: BlogStatus;
}

export interface PublicBlogDetail extends PublicBlogItem {
  content: string;
  seoTitle?: string;
  seoDescription?: string;
  relatedGame?: {
    id: string;
    name: string;
    slug: string;
    image: string;
  };
  relatedPromo?: {
    id: string;
    name: string;
    code: string;
    discountType: string;
    discountValue: number;
  };
  relatedCampaign?: {
    id: string;
    title: string;
    slug?: string;
    mediaUrl?: string;
  };
  relatedLanding?: {
    id: string;
    title: string;
    slug: string;
    mediaUrl?: string;
  };
}
