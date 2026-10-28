import { Request, Response, NextFunction } from 'express';
import { can } from './auth-service.js';
import { verifySupabaseAccessToken } from './supabase-auth-verifier.js';
import { supabaseAdmin } from './supabase-admin.js';


export interface AuthenticatedRequest extends Request {
  user?: any;
}

export const optionalAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const result = await verifySupabaseAccessToken(token);
    if (result.valid && result.identity) {
      req.user = result.identity;
      next();
    } else {
      req.user = null;
      next();
    }
  } catch (error) {
    req.user = null;
    next();
  }
};

export const requireAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Unauthorized. Token required.' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const result = await verifySupabaseAccessToken(token);
    if (result.valid && result.identity) {
      req.user = result.identity;
      next();
    } else {
      return res.status(401).json({ success: false, message: result.error || 'Invalid token' });
    }
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Authentication error' });
  }
};

/**
 * Fail-closed authorization decision for routes that require a staff/admin role.
 * The canonical profile column is role_id (not role). Custom roles are allowed
 * only when their role record is present and active.
 */
export function isAdminRoleAllowed(roleId: unknown, profileStatus: unknown, roleStatus: unknown): boolean {
  const normalizedRoleId = typeof roleId === 'string' ? roleId.trim().toLowerCase() : '';
  const normalizedProfileStatus = typeof profileStatus === 'string' ? profileStatus.trim().toLowerCase() : '';
  const normalizedRoleStatus = typeof roleStatus === 'string' ? roleStatus.trim().toLowerCase() : '';

  if (!normalizedRoleId || normalizedRoleId === 'customer') return false;
  if (normalizedProfileStatus && normalizedProfileStatus !== 'active') return false;
  return normalizedRoleStatus === 'active';
}

export const requireAdmin = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  await requireAuth(req, res, async () => {
    try {
      if (!supabaseAdmin) {
        return res.status(503).json({ success: false, message: 'Authorization service unavailable' });
      }

      // Read the canonical role_id and account status from the trusted server-side profile.
      const { data: userDoc, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('role_id,status')
        .eq('id', req.user.uid)
        .maybeSingle();

      if (profileError || !userDoc) {
        return res.status(403).json({ success: false, message: 'Forbidden: Admin access required' });
      }

      const roleId = typeof userDoc.role_id === 'string' ? userDoc.role_id.trim() : '';
      if (!roleId || roleId.toLowerCase() === 'customer') {
        return res.status(403).json({ success: false, message: 'Forbidden: Admin access required' });
      }

      const { data: roleDoc, error: roleError } = await supabaseAdmin
        .from('roles')
        .select('status')
        .eq('id', roleId)
        .maybeSingle();

      if (roleError || !roleDoc || !isAdminRoleAllowed(roleId, userDoc.status, roleDoc.status)) {
        return res.status(403).json({ success: false, message: 'Forbidden: Admin access required' });
      }

      return next();
    } catch (error) {
      console.error('[Auth Error] Admin authorization failed:', error);
      return res.status(503).json({ success: false, message: 'Authorization service unavailable' });
    }
  });
};

export const requirePermission = (resource: string, action: string, scope: string = "global") => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    await requireAuth(req, res, async () => {
      try {
        const userEmail = (req.user?.email || "").toLowerCase();
        console.log(`[Permission Check] User: ${userEmail}, UID: ${req.user.uid}, Resource: ${resource}, Action: ${action}`);
        const hasPermission = await can(req.user.uid, userEmail, resource, action, scope);
        if (hasPermission) {
          next();
        } else {
          res.status(403).json({ success: false, message: `Forbidden: Missing permission ${action} on ${resource}` });
        }
      } catch (error: any) {
        console.error("[Permission Error]", error);
        res.status(500).json({ 
          success: false, 
          message: 'Server error during permission check',
          details: error.message,
          code: error.code
        });
      }
    });
  };
};
