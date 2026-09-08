export type TwitterCardType = "summary" | "summary_large_image";

export interface DefaultOgImage {
  mediaId?: string;
  url: string;
  altText?: string;
  width?: number;
  height?: number;
}

export interface RobotsPolicy {
  allowIndexing: boolean;
  disallowPaths: string[];
  crawlDelay?: number;
  customDirectives?: string;
}

export interface SitemapPolicy {
  enabled: boolean;
  includeHomepage: boolean;
  includeGames: boolean;
  includeBlog: boolean;
  includeLandings: boolean;
  includeFaq: boolean;
  changefreqDefault: "always" | "hourly" | "daily" | "weekly" | "monthly";
  customPaths?: string[];
}

export interface SocialMetadata {
  twitterHandle?: string;
  twitterCreator?: string;
  twitterCardType: TwitterCardType;
  facebookAppId?: string;
}

export interface SEOSettings {
  id: "global";
  siteName: string;
  titleSeparator: string;
  defaultTitle: string;
  defaultDescription: string;
  defaultKeywords: string[];
  canonicalBaseUrl: string;
  defaultOgImage: DefaultOgImage;
  robotsPolicy: RobotsPolicy;
  sitemapPolicy: SitemapPolicy;
  socialMetadata: SocialMetadata;
  updatedAt: string;
  updatedBy: string;
}

export interface PublicSEOSettings {
  siteName: string;
  titleSeparator: string;
  defaultTitle: string;
  defaultDescription: string;
  defaultKeywords: string[];
  canonicalBaseUrl: string;
  defaultOgImage: DefaultOgImage;
  socialMetadata: SocialMetadata;
}

export interface PageMetadataInput {
  title?: string;
  description?: string;
  keywords?: string[];
  canonicalPath?: string;
  ogImage?: string;
  ogType?: "website" | "article" | "product";
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
  noindex?: boolean;
  jsonLd?: Record<string, any> | Array<Record<string, any>>;
}
