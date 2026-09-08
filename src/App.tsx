/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "./lib/firebase";
import { useAuthStore } from "./store/auth-store";

// Layouts
import MainLayout from "./layouts/MainLayout";
import AdminLayout from "./layouts/AdminLayout";

// Public Pages
import HomePage from "./pages/HomePage";
import GameDetailPage from "./pages/GameDetailPage";
import TransactionCheckPage from "./pages/TransactionCheckPage";
import TransactionHistoryPage from "./pages/TransactionHistoryPage";
import TransactionDetailPage from "./pages/TransactionDetailPage";
import MembershipStatusPage from "./pages/MembershipStatusPage";
import AccountPage from "./pages/AccountPage";

// Auth Pages
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";

// Admin Pages
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminGamesPage from "./pages/admin/AdminGamesPage";
import AdminCategoriesPage from "./pages/admin/AdminCategoriesPage";
import AdminProductsPage from "./pages/admin/AdminProductsPage";
import AdminPricingRulesPage from "./pages/admin/AdminPricingRulesPage";
import AdminProvidersPage from "./pages/admin/AdminProvidersPage";
import AdminProviderMappingPage from "./pages/admin/AdminProviderMappingPage";
import AdminPaymentGatewaysPage from "./pages/admin/AdminPaymentGatewaysPage";
import AdminStockPage from "./pages/admin/AdminStockPage";
import AdminDeliveryPage from "./pages/admin/AdminDeliveryPage";
import AdminQueuePage from "./pages/admin/AdminQueuePage";
import SLAPage from "./pages/admin/SLA";
import AdminSettingsPage from "./pages/admin/AdminSettingsPage";
import AdminBrandingPage from "./pages/admin/AdminBrandingPage";
import AdminDomainPage from "./pages/admin/AdminDomainPage";
import RoleManagementPage from "./pages/admin/RoleManagementPage";
import AdminPaymentsPage from "./pages/admin/AdminPaymentsPage";
import AdminRefundsPage from "./pages/admin/AdminRefundsPage";
import AdminSettlementPage from "./pages/admin/AdminSettlementPage";
import AdminOrdersPage from "./pages/admin/AdminOrdersPage";
import AdminMidtransIntegrationPage from "./pages/admin/AdminMidtransIntegrationPage";
import AdminIntegrationsHubPage from "./pages/admin/AdminIntegrationsHubPage";
import AdminApiGamesIntegrationPage from "./pages/admin/AdminApiGamesIntegrationPage";
import AdminTokoVoucherIntegrationPage from "./pages/admin/AdminTokoVoucherIntegrationPage";
import AdminPromosPage from "./pages/admin/AdminPromosPage";
import AdminFlashSalePage from "./pages/admin/AdminFlashSalePage";
import AdminLoyaltyPage from "./pages/admin/AdminLoyaltyPage";
import AdminRewardsPage from "./pages/admin/AdminRewardsPage";
import AdminReviewsPage from "./pages/admin/AdminReviewsPage";
import AdminMediaLibraryPage from "./pages/admin/AdminMediaLibraryPage";
import AdminBannersPage from "./pages/admin/AdminBannersPage";
import AdminPopupsPage from "./pages/admin/AdminPopupsPage";
import AdminCampaignsPage from "./pages/admin/AdminCampaignsPage";
import AdminLandingsPage from "./pages/admin/AdminLandingsPage";
import AdminLandingPreviewPage from "./pages/admin/AdminLandingPreviewPage";
import PublicLandingPage from "./pages/PublicLandingPage";
import AdminBlogPage from "./pages/admin/AdminBlogPage";
import BlogListPage from "./pages/BlogListPage";
import BlogDetailPage from "./pages/BlogDetailPage";
import AdminFaqPage from "./pages/admin/AdminFaqPage";
import NotificationPage from "./pages/NotificationPage";
import FaqPage from "./pages/FaqPage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import AdminSeoPage from "./pages/admin/AdminSeoPage";
import AdminCalendarPage from "./pages/admin/AdminCalendarPage";
import AdminNotificationPage from "./pages/admin/AdminNotificationPage";
import AdminNotificationSettingsPage from "./pages/admin/AdminNotificationSettingsPage";
import AdminCommunicationPage from "./pages/admin/AdminCommunicationPage";
import AdminPrivacyPage from "./pages/admin/AdminPrivacyPage";
import AdminRegionalPage from "./pages/admin/AdminRegionalPage";
import AdminHealthPage from "./pages/admin/AdminHealthPage";
import AdminIncidentPage from "./pages/admin/AdminIncidentPage";
import SecurityPage from "./pages/admin/SecurityPage";
import { AdminFeatureFlagsPage } from "./pages/admin/AdminFeatureFlagsPage";
import AuditLogsPage from "./pages/admin/AuditLogsPage";
import SystemLogsPage from "./pages/admin/SystemLogsPage";
import { AdminSystemConfigPage } from "./pages/admin/AdminSystemConfigPage";
import { AdminLedgerPage } from "./pages/admin/AdminLedgerPage";
import { AdminReconciliationPage } from "./pages/admin/AdminReconciliationPage";
import { AdminTaxesPage } from "./pages/admin/AdminTaxesPage";
import AdminCommissionPage from "./pages/admin/AdminCommissionPage";
import { AdminBackupPage } from "./pages/admin/AdminBackupPage";
import AdminUsersPage from "./pages/admin/AdminUsersPage";
import { AdminCustomerSegmentsPage } from "./pages/admin/AdminCustomerSegmentsPage";
import AdminReferralPage from "./pages/admin/AdminReferralPage";
import AdminMembershipPage from "./pages/admin/AdminMembershipPage";
import AdminSupportPage from "./pages/admin/AdminSupportPage";
import SupportPage from "./pages/SupportPage";

import AdminPlaceholderComponent from "./components/AdminPlaceholder";
import { ADMIN_NAVIGATION } from "./lib/admin-navigation";

const AdminPlaceholder = ({ title }: { title: string }) => {
  const currentPath = window.location.pathname;
  let itemMetadata: any = null;
  let groupTitle = "";

  for (const group of ADMIN_NAVIGATION) {
    const found = group.items.find(i => i.href === currentPath);
    if (found) {
      itemMetadata = found;
      groupTitle = group.title;
      break;
    }
  }

  return (
    <AdminPlaceholderComponent 
      title={title} 
      status={itemMetadata?.status || "IN_DEVELOPMENT"} 
      description={itemMetadata?.description}
      dependencies={itemMetadata?.dependencies}
      group={groupTitle}
    />
  );
};

import { ErrorBoundary } from "./components/ErrorBoundary";

export default function App() {
  console.log("App.tsx: Rendering App component");
  const { user, setUser, setLoading } = useAuthStore();

  useEffect(() => {
    // Detect Referral Code in URL
    const params = new URLSearchParams(window.location.search);
    const refCode = params.get("ref");
    if (refCode) {
      sessionStorage.setItem("pendingReferralCode", refCode);
    }
  }, []);

  useEffect(() => {
    // If logged in and has pending referral code, attribute it
    const attributeReferral = async () => {
      const pendingCode = sessionStorage.getItem("pendingReferralCode");
      if (user && pendingCode) {
        try {
          const token = await user.getIdToken();
          const res = await fetch("/api/referral/attribute", {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ referralCode: pendingCode, source: 'URL' })
          });
          const json = await res.json();
          if (json.success) {
            sessionStorage.removeItem("pendingReferralCode");
          }
        } catch (e) {
          console.error("Referral attribution failed", e);
        }
      }
    };
    attributeReferral();
  }, [user]);

  useEffect(() => {
    // Load Midtrans Snap script dynamically based on server configuration
    const loadMidtrans = async () => {
      try {
        const res = await fetch("/api/public/config/midtrans");
        
        const contentType = res.headers.get("content-type");
        if (!res.ok || !contentType || !contentType.includes("application/json")) {
          console.warn("Midtrans configuration endpoint returned non-JSON. This usually happens during server restart or initial deployment.");
          return;
        }

        const json = await res.json();
        
        if (json.success && json.data.configured) {
          const { clientKey, isProduction } = json.data;
          
          // Remove existing script if any
          const existingScript = document.querySelector('script[src*="midtrans.com/snap/snap.js"]');
          if (existingScript) existingScript.remove();

          const script = document.createElement("script");
          script.src = isProduction 
            ? "https://app.midtrans.com/snap/snap.js" 
            : "https://app.sandbox.midtrans.com/snap/snap.js";
          script.setAttribute("data-client-key", clientKey);
          document.head.appendChild(script);
          
          console.log(`[Midtrans] Snap script loaded in ${isProduction ? 'PRODUCTION' : 'SANDBOX'} mode.`);
        } else {
          // Fallback to build-time env vars if server config is not available or not configured
          const isProd = import.meta.env.VITE_MIDTRANS_IS_PRODUCTION === "true";
          const clientKey = import.meta.env.VITE_MIDTRANS_CLIENT_KEY || "";
          
          if (clientKey) {
            const script = document.createElement("script");
            script.src = isProd ? "https://app.midtrans.com/snap/snap.js" : "https://app.sandbox.midtrans.com/snap/snap.js";
            script.setAttribute("data-client-key", clientKey);
            document.head.appendChild(script);
            console.warn("[Midtrans] Fallback to build-time environment variables.");
          }
        }
      } catch (err) {
        console.error("[Midtrans] Failed to load runtime configuration:", err);
      }
    };

    loadMidtrans();
  }, []);

  useEffect(() => {
    if (!auth) {
      setUser(null, null);
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userEmail = (firebaseUser.email || "").toLowerCase().trim();
        const ownerEmail = (import.meta.env.VITE_OWNER_EMAIL || "chokerbayu@gmail.com").toLowerCase().trim();
        const isOwner = userEmail === ownerEmail;
        let role: 'customer' | 'admin' | 'pemilik' = isOwner ? "pemilik" : "customer";

        if (db) {
          try {
            const userDocRef = doc(db, "users", firebaseUser.uid);
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists()) {
              const existingRole = userDoc.data().role;
              if (isOwner) {
                role = "pemilik";
                if (existingRole !== "pemilik") {
                  await setDoc(userDocRef, { role: "pemilik" }, { merge: true });
                }
              } else if (existingRole) {
                role = existingRole;
              }
            } else {
              await setDoc(userDocRef, {
                uid: firebaseUser.uid,
                email: firebaseUser.email || userEmail,
                name: firebaseUser.displayName || userEmail.split("@")[0],
                role: role,
                createdAt: new Date().toISOString()
              }, { merge: true });
            }
          } catch (e) {
            console.warn("Notice: user role fetch on auth state change:", e);
          }
        }

        const userData = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || userEmail,
          displayName: firebaseUser.displayName || userEmail.split("@")[0],
          getIdToken: () => firebaseUser.getIdToken()
        };

        setUser(userData, role);

        try {
          const token = await firebaseUser.getIdToken();
          const permsRes = await fetch('/api/auth/permissions', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const permsData = await permsRes.json();
          if (permsData.success) {
            useAuthStore.getState().setPermissions(permsData.data);
          }
        } catch (e) {
          console.warn("Notice: permissions fetch failed", e);
        }

      } else {
        setUser(null, null);
        useAuthStore.getState().setPermissions([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [setUser, setLoading]);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
        {/* Auth Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Public Routes */}
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

        {/* Admin Routes */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboardPage />} />
          
          {/* UTAMA */}
          <Route path="notifications" element={<AdminNotificationPage />} />
          <Route path="health" element={<AdminHealthPage />} />
          <Route path="incidents" element={<AdminIncidentPage />} />
          
          {/* COMMERCE */}
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
          
          {/* FINANCE */}
          <Route path="payments" element={<AdminPaymentsPage />} />
          <Route path="refunds" element={<AdminRefundsPage />} />
          <Route path="taxes" element={<AdminTaxesPage />} />
          <Route path="reconciliation" element={<AdminReconciliationPage />} />
          <Route path="settlement" element={<AdminSettlementPage />} />
          <Route path="commission" element={<AdminCommissionPage />} />
          <Route path="ledger" element={<AdminLedgerPage />} />
          
          {/* CUSTOMER */}
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="customer-segments" element={<AdminCustomerSegmentsPage />} />
          <Route path="referral" element={<AdminReferralPage />} />
          <Route path="membership" element={<AdminMembershipPage />} />
          <Route path="support" element={<AdminSupportPage />} />
          <Route path="tickets" element={<AdminSupportPage />} />
          
          {/* OPERASIONAL */}
          <Route path="stock" element={<AdminStockPage />} />
          <Route path="delivery" element={<AdminDeliveryPage />} />
          <Route path="queue" element={<AdminQueuePage />} />
          <Route path="sla" element={<SLAPage />} />
          <Route path="calendar" element={<AdminCalendarPage />} />
          
          {/* MARKETING & CONTENT */}
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
          
          {/* SYSTEM */}
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
          
          {/* PENGATURAN */}
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
