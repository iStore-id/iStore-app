export interface SystemConfiguration {
  id?: string;
  key: string;
  name: string;
  description: string;
  value: any;
  valueType: 'boolean' | 'number' | 'text' | 'percentage' | 'currency' | 'duration' | 'selection' | 'structured';
  scope: 'global' | 'store' | 'game' | 'product' | 'category' | 'payment' | 'provider' | 'segment' | 'campaign' | 'membership';
  status: 'active' | 'inactive' | 'archived';
  effectiveAt?: string;
  expiresAt?: string;
  version: number;
  updatedBy: string;
  updatedAt: string;
  createdAt: string;
}

export interface HomepageLayoutItem {
  id: 'hero' | 'ticker' | 'flashSale' | 'campaign' | 'landing' | 'navigation' | 'catalog' | 'blog' | 'faq';
  order: number;
  visible: boolean;
}

export interface HomepageLayoutConfig {
  items: HomepageLayoutItem[];
}

export interface StoreConfiguration {
  id?: string;
  name: string;
  logo: string;
  favicon: string;
  description: string;
  contactInformation: {
    email: string;
    phone: string;
    whatsapp: string;
    address: string;
  };
  currency: string;
  currencySymbol?: string;
  currencyPosition?: 'prefix' | 'suffix';
  decimalSeparator?: ',' | '.';
  thousandSeparator?: '.' | ',';
  decimalPlaces?: number;
  timezone: string;
  locale?: string;
  defaultLanguage?: string;
  supportedLanguages?: string[];
  dateFormat?: string;
  timeFormat?: '24h' | '12h';
  operationalStatus: 'open' | 'closed' | 'maintenance';
  closedMessage?: string;
  maintenanceMessage?: string;
  basicInformation: {
    tagline: string;
    socialMedia: Record<string, string>;
  };
  primaryColor?: string;
  secondaryColor?: string;
  brandTextColor?: string;
  
  // Expanded Branding Settings
  backgroundColor?: string;
  surfaceColor?: string;
  textColor?: string;
  textSecondaryColor?: string;
  borderColor?: string;
  accentColor?: string;
  hoverColor?: string;
  headerBackgroundColor?: string;
  headerTextColor?: string;
  logoStyle?: 'natural' | 'circle' | 'rounded-box';
  logoShowName?: boolean;
  catalogMarqueeText?: string;
  showCatalogMarquee?: boolean;
  homepageLayout?: HomepageLayoutConfig;
  homepageFeaturedGameIds?: string[];
  
  // Custom Homepage Background Settings
  homepageBackgroundColor?: string;
  homepageBackgroundImage?: string;
  homepageBackgroundMode?: 'color' | 'image';
  
  // Custom Footer Background Settings
  footerBackgroundColor?: string;
  footerBackgroundImage?: string;
  footerBackgroundMode?: 'inherit' | 'color' | 'image';

  // Custom Auth Background Settings (Login/Register)
  authBackgroundColor?: string;
  authBackgroundImage?: string;
  authBackgroundMode?: 'color' | 'image';
  
  // Custom Transaction Card Transparency & Blur Settings
  transactionCardColor?: string;
  transactionCardOpacity?: number;
  transactionCardBlur?: 'none' | 'sm' | 'md' | 'lg';
  
  headerScrollEffect?: boolean;
  logoHoverEffect?: boolean;
  navIndicator?: boolean;
  
  borderRadius?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'full';
  buttonStyle?: 'solid' | 'outline' | 'ghost' | 'soft';
  themePreference?: 'light' | 'dark' | 'system';
  showGlobalBorders?: boolean;
  
  updatedAt: string;
  createdAt: string;
}

export type CatalogStatus = 'active' | 'inactive' | 'maintenance' | 'archived';
export type AvailabilityStatus = 'available' | 'unavailable' | 'limited' | 'maintenance';

export interface Game {
  id?: string;
  name: string;
  slug: string;
  description: string;
  image: string; // cover image
  icon?: string; // thumbnail/icon
  categoryIds: string[];
  labels: string[];
  status: CatalogStatus;
  availability: AvailabilityStatus;
  sortOrder: number;
  searchKeywords: string[];
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  productCount?: number;
  variantCount?: number;
  minPrice?: number;
  maxPrice?: number;
}

export interface Category {
  id?: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  image?: string;
  status: 'active' | 'inactive';
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface Product {
  id?: string;
  gameId: string;
  categoryIds: string[];
  name: string;
  slug: string;
  description: string;
  type: 'game_currency' | 'membership' | 'battle_pass' | 'gift_card' | 'voucher' | 'digital_product' | 'other';
  image: string;
  status: CatalogStatus;
  availability: AvailabilityStatus;
  sortOrder: number;
  searchKeywords: string[];
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export type PricingMethod = 'fixed' | 'markup_fixed' | 'markup_percentage' | 'target_margin';

export interface PricingRule {
  id?: string;
  name: string;
  description?: string;
  method: PricingMethod;
  value: number;
  scope: 'global' | 'game' | 'category' | 'product' | 'variant' | 'membership';
  scopeId?: string; // ID of game, category, membership plan, etc.
  priority: number;
  status: 'active' | 'inactive';
  effectiveFrom?: string;
  effectiveUntil?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface PriceHistory {
  id?: string;
  variantId: string;
  oldCost: number;
  newCost: number;
  oldSellingPrice: number;
  newSellingPrice: number;
  oldMargin: number;
  newMargin: number;
  pricingMethod: PricingMethod;
  ruleId?: string;
  effectiveAt: string;
  actor: {
    uid: string;
    email: string;
  };
  reason?: string;
  timestamp: string;
}

export type StockStatus = 'active' | 'inactive';
export type StockMovementType = 'RECEIVE' | 'RESERVE' | 'RELEASE' | 'CONSUME' | 'ADJUST' | 'EXPIRE';
export type ReservationStatus = 'ACTIVE' | 'CONSUMED' | 'RELEASED' | 'EXPIRED';

export interface Stock {
  id?: string;
  variantId: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  lowStockThreshold: number;
  status: StockStatus;
  updatedAt: string;
  updatedBy: string;
}

export interface StockMovement {
  id?: string;
  variantId: string;
  type: StockMovementType;
  quantity: number;
  before: number;
  after: number;
  referenceId?: string;
  actor: string;
  reason?: string;
  timestamp: string;
}

export interface Reservation {
  id?: string;
  orderId: string;
  variantId: string;
  quantity: number;
  status: ReservationStatus;
  createdAt: string;
  expiresAt: string;
}

export interface Quota {
  id?: string;
  providerId: string;
  providerSkuId?: string;
  dailyTransactionLimit: number;
  dailyAmountLimit: number;
  usageTransaction: number;
  usageAmount: number;
  enabled: boolean;
  status: 'active' | 'inactive' | 'maintenance';
  period: string; // YYYY-MM-DD (local business date)
  updatedAt: string;
}

export interface ProductVariant {
  id?: string;
  productId: string;
  name: string;
  displayName: string;
  nominalValue?: number;
  unit?: string;
  sku: string;
  status: CatalogStatus;
  availability: AvailabilityStatus;
  sortOrder: number;
  // Pricing Engine
  pricing: {
    baseCost: number;
    sellingPrice: number;
    currency: string;
    margin: number;
    marginPercentage: number;
    pricingMethod: PricingMethod;
    appliedRuleId?: string;
    status: 'active' | 'pending' | 'review' | 'negative_margin';
    lastPriceUpdate?: string;
    lastCostUpdate?: string;
  };
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface ProviderMapping {
  id?: string;
  productId: string;
  variantId: string;
  sku: string; // internal variant sku
  providerId: string;
  providerSkuId: string; // linked to providerSkus collection
  providerSku: string; // provider's actual sku code
  status: 'UNMAPPED' | 'CANDIDATE' | 'NEEDS_REVIEW' | 'MAPPED' | 'APPROVED' | 'REJECTED';
  priority: number;
  routingEligibility: boolean;
  notes?: string;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

export type ProviderStatus = 'active' | 'inactive' | 'maintenance';
export type PaymentGatewayStatus = 'active' | 'inactive' | 'maintenance';
export type PaymentGatewayEnvironment = 'sandbox' | 'production';

export interface PaymentGateway {
  id?: string;
  name: string;
  code: string; // e.g. 'midtrans'
  type: string; // e.g. 'aggregator'
  environment: PaymentGatewayEnvironment;
  status: PaymentGatewayStatus;
  enabled: boolean;
  priority: number;
  capabilities: string[];
  createdAt?: string;
  updatedAt?: string;
}

export type ProviderHealthState = 'healthy' | 'degraded' | 'unavailable' | 'maintenance' | 'unknown';

export interface Provider {
  id?: string;
  name: string;
  code: string; // slug, e.g., 'apigames', 'tokovoucher'
  description: string;
  status: ProviderStatus;
  priority: number;
  capabilities: string[]; // e.g., ['game_topup', 'voucher']
  health: {
    state: ProviderHealthState;
    lastCheckedAt?: string;
    message?: string;
  };
  configMetadata: Record<string, any>; // non-sensitive
  createdAt: string;
  updatedAt: string;
}

export interface ProviderSku {
  id?: string;
  providerId: string;
  providerSku: string; // provider's code
  name: string; // provider's product name
  type: string;
  status: 'active' | 'inactive';
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface RoutingPolicy {
  id: string;
  name: string;
  priority: number;
  isActive: boolean;
  allowFallback: boolean;
  maxFallbackAttempts: number;
  maintenanceExclusion: boolean;
  capabilityMatching: boolean;
  effectiveFrom?: string;
  effectiveUntil?: string;
  updatedAt: string;
}

export interface RoutingDecision {
  orderId?: string;
  productVariantId: string;
  selectedMappingId: string;
  selectedProviderId: string;
  selectedProviderSkuId: string;
  selectedProviderSku: string;
  reason: string;
  code: 'SUCCESS' | 'NO_MAPPING' | 'PROVIDER_INACTIVE' | 'MAINTENANCE' | 'LOW_PRIORITY' | 'FALLBACK_TRIGGERED' | 'FAILED';
  isFallback: boolean;
  attempt: number;
  timestamp: string;
}

export interface AuditLog {
  id?: string;
  actor: {
    uid: string;
    email: string;
  };
  role: string;
  action: string;
  target: string;
  before?: any;
  after?: any;
  reason?: string;
  timestamp: string;
}

export type SystemLogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
export type SystemLogCategory = 'APPLICATION' | 'API' | 'PAYMENT' | 'PROVIDER' | 'WEBHOOK' | 'QUEUE' | 'FULFILLMENT' | 'SECURITY' | 'SYSTEM';

export interface SystemLog {
  id?: string;
  timestamp: string;
  level: SystemLogLevel;
  category: SystemLogCategory;
  event: string;
  message: string;
  service: string;
  requestId?: string;
  correlationId?: string;
  orderId?: string;
  jobId?: string;
  provider?: string;
  httpStatus?: number;
  durationMs?: number;
  retryCount?: number;
  outcome?: 'SUCCESS' | 'FAILURE' | 'PENDING' | 'BLOCKED' | 'WARNING';
  stackTrace?: string;
  metadata?: Record<string, any>;
}

export interface ReconciliationRun {
  id: string;
  executedBy: string;
  startedAt: string;
  completedAt: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  totalOrdersScanned: number;
  mismatchCount: number;
  createdAt: string;
}

export interface ReconciliationRecord {
  id: string;
  runId: string;
  orderId: string;
  type: 'STATUS_MISMATCH' | 'AMOUNT_MISMATCH' | 'PROVIDER_PENDING';
  resolutionStatus: 'OPEN' | 'RESOLVED';
  localState: string;
  providerState: string | null;
  expectedAmount: number;
  actualAmount: number;
  actorUid?: string | null;
  resolutionReason?: string | null;
  resolutionAction?: string | null;
  resolvedAt?: string | null;
  firstDetectedAt: string;
  lastCheckedAt: string;
  createdAt: string;
  updatedAt: string;
}

export type JobStatus = 'QUEUED' | 'PROCESSING' | 'SUCCEEDED' | 'RETRYING' | 'FAILED' | 'DEAD_LETTER' | 'CANCELLED';
export type JobPriority = 'HIGH' | 'NORMAL' | 'LOW';

export interface Job {
  id: string;
  type: string;
  status: JobStatus;
  priority: JobPriority;
  attempts: number;
  maxAttempts: number;
  payload: any;
  referenceId?: string;
  idempotencyKey: string;
  scheduledAt: string;
  startedAt?: string;
  completedAt?: string;
  nextRetryAt?: string;
  lastError?: string;
  lockedAt?: string;
  lockedBy?: string;
  logs?: { timestamp: string; message: string }[];
  createdAt: string;
  updatedAt: string;
}

export type SLAResource = 'PAYMENT' | 'FULFILLMENT' | 'PROVIDER' | 'ORDER_TOTAL' | 'SUPPORT_FIRST_RESPONSE' | 'SUPPORT_RESOLUTION';
export type SLAStatus = 'NOT_STARTED' | 'RUNNING' | 'WARNING' | 'BREACHED' | 'COMPLETED' | 'EXCLUDED';

export interface SLAPolicy {
  id?: string;
  name: string;
  resource: SLAResource;
  targetDuration: number; // in seconds
  warningThreshold: number; // in seconds
  criticalThreshold: number; // in seconds
  enabled: boolean;
  priority: number;
  useBusinessHours?: boolean;
  scope?: {
    providerIds?: string[];
    gameIds?: string[];
    productIds?: string[];
  };
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface SLAMeasurement {
  policyId: string;
  policyName: string;
  resource: SLAResource;
  status: SLAStatus;
  elapsedTime: number; // in seconds
  targetTime: number;
  warningTime: number;
  criticalTime: number;
  breachDuration: number;
  startedAt: string | null;
  completedAt: string | null;
}

export interface OrderSLA {
  orderId: string;
  measurements: Record<SLAResource, SLAMeasurement>;
  overallStatus: SLAStatus;
  updatedAt: string;
}

export interface BusinessCalendarConfig {
  id?: string;
  timezone: string; // IANA Timezone, e.g., 'Asia/Jakarta'
  weeklySchedule: Record<number, DaySchedule>; // 0-6 (Sun-Sat)
  updatedAt: string;
  updatedBy: string;
}

export interface DaySchedule {
  isEnabled: boolean;
  windows: TimeWindow[];
}

export interface TimeWindow {
  open: string; // HH:mm
  close: string; // HH:mm
}

export type CalendarExceptionType = 'HOLIDAY' | 'SPECIAL_OPERATING_DAY' | 'BLACKOUT' | 'MAINTENANCE';

export interface CalendarException {
  id?: string;
  name: string;
  type: CalendarExceptionType;
  date?: string; // YYYY-MM-DD for single day exceptions
  startAt?: string; // ISO string for blackout/maintenance
  endAt?: string; // ISO string for blackout/maintenance
  windows?: TimeWindow[]; // For SPECIAL_OPERATING_DAY
  isEnabled: boolean;
  reason?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export type SettlementAdjustmentType =
  | 'MDR_CORRECTION'
  | 'BANK_FEE'
  | 'REVENUE_ADJUSTMENT'
  | 'RECEIVABLE_WRITE_OFF'
  | 'OTHER';

export interface SettlementAdjustment {
  id: string; // sett_adj_{batchId}_{timestamp}_{random}
  batchId: string;
  amount: number; // Positive integer IDR
  type: SettlementAdjustmentType;
  direction: 'POSITIVE' | 'NEGATIVE';
  reason: string;
  createdBy: string;
  createdAt: string;
  isPostSettlement?: boolean;
  ledgerRecorded?: boolean;
  ledgerRecordedAt?: string;
}

export interface SettlementBatch {
  id: string;
  periodDate: string;
  periodStart?: string;
  periodEnd?: string;
  sourceType: 'MIDTRANS_MAP_CSV';
  sourceFileName: string;
  sourceFileHash: string;
  grossAmount: number;
  mdrFeeAmount: number;
  refundAmount: number;
  adjustmentAmount: number;
  netSettledAmount: number;
  orderCount: number;
  status: 'CALCULATED' | 'VERIFIED' | 'SETTLED' | 'DISPUTED';
  idempotencyKey: string;
  processedBy: string;
  createdAt: string;
  updatedAt: string;
  verifiedAt?: string;
  settledAt?: string;
}

export interface SettlementRecord {
  id: string; // sett_rec_{orderId}
  batchId: string;
  orderId: string;
  grossAmount: number;
  mdrFeeAmount: number;
  refundAmount: number;
  adjustmentAmount: number;
  netAmount: number;
  paymentType: string;
  gatewayTransactionStatus: string;
  gatewaySettledAt?: string;
  sourceRowHash?: string;
  createdAt: string;
}

export interface ProcessResult {
  success: boolean;
  message?: string;
  code?: string;
  batch?: any;
  recordsCount?: number;
  data?: any;
}

export interface SecuritySettings {
  auth: {
    allowPasswordAuth: boolean;
    allowGoogleAuth: boolean;
    sessionTimeoutMinutes: number;
    minPasswordLength: number;
    requirePasswordNumbers: boolean;
    requirePasswordSymbols: boolean;
    maxFailedLoginAttempts: number;
    lockoutDurationMinutes: number;
    requireReauthForSensitiveOps: boolean;
    mfaPolicy: 'disabled' | 'optional' | 'required_admins' | 'required_all';
  };
  rateLimiting: {
    enablePublicRateLimit: boolean;
    publicApiMaxRequestsPerMinute: number;
    enableCheckoutRateLimit: boolean;
    checkoutMaxRequestsPerMinute: number;
    enableAdminRateLimit: boolean;
    adminMaxRequestsPerMinute: number;
    enableBotProtection: boolean;
  };
  network: {
    ipWhitelistEnabled: boolean;
    ipWhitelist: string[];
    ipBlacklistEnabled: boolean;
    ipBlacklist: string[];
    enforceMidtransIpWhitelist: boolean;
    enforceTokoVoucherIpWhitelist: boolean;
  };
  dataProtection: {
    maskCustomerDataInLogs: boolean;
    logAllAdminMutations: boolean;
    requireReasonForRefunds: boolean;
    requireReasonForConfigChanges: boolean;
    allowExportSensitiveData: boolean;
    secretMaskingStrict: boolean;
  };
  emergency: {
    lockdownMode: boolean;
    lockdownReason?: string;
    lockdownStartedAt?: string;
  };
}
