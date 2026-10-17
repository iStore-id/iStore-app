/**
 * Public route registry: keep static public route paths and sitemap picker
 * eligibility in one place. Content-backed route families (games, blog posts,
 * and landing pages) are handled by SEOService's active-content sitemap queries.
 */
export const PUBLIC_ROUTE_PATHS = {
  home: "/",
  gameDetail: "/games/:slug",
  transactionCheck: "/transactions",
  transactionHistory: "/transactions/history",
  transactionDetail: "/transactions/:invoice",
  promoLanding: "/promo/:slug",
  landing: "/landing/:slug",
  blogList: "/blog",
  blogDetail: "/blog/:slug",
  faq: "/faq",
  privacy: "/privacy",
  terms: "/terms",
  termsAlias: "/syarat-ketentuan",
  refund: "/refund",
  refundAlias: "/kebijakan-pengembalian",
  notifications: "/notifications",
  membership: "/membership",
  support: "/support",
  account: "/account",
  profile: "/profile",
} as const;

export interface SitemapPublicPage {
  path: string;
  label: string;
}

/**
 * Only real, static, customer-facing pages that are not already covered by
 * sitemap's automatic homepage/catalog/blog/landing/FAQ/legal entries.
 * Private customer pages and parameterized content routes are deliberately
 * excluded; active content pages are included by the server-side generator.
 */
export const ADDITIONAL_SITEMAP_PUBLIC_PAGES: readonly SitemapPublicPage[] = [
  { path: PUBLIC_ROUTE_PATHS.transactionCheck, label: "Cek Status Transaksi" },
  { path: PUBLIC_ROUTE_PATHS.membership, label: "Status VIP Membership" },
  { path: PUBLIC_ROUTE_PATHS.support, label: "Bantuan & Dukungan" },
];
