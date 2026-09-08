import { create } from 'zustand';

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  getIdToken?: () => Promise<string>;
}

export interface AppPermission {
  resource: string;
  action: string;
  scope?: string;
}

interface AuthState {
  user: AppUser | null;
  role: string | null;
  permissions: AppPermission[];
  loading: boolean;
  setUser: (user: AppUser | null, role?: string | null) => void;
  setPermissions: (permissions: AppPermission[]) => void;
  setLoading: (loading: boolean) => void;
  can: (resource: string, action: string) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  role: null,
  permissions: [],
  loading: true,
  setUser: (user, role = 'customer') => set({ user, role }),
  setPermissions: (permissions) => set({ permissions }),
  setLoading: (loading) => set({ loading }),
  can: (resource, action) => {
    const { permissions, role } = get();
    if (role === 'pemilik') return true;
    
    const safePermissions = Array.isArray(permissions) ? permissions : [];
    
    // Check for full access
    const hasFullAccess = safePermissions.some(p => p.action === 'full_access' && (p.resource === resource || p.resource === '*'));
    if (hasFullAccess) return true;
    
    return safePermissions.some(p => p.resource === resource && p.action === action);
  }
}));
