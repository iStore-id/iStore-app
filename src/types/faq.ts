export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  sortOrder: number;
  published: boolean;
  enabled: boolean;
  archived: boolean;
  relatedGameId?: string;
  relatedPromoId?: string;
  relatedBlogId?: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export type FAQStatus = "PUBLISHED" | "DRAFT" | "INACTIVE" | "ARCHIVED";

export interface FAQAdminItem extends FAQItem {
  status: FAQStatus;
}

export interface PublicFAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  sortOrder: number;
  relatedGame?: {
    id: string;
    name: string;
    slug: string;
    image?: string;
  } | null;
  relatedPromo?: {
    id: string;
    name: string;
    code: string;
    discountType: string;
    discountValue: number;
  } | null;
}

export interface FAQListResponse {
  items: PublicFAQItem[];
  total: number;
  categories: string[];
}

export interface FAQAdminListResponse {
  items: FAQAdminItem[];
  total: number;
  page: number;
  totalPages: number;
  categories: string[];
}
