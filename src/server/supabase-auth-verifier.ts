/**
 * Server-side Supabase Token Verification Module (STEP 4.4 PREPARATION)
 *
 * Dedicated to verifying Supabase Auth JWT access tokens cryptographically
 * using the official Supabase Auth Admin SDK (`supabaseAdmin.auth.getUser(token)`).
 *
 * IMPORTANT:
 * - This module is prepared for subsequent migration phases.
 * - It DOES NOT replace the currently active Firebase Auth middleware in STEP 4.4.
 * - It DOES NOT trust user data from request body, query params, or client headers.
 * - It never exposes SUPABASE_SERVICE_ROLE_KEY to the browser.
 */

import { supabaseAdmin, isSupabaseAdminConfigured } from './supabase-admin.js';
import type { User } from '@supabase/supabase-js';

export interface VerifiedSupabaseIdentity {
  uid: string;
  email: string;
  role?: string;
  user: User;
  source: 'supabase';
}

export interface SupabaseTokenVerificationResult {
  valid: boolean;
  identity: VerifiedSupabaseIdentity | null;
  error?: string;
}

/**
 * Verifies a Supabase access token server-side via Supabase Auth Admin API.
 * Uses `supabaseAdmin.auth.getUser(jwt)` to guarantee that the token was
 * legitimately signed by the Supabase project, is unexpired, and not revoked.
 *
 * @param token - Bearer JWT string supplied by the client in Authorization header
 */
export async function verifySupabaseAccessToken(
  token: string
): Promise<SupabaseTokenVerificationResult> {
  if (!token || typeof token !== 'string') {
    return {
      valid: false,
      identity: null,
      error: 'Token string is required',
    };
  }

  if (!supabaseAdmin || !isSupabaseAdminConfigured) {
    return {
      valid: false,
      identity: null,
      error: 'Supabase Admin is not configured in server environment (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing)',
    };
  }

  try {
    const cleanToken = token.startsWith('Bearer ') ? token.slice(7).trim() : token.trim();
    if (!cleanToken) {
      return {
        valid: false,
        identity: null,
        error: 'Empty token string provided',
      };
    }

    // Cryptographic token validation against Supabase Auth service
    const { data, error } = await supabaseAdmin.auth.getUser(cleanToken);

    if (error || !data.user) {
      return {
        valid: false,
        identity: null,
        error: error?.message || 'Invalid or expired Supabase token',
      };
    }

    const user = data.user;
    const email = (user.email || '').toLowerCase().trim();

    const identity: VerifiedSupabaseIdentity = {
      uid: user.id,
      email,
      role: (user.user_metadata?.role as string) || (user.app_metadata?.role as string) || 'customer',
      user,
      source: 'supabase',
    };

    return {
      valid: true,
      identity,
    };
  } catch (err: any) {
    return {
      valid: false,
      identity: null,
      error: err?.message || 'Server error verifying Supabase token',
    };
  }
}
