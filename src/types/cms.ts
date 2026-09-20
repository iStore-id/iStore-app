
export interface MediaItem {
  id: string;
  fileName: string;
  originalName: string;
  storagePath: string;
  cloudinaryPublicId?: string;
  url: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  altText?: string;
  folder?: string;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'archived';
}

export interface Banner {
  id: string;
  name: string;
  mediaId: string;
  mediaUrl: string;
  placement: 'homepage_hero' | 'homepage_promo' | 'game_promo';
  title?: string;
  altText?: string;
  target?: string;
  sortOrder: number;
  enabled: boolean;
  published: boolean;
  startAt?: string;
  endAt?: string;
  createdBy: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Popup {
  id: string;
  name: string;
  title: string;
  content: string;
  mediaId?: string;
  mediaUrl?: string;
  placement: 'homepage' | 'all_pages' | 'checkout';
  trigger: 'immediate' | 'delay_3s' | 'exit_intent';
  target?: string;
  priority: number;
  enabled: boolean;
  published: boolean;
  startAt?: string;
  endAt?: string;
  createdBy: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export type CampaignStatus = 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'ENDED' | 'INACTIVE' | 'ARCHIVED';

export function computeCampaignStatus(campaign: {
  published: boolean;
  enabled: boolean;
  isArchived?: boolean;
  startAt: string;
  endAt?: string;
}): CampaignStatus {
  if (campaign.isArchived) return 'ARCHIVED';
  if (!campaign.published) return 'DRAFT';
  if (!campaign.enabled) return 'INACTIVE';

  const now = new Date().toISOString();
  if (campaign.startAt && now < campaign.startAt) {
    return 'SCHEDULED';
  }
  if (campaign.endAt && now > campaign.endAt) {
    return 'ENDED';
  }
  return 'ACTIVE';
}

export interface Campaign {
  id: string;
  name: string;
  title: string;
  description: string;
  slug: string;
  mediaId?: string;
  mediaUrl?: string;
  promoIds?: string[];
  flashSaleIds?: string[];
  bannerIds?: string[];
  popupIds?: string[];
  targetType: 'all' | 'game' | 'category' | 'product' | 'custom_url';
  targetId?: string;
  targetUrl?: string;
  priority: number;
  enabled: boolean;
  published: boolean;
  isArchived: boolean;
  startAt: string;
  endAt?: string;
  status: CampaignStatus;
  createdBy: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}
