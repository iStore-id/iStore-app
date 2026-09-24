import React, { useState, useEffect, useMemo, FormEvent } from "react";
import { useAuthStore } from "../../store/auth-store";
import {
  Shield,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  Check,
  X,
  Users,
  AlertCircle,
  Search,
  Lock,
  Unlock,
  CheckCircle2,
  Layers,
  HelpCircle,
  Sparkles,
  Info,
  Eye,
  KeyRound,
  RotateCcw,
  Sliders,
  Filter,
  UserCheck
} from "lucide-react";
import { Role, Permission } from "../../types/auth";

// System Resource definitions with groupings
export interface SystemResourceGroup {
  groupName: string;
  resources: {
    key: string;
    label: string;
    description: string;
    availableActions: string[];
  }[];
}

export const PERMISSION_ACTIONS = [
  { key: "view", label: "Lihat", desc: "Membaca & melihat data" },
  { key: "create", label: "Tambah", desc: "Membuat item baru" },
  { key: "edit", label: "Edit", desc: "Mengubah data" },
  { key: "delete", label: "Hapus", desc: "Menghapus item" },
  { key: "activate", label: "Aktif/Nonaktif", desc: "Mengubah status aktif" },
  { key: "publish", label: "Approve/Publish", desc: "Mempublikasikan" },
  { key: "export", label: "Export", desc: "Mengunduh/ekspor data" },
  { key: "full_access", label: "Full Access", desc: "Akses mutlak modul" },
];

export const SYSTEM_RESOURCE_GROUPS: SystemResourceGroup[] = [
  {
    groupName: "Katalog & Produk (Commerce)",
    resources: [
      { key: "games", label: "Katalog Game", description: "Kelola item game, banner game, dan kategori", availableActions: ["view", "create", "edit", "delete", "activate", "export", "full_access"] },
      { key: "products", label: "Produk & Varian", description: "Kelola item diamond/voucher, stok, dan status varian", availableActions: ["view", "create", "edit", "delete", "activate", "export", "full_access"] },
      { key: "pricing", label: "Pricing & Margin Engine", description: "Kelola aturan margin, mark-up harga, dan formula otomatis", availableActions: ["view", "create", "edit", "delete", "export", "full_access"] },
    ]
  },
  {
    groupName: "Transaksi & Finansial (Orders & Finance)",
    resources: [
      { key: "orders", label: "Pesanan & Fulfillment", description: "Pantau pesanan, retry fulfillment, dan status delivery", availableActions: ["view", "edit", "export", "full_access"] },
      { key: "payments", label: "Transaksi Pembayaran", description: "Verifikasi payment gateway, transaksi QRIS, e-wallet & VA", availableActions: ["view", "edit", "export", "full_access"] },
      { key: "settlement", label: "Settlement & Rekonsiliasi", description: "Audit MDR, batch settlement, adjustment, dan disbursement", availableActions: ["view", "edit", "publish", "export", "full_access"] },
      { key: "refunds", label: "Refund & Kompensasi", description: "Proses pengembalian dana dan kompensasi saldo pelanggan", availableActions: ["view", "create", "edit", "publish", "export", "full_access"] },
    ]
  },
  {
    groupName: "Pengguna & Akses (Users & Security)",
    resources: [
      { key: "users", label: "Manajemen Pengguna", description: "Kelola data pelanggan, saldo, dan status akun", availableActions: ["view", "edit", "activate", "export", "full_access"] },
      { key: "roles", label: "Roles & Permissions", description: "Kelola hak akses sistem, matrix permission, dan penugasan peran", availableActions: ["view", "create", "edit", "delete", "full_access"] },
    ]
  },
  {
    groupName: "Provider & Integrasi (Integrations)",
    resources: [
      { key: "providers", label: "Provider Gateway (TokoVoucher/ApiGames)", description: "Konfigurasi kredensial API provider, SKU mapping & health check", availableActions: ["view", "create", "edit", "activate", "full_access"] },
    ]
  },
  {
    groupName: "Pemasaran & Konten (Marketing & Content)",
    resources: [
      { key: "marketing", label: "Promosi & Flash Sale", description: "Atur kode kupon diskon, voucher promo, dan jadwal flash sale", availableActions: ["view", "create", "edit", "delete", "publish", "export", "full_access"] },
      { key: "content", label: "Landing Page & FAQ", description: "Kelola susunan komponen landing page dan tanya-jawab", availableActions: ["view", "create", "edit", "delete", "publish", "full_access"] },
      { key: "blog", label: "Artikel & Berita", description: "Tulis dan publikasikan artikel blog game dan tips", availableActions: ["view", "create", "edit", "delete", "publish", "full_access"] },
      { key: "seo", label: "SEO & Meta Tags", description: "Optimasi meta title, description, dan Open Graph", availableActions: ["view", "edit", "full_access"] },
    ]
  },
  {
    groupName: "Sistem & Operasional (System & Settings)",
    resources: [
      { key: "settings", label: "Pengaturan Toko & Regional", description: "Konfigurasi toko, timezone, format mata uang, kontak, dan privasi", availableActions: ["view", "edit", "full_access"] },
      { key: "notifications", label: "Notifikasi & Template", description: "Pengaturan notifikasi WhatsApp, Email, dan channel broadcast", availableActions: ["view", "edit", "publish", "full_access"] },
      { key: "calendar", label: "Business Calendar & Hari Libur", description: "Jadwal operasional, jam kerja, dan pengecualian hari libur", availableActions: ["view", "create", "edit", "delete", "full_access"] },
      { key: "sla", label: "SLA Policies & Penalti", description: "Pengaturan target durasi fulfillment dan mitigasi breach", availableActions: ["view", "create", "edit", "delete", "full_access"] },
      { key: "health", label: "System Health & Uptime", description: "Monitoring status backend, database latency, dan external APIs", availableActions: ["view", "edit", "full_access"] },
      { key: "incidents", label: "Incident & Maintenance", description: "Manajemen insiden gangguan teknis dan mode pemeliharaan", availableActions: ["view", "create", "edit", "publish", "full_access"] },
      { key: "audit", label: "Audit Logs", description: "Rekaman jejak aktivitas admin, mutasi data, dan keamanan", availableActions: ["view", "export", "full_access"] },
    ]
  }
];

export default function RoleManagementPage() {
  const { role: currentActorRole, user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<"roles" | "users">("roles");
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Search & Filters
  const [roleSearch, setRoleSearch] = useState("");
  const [roleTypeFilter, setRoleTypeFilter] = useState<"all" | "system" | "custom">("all");
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState<string>("all");

  // Modal State
  const [modalMode, setModalMode] = useState<"create" | "edit" | "view" | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [formData, setFormData] = useState<{
    id: string;
    name: string;
    description: string;
    status: "active" | "inactive";
    permissions: Permission[];
  }>({
    id: "",
    name: "",
    description: "",
    status: "active",
    permissions: []
  });

  // Delete confirmation
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await (user as any)?.getIdToken?.();
      const authHeaders = { "Authorization": token ? `Bearer ${token}` : "" };

      // 1. Fetch Roles
      const rolesRes = await fetch("/api/admin/roles", { headers: authHeaders });
      const rolesData = await rolesRes.json();
      if (rolesData.success) {
        setRoles(rolesData.data || []);
      } else {
        throw new Error(rolesData.message || "Gagal memuat daftar role");
      }

      // 2. Fetch Users
      const usersRes = await fetch("/api/admin/users", { headers: authHeaders });
      const usersData = await usersRes.json();
      if (usersData.success) {
        setUsers(usersData.data || []);
      } else {
        console.warn("Gagal memuat daftar user via API, fallback ke array kosong:", usersData.message);
        setUsers([]);
      }
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan saat mengambil data");
    } finally {
      setLoading(false);
    }
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setSelectedRole(null);
    setFormData({
      id: "",
      name: "",
      description: "",
      status: "active",
      permissions: []
    });
    setModalMode("create");
  };

  // Open Edit Modal
  const handleOpenEditModal = (roleItem: Role) => {
    setSelectedRole(roleItem);
    setFormData({
      id: roleItem.id || "",
      name: roleItem.name || "",
      description: roleItem.description || "",
      status: roleItem.status || "active",
      permissions: [...(roleItem.permissions || [])]
    });
    setModalMode("edit");
  };

  // Open View Matrix Modal
  const handleOpenViewModal = (roleItem: Role) => {
    setSelectedRole(roleItem);
    setFormData({
      id: roleItem.id || "",
      name: roleItem.name || "",
      description: roleItem.description || "",
      status: roleItem.status || "active",
      permissions: [...(roleItem.permissions || [])]
    });
    setModalMode("view");
  };

  // Toggle specific permission action for a resource in form
  const handleTogglePermission = (resourceKey: string, actionKey: string) => {
    if (modalMode === "view") return;

    setFormData(prev => {
      const existingPermIndex = prev.permissions.findIndex(
        p => p.resource === resourceKey && p.action === actionKey
      );

      let updatedPermissions: Permission[];
      if (existingPermIndex >= 0) {
        // Remove permission
        updatedPermissions = prev.permissions.filter((_, idx) => idx !== existingPermIndex);
      } else {
        // Add permission
        updatedPermissions = [...prev.permissions, { resource: resourceKey, action: actionKey, scope: "global" }];
      }

      return {
        ...prev,
        permissions: updatedPermissions
      };
    });
  };

  // Check if permission is enabled in form
  const isPermissionEnabled = (resourceKey: string, actionKey: string): boolean => {
    if (formData.id === "pemilik" || selectedRole?.id === "pemilik") return true;
    if (formData.permissions.some(p => p.resource === "*" && p.action === "full_access")) {
      return true;
    }
    if (formData.permissions.some(p => p.resource === resourceKey && p.action === "full_access")) {
      return true;
    }
    return formData.permissions.some(p => p.resource === resourceKey && p.action === actionKey);
  };

  // Presets
  const applyPreset = (preset: "full" | "readonly" | "support" | "content" | "clear") => {
    if (modalMode === "view") return;

    if (preset === "clear") {
      setFormData(prev => ({ ...prev, permissions: [] }));
      return;
    }

    if (preset === "full") {
      setFormData(prev => ({
        ...prev,
        permissions: [{ resource: "*", action: "full_access", scope: "global" }]
      }));
      return;
    }

    if (preset === "readonly") {
      const readOnlyPerms: Permission[] = [];
      SYSTEM_RESOURCE_GROUPS.forEach(g => {
        g.resources.forEach(r => {
          readOnlyPerms.push({ resource: r.key, action: "view", scope: "global" });
        });
      });
      setFormData(prev => ({ ...prev, permissions: readOnlyPerms }));
      return;
    }

    if (preset === "support") {
      setFormData(prev => ({
        ...prev,
        permissions: [
          { resource: "orders", action: "view" },
          { resource: "orders", action: "edit" },
          { resource: "payments", action: "view" },
          { resource: "refunds", action: "view" },
          { resource: "refunds", action: "create" },
          { resource: "users", action: "view" },
          { resource: "products", action: "view" },
          { resource: "games", action: "view" },
        ]
      }));
      return;
    }

    if (preset === "content") {
      setFormData(prev => ({
        ...prev,
        permissions: [
          { resource: "marketing", action: "view" },
          { resource: "marketing", action: "create" },
          { resource: "marketing", action: "edit" },
          { resource: "content", action: "view" },
          { resource: "content", action: "create" },
          { resource: "content", action: "edit" },
          { resource: "blog", action: "view" },
          { resource: "blog", action: "create" },
          { resource: "blog", action: "edit" },
          { resource: "seo", action: "view" },
          { resource: "seo", action: "edit" },
        ]
      }));
      return;
    }
  };

  // Submit Save/Create Role
  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert("Nama Role wajib diisi");
      return;
    }

    setActionLoading(true);
    setError(null);

    try {
      const token = await (user as any)?.getIdToken?.();
      const authHeaders = {
        "Content-Type": "application/json",
        "Authorization": token ? `Bearer ${token}` : ""
      };

      if (modalMode === "create") {
        const res = await fetch("/api/admin/roles", {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            name: formData.name.trim(),
            description: formData.description.trim(),
            status: formData.status,
            permissions: formData.permissions
          })
        });
        const data = await res.json();
        if (data.success) {
          showSuccess(`Role "${formData.name}" berhasil dibuat`);
          setModalMode(null);
          await fetchData();
        } else {
          throw new Error(data.message || "Gagal membuat role");
        }
      } else if (modalMode === "edit" && selectedRole) {
        const res = await fetch(`/api/admin/roles/${selectedRole.id}`, {
          method: "PUT",
          headers: authHeaders,
          body: JSON.stringify({
            name: formData.name.trim(),
            description: formData.description.trim(),
            status: formData.status,
            permissions: formData.permissions
          })
        });
        const data = await res.json();
        if (data.success) {
          showSuccess(`Role "${formData.name}" berhasil diperbarui`);
          setModalMode(null);
          await fetchData();
        } else {
          throw new Error(data.message || "Gagal memperbarui role");
        }
      }
    } catch (err: any) {
      setError(err.message || "Gagal menyimpan role");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Delete Role
  const handleConfirmDeleteRole = async () => {
    if (!roleToDelete) return;
    setActionLoading(true);
    setError(null);

    try {
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch(`/api/admin/roles/${roleToDelete.id}`, {
        method: "DELETE",
        headers: { "Authorization": token ? `Bearer ${token}` : "" }
      });
      const data = await res.json();
      if (data.success) {
        showSuccess(`Role "${roleToDelete.name}" berhasil dihapus`);
        setRoleToDelete(null);
        await fetchData();
      } else {
        throw new Error(data.message || "Gagal menghapus role");
      }
    } catch (err: any) {
      setError(err.message || "Gagal menghapus role");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle User Role Change
  const handleUserRoleChange = async (targetUid: string, targetEmail: string, newRoleId: string) => {
    if (targetEmail === "chokerbayu@gmail.com") {
      alert("Role Owner dilindungi sistem dan tidak dapat diubah!");
      return;
    }

    setActionLoading(true);
    setError(null);

    try {
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch(`/api/admin/users/${targetUid}/role`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({ roleId: newRoleId })
      });
      const data = await res.json();
      if (data.success) {
        showSuccess(`Role pengguna ${targetEmail} berhasil diperbarui menjadi ${newRoleId}`);
        // Update local user state
        setUsers(prev => prev.map(u => u.uid === targetUid ? { ...u, role: newRoleId } : u));
      } else {
        throw new Error(data.message || "Gagal memperbarui role pengguna");
      }
    } catch (err: any) {
      setError(err.message || "Gagal mengubah role pengguna");
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered Roles
  const filteredRoles = useMemo(() => {
    return roles.filter(r => {
      const matchSearch = (r.name || "").toLowerCase().includes(roleSearch.toLowerCase()) ||
        (r.id || "").toLowerCase().includes(roleSearch.toLowerCase()) ||
        (r.description || "").toLowerCase().includes(roleSearch.toLowerCase());
      
      const matchType = roleTypeFilter === "all" ||
        (roleTypeFilter === "system" && r.isSystemRole) ||
        (roleTypeFilter === "custom" && !r.isSystemRole);

      return matchSearch && matchType;
    });
  }, [roles, roleSearch, roleTypeFilter]);

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchSearch = (u.name || "").toLowerCase().includes(userSearch.toLowerCase()) ||
        (u.email || "").toLowerCase().includes(userSearch.toLowerCase()) ||
        (u.uid || "").toLowerCase().includes(userSearch.toLowerCase());

      const matchRole = userRoleFilter === "all" || u.role === userRoleFilter;

      return matchSearch && matchRole;
    });
  }, [users, userSearch, userRoleFilter]);

  if (currentActorRole !== "pemilik") {
    return (
      <div className="bg-white p-8 rounded-2xl border border-red-200 shadow-sm flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-4">
          <Shield className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Akses Terbatas: Owner Only</h2>
        <p className="text-slate-500 text-center max-w-md">
          Pengelolaan Role & Matrix Permissions merupakan otoritas tertinggi sistem yang hanya dapat diakses langsung oleh Pemilik Sistem (Owner).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="ui-page-title text-slate-900">Roles & Permissions Engine</h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Shield className="w-3.5 h-3.5" />
                  RBAC Active
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Kelola hak akses sistem, matrix permission berjenjang (8 level), dan penugasan peran staf/pelanggan.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              disabled={loading || actionLoading}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors flex items-center gap-1.5"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh Data
            </button>
            <button
              onClick={handleOpenCreateModal}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-xs flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Tambah Role Baru
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-100 mt-6 -mb-2 gap-6">
          <button
            onClick={() => setActiveTab("roles")}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 transition-colors relative ${
              activeTab === "roles"
                ? "text-indigo-600 border-b-2 border-indigo-600"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Shield className="w-4 h-4" />
            Daftar Peran & Hak Akses
            <span className="ml-1 px-2 py-0.5 text-xs bg-slate-100 text-slate-700 rounded-full">
              {roles.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 transition-colors relative ${
              activeTab === "users"
                ? "text-indigo-600 border-b-2 border-indigo-600"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Users className="w-4 h-4" />
            Penugasan Pengguna (User Assignment)
            <span className="ml-1 px-2 py-0.5 text-xs bg-slate-100 text-slate-700 rounded-full">
              {users.length}
            </span>
          </button>
        </div>
      </div>

      {/* Global Notification Alerts */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-sm flex items-center gap-2.5 shadow-xs animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl text-sm flex items-center gap-2.5 shadow-xs">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">Terjadi Kesalahan</p>
            <p className="text-xs text-red-700 mt-0.5">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TAB 1: ROLES MANAGEMENT */}
      {activeTab === "roles" && (
        <div className="space-y-4">
          {/* Controls / Filter Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={roleSearch}
                onChange={e => setRoleSearch(e.target.value)}
                placeholder="Cari role ID, nama, atau deskripsi..."
                className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-medium text-slate-500">Tipe:</span>
              <select
                value={roleTypeFilter}
                onChange={e => setRoleTypeFilter(e.target.value as any)}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">Semua Tipe Role</option>
                <option value="system">System Role (Built-in)</option>
                <option value="custom">Custom Role</option>
              </select>
            </div>
          </div>

          {/* Roles Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            {loading ? (
              <div className="p-12 flex flex-col items-center justify-center text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
                <p className="text-sm font-medium">Memuat data role...</p>
              </div>
            ) : filteredRoles.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Shield className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="text-sm font-semibold text-slate-600">Tidak ada role yang sesuai filter</p>
                <p className="text-xs text-slate-400 mt-1">Coba sesuaikan kata kunci pencarian atau buat role baru.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/75 border-b border-slate-100 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      <th className="py-3.5 px-5">Role ID & Nama</th>
                      <th className="py-3.5 px-4">Deskripsi</th>
                      <th className="py-3.5 px-4">Tipe Peran</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">Jumlah Akses</th>
                      <th className="py-3.5 px-4">Pengguna Terdaftar</th>
                      <th className="py-3.5 px-5 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                    {filteredRoles.map(r => {
                      const userCount = users.filter(u => u.role === r.id).length;
                      const isOwnerRole = r.id === "pemilik";
                      const isCustomerRole = r.id === "customer";

                      return (
                        <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-4 px-5">
                            <div className="flex items-center gap-2.5">
                              <div className={`p-2 rounded-lg ${
                                isOwnerRole
                                  ? "bg-amber-100 text-amber-700"
                                  : r.isSystemRole
                                  ? "bg-indigo-100 text-indigo-700"
                                  : "bg-blue-50 text-blue-700"
                              }`}>
                                {isOwnerRole ? <Lock className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                              </div>
                              <div>
                                <span className="font-bold text-slate-900 block">{r.name}</span>
                                <code className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded font-mono">
                                  {r.id}
                                </code>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4 max-w-xs truncate text-slate-500">
                            {r.description || "-"}
                          </td>
                          <td className="py-4 px-4">
                            {r.isSystemRole ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                <Lock className="w-3 h-3 text-slate-400" />
                                System
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                <Sliders className="w-3 h-3 text-blue-500" />
                                Custom
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                              r.status === "active"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-rose-50 text-rose-700 border border-rose-200"
                            }`}>
                              {r.status === "active" ? "Aktif" : "Nonaktif"}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            {isOwnerRole ? (
                              <span className="font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-flex items-center gap-1">
                                <Sparkles className="w-3 h-3" /> Full Access (*)
                              </span>
                            ) : (
                              <span className="font-medium text-slate-700">
                                {r.permissions?.length || 0} hak akses
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-4">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 font-medium text-slate-700">
                              <UserCheck className="w-3 h-3 text-slate-500" />
                              {userCount} user
                            </span>
                          </td>
                          <td className="py-4 px-5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* View Permissions Matrix */}
                              <button
                                onClick={() => handleOpenViewModal(r)}
                                title="Lihat Matrix Permission"
                                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              {/* Edit Role (Custom or Admin) */}
                              {!isOwnerRole && !isCustomerRole && (
                                <button
                                  onClick={() => handleOpenEditModal(r)}
                                  title="Edit Role & Permissions"
                                  className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                              )}

                              {/* Delete Role (Custom only) */}
                              {!r.isSystemRole && (
                                <button
                                  onClick={() => setRoleToDelete(r)}
                                  title="Hapus Role"
                                  className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: USER ASSIGNMENT */}
      {activeTab === "users" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                placeholder="Cari nama, email, atau UID pengguna..."
                className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-medium text-slate-500">Filter Role:</span>
              <select
                value={userRoleFilter}
                onChange={e => setUserRoleFilter(e.target.value)}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">Semua Role</option>
                {roles.map(r => (
                  <option key={r.id} value={r.id}>{r.name} ({r.id})</option>
                ))}
              </select>
            </div>
          </div>

          {/* User Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            {loading ? (
              <div className="p-12 flex flex-col items-center justify-center text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
                <p className="text-sm font-medium">Memuat data pengguna...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="text-sm font-semibold text-slate-600">Tidak ada pengguna yang cocok</p>
                <p className="text-xs text-slate-400 mt-1">Coba sesuaikan kata kunci pencarian.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/75 border-b border-slate-100 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      <th className="py-3.5 px-5">Pengguna</th>
                      <th className="py-3.5 px-4">Email</th>
                      <th className="py-3.5 px-4">UID</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-5">Role Saat Ini</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                    {filteredUsers.map(u => {
                      const isOwnerUser = u.email === "chokerbayu@gmail.com" || u.role === "pemilik";

                      return (
                        <tr key={u.uid} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-4 px-5 font-semibold text-slate-900">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold">
                                {(u.name || u.email || "U")[0].toUpperCase()}
                              </div>
                              <span>{u.name || "Pengguna iStore"}</span>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-slate-600">
                            {u.email}
                          </td>
                          <td className="py-4 px-4 font-mono text-[10px] text-slate-400">
                            {u.uid}
                          </td>
                          <td className="py-4 px-4">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700">
                              {u.status || "active"}
                            </span>
                          </td>
                          <td className="py-4 px-5">
                            {isOwnerUser ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold">
                                <Lock className="w-3.5 h-3.5 text-amber-600" />
                                Owner (Sistem Terkunci)
                              </span>
                            ) : (
                              <div className="flex items-center gap-2">
                                <select
                                  value={u.role || "customer"}
                                  disabled={actionLoading}
                                  onChange={e => handleUserRoleChange(u.uid, u.email, e.target.value)}
                                  className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                                >
                                  {roles.map(r => (
                                    <option key={r.id} value={r.id} disabled={r.status === "inactive"}>
                                      {r.name} {r.status === "inactive" ? "(Nonaktif)" : ""}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE / EDIT / VIEW PERMISSION MATRIX MODAL */}
      {modalMode && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col my-auto overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {modalMode === "create" && "Buat Custom Role Baru"}
                    {modalMode === "edit" && `Edit Role: ${formData.name}`}
                    {modalMode === "view" && `Detail Matrix Permission: ${formData.name}`}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {modalMode === "view"
                      ? "Lihat konfigurasi hak akses granular pada setiap modul sistem"
                      : "Tentukan nama role dan aktifkan izin aksi spesifik per modul"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalMode(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveRole} className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Role General Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200/80">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Role <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={modalMode === "view" || selectedRole?.isSystemRole}
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Contoh: Staf Keuangan, Support Toko"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Status Role
                  </label>
                  <select
                    disabled={modalMode === "view" || selectedRole?.isSystemRole}
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
                  >
                    <option value="active">Aktif (Dapat Ditugaskan)</option>
                    <option value="inactive">Nonaktif (Akses Ditangguhkan)</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Deskripsi Peran
                  </label>
                  <input
                    type="text"
                    disabled={modalMode === "view" || selectedRole?.isSystemRole}
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Deskripsi tugas atau ruang lingkup wewenang role ini..."
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
                  />
                </div>
              </div>

              {/* Matrix Presets (Edit/Create only) */}
              {modalMode !== "view" && (
                <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 text-xs">
                  <div className="flex items-center gap-1.5 text-indigo-900 font-semibold">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <span>Template Preset:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => applyPreset("readonly")}
                      className="px-2.5 py-1 bg-white border border-indigo-200 rounded-lg text-indigo-700 font-medium hover:bg-indigo-50 transition-colors shadow-2xs"
                    >
                      Hanya Lihat (Read-Only)
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset("support")}
                      className="px-2.5 py-1 bg-white border border-indigo-200 rounded-lg text-indigo-700 font-medium hover:bg-indigo-50 transition-colors shadow-2xs"
                    >
                      Customer Support
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset("content")}
                      className="px-2.5 py-1 bg-white border border-indigo-200 rounded-lg text-indigo-700 font-medium hover:bg-indigo-50 transition-colors shadow-2xs"
                    >
                      Content & Marketing
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset("full")}
                      className="px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 font-medium hover:bg-amber-100 transition-colors shadow-2xs"
                    >
                      Akses Penuh (*)
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset("clear")}
                      className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-600 font-medium hover:bg-slate-50 transition-colors shadow-2xs"
                    >
                      Bersihkan Semua
                    </button>
                  </div>
                </div>
              )}

              {/* Granular Permission Matrix Table */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Matrix Hak Akses Granular (Resource × Action Level)
                  </h3>
                  <span className="text-xs text-slate-500 font-medium">
                    {formData.permissions.some(p => p.action === "full_access" && p.resource === "*")
                      ? "Akses Penuh Semua Modul (*)"
                      : `${formData.permissions.length} izin aktif`}
                  </span>
                </div>

                {SYSTEM_RESOURCE_GROUPS.map(group => (
                  <div key={group.groupName} className="rounded-xl border border-slate-200/80 overflow-hidden shadow-2xs">
                    <div className="bg-slate-100/75 px-4 py-2.5 border-b border-slate-200 font-bold text-xs text-slate-800 flex items-center justify-between">
                      <span>{group.groupName}</span>
                    </div>

                    <div className="divide-y divide-slate-100">
                      {group.resources.map(res => {
                        const hasFullModAccess = isPermissionEnabled(res.key, "full_access");

                        return (
                          <div key={res.key} className="p-4 hover:bg-slate-50/50 transition-colors">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
                              <div>
                                <span className="font-bold text-xs text-slate-900">{res.label}</span>
                                <code className="ml-2 text-[10px] font-mono text-slate-400 bg-slate-100 px-1 rounded">
                                  {res.key}
                                </code>
                                <p className="text-[11px] text-slate-500 mt-0.5">{res.description}</p>
                              </div>

                              {modalMode !== "view" && (
                                <button
                                  type="button"
                                  onClick={() => handleTogglePermission(res.key, "full_access")}
                                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-colors ${
                                    hasFullModAccess
                                      ? "bg-amber-100 text-amber-800 border-amber-300"
                                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                  }`}
                                >
                                  {hasFullModAccess ? "✓ Full Modul Aktif" : "Set Full Modul"}
                                </button>
                              )}
                            </div>

                            {/* Action Checkboxes */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                              {PERMISSION_ACTIONS.map(act => {
                                const isSupported = res.availableActions.includes(act.key);
                                const isChecked = isPermissionEnabled(res.key, act.key);

                                if (!isSupported) {
                                  return (
                                    <div
                                      key={act.key}
                                      className="p-2 rounded-lg border border-dashed border-slate-200 bg-slate-50/50 text-[11px] text-slate-300 text-center flex flex-col justify-center items-center select-none"
                                    >
                                      <span>{act.label}</span>
                                      <span className="text-[9px] text-slate-300">N/A</span>
                                    </div>
                                  );
                                }

                                return (
                                  <button
                                    key={act.key}
                                    type="button"
                                    disabled={modalMode === "view" || hasFullModAccess}
                                    onClick={() => handleTogglePermission(res.key, act.key)}
                                    className={`p-2 rounded-lg border text-[11px] font-medium text-center flex flex-col justify-center items-center transition-all ${
                                      isChecked
                                        ? "bg-indigo-50 border-indigo-300 text-indigo-700 shadow-2xs font-bold"
                                        : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                                    } ${hasFullModAccess ? "opacity-75 cursor-not-allowed bg-amber-50/60 border-amber-200 text-amber-800" : ""}`}
                                  >
                                    <div className="flex items-center gap-1 mb-0.5">
                                      <div className={`w-3.5 h-3.5 rounded flex items-center justify-center ${
                                        isChecked ? "bg-indigo-600 text-white" : "border border-slate-300"
                                      }`}>
                                        {isChecked && <Check className="w-2.5 h-2.5" />}
                                      </div>
                                      <span>{act.label}</span>
                                    </div>
                                    <span className="text-[9px] text-slate-400 font-mono">
                                      {act.key}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  {modalMode === "view" ? "Tutup" : "Batal"}
                </button>
                {modalMode !== "view" && (
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {modalMode === "create" ? "Buat Role Sekarang" : "Simpan Perubahan Role"}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE ROLE CONFIRMATION MODAL */}
      {roleToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <div className="p-3 bg-red-100 rounded-full">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Hapus Custom Role?</h3>
                <p className="text-xs text-slate-500">Tindakan ini tidak dapat dibatalkan</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-6 leading-relaxed">
              Apakah Anda yakin ingin menghapus role <strong>{roleToDelete.name}</strong> (<code>{roleToDelete.id}</code>)?
              Penghapusan akan ditolak jika masih ada pengguna yang ditugaskan pada role ini.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setRoleToDelete(null)}
                disabled={actionLoading}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteRole}
                disabled={actionLoading}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-50"
              >
                {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Ya, Hapus Role
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
