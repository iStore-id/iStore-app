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

export const requireAdmin = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  await requireAuth(req, res, async () => {
    try {
      // Check role strictly from trusted server-side DB profile source (fail closed)
      const { data: userDoc, error } = await supabaseAdmin!.from('profiles').select('role').eq('id', req.user.uid).maybeSingle();
      if (error || !userDoc) {
        return res.status(403).json({ success: false, message: 'Forbidden: Admin access required' });
      }
      const role = userDoc?.role;
      
      if (role && role !== 'customer') {
        return next();
      } else {
        return res.status(403).json({ success: false, message: 'Forbidden: Admin access required' });
      }
    } catch (error) {
      console.error("[Auth Error]", error);
      return res.status(500).json({ success: false, message: 'Server error during authorization' });
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
