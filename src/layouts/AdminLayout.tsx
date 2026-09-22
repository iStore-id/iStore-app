import { Outlet, Link, useNavigate, Navigate, useLocation } from "react-router-dom";
import { supabaseSignOut } from "../lib/supabase-auth";
import { useAuthStore } from "../store/auth-store";
import { 
  LogOut, 
  Menu, 
  X, 
  ChevronDown, 
  ChevronRight,
  User,
  ExternalLink,
  Bell,
  Lock
} from "lucide-react";
import { useState, useEffect } from "react";
import { ADMIN_NAVIGATION } from "../lib/admin-navigation";
import { NavGroup, NavItem } from "../types/admin-nav";
import { motion, AnimatePresence } from "motion/react";

interface NavLinkProps {
  key?: string;
  item: NavItem;
  pathname: string;
  search?: string;
  can: (resource: string, action: string) => boolean;
}

const NavLink = ({ item, pathname, search = '', can }: NavLinkProps) => {
  const currentFull = pathname + search;
  const isExactQuery = item.href.includes('?');
  const isActive = isExactQuery
    ? currentFull === item.href
    : (pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href) && !search.includes('tab=')));
  
  // Rule: Expose ACTIVE and IN_DEVELOPMENT
  if (item.status !== 'ACTIVE' && item.status !== 'IN_DEVELOPMENT') {
    return null;
  }

  const isAuthorized = !item.resource || can(item.resource, item.action || 'view');

  if (!isAuthorized) {
    return (
      <div 
        className="flex items-center justify-between px-3 py-2 rounded-lg text-slate-600 bg-slate-900/10 cursor-not-allowed select-none border border-transparent"
        title="Anda tidak memiliki izin untuk mengakses modul ini"
      >
        <div className="flex items-center gap-3 min-w-0">
          <item.icon className="w-4.5 h-4.5 shrink-0 text-slate-700" />
          <span className="text-sm font-medium text-slate-500 truncate">{item.title}</span>
        </div>
        <Lock className="w-3.5 h-3.5 text-slate-700 shrink-0" />
      </div>
    );
  }

  return (
    <Link 
      to={item.href} 
      className={`flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-200 group ${
        isActive 
          ? 'bg-brand-600 text-white shadow-md shadow-brand-900/20' 
          : 'text-slate-400 hover:text-white hover:bg-slate-800'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <item.icon className={`w-4.5 h-4.5 shrink-0 ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`} />
        <span className="text-sm font-medium truncate">{item.title}</span>
        {item.status === 'IN_DEVELOPMENT' && (
          <span className="text-[8px] px-1 py-0.5 bg-brand-950/40 text-brand-400 border border-brand-900 rounded font-bold uppercase tracking-wider scale-95 shrink-0">Dev</span>
        )}
      </div>
    </Link>
  );
};

interface NavSectionProps {
  key?: string;
  group: NavGroup;
  pathname: string;
  search?: string;
  can: (resource: string, action: string) => boolean;
  expandedGroups: string[];
  toggleGroup: (title: string) => void;
}

const NavSection = ({ group, pathname, search = '', can, expandedGroups, toggleGroup }: NavSectionProps) => {
  const isExpanded = expandedGroups.includes(group.title);
  
  // Check if any item in group is visible (authorized or locked, ACTIVE or IN_DEVELOPMENT)
  const visibleItems = group.items.filter(item => 
    item.status === 'ACTIVE' || item.status === 'IN_DEVELOPMENT'
  );

  if (visibleItems.length === 0) return null;

  return (
    <div className="mb-2">
      <button 
        onClick={() => toggleGroup(group.title)}
        className="flex items-center justify-between w-full px-3 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider hover:text-slate-300 transition-colors"
      >
        {group.title}
        {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </button>
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden space-y-1 mt-1"
          >
            {group.items.map((item) => (
              <NavLink key={`${item.href}-${item.title}`} item={item} pathname={pathname} search={search} can={can} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function AdminLayout() {
  const { user, role, loading, setUser, can } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([
    "UTAMA", "COMMERCE", "FINANCE", "CUSTOMER", "OPERASIONAL", "MARKETING & CONTENT", "SYSTEM", "PENGATURAN"
  ]);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  console.log("AdminLayout: role", role, "loading", loading);
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-brand-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-medium">Memuat Panel Admin...</p>
      </div>
    );
  }

  // Only users who aren't basic customers can access admin area
  if (role === 'customer' || !role) {
    return <Navigate to="/" replace />;
  }

  const handleLogout = async () => {
    try {
      await supabaseSignOut();
    } catch (e) {
      console.error("Sign out error:", e);
    }
    sessionStorage.removeItem('istore_session');
    setUser(null, null);
    navigate("/login");
  };

  const toggleGroup = (title: string) => {
    setExpandedGroups(prev => 
      prev.includes(title) 
        ? prev.filter(t => t !== title) 
        : [...prev, title]
    );
  };

  return (
    <div className="min-h-screen flex bg-slate-50 overflow-hidden font-sans">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 flex flex-col transform transition-transform duration-300 ease-in-out border-r border-slate-800 shadow-2xl lg:shadow-none ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="h-16 flex items-center justify-between px-6 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center font-bold text-white text-lg shadow-inner">i</div>
            <span className="font-bold text-lg text-white tracking-tight">iStore Panel</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden p-1 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <nav className="flex-1 py-6 space-y-1 px-3 overflow-y-auto custom-scrollbar">
          {ADMIN_NAVIGATION.map((group) => (
            <NavSection 
              key={group.title} 
              group={group} 
              pathname={location.pathname}
              search={location.search}
              can={can}
              expandedGroups={expandedGroups}
              toggleGroup={toggleGroup}
            />
          ))}
        </nav>

        <div className="p-4 bg-slate-950/50 border-t border-slate-800">
          <Link 
            to="/account" 
            className="flex items-center gap-3 mb-4 px-2 py-1.5 rounded-xl hover:bg-slate-800/80 transition-all group"
            title="Pengaturan Akun & Kata Sandi"
          >
            <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-brand-400 border border-slate-700 group-hover:border-brand-500 transition-colors">
              <User className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate group-hover:text-brand-400 transition-colors">{user?.displayName || "Admin"}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">{role === 'pemilik' ? 'Owner' : 'Admin'}</p>
            </div>
          </Link>
          <button 
            onClick={handleLogout} 
            className="flex items-center gap-3 w-full px-3 py-2.5 text-sm font-medium text-slate-400 hover:text-white hover:bg-red-600/10 hover:text-red-500 rounded-xl transition-all duration-200"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            Keluar Panel
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 lg:px-8 shrink-0 shadow-sm z-30">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-brand-600 hover:bg-brand-50 rounded-xl transition-all"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="hidden sm:flex items-center gap-2 text-slate-400">
              <span className="text-xs font-medium uppercase tracking-widest">Admin</span>
              <span className="text-slate-300">/</span>
              <span className="text-sm font-semibold text-slate-800 capitalize">
                {location.pathname === '/admin' ? 'Dashboard' : location.pathname.split('/').pop()?.replace(/-/g, ' ')}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link 
              to="/account" 
              className="p-2 text-slate-500 hover:text-brand-600 hover:bg-brand-50 rounded-xl transition-all"
              title="Akun & Keamanan"
            >
              <User className="w-5 h-5" />
            </Link>
            <button className="p-2 text-slate-500 hover:text-brand-600 hover:bg-brand-50 rounded-xl transition-all relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 border-2 border-white rounded-full"></span>
            </button>
            <div className="w-px h-6 bg-slate-200 mx-1 sm:mx-2 hidden sm:block"></div>
            <Link 
              to="/" 
              className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-brand-600 hover:bg-brand-50 rounded-xl transition-all group"
            >
              <span className="hidden sm:inline">Lihat Toko</span>
              <ExternalLink className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </Link>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6 lg:p-10 bg-slate-50/50 min-w-0">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </div>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1e293b;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #334155;
        }
      `}} />
    </div>
  );
}

