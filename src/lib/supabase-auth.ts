/**
 * Supabase Auth Service Preparation (STEP 4.3)
 * 
 * Provides an architectural adapter for Supabase Authentication capabilities:
 * - Email/Password Sign-In
 * - Email/Password Sign-Up
 * - Google OAuth Sign-In (using current origin as default redirectTo)
 * - Password Reset
 * - Password Update (authenticated)
 * - Sign Out
 * - Session & User Retrieval
 * - Auth State Change Subscription
 * 
 * NOTE: This module is prepared for subsequent migration phases.
 * It DOES NOT replace the currently active Firebase Auth flow in STEP 4.3.
 */

import { supabase, isSupabaseConfigured } from "./supabase";
import type { 
  Session, 
  User, 
  AuthResponse, 
  OAuthResponse, 
  UserResponse,
  Subscription 
} from "@supabase/supabase-js";

export interface SupabaseAuthResult<T = any> {
  data: T | null;
  error: Error | null;
}

/**
 * Sign in user with email and password using Supabase Auth.
 */
export async function supabaseSignInWithPassword(
  email: string, 
  password: string
): Promise<AuthResponse> {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Supabase is not configured. VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be provided.");
  }
  return await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
}

/**
 * Register a new user with email, password, and optional metadata.
 */
export async function supabaseSignUpWithPassword(
  email: string, 
  password: string,
  options?: {
    displayName?: string;
    phone?: string;
    metadata?: Record<string, any>;
    emailRedirectTo?: string;
  }
): Promise<AuthResponse> {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Supabase is not configured. VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be provided.");
  }

  const normalizedEmail = email.trim().toLowerCase();
  const userMetadata: Record<string, any> = {
    display_name: options?.displayName || normalizedEmail.split("@")[0],
    full_name: options?.displayName || normalizedEmail.split("@")[0],
    ...(options?.metadata || {}),
  };

  if (options?.phone) {
    userMetadata.phone = options.phone;
  }

  return await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      data: userMetadata,
      emailRedirectTo: options?.emailRedirectTo,
    },
  });
}

/**
 * Initiate Google OAuth sign-in with Supabase.
 * Redirects to the provider OAuth consent screen.
 */
export async function supabaseSignInWithGoogle(
  redirectTo?: string
): Promise<OAuthResponse> {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Supabase is not configured. VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be provided.");
  }

  const callbackUrl = redirectTo || (typeof window !== "undefined" ? `${window.location.origin}/login` : "https://ist.web.id/login");

  return await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callbackUrl,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });
}

/**
 * Send password reset email via Supabase Auth.
 */
export async function supabaseResetPasswordForEmail(
  email: string,
  redirectTo?: string
): Promise<{ data: {}; error: Error | null }> {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Supabase is not configured. VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be provided.");
  }

  const resetRedirect = redirectTo || (typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined);

  const res = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: resetRedirect,
  });

  return {
    data: res.data ?? {},
    error: res.error as Error | null,
  };
}

/**
 * Update password for the currently authenticated user.
 */
export async function supabaseUpdatePassword(
  newPassword: string
): Promise<UserResponse> {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Supabase is not configured. VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be provided.");
  }

  return await supabase.auth.updateUser({
    password: newPassword,
  });
}

/**
 * Sign out from Supabase Auth session.
 */
export async function supabaseSignOut(): Promise<{ error: Error | null }> {
  if (!supabase || !isSupabaseConfigured) {
    return { error: null };
  }

  const res = await supabase.auth.signOut();
  return { error: res.error as Error | null };
}

/**
 * Get the current active session from Supabase client.
 */
export async function supabaseGetSession(): Promise<{ session: Session | null; error: Error | null }> {
  if (!supabase || !isSupabaseConfigured) {
    return { session: null, error: null };
  }

  const res = await supabase.auth.getSession();
  return {
    session: res.data.session,
    error: res.error as Error | null,
  };
}

/**
 * Get current authenticated user from Supabase.
 */
export async function supabaseGetUser(): Promise<{ user: User | null; error: Error | null }> {
  if (!supabase || !isSupabaseConfigured) {
    return { user: null, error: null };
  }

  const res = await supabase.auth.getUser();
  return {
    user: res.data.user,
    error: res.error as Error | null,
  };
}

/**
 * Helper to retrieve an access token suitable for passing to backend APIs.
 * Mirroring the AppUser.getIdToken interface.
 */
export async function supabaseGetAccessToken(): Promise<string | null> {
  if (!supabase || !isSupabaseConfigured) {
    return null;
  }

  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}

/**
 * Subscribe to Supabase auth state changes.
 */
export function supabaseOnAuthStateChange(
  callback: (event: string, session: Session | null) => void
): { unsubscribe: () => void } {
  if (!supabase || !isSupabaseConfigured) {
    return {
      unsubscribe: () => {},
    };
  }

  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });

  return {
    unsubscribe: () => {
      data.subscription.unsubscribe();
    },
  };
}
