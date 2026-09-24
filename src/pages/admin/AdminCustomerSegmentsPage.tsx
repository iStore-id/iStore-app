import React, { useState, useEffect, useMemo, useCallback } from "react";
import { 
  Users, 
  Plus, 
  RefreshCw, 
  Search, 
  Filter, 
  Play, 
  Download, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Layers, 
  UserCheck, 
  UserX, 
  AlertTriangle, 
  ChevronRight, 
  Eye, 
  FileText, 
  Tag, 
  DollarSign, 
  Award, 
  Activity, 
  X,
  History
} from "lucide-react";
import { useAuthStore } from "../../store/auth-store";
import { 
  CustomerSegment, 
  CustomerSegmentsResponse, 
  SegmentMemberView, 
  SegmentRule, 
  SegmentRuleGroup, 
  SEGMENT_FIELD_CATALOG, 
  RuleCategory,
  SegmentType,
  SegmentStatus
} from "../../types/customer-segment";

export const AdminCustomerSegmentsPage: React.FC = () => {
  const { user } = useAuthStore();
  const [data, setData] = useState<CustomerSegmentsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<SegmentType | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<SegmentStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);

  // Modals & Drawers
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingSegment, setEditingSegment] = useState<CustomerSegment | null>(null);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [selectedSegment, setSelectedSegment] = useState<CustomerSegment | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "rules" | "members" | "evaluation" | "audit">("overview");

  // Members Tab State
  const [members, setMembers] = useState<SegmentMemberView[]>([]);
  const [membersTotal, setMembersTotal] = useState(0);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersSearch, setMembersSearch] = useState("");
  const [membersPage, setMembersPage] = useState(1);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userSearchResults, setUserSearchResults] = useState<any[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);

  // Evaluation & Action States
  const [evaluatingId, setEvaluatingId] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [actionErrorMsg, setActionErrorMsg] = useState<string | null>(null);

  // Segment Form State
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    type: SegmentType;
    ruleGroup: SegmentRuleGroup;
  }>({
    name: "",
    description: "",
    type: "DYNAMIC",
    ruleGroup: {
      combinator: "AND",
      rules: [
        {
          id: "rule_1",
          category: "COMMERCE",
          field: "commerce.totalSpentIdr",
          operator: "greater_than_or_equal",
          value: 1000000
        }
      ]
    }
  });

  const fetchSegments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await user?.getIdToken();
      const params = new URLSearchParams({
        search: searchTerm,
        type: typeFilter,
        status: statusFilter,
        page: page.toString(),
        limit: "20"
      });

      const res = await fetch(`/api/admin/customer-segments?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      setData(json);
    } catch (err: any) {
      setError(err.message || "Gagal memuat data segmen pelanggan.");
    } finally {
      setLoading(false);
    }
  }, [user, searchTerm, typeFilter, statusFilter, page]);

  useEffect(() => {
    if (user) {
      fetchSegments();
    }
  }, [user, fetchSegments]);

  // Fetch Segment Detail for Drawer
  const fetchSegmentDetail = async (id: string) => {
    try {
      const token = await user?.getIdToken();
      const res = await fetch(`/api/admin/customer-segments/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) {
        setSelectedSegment(json.data);
      }
    } catch (err) {
      console.error("Error fetching segment detail", err);
    }
  };

  useEffect(() => {
    if (selectedSegmentId) {
      fetchSegmentDetail(selectedSegmentId);
      if (activeTab === "members") {
        fetchSegmentMembers(selectedSegmentId);
      }
    } else {
      setSelectedSegment(null);
    }
  }, [selectedSegmentId, activeTab]);

  // Fetch Members
  const fetchSegmentMembers = async (segmentId: string) => {
    setMembersLoading(true);
    try {
      const token = await user?.getIdToken();
      const params = new URLSearchParams({
        search: membersSearch,
        page: membersPage.toString(),
        limit: "15"
      });

      const res = await fetch(`/api/admin/customer-segments/${segmentId}/members?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) {
        setMembers(json.items || []);
        setMembersTotal(json.total || 0);
      }
    } catch (err) {
      console.error("Error fetching members", err);
    } finally {
      setMembersLoading(false);
    }
  };

  useEffect(() => {
    if (selectedSegmentId && activeTab === "members") {
      fetchSegmentMembers(selectedSegmentId);
    }
  }, [membersSearch, membersPage]);

  // Search users to add as static members
  const searchAvailableUsers = async (query: string) => {
    if (!query.trim()) {
      setUserSearchResults([]);
      return;
    }
    setSearchingUsers(true);
    try {
      const token = await user?.getIdToken();
      const res = await fetch(`/api/admin/customers?search=${encodeURIComponent(query)}&limit=10`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) {
        setUserSearchResults(json.items || []);
      }
    } catch (err) {
      console.error("Search users error", err);
    } finally {
      setSearchingUsers(false);
    }
  };

  // Actions
  const handleEvaluate = async (id: string) => {
    setEvaluatingId(id);
    setActionErrorMsg(null);
    try {
      const token = await user?.getIdToken();
      const res = await fetch(`/api/admin/customer-segments/${id}/evaluate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);

      setActionSuccessMsg(json.message);
      fetchSegments();
      if (selectedSegmentId === id) {
        fetchSegmentDetail(id);
        fetchSegmentMembers(id);
      }
    } catch (err: any) {
      setActionErrorMsg(err.message || "Gagal mengevaluasi segmen.");
    } finally {
      setEvaluatingId(null);
    }
  };

  const handleToggleStatus = async (segment: CustomerSegment) => {
    setActionErrorMsg(null);
    try {
      const token = await user?.getIdToken();
      const endpoint = segment.status === "ACTIVE" ? "deactivate" : "activate";
      const res = await fetch(`/api/admin/customer-segments/${segment.id}/${endpoint}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);

      setActionSuccessMsg(json.message);
      fetchSegments();
      if (selectedSegmentId === segment.id) {
        fetchSegmentDetail(segment.id);
      }
    } catch (err: any) {
      setActionErrorMsg(err.message || "Gagal mengubah status segmen.");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus segmen '${name}'? Tindakan ini akan menghapus semua riwayat keanggotaan segmen ini.`)) {
      return;
    }
    setActionErrorMsg(null);
    try {
      const token = await user?.getIdToken();
      const res = await fetch(`/api/admin/customer-segments/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);

      setActionSuccessMsg(json.message);
      if (selectedSegmentId === id) {
        setSelectedSegmentId(null);
      }
      fetchSegments();
    } catch (err: any) {
      setActionErrorMsg(err.message || "Gagal menghapus segmen.");
    }
  };

  const handleExportCsv = async (id: string) => {
    try {
      const token = await user?.getIdToken();
      const res = await fetch(`/api/admin/customer-segments/${id}/export`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Gagal mengunduh CSV");
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `customer_segment_${id}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setActionErrorMsg(err.message || "Gagal mengekspor CSV.");
    }
  };

  const handleAddMember = async (customerUid: string) => {
    if (!selectedSegmentId) return;
    try {
      const token = await user?.getIdToken();
      const res = await fetch(`/api/admin/customer-segments/${selectedSegmentId}/members`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ customerUid })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);

      setActionSuccessMsg("Anggota berhasil ditambahkan.");
      setIsAddMemberModalOpen(false);
      setUserSearchQuery("");
      setUserSearchResults([]);
      fetchSegmentMembers(selectedSegmentId);
      fetchSegmentDetail(selectedSegmentId);
      fetchSegments();
    } catch (err: any) {
      setActionErrorMsg(err.message || "Gagal menambahkan anggota.");
    }
  };

  const handleRemoveMember = async (customerUid: string) => {
    if (!selectedSegmentId) return;
    if (!confirm("Keluarkan pelanggan ini dari segmen?")) return;
    try {
      const token = await user?.getIdToken();
      const res = await fetch(`/api/admin/customer-segments/${selectedSegmentId}/members/${customerUid}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);

      setActionSuccessMsg(json.message);
      fetchSegmentMembers(selectedSegmentId);
      fetchSegmentDetail(selectedSegmentId);
      fetchSegments();
    } catch (err: any) {
      setActionErrorMsg(err.message || "Gagal mengeluarkan anggota.");
    }
  };

  // Rule Form Helpers
  const addRuleToGroup = () => {
    setFormData(prev => ({
      ...prev,
      ruleGroup: {
        ...prev.ruleGroup,
        rules: [
          ...prev.ruleGroup.rules,
          {
            id: `rule_${Date.now()}`,
            category: "COMMERCE",
            field: "commerce.totalSpentIdr",
            operator: "greater_than_or_equal",
            value: 500000
          }
        ]
      }
    }));
  };

  const removeRuleFromGroup = (index: number) => {
    setFormData(prev => ({
      ...prev,
      ruleGroup: {
        ...prev.ruleGroup,
        rules: prev.ruleGroup.rules.filter((_, i) => i !== index)
      }
    }));
  };

  const updateRuleField = (index: number, fieldKey: string) => {
    const fieldDef = SEGMENT_FIELD_CATALOG[fieldKey];
    if (!fieldDef) return;

    let defaultValue: any = "";
    if (fieldDef.valueType === "number") defaultValue = 0;
    else if (fieldDef.valueType === "boolean") defaultValue = true;
    else if (fieldDef.valueType === "enum" && fieldDef.enumValues?.length) defaultValue = fieldDef.enumValues[0].value;
    else if (fieldDef.valueType === "date") defaultValue = new Date().toISOString().split("T")[0];

    setFormData(prev => {
      const newRules = [...prev.ruleGroup.rules];
      const existing = newRules[index] as SegmentRule;
      newRules[index] = {
        ...existing,
        category: fieldDef.category,
        field: fieldKey,
        operator: fieldDef.allowedOperators[0],
        value: defaultValue
      };
      return {
        ...prev,
        ruleGroup: {
          ...prev.ruleGroup,
          rules: newRules
        }
      };
    });
  };

  const updateRuleOperator = (index: number, operator: any) => {
    setFormData(prev => {
      const newRules = [...prev.ruleGroup.rules];
      const existing = newRules[index] as SegmentRule;
      newRules[index] = {
        ...existing,
        operator
      };
      return {
        ...prev,
        ruleGroup: {
          ...prev.ruleGroup,
          rules: newRules
        }
      };
    });
  };

  const updateRuleValue = (index: number, value: any) => {
    setFormData(prev => {
      const newRules = [...prev.ruleGroup.rules];
      const existing = newRules[index] as SegmentRule;
      newRules[index] = {
        ...existing,
        value
      };
      return {
        ...prev,
        ruleGroup: {
          ...prev.ruleGroup,
          rules: newRules
        }
      };
    });
  };

  const handleSaveSegment = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionErrorMsg(null);
    try {
      const token = await user?.getIdToken();

      if (editingSegment) {
        // Update
        const res = await fetch(`/api/admin/customer-segments/${editingSegment.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            name: formData.name,
            description: formData.description,
            ruleGroup: formData.type === "DYNAMIC" ? formData.ruleGroup : undefined
          })
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.message);
        setActionSuccessMsg(json.message);
      } else {
        // Create
        const res = await fetch(`/api/admin/customer-segments`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(formData)
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.message);
        setActionSuccessMsg(json.message);
      }

      setIsCreateModalOpen(false);
      setEditingSegment(null);
      fetchSegments();
    } catch (err: any) {
      setActionErrorMsg(err.message || "Gagal menyimpan segmen.");
    }
  };

  const openEditModal = (segment: CustomerSegment) => {
    setEditingSegment(segment);
    setFormData({
      name: segment.name,
      description: segment.description || "",
      type: segment.type,
      ruleGroup: segment.ruleGroup || {
        combinator: "AND",
        rules: [
          {
            id: "rule_1",
            category: "COMMERCE",
            field: "commerce.totalSpentIdr",
            operator: "greater_than_or_equal",
            value: 1000000
          }
        ]
      }
    });
    setIsCreateModalOpen(true);
  };

  const openCreateModal = () => {
    setEditingSegment(null);
    setFormData({
      name: "",
      description: "",
      type: "DYNAMIC",
      ruleGroup: {
        combinator: "AND",
        rules: [
          {
            id: "rule_1",
            category: "COMMERCE",
            field: "commerce.totalSpentIdr",
            operator: "greater_than_or_equal",
            value: 1000000
          }
        ]
      }
    });
    setIsCreateModalOpen(true);
  };

  // Group catalog by category
  const catalogByCategory = useMemo(() => {
    const map: Record<RuleCategory, typeof SEGMENT_FIELD_CATALOG[string][]> = {
      CUSTOMER: [],
      COMMERCE: [],
      LOYALTY: [],
      TAGGING: []
    };
    Object.values(SEGMENT_FIELD_CATALOG).forEach(def => {
      if (map[def.category]) {
        map[def.category].push(def);
      }
    });
    return map;
  }, []);

  return (
    <div className="space-y-6 pb-12">
      {/* Toast notifications */}
      {actionSuccessMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-lg flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span className="text-sm font-medium">{actionSuccessMsg}</span>
          </div>
          <button onClick={() => setActionSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {actionErrorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-lg flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
            <span className="text-sm font-medium">{actionErrorMsg}</span>
          </div>
          <button onClick={() => setActionErrorMsg(null)} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-50 border border-indigo-100 rounded-lg">
              <Users className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="ui-page-title text-slate-900">Customer Segments Engine</h1>
              <p className="text-sm text-slate-500">
                Segmentasi target audiens berbasis aturan dinamis dan kurasi statis (Phase C2).
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => fetchSegments()}
            disabled={loading}
            className="inline-flex items-center px-3.5 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 shadow-sm transition-colors"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Buat Segmen Baru
          </button>
        </div>
      </div>

      {/* KPI Metrics Cards */}
      {data?.metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Segmen</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{data.metrics.totalSegments}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Segmen Aktif</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">{data.metrics.activeCount}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Segmen Inaktif</p>
            <p className="text-2xl font-bold text-slate-600 mt-1">{data.metrics.inactiveCount}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Tipe Dinamis</p>
            <p className="text-2xl font-bold text-indigo-700 mt-1">{data.metrics.dynamicCount}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Tipe Statis</p>
            <p className="text-2xl font-bold text-amber-700 mt-1">{data.metrics.staticCount}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-sky-600 uppercase tracking-wider">Total Anggota</p>
            <p className="text-2xl font-bold text-sky-700 mt-1">{data.metrics.totalActiveMemberships}</p>
          </div>
        </div>
      )}

      {/* Filters Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Cari berdasarkan nama segmen atau deskripsi..."
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div className="sm:col-span-3">
            <select
              value={typeFilter}
              onChange={e => { setTypeFilter(e.target.value as any); setPage(1); }}
              className="w-full py-2 px-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
            >
              <option value="ALL">Semua Tipe Segmen</option>
              <option value="DYNAMIC">Hanya Dinamis (Dynamic)</option>
              <option value="STATIC">Hanya Statis (Static)</option>
            </select>
          </div>

          <div className="sm:col-span-3">
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value as any); setPage(1); }}
              className="w-full py-2 px-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
            >
              <option value="ALL">Semua Status</option>
              <option value="ACTIVE">Aktif (ACTIVE)</option>
              <option value="INACTIVE">Nonaktif (INACTIVE)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Segments Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center">
            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-500">Memuat data segmen pelanggan...</p>
          </div>
        ) : error ? (
          <div className="py-16 text-center text-rose-600">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        ) : !data?.items.length ? (
          <div className="py-16 text-center text-slate-500">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-base font-medium text-slate-700">Belum ada segmen pelanggan</p>
            <p className="text-sm text-slate-500 mt-1">Buat segmen baru untuk menargetkan pelanggan di kampanye pemasaran atau promosi.</p>
            <button
              onClick={openCreateModal}
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Buat Segmen Sekarang
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Nama Segmen</th>
                  <th className="py-3.5 px-4">Tipe</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-center">Anggota</th>
                  <th className="py-3.5 px-4">Evaluasi Terakhir</th>
                  <th className="py-3.5 px-4">Status Evaluasi</th>
                  <th className="py-3.5 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map(segment => (
                  <tr key={segment.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-4">
                      <div className="font-semibold text-slate-900">{segment.name}</div>
                      {segment.description && (
                        <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{segment.description}</p>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      {segment.type === "DYNAMIC" ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                          <Layers className="w-3 h-3 mr-1" />
                          DYNAMIC
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                          <Tag className="w-3 h-3 mr-1" />
                          STATIC
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      {segment.status === "ACTIVE" ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          ACTIVE
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          <XCircle className="w-3 h-3 mr-1" />
                          INACTIVE
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-center font-semibold text-slate-900">
                      {segment.memberCount.toLocaleString("id-ID")}
                    </td>
                    <td className="py-4 px-4 text-xs text-slate-500">
                      {segment.lastEvaluatedAt ? (
                        <div className="flex items-center space-x-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{new Date(segment.lastEvaluatedAt).toLocaleString("id-ID")}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Belum pernah</span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      {segment.type === "DYNAMIC" ? (
                        segment.evaluationStatus === "RUNNING" || evaluatingId === segment.id ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-sky-50 text-sky-700 border border-sky-200 animate-pulse">
                            <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                            Evaluating...
                          </span>
                        ) : segment.evaluationStatus === "FAILED" ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200" title={segment.evaluationError || "Error"}>
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            FAILED
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            READY
                          </span>
                        )
                      ) : (
                        <span className="text-xs text-slate-400">Manual Kurasi</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        {segment.type === "DYNAMIC" && (
                          <button
                            onClick={() => handleEvaluate(segment.id)}
                            disabled={evaluatingId === segment.id}
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Evaluasi Aturan Sekarang"
                          >
                            <Play className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => { setSelectedSegmentId(segment.id); setActiveTab("overview"); }}
                          className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Lihat Detail & Anggota"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleExportCsv(segment.id)}
                          className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Ekspor CSV Anggota"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(segment)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            segment.status === "ACTIVE" 
                              ? "text-amber-600 hover:bg-amber-50" 
                              : "text-emerald-600 hover:bg-emerald-50"
                          }`}
                          title={segment.status === "ACTIVE" ? "Nonaktifkan" : "Aktifkan"}
                        >
                          {segment.status === "ACTIVE" ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleDelete(segment.id, segment.name)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Hapus Segmen"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {data && data.pagination.totalPages > 1 && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Menampilkan {data.items.length} dari {data.pagination.total} segmen
            </span>
            <div className="flex space-x-1">
              {Array.from({ length: data.pagination.totalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`px-3 py-1 rounded text-xs font-medium ${
                    p === page
                      ? "bg-indigo-600 text-white"
                      : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SEGMENT DETAIL DRAWER / MODAL */}
      {/* ========================================================================= */}
      {selectedSegmentId && selectedSegment && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-3xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-xl font-bold text-slate-900">{selectedSegment.name}</h2>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    selectedSegment.type === "DYNAMIC" ? "bg-indigo-100 text-indigo-700" : "bg-amber-100 text-amber-700"
                  }`}>
                    {selectedSegment.type}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    selectedSegment.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                  }`}>
                    {selectedSegment.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">ID: {selectedSegment.id}</p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => openEditModal(selectedSegment)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 bg-white hover:bg-slate-50"
                >
                  Edit Segmen
                </button>
                <button
                  onClick={() => setSelectedSegmentId(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="border-b border-slate-200 px-6 flex space-x-6 bg-white">
              <button
                onClick={() => setActiveTab("overview")}
                className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "overview" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                Ringkasan
              </button>
              {selectedSegment.type === "DYNAMIC" && (
                <button
                  onClick={() => setActiveTab("rules")}
                  className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === "rules" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Definisi Aturan
                </button>
              )}
              <button
                onClick={() => setActiveTab("members")}
                className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "members" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                Daftar Anggota ({selectedSegment.memberCount})
              </button>
              {selectedSegment.type === "DYNAMIC" && (
                <button
                  onClick={() => setActiveTab("evaluation")}
                  className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === "evaluation" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Evaluasi & Status
                </button>
              )}
              <button
                onClick={() => setActiveTab("audit")}
                className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "audit" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                Jejak Audit
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* TAB 1: OVERVIEW */}
              {activeTab === "overview" && (
                <div className="space-y-6">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-slate-900 mb-2">Deskripsi Segmen</h3>
                    <p className="text-sm text-slate-600">{selectedSegment.description || "Tidak ada deskripsi yang ditambahkan."}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white border border-slate-200 rounded-xl p-4">
                      <p className="text-xs text-slate-500 font-semibold uppercase">Total Anggota Terkualifikasi</p>
                      <p className="text-2xl font-bold text-indigo-600 mt-1">{selectedSegment.memberCount}</p>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-4">
                      <p className="text-xs text-slate-500 font-semibold uppercase">Status Evaluasi</p>
                      <p className="text-base font-semibold text-slate-800 mt-2">{selectedSegment.evaluationStatus}</p>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-sm">
                    <div className="p-3 bg-slate-50 font-semibold text-slate-700 text-xs uppercase">Metadata Segmen</div>
                    <div className="p-3 flex justify-between">
                      <span className="text-slate-500">Dibuat Oleh</span>
                      <span className="font-medium text-slate-800">{selectedSegment.createdBy}</span>
                    </div>
                    <div className="p-3 flex justify-between">
                      <span className="text-slate-500">Waktu Pembuatan</span>
                      <span className="font-medium text-slate-800">{new Date(selectedSegment.createdAt).toLocaleString("id-ID")}</span>
                    </div>
                    <div className="p-3 flex justify-between">
                      <span className="text-slate-500">Terakhir Diperbarui</span>
                      <span className="font-medium text-slate-800">{new Date(selectedSegment.updatedAt).toLocaleString("id-ID")}</span>
                    </div>
                    <div className="p-3 flex justify-between">
                      <span className="text-slate-500">Evaluasi Terakhir</span>
                      <span className="font-medium text-slate-800">
                        {selectedSegment.lastEvaluatedAt ? new Date(selectedSegment.lastEvaluatedAt).toLocaleString("id-ID") : "Belum dievaluasi"}
                      </span>
                    </div>
                  </div>

                  <div className="flex space-x-3">
                    {selectedSegment.type === "DYNAMIC" && (
                      <button
                        onClick={() => handleEvaluate(selectedSegment.id)}
                        disabled={evaluatingId === selectedSegment.id}
                        className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center justify-center space-x-2"
                      >
                        <Play className="w-4 h-4" />
                        <span>Evaluasi Aturan Sekarang</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleExportCsv(selectedSegment.id)}
                      className="px-4 py-2.5 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center space-x-2"
                    >
                      <Download className="w-4 h-4" />
                      <span>Ekspor CSV</span>
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: RULES */}
              {activeTab === "rules" && selectedSegment.ruleGroup && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-800">
                      Kombinator Aturan: <span className="text-indigo-600 font-bold">{selectedSegment.ruleGroup.combinator}</span> (
                      {selectedSegment.ruleGroup.combinator === "AND" ? "Harus memenuhi SEMUA aturan" : "Cukup memenuhi SALAH SATU aturan"}
                      )
                    </span>
                  </div>

                  <div className="space-y-3">
                    {selectedSegment.ruleGroup.rules.map((r: any, idx) => {
                      const def = SEGMENT_FIELD_CATALOG[r.field];
                      return (
                        <div key={r.id || idx} className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className="px-2 py-0.5 bg-slate-200 text-slate-700 text-xs font-semibold rounded">
                                {r.category}
                              </span>
                              <span className="font-semibold text-slate-900 text-sm">
                                {def?.label || r.field}
                              </span>
                            </div>
                            <div className="text-xs text-slate-600 flex items-center space-x-2">
                              <span className="font-mono bg-slate-100 px-1 py-0.5 rounded border border-slate-200">
                                {r.operator}
                              </span>
                              <span className="font-bold text-indigo-700">
                                {Array.isArray(r.value) ? JSON.stringify(r.value) : String(r.value)}
                              </span>
                            </div>
                          </div>
                          <span className="text-xs text-slate-400 font-mono">#{idx + 1}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 3: MEMBERS */}
              {activeTab === "members" && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        placeholder="Cari anggota (Nama, Email, UID)..."
                        value={membersSearch}
                        onChange={e => { setMembersSearch(e.target.value); setMembersPage(1); }}
                        className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="flex items-center space-x-2">
                      {selectedSegment.type === "STATIC" && (
                        <button
                          onClick={() => setIsAddMemberModalOpen(true)}
                          className="px-3.5 py-2 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 flex items-center space-x-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Tambah Anggota</span>
                        </button>
                      )}
                      <button
                        onClick={() => fetchSegmentMembers(selectedSegment.id)}
                        className="p-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50"
                        title="Refresh Anggota"
                      >
                        <RefreshCw className={`w-4 h-4 ${membersLoading ? "animate-spin" : ""}`} />
                      </button>
                    </div>
                  </div>

                  {membersLoading ? (
                    <div className="py-12 text-center text-slate-500">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                      <span className="text-xs">Memuat data anggota...</span>
                    </div>
                  ) : members.length === 0 ? (
                    <div className="py-12 text-center text-slate-500 border border-dashed border-slate-200 rounded-xl">
                      <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="text-sm font-medium">Belum ada anggota dalam segmen ini.</p>
                      {selectedSegment.type === "DYNAMIC" && (
                        <p className="text-xs text-slate-400 mt-1">Klik "Evaluasi Aturan Sekarang" untuk mengevaluasi data pelanggan.</p>
                      )}
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                      {members.map(m => (
                        <div key={m.membership.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-semibold text-slate-900 text-sm">{m.customer.name}</span>
                              <span className="text-xs font-mono text-slate-400">({m.customer.uid})</span>
                            </div>
                            <div className="text-xs text-slate-500 flex items-center space-x-4">
                              <span>Email: {m.customer.email}</span>
                              <span>Telp: {m.customer.phone}</span>
                              <span>LTV: Rp {m.customer.totalSpentIdr.toLocaleString("id-ID")}</span>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            {selectedSegment.type === "STATIC" && (
                              <button
                                onClick={() => handleRemoveMember(m.customer.uid)}
                                className="p-1.5 text-rose-500 hover:bg-rose-50 rounded"
                                title="Keluarkan dari segmen"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: EVALUATION */}
              {activeTab === "evaluation" && (
                <div className="space-y-6">
                  <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm text-center">
                    <Activity className="w-10 h-10 text-indigo-600 mx-auto mb-3" />
                    <h3 className="text-base font-bold text-slate-900">Konsol Evaluasi Aturan Dinamis</h3>
                    <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                      Evaluasi memproses data pelanggan, riwayat pesanan, saldo loyalitas, dan label tanpa menghapus data secara destruktif.
                    </p>

                    <div className="mt-6 flex justify-center">
                      <button
                        onClick={() => handleEvaluate(selectedSegment.id)}
                        disabled={evaluatingId === selectedSegment.id}
                        className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center space-x-2"
                      >
                        <Play className="w-4 h-4" />
                        <span>{evaluatingId === selectedSegment.id ? "Sedang Mengevaluasi..." : "Jalankan Evaluasi Sekarang"}</span>
                      </button>
                    </div>
                  </div>

                  {selectedSegment.evaluationError && (
                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-800 text-xs">
                      <p className="font-bold flex items-center space-x-1">
                        <AlertTriangle className="w-4 h-4 text-rose-600" />
                        <span>Log Error Evaluasi Terakhir:</span>
                      </p>
                      <p className="mt-1 font-mono">{selectedSegment.evaluationError}</p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: AUDIT */}
              {activeTab === "audit" && (
                <div className="space-y-4">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 flex items-center space-x-2">
                    <History className="w-4 h-4 text-slate-500" />
                    <span>Seluruh mutasi segmen dan keanggotaan tercatat otomatis di Core Audit Logs.</span>
                  </div>
                  <p className="text-xs text-slate-400 italic text-center py-6">
                    Buka menu "Audit Logs" di sidebar admin untuk melihat riwayat lengkap perubahan segmen '{selectedSegment.name}'.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CREATE / EDIT SEGMENT MODAL */}
      {/* ========================================================================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in duration-200">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h2 className="text-lg font-bold text-slate-900">
                {editingSegment ? "Edit Segmen Pelanggan" : "Buat Segmen Pelanggan Baru"}
              </h2>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSegment} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* Type selector (only for new segments) */}
              {!editingSegment && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Tipe Segmen
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, type: "DYNAMIC" }))}
                      className={`p-3 rounded-xl border text-left flex items-start space-x-3 transition-colors ${
                        formData.type === "DYNAMIC"
                          ? "border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20"
                          : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <Layers className={`w-5 h-5 mt-0.5 ${formData.type === "DYNAMIC" ? "text-indigo-600" : "text-slate-400"}`} />
                      <div>
                        <p className="text-sm font-bold text-slate-900">Dinamis (Dynamic)</p>
                        <p className="text-xs text-slate-500 mt-0.5">Keanggotaan dievaluasi otomatis berdasarkan aturan kriteria.</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, type: "STATIC" }))}
                      className={`p-3 rounded-xl border text-left flex items-start space-x-3 transition-colors ${
                        formData.type === "STATIC"
                          ? "border-amber-600 bg-amber-50/50 ring-2 ring-amber-500/20"
                          : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <Tag className={`w-5 h-5 mt-0.5 ${formData.type === "STATIC" ? "text-amber-600" : "text-slate-400"}`} />
                      <div>
                        <p className="text-sm font-bold text-slate-900">Statis (Static)</p>
                        <p className="text-xs text-slate-500 mt-0.5">Keanggotaan ditentukan manual per pelanggan.</p>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* Segment Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nama Segmen <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: VIP Gamers Sultan (LTV > 5 Juta)"
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Deskripsi
                </label>
                <textarea
                  rows={2}
                  placeholder="Penjelasan tujuan segmentasi ini..."
                  value={formData.description}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Visual Rule Builder for Dynamic Segments */}
              {formData.type === "DYNAMIC" && (
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Definisi Aturan Kualifikasi</h4>
                      <p className="text-xs text-slate-500">Pelanggan yang cocok akan otomatis menjadi anggota aktif.</p>
                    </div>

                    <select
                      value={formData.ruleGroup.combinator}
                      onChange={e => setFormData(prev => ({
                        ...prev,
                        ruleGroup: { ...prev.ruleGroup, combinator: e.target.value as any }
                      }))}
                      className="px-3 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
                    >
                      <option value="AND">Penuhi SEMUA Aturan (AND)</option>
                      <option value="OR">Penuhi SALAH SATU Aturan (OR)</option>
                    </select>
                  </div>

                  {/* Rules list */}
                  <div className="space-y-3">
                    {formData.ruleGroup.rules.map((ruleItem: any, index) => {
                      const fieldDef = SEGMENT_FIELD_CATALOG[ruleItem.field] || SEGMENT_FIELD_CATALOG["commerce.totalSpentIdr"];
                      return (
                        <div key={ruleItem.id || index} className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                            {/* Field Selector */}
                            <div className="sm:col-span-5">
                              <select
                                value={ruleItem.field}
                                onChange={e => updateRuleField(index, e.target.value)}
                                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:ring-1 focus:ring-indigo-500"
                              >
                                {Object.entries(catalogByCategory).map(([cat, fields]) => (
                                  <optgroup key={cat} label={`Kategori: ${cat}`}>
                                    {(fields as any[]).map(f => (
                                      <option key={f.field} value={f.field}>{f.label}</option>
                                    ))}
                                  </optgroup>
                                ))}
                              </select>
                            </div>

                            {/* Operator Selector */}
                            <div className="sm:col-span-3">
                              <select
                                value={ruleItem.operator}
                                onChange={e => updateRuleOperator(index, e.target.value)}
                                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:ring-1 focus:ring-indigo-500"
                              >
                                {fieldDef.allowedOperators.map(op => (
                                  <option key={op} value={op}>{op}</option>
                                ))}
                              </select>
                            </div>

                            {/* Value Input */}
                            <div className="sm:col-span-3">
                              {fieldDef.valueType === "enum" && fieldDef.enumValues ? (
                                <select
                                  value={ruleItem.value}
                                  onChange={e => updateRuleValue(index, e.target.value)}
                                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                                >
                                  {fieldDef.enumValues.map(ev => (
                                    <option key={ev.value} value={ev.value}>{ev.label}</option>
                                  ))}
                                </select>
                              ) : fieldDef.valueType === "number" ? (
                                <input
                                  type="number"
                                  value={ruleItem.value}
                                  onChange={e => updateRuleValue(index, Number(e.target.value))}
                                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                                />
                              ) : (
                                <input
                                  type="text"
                                  value={ruleItem.value}
                                  onChange={e => updateRuleValue(index, e.target.value)}
                                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                                  placeholder="Nilai kriteria..."
                                />
                              )}
                            </div>

                            {/* Delete Rule */}
                            <div className="sm:col-span-1 flex items-center justify-center">
                              {formData.ruleGroup.rules.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeRuleFromGroup(index)}
                                  className="p-1 text-slate-400 hover:text-rose-600"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={addRuleToGroup}
                    className="inline-flex items-center px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Tambah Aturan Kriteria
                  </button>
                </div>
              )}

              <div className="pt-4 border-t border-slate-200 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm"
                >
                  {editingSegment ? "Simpan Perubahan" : "Buat Segmen"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ADD STATIC MEMBER MODAL */}
      {/* ========================================================================= */}
      {isAddMemberModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h2 className="text-base font-bold text-slate-900">Tambah Anggota ke Segmen Statis</h2>
              <button onClick={() => setIsAddMemberModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Ketik nama, email, atau UID pelanggan..."
                  value={userSearchQuery}
                  onChange={e => {
                    setUserSearchQuery(e.target.value);
                    searchAvailableUsers(e.target.value);
                  }}
                  className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {searchingUsers ? (
                <div className="py-6 text-center text-slate-400 text-xs">Mencari pengguna...</div>
              ) : userSearchResults.length > 0 ? (
                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-60 overflow-y-auto">
                  {userSearchResults.map(u => (
                    <div key={u.id} className="p-3 flex items-center justify-between hover:bg-slate-50">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{u.name}</p>
                        <p className="text-xs text-slate-500">{u.email} • UID: {u.id}</p>
                      </div>
                      <button
                        onClick={() => handleAddMember(u.id)}
                        className="px-3 py-1 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700"
                      >
                        Pilih
                      </button>
                    </div>
                  ))}
                </div>
              ) : userSearchQuery ? (
                <p className="text-xs text-slate-400 text-center py-4">Tidak ada pelanggan ditemukan.</p>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
