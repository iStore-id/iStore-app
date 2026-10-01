import { useEffect, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase, isSupabaseConfigured } from "./lib/supabase";
import { useAuthStore } from "./store/auth-store";
import { ErrorBoundary } from "./components/ErrorBoundary";

// Layouts
import MainLayout from "./layouts/MainLayout";
import AdminLayout from "./layouts/AdminLayout";

// Public Pages (Static for instant First Paint)
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import GameDetailPage from "./pages/GameDetailPage";
import TransactionCheckPage from "./pages/TransactionCheckPage";
import TransactionHistoryPage from "./pages/TransactionHistoryPage";
import TransactionDetailPage from "./pages/TransactionDetailPage";
import PublicLandingPage from "./pages/PublicLandingPage";
import BlogListPage from "./pages/BlogListPage";
import BlogDetailPage from "./pages/BlogDetailPage";
import FaqPage from "./pages/FaqPage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import TermsPage from "./pages/TermsPage";
import RefundPolicyPage from "./pages/RefundPolicyPage";
import NotificationPage from "./pages/NotificationPage";
import MembershipStatusPage from "./pages/MembershipStatusPage";
import SupportPage from "./pages/SupportPage";
import AccountPage from "./pages/AccountPage";

// Lazy-loaded Admin Pages (Code Splitting for Optimal Homepage Payload)
const AdminDashboardPage = lazy(() => import("./pages/admin/AdminDashboardPage"));
const AdminProductsPage = lazy(() => import("./pages/admin/AdminProductsPage"));
const AdminGamesPage = lazy(() => import("./pages/admin/AdminGamesPage"));
const AdminCategoriesPage = lazy(() => import("./pages/admin/AdminCategoriesPage"));
const AdminPricingRulesPage = lazy(() => import("./pages/admin/AdminPricingRulesPage"));
const AdminProvidersPage = lazy(() => import("./pages/admin/AdminProvidersPage"));
const AdminProviderMappingPage = lazy(() => import("./pages/admin/AdminProviderMappingPage"));
const AdminPaymentGatewaysPage = lazy(() => import("./pages/admin/AdminPaymentGatewaysPage"));
const AdminOrdersPage = lazy(() => import("./pages/admin/AdminOrdersPage"));
const AdminPromosPage = lazy(() => import("./pages/admin/AdminPromosPage"));
const AdminFlashSalePage = lazy(() => import("./pages/admin/AdminFlashSalePage"));
const AdminLoyaltyPage = lazy(() => import("./pages/admin/AdminLoyaltyPage"));
const AdminRewardsPage = lazy(() => import("./pages/admin/AdminRewardsPage"));
const AdminReviewsPage = lazy(() => import("./pages/admin/AdminReviewsPage"));
const AdminPaymentsPage = lazy(() => import("./pages/admin/AdminPaymentsPage"));
const AdminRefundsPage = lazy(() => import("./pages/admin/AdminRefundsPage"));
const AdminTaxesPage = lazy(() => import("./pages/admin/AdminTaxesPage").then(m => ({ default: m.AdminTaxesPage })));
const AdminReconciliationPage = lazy(() => import("./pages/admin/AdminReconciliationPage").then(m => ({ default: m.AdminReconciliationPage })));
const AdminSettlementPage = lazy(() => import("./pages/admin/AdminSettlementPage"));
const AdminCommissionPage = lazy(() => import("./pages/admin/AdminCommissionPage"));
const AdminLedgerPage = lazy(() => import("./pages/admin/AdminLedgerPage").then(m => ({ default: m.AdminLedgerPage })));
const AdminUsersPage = lazy(() => import("./pages/admin/AdminUsersPage"));
const AdminCustomerSegmentsPage = lazy(() => import("./pages/admin/AdminCustomerSegmentsPage").then(m => ({ default: m.AdminCustomerSegmentsPage })));
const AdminReferralPage = lazy(() => import("./pages/admin/AdminReferralPage"));
const AdminMembershipPage = lazy(() => import("./pages/admin/AdminMembershipPage"));
const AdminSupportPage = lazy(() => import("./pages/admin/AdminSupportPage"));
const AdminStockPage = lazy(() => import("./pages/admin/AdminStockPage"));
const AdminDeliveryPage = lazy(() => import("./pages/admin/AdminDeliveryPage"));
const AdminQueuePage = lazy(() => import("./pages/admin/AdminQueuePage"));
const SLAPage = lazy(() => import("./pages/admin/SLA"));
const AdminCalendarPage = lazy(() => import("./pages/admin/AdminCalendarPage"));
const AdminCampaignsPage = lazy(() => import("./pages/admin/AdminCampaignsPage"));
const AdminBannersPage = lazy(() => import("./pages/admin/AdminBannersPage"));
const AdminPopupsPage = lazy(() => import("./pages/admin/AdminPopupsPage"));
const AdminLandingsPage = lazy(() => import("./pages/admin/AdminLandingsPage"));
const AdminLandingPreviewPage = lazy(() => import("./pages/admin/AdminLandingPreviewPage"));
const AdminBlogPage = lazy(() => import("./pages/admin/AdminBlogPage"));
const AdminFaqPage = lazy(() => import("./pages/admin/AdminFaqPage"));
const AdminMediaLibraryPage = lazy(() => import("./pages/admin/AdminMediaLibraryPage"));
const AdminSeoPage = lazy(() => import("./pages/admin/AdminSeoPage"));
const RoleManagementPage = lazy(() => import("./pages/admin/RoleManagementPage"));
const SecurityPage = lazy(() => import("./pages/admin/SecurityPage"));
const AuditLogsPage = lazy(() => import("./pages/admin/AuditLogsPage"));
const SystemLogsPage = lazy(() => import("./pages/admin/SystemLogsPage"));
const AdminFeatureFlagsPage = lazy(() => import("./pages/admin/AdminFeatureFlagsPage").then(m => ({ default: m.AdminFeatureFlagsPage })));
const AdminSystemConfigPage = lazy(() => import("./pages/admin/AdminSystemConfigPage").then(m => ({ default: m.AdminSystemConfigPage })));
const AdminIntegrationsHubPage = lazy(() => import("./pages/admin/AdminIntegrationsHubPage"));
const AdminMidtransIntegrationPage = lazy(() => import("./pages/admin/AdminMidtransIntegrationPage"));
const AdminIpaymuIntegrationPage = lazy(() => import("./pages/admin/AdminIpaymuIntegrationPage"));
const AdminApiGamesIntegrationPage = lazy(() => import("./pages/admin/AdminApiGamesIntegrationPage"));
const AdminTokoVoucherIntegrationPage = lazy(() => import("./pages/admin/AdminTokoVoucherIntegrationPage"));
const AdminBackupPage = lazy(() => import("./pages/admin/AdminBackupPage").then(m => ({ default: m.AdminBackupPage })));
const AdminSettingsPage = lazy(() => import("./pages/admin/AdminSettingsPage"));
const AdminBrandingPage = lazy(() => import("./pages/admin/AdminBrandingPage"));
const AdminDomainPage = lazy(() => import("./pages/admin/AdminDomainPage"));
const AdminNotificationSettingsPage = lazy(() => import("./pages/admin/AdminNotificationSettingsPage"));
const AdminCommunicationPage = lazy(() => import("./pages/admin/AdminCommunicationPage"));
const AdminPrivacyPage = lazy(() => import("./pages/admin/AdminPrivacyPage"));
const AdminRegionalPage = lazy(() => import("./pages/admin/AdminRegionalPage"));
const AdminNotificationPage = lazy(() => import("./pages/admin/AdminNotificationPage"));
const AdminHealthPage = lazy(() => import("./pages/admin/AdminHealthPage"));
const AdminIncidentPage = lazy(() => import("./pages/admin/AdminIncidentPage"));

const AdminSuspenseFallback = () => (
  <div className="flex items-center justify-center min-h-[50vh] p-8">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-brand-600 rounded-full animate-spin" />
  </div>
);

export default function App() {
  const { setUser, setLoading } = useAuthStore();

  useEffect(() => {
    let active = true;

    async function initAuth() {
      if (!isSupabaseConfigured || !supabase) {
        setLoading(false);
        return;
      }

      // 1. Try to get initial session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (active) {
        if (session?.user) {
          // Handle initial session user
          await handleAuthUpdate(session);
        } else {
          setUser(null, null);
          useAuthStore.getState().setPermissions([]);
          setLoading(false);
        }
      }

      // 2. Subscribe to auth changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (active) {
          await handleAuthUpdate(session);
        }
      });

      return () => {
        active = false;
        subscription.unsubscribe();
      };
    }

    async function handleAuthUpdate(session: any) {
      if (session?.user) {
        const sbUser = session.user;
        const userEmail = sbUser.email || "";
        const token = session.access_token;
        
        let role = "customer";
        try {
          const [permsRes, profileRes] = await Promise.all([
            fetch('/api/auth/permissions', {
              headers: { 'Authorization': `Bearer ${token}` }
            }),
            fetch(`/api/customer/profile/${sbUser.id}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            })
          ]);
          const [permsData, profileData] = await Promise.all([
            permsRes.json(),
            profileRes.json()
          ]);
          if (permsData.success) {
            useAuthStore.getState().setPermissions(permsData.data);
          }
          if (profileData.success) {
            role = profileData.data.role || "customer";
          }
        } catch (e) {
          console.warn("Notice: permissions/profile fetch failed", e);
        }

        console.log("Setting user role to:", role);
        const userData = {
          uid: sbUser.id,
          email: userEmail,
          displayName: sbUser.user_metadata?.full_name || userEmail.split("@")[0],
          getIdToken: async () => token
        };
        setUser(userData, role);
      } else {
        setUser(null, null);
        useAuthStore.getState().setPermissions([]);
      }
      setLoading(false);
    }

    initAuth();
  }, [setUser, setLoading]);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route element={<MainLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/games/:slug" element={<GameDetailPage />} />
            <Route path="/transactions" element={<TransactionCheckPage />} />
            <Route path="/transactions/history" element={<TransactionHistoryPage />} />
            <Route path="/transactions/:invoice" element={<TransactionDetailPage />} />
            <Route path="/promo/:slug" element={<PublicLandingPage />} />
            <Route path="/landing/:slug" element={<PublicLandingPage />} />
            <Route path="/blog" element={<BlogListPage />} />
            <Route path="/blog/:slug" element={<BlogDetailPage />} />
            <Route path="/faq" element={<FaqPage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/syarat-ketentuan" element={<TermsPage />} />
            <Route path="/refund" element={<RefundPolicyPage />} />
            <Route path="/kebijakan-pengembalian" element={<RefundPolicyPage />} />
            <Route path="/notifications" element={<NotificationPage />} />
            <Route path="/membership" element={<MembershipStatusPage />} />
            <Route path="/support" element={<SupportPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/profile" element={<AccountPage />} />
          </Route>
          <Route
            path="/admin"
            element={
              <Suspense fallback={<AdminSuspenseFallback />}>
                <AdminLayout />
              </Suspense>
            }
          >
            <Route index element={<AdminDashboardPage />} />
            <Route path="notifications" element={<AdminNotificationPage />} />
            <Route path="health" element={<AdminHealthPage />} />
            <Route path="incidents" element={<AdminIncidentPage />} />
            <Route path="products" element={<AdminProductsPage />} />
            <Route path="games" element={<AdminGamesPage />} />
            <Route path="categories" element={<AdminCategoriesPage />} />
            <Route path="pricing-rules" element={<AdminPricingRulesPage />} />
            <Route path="providers" element={<AdminProvidersPage />} />
            <Route path="provider-mappings" element={<AdminProviderMappingPage />} />
            <Route path="gateways" element={<AdminPaymentGatewaysPage />} />
            <Route path="orders" element={<AdminOrdersPage />} />
            <Route path="promos" element={<AdminPromosPage />} />
            <Route path="flash-sale" element={<AdminFlashSalePage />} />
            <Route path="loyalty" element={<AdminLoyaltyPage />} />
            <Route path="rewards" element={<AdminRewardsPage />} />
            <Route path="reviews" element={<AdminReviewsPage />} />
            <Route path="payments" element={<AdminPaymentsPage />} />
            <Route path="refunds" element={<AdminRefundsPage />} />
            <Route path="taxes" element={<AdminTaxesPage />} />
            <Route path="reconciliation" element={<AdminReconciliationPage />} />
            <Route path="settlement" element={<AdminSettlementPage />} />
            <Route path="commission" element={<AdminCommissionPage />} />
            <Route path="ledger" element={<AdminLedgerPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="customer-segments" element={<AdminCustomerSegmentsPage />} />
            <Route path="referral" element={<AdminReferralPage />} />
            <Route path="membership" element={<AdminMembershipPage />} />
            <Route path="support" element={<AdminSupportPage />} />
            <Route path="tickets" element={<AdminSupportPage />} />
            <Route path="stock" element={<AdminStockPage />} />
            <Route path="delivery" element={<AdminDeliveryPage />} />
            <Route path="queue" element={<AdminQueuePage />} />
            <Route path="sla" element={<SLAPage />} />
            <Route path="calendar" element={<AdminCalendarPage />} />
            <Route path="campaigns" element={<AdminCampaignsPage />} />
            <Route path="banners" element={<AdminBannersPage />} />
            <Route path="popups" element={<AdminPopupsPage />} />
            <Route path="landings" element={<AdminLandingsPage />} />
            <Route path="landings/:id/preview" element={<AdminLandingPreviewPage />} />
            <Route path="blog" element={<AdminBlogPage />} />
            <Route path="blog/:id/preview" element={<BlogDetailPage />} />
            <Route path="faq" element={<AdminFaqPage />} />
            <Route path="media" element={<AdminMediaLibraryPage />} />
            <Route path="seo" element={<AdminSeoPage />} />
            <Route path="roles" element={<RoleManagementPage />} />
            <Route path="security" element={<SecurityPage />} />
            <Route path="audit-logs" element={<AuditLogsPage />} />
            <Route path="system-logs" element={<SystemLogsPage />} />
            <Route path="feature-flags" element={<AdminFeatureFlagsPage />} />
            <Route path="system-config" element={<AdminSystemConfigPage />} />
            <Route path="integrations" element={<AdminIntegrationsHubPage />} />
            <Route path="integrations/midtrans" element={<AdminMidtransIntegrationPage />} />
            <Route path="integrations/ipaymu" element={<AdminIpaymuIntegrationPage />} />
            <Route path="integrations/apigames" element={<AdminApiGamesIntegrationPage />} />
            <Route path="integrations/tokovoucher" element={<AdminTokoVoucherIntegrationPage />} />
            <Route path="backup" element={<AdminBackupPage />} />
            <Route path="settings" element={<AdminSettingsPage />} />
            <Route path="branding" element={<AdminBrandingPage />} />
            <Route path="domain" element={<AdminDomainPage />} />
            <Route path="notification-settings" element={<AdminNotificationSettingsPage />} />
            <Route path="communication" element={<AdminCommunicationPage />} />
            <Route path="privacy" element={<AdminPrivacyPage />} />
            <Route path="regional" element={<AdminRegionalPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
