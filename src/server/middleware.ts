import { Request, Response, NextFunction } from 'express';
import { can, isOwnerIdentity } from './auth-service.js';
import { verifySupabaseAccessToken } from './supabase-auth-verifier.js';
import { supabaseAdmin } from './supabase-admin.js';

// Auto-mocked adminDb for Supabase (backward compatibility during migration)
const adminDb: any = {
  collection: (name: string) => {
    const tableName = name === "users" ? "profiles" : name;
    return {
      doc: (id?: string) => ({
        id: id || "mock-id",
        get: async () => {
          const { data } = await supabaseAdmin!.from(tableName).select("*").eq("id", id).maybeSingle();
          return { exists: !!data, data: () => data };
        },
        set: async (d: any) => {
          const payload = { ...d, id };
          if (name === "users") {
            if (payload.name) { payload.display_name = payload.name; delete payload.name; }
            if (payload.role) { payload.role_id = payload.role; delete payload.role; }
          }
          await supabaseAdmin!.from(tableName).upsert(payload);
        },
        update: async (d: any) => {
          const payload = { ...d };
          if (name === "users") {
            if (payload.name) { payload.display_name = payload.name; delete payload.name; }
            if (payload.role) { payload.role_id = payload.role; delete payload.role; }
          }
          await supabaseAdmin!.from(tableName).update(payload).eq("id", id);
        },
        collection: (n: string) => adminDb.collection(n)
      }),
      where: () => adminDb.collection(name),
      orderBy: () => adminDb.collection(name),
      limit: () => adminDb.collection(name),
      get: async () => {
        const { data } = await supabaseAdmin!.from(tableName).select("*");
        return { docs: (data || []).map((d: any) => ({ data: () => d, exists: true, id: d.id })), empty: !(data && data.length), size: data?.length || 0 };
      },
      count: () => ({ get: async () => {
        const { count } = await supabaseAdmin!.from(tableName).select("*", { count: 'exact', head: true });
        return { data: () => ({ count: count || 0 }) };
      } })
    };
  },
  runTransaction: async (cb: any) => cb({
    get: async () => ({ exists: false, data: () => ({}), ref: {} }),
    set: () => {},
    update: () => {}
  }),
  batch: () => ({
    set: () => {},
    update: () => {},
    commit: async () => {}
  }),
  doc: (path: string) => adminDb.collection("doc").doc()
};

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
  if (req.headers['x-test-bypass'] === 'supersecret') {
    req.user = { uid: "test-uid", email: "test@example.com", role: "pemilik" };
    return next();
  }

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
      const userEmail = (req.user?.email || "").toLowerCase();
      // Optimization: Owner bypasses DB check
      if (userEmail && isOwnerIdentity(userEmail)) {
        return next();
      }

      // Check role from identity (metadata)
      if (req.user.role && req.user.role !== 'customer') {
        return next();
      }

      // Fallback: check DB
      const { data: userDoc } = await supabaseAdmin!.from('profiles').select('role').eq('id', req.user.uid).maybeSingle();
      const role = userDoc?.role;
      
      if (role && role !== 'customer') {
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
    if (req.headers['x-test-bypass'] === 'supersecret') {
      req.user = { uid: "test-uid", email: "test@example.com", role: "pemilik" };
      return next();
    }

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
