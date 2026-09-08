import { Request, Response, NextFunction } from 'express';
import { adminAuth, adminDb } from './firebase-admin';
import { can, isOwnerIdentity } from './auth-service';

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
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    // If token is explicitly provided but invalid, reject
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

export const requireAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  await optionalAuth(req, res, () => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized. Token required.' });
    }
    next();
  });
};

export const requireAdmin = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  await requireAuth(req, res, async () => {
    try {
      const userEmail = (req.user?.email || "").toLowerCase();
      // Optimization: Owner bypasses DB check
      if (userEmail && isOwnerIdentity(userEmail)) {
        return next();
      }

      // Basic check for admin/pemilik role or custom role
      const userDoc = await adminDb.collection('users').doc(req.user.uid).get();
      const role = userDoc.exists ? userDoc.data()?.role : null;
      if (userDoc.exists && role && role !== 'customer') {
        next();
      } else {
        res.status(403).json({ success: false, message: 'Forbidden: Admin access required' });
      }
    } catch (error) {
      console.error("[Auth Error]", error);
      res.status(500).json({ success: false, message: 'Server error during authorization' });
    }
  });
};

export const requirePermission = (resource: string, action: string, scope: string = "global") => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    await requireAuth(req, res, async () => {
      try {
        const userEmail = (req.user?.email || "").toLowerCase();
        console.log(`[Permission Check] User: ${userEmail}, UID: ${req.user.uid}, Resource: ${resource}, Action: ${action}`);
        const hasPermission = await can(req.user.uid, resource, action, scope, userEmail);
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
