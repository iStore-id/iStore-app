import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase, isSupabaseConfigured } from "./lib/supabase";
import { useAuthStore } from "./store/auth-store";
import { ErrorBoundary } from "./components/ErrorBoundary";

// Layouts
import MainLayout from "./layouts/MainLayout";
import AdminLayout from "./layouts/AdminLayout";

// Pages
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
import NotificationPage from "./pages/NotificationPage";
import MembershipStatusPage from "./pages/MembershipStatusPage";
import SupportPage from "./pages/SupportPage";
import AccountPage from "./pages/AccountPage";

// Admin Pages
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminProductsPage from "./pages/admin/AdminProductsPage";
import AdminGamesPage from "./pages/admin/AdminGamesPage";
import AdminCategoriesPage from "./pages/admin/AdminCategoriesPage";
import AdminPricingRulesPage from "./pages/admin/AdminPricingRulesPage";
import AdminProvidersPage from "./pages/admin/AdminProvidersPage";
import AdminProviderMappingPage from "./pages/admin/AdminProviderMappingPage";
import AdminPaymentGatewaysPage from "./pages/admin/AdminPaymentGatewaysPage";
import AdminOrdersPage from "./pages/admin/AdminOrdersPage";
import AdminPromosPage from "./pages/admin/AdminPromosPage";
import AdminFlashSalePage from "./pages/admin/AdminFlashSalePage";
import AdminLoyaltyPage from "./pages/admin/AdminLoyaltyPage";
import AdminRewardsPage from "./pages/admin/AdminRewardsPage";
import AdminReviewsPage from "./pages/admin/AdminReviewsPage";
import AdminPaymentsPage from "./pages/admin/AdminPaymentsPage";
import AdminRefundsPage from "./pages/admin/AdminRefundsPage";
import { AdminTaxesPage } from "./pages/admin/AdminTaxesPage";
import { AdminReconciliationPage } from "./pages/admin/AdminReconciliationPage";
import AdminSettlementPage from "./pages/admin/AdminSettlementPage";
import AdminCommissionPage from "./pages/admin/AdminCommissionPage";
import { AdminLedgerPage } from "./pages/admin/AdminLedgerPage";
import AdminUsersPage from "./pages/admin/AdminUsersPage";
import { AdminCustomerSegmentsPage } from "./pages/admin/AdminCustomerSegmentsPage";
import AdminReferralPage from "./pages/admin/AdminReferralPage";
import AdminMembershipPage from "./pages/admin/AdminMembershipPage";
import AdminSupportPage from "./pages/admin/AdminSupportPage";
import AdminStockPage from "./pages/admin/AdminStockPage";
import AdminDeliveryPage from "./pages/admin/AdminDeliveryPage";
import AdminQueuePage from "./pages/admin/AdminQueuePage";
import SLAPage from "./pages/admin/SLA";
import AdminCalendarPage from "./pages/admin/AdminCalendarPage";
import AdminCampaignsPage from "./pages/admin/AdminCampaignsPage";
import AdminBannersPage from "./pages/admin/AdminBannersPage";
import AdminPopupsPage from "./pages/admin/AdminPopupsPage";
import AdminLandingsPage from "./pages/admin/AdminLandingsPage";
import AdminLandingPreviewPage from "./pages/admin/AdminLandingPreviewPage";
import AdminBlogPage from "./pages/admin/AdminBlogPage";
import AdminFaqPage from "./pages/admin/AdminFaqPage";
import AdminMediaLibraryPage from "./pages/admin/AdminMediaLibraryPage";
import AdminSeoPage from "./pages/admin/AdminSeoPage";
import RoleManagementPage from "./pages/admin/RoleManagementPage";
import SecurityPage from "./pages/admin/SecurityPage";
import AuditLogsPage from "./pages/admin/AuditLogsPage";
import SystemLogsPage from "./pages/admin/SystemLogsPage";
import { AdminFeatureFlagsPage } from "./pages/admin/AdminFeatureFlagsPage";
import { AdminSystemConfigPage } from "./pages/admin/AdminSystemConfigPage";
import AdminIntegrationsHubPage from "./pages/admin/AdminIntegrationsHubPage";
import AdminMidtransIntegrationPage from "./pages/admin/AdminMidtransIntegrationPage";
import AdminApiGamesIntegrationPage from "./pages/admin/AdminApiGamesIntegrationPage";
import AdminTokoVoucherIntegrationPage from "./pages/admin/AdminTokoVoucherIntegrationPage";
import { AdminBackupPage } from "./pages/admin/AdminBackupPage";
import AdminSettingsPage from "./pages/admin/AdminSettingsPage";
import AdminBrandingPage from "./pages/admin/AdminBrandingPage";
import AdminDomainPage from "./pages/admin/AdminDomainPage";
import AdminNotificationSettingsPage from "./pages/admin/AdminNotificationSettingsPage";
import AdminCommunicationPage from "./pages/admin/AdminCommunicationPage";
import AdminPrivacyPage from "./pages/admin/AdminPrivacyPage";
import AdminRegionalPage from "./pages/admin/AdminRegionalPage";
import AdminNotificationPage from "./pages/admin/AdminNotificationPage";
import AdminHealthPage from "./pages/admin/AdminHealthPage";
import AdminIncidentPage from "./pages/admin/AdminIncidentPage";

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
          const permsRes = await fetch('/api/auth/permissions', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const permsData = await permsRes.json();
          if (permsData.success) {
            useAuthStore.getState().setPermissions(permsData.data);
            const profileRes = await fetch(`/api/customer/profile/${sbUser.id}`, {
               headers: { 'Authorization': `Bearer ${token}` }
            });
            const profileData = await profileRes.json();
            if (profileData.success) {
              role = profileData.data.role || "customer";
            }
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
            <Route path="/notifications" element={<NotificationPage />} />
            <Route path="/membership" element={<MembershipStatusPage />} />
            <Route path="/support" element={<SupportPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/profile" element={<AccountPage />} />
          </Route>
          <Route path="/admin" element={<AdminLayout />}>
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
