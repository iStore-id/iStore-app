import React, { useState, useEffect } from 'react';
import { 
  Users, Award, Settings, Plus, Search, Filter, RefreshCw, 
  CheckCircle2, AlertTriangle, AlertCircle, Edit2, ShieldAlert,
  HelpCircle, ChevronRight, Layers, ArrowUpRight, Lock, Save,
  X, Check, Building2, Calendar, FileText, ToggleLeft, ToggleRight,
  TrendingUp, DollarSign, Eye, Clock, ArrowRight, BookOpen, Download,
  CreditCard, Send, CheckSquare, Ban
} from 'lucide-react';
import { useAuthStore } from '../../store/auth-store';
import { 
  CommissionConfig, 
  CommissionRecipient, 
  CommissionRule, 
  CommissionRecord,
  PayoutBatch,
  PayoutBatchStatus,
  RecipientStatus, 
  CommissionCalculationMethod 
} from '../../types/commission';

export default function AdminCommissionPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'overview' | 'payouts' | 'records' | 'affiliates' | 'rules' | 'config'>('overview');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Config State
  const [config, setConfig] = useState<CommissionConfig>({
    enabled: false,
    defaultCalculationMethod: 'PERCENTAGE_OF_SELLING_PRICE',
    defaultCurrency: 'IDR',
    minimumPayoutThreshold: 50000,
    supportedRecipientTypes: ['AFFILIATE'],
    updatedAt: '',
    updatedBy: ''
  });

  // Commission Records State (Phase 2)
  const [records, setRecords] = useState<CommissionRecord[]>([]);
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordSummary, setRecordSummary] = useState({
    totalRecords: 0,
    totalPayable: 0,
    totalCancelled: 0,
    totalCommissionAmount: 0,
    payableAmount: 0,
    cancelledAmount: 0
  });
  const [recordPagination, setRecordPagination] = useState({
    page: 1,
    limit: 15,
    totalRecords: 0,
    totalPages: 1
  });
  const [searchRecord, setSearchRecord] = useState('');
  const [statusFilterRecord, setStatusFilterRecord] = useState<string>('ALL');
  const [methodFilterRecord, setMethodFilterRecord] = useState<string>('ALL');
  const [startDateRecord, setStartDateRecord] = useState<string>('');
  const [endDateRecord, setEndDateRecord] = useState<string>('');
  const [selectedRecord, setSelectedRecord] = useState<CommissionRecord | null>(null);
  const [recordModalOpen, setRecordModalOpen] = useState(false);

  // Ledger Reconciliation State (Phase 3)
  const [reconciliationReport, setReconciliationReport] = useState<any>(null);
  const [reconciling, setReconciling] = useState(false);
  const [reconcileModalOpen, setReconcileModalOpen] = useState(false);

  const handleRunReconciliation = async () => {
    setReconciling(true);
    setErrorMsg('');
    try {
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch('/api/admin/commission/reconciliation', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Gagal memverifikasi rekonsiliasi');
      setReconciliationReport(data.data);
      setReconcileModalOpen(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menjalankan rekonsiliasi buku besar');
    } finally {
      setReconciling(false);
    }
  };

  // Affiliates State
  const [recipients, setRecipients] = useState<CommissionRecipient[]>([]);
  const [searchRecipient, setSearchRecipient] = useState('');
  const [statusFilterRecipient, setStatusFilterRecipient] = useState<string>('ALL');
  const [recipientModalOpen, setRecipientModalOpen] = useState(false);
  const [editingRecipient, setEditingRecipient] = useState<CommissionRecipient | null>(null);

  // Recipient Form State
  const [recName, setRecName] = useState('');
  const [recCode, setRecCode] = useState('');
  const [recStatus, setRecStatus] = useState<RecipientStatus>('ACTIVE');
  const [recNotes, setRecNotes] = useState('');
  const [recBankName, setRecBankName] = useState('');
  const [recAccountNumber, setRecAccountNumber] = useState('');
  const [recAccountHolder, setRecAccountHolder] = useState('');

  // Rules State
  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [searchRule, setSearchRule] = useState('');
  const [statusFilterRule, setStatusFilterRule] = useState<string>('ALL');
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<CommissionRule | null>(null);

  // Rule Form State
  const [ruleName, setRuleName] = useState('');
  const [ruleMethod, setRuleMethod] = useState<CommissionCalculationMethod>('PERCENTAGE_OF_SELLING_PRICE');
  const [ruleRate, setRuleRate] = useState<number>(2.0);
  const [ruleMinOrder, setRuleMinOrder] = useState<number>(0);
  const [ruleMaxCommission, setRuleMaxCommission] = useState<string>('');
  const [rulePriority, setRulePriority] = useState<number>(10);
  const [ruleEffectiveFrom, setRuleEffectiveFrom] = useState<string>(new Date().toISOString().split('T')[0]);
  const [ruleEffectiveUntil, setRuleEffectiveUntil] = useState<string>('');
  const [ruleRecipientId, setRuleRecipientId] = useState<string>('');
  const [ruleStatus, setRuleStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');

  // ==========================================================================
  // PHASE 5: PAYOUT BATCHES STATE
  // ==========================================================================
  const [payoutBatches, setPayoutBatches] = useState<PayoutBatch[]>([]);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [statusFilterPayout, setStatusFilterPayout] = useState<string>('ALL');
  const [selectedBatch, setSelectedBatch] = useState<PayoutBatch | null>(null);
  const [batchDetailModalOpen, setBatchDetailModalOpen] = useState(false);
  const [batchCommissions, setBatchCommissions] = useState<CommissionRecord[]>([]);

  // Create Batch Modal State
  const [createBatchModalOpen, setCreateBatchModalOpen] = useState(false);
  const [selectedRecipientForBatch, setSelectedRecipientForBatch] = useState<string>('');
  const [unpaidCommissionsForRecipient, setUnpaidCommissionsForRecipient] = useState<CommissionRecord[]>([]);
  const [selectedCommissionIds, setSelectedCommissionIds] = useState<string[]>([]);
  const [overrideThreshold, setOverrideThreshold] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [creatingBatch, setCreatingBatch] = useState(false);

  // Confirm Paid Modal State
  const [confirmPaidModalOpen, setConfirmPaidModalOpen] = useState(false);
  const [batchToConfirm, setBatchToConfirm] = useState<PayoutBatch | null>(null);
  const [transferReference, setTransferReference] = useState('');
  const [proofReference, setProofReference] = useState('');
  const [confirmingPaid, setConfirmingPaid] = useState(false);

  // Cancel Batch Modal State
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [batchToCancel, setBatchToCancel] = useState<PayoutBatch | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [cancellingBatch, setCancellingBatch] = useState(false);

  // Fetch Payout Batches
  const fetchPayoutBatches = async () => {
    setPayoutLoading(true);
    try {
      const token = await (user as any)?.getIdToken?.();
      const headers = { Authorization: `Bearer ${token}` };
      const url = statusFilterPayout !== 'ALL'
        ? `/api/admin/commission/payouts?status=${statusFilterPayout}`
        : '/api/admin/commission/payouts';
      const res = await fetch(url, { headers });
      const data = await res.json();
      if (data.success) {
        setPayoutBatches(data.batches || []);
      }
    } catch (err: any) {
      console.error('Error fetching payout batches:', err);
    } finally {
      setPayoutLoading(false);
    }
  };

  // Fetch Unpaid Commissions for Selected Recipient
  const fetchUnpaidCommissionsForRecipient = async (recId: string) => {
    if (!recId) {
      setUnpaidCommissionsForRecipient([]);
      setSelectedCommissionIds([]);
      return;
    }
    try {
      const token = await (user as any)?.getIdToken?.();
      const headers = { Authorization: `Bearer ${token}` };
      const res = await fetch(`/api/admin/commission/records?recipientId=${recId}&status=PAYABLE&limit=100`, { headers });
      const data = await res.json();
      if (data.success) {
        const unallocated = (data.data.records || []).filter(
          (r: CommissionRecord) => (!r.payoutStatus || r.payoutStatus === 'UNPAID') && (r.remainingPayableAmount || r.commissionAmount) > 0
        );
        setUnpaidCommissionsForRecipient(unallocated);
        // Default select all eligible
        setSelectedCommissionIds(unallocated.map((r: CommissionRecord) => r.id));
      }
    } catch (err: any) {
      console.error('Error fetching unpaid commissions:', err);
    }
  };

  // Load All Data
  const fetchData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const token = await (user as any)?.getIdToken?.();
      const headers = { Authorization: `Bearer ${token}` };

      const [configRes, recRes, ruleRes] = await Promise.all([
        fetch('/api/admin/commission/config', { headers }),
        fetch('/api/admin/commission/recipients', { headers }),
        fetch('/api/admin/commission/rules', { headers })
      ]);

      const [configData, recData, ruleData] = await Promise.all([
        configRes.json(),
        recRes.json(),
        ruleRes.json()
      ]);

      if (configData.success) setConfig(configData.data);
      if (recData.success) setRecipients(recData.data);
      if (ruleData.success) setRules(ruleData.data);
    } catch (e: any) {
      setErrorMsg(e.message || 'Gagal memuat data komisi.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Commission Records (Phase 2)
  const fetchRecords = async (page = 1) => {
    setRecordLoading(true);
    try {
      const token = await (user as any)?.getIdToken?.();
      const headers = { Authorization: `Bearer ${token}` };

      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(recordPagination.limit));
      if (searchRecord.trim()) params.set('search', searchRecord.trim());
      if (statusFilterRecord !== 'ALL') params.set('status', statusFilterRecord);
      if (methodFilterRecord !== 'ALL') params.set('calculationMethod', methodFilterRecord);
      if (startDateRecord) params.set('startDate', startDateRecord);
      if (endDateRecord) params.set('endDate', endDateRecord);

      const res = await fetch(`/api/admin/commission/records?${params.toString()}`, { headers });
      const data = await res.json();
      if (data.success) {
        setRecords(data.data.records || []);
        setRecordPagination(data.data.pagination || { page: 1, limit: 15, totalRecords: 0, totalPages: 1 });
        setRecordSummary(data.data.summary || {
          totalRecords: 0,
          totalPayable: 0,
          totalCancelled: 0,
          totalCommissionAmount: 0,
          payableAmount: 0,
          cancelledAmount: 0
        });
      }
    } catch (err: any) {
      console.error('Error fetching commission records:', err);
    } finally {
      setRecordLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchRecords(1);
    fetchPayoutBatches();
  }, [user]);

  useEffect(() => {
    if (activeTab === 'records' || activeTab === 'overview') {
      fetchRecords(1);
    }
    if (activeTab === 'payouts' || activeTab === 'overview') {
      fetchPayoutBatches();
    }
  }, [activeTab, statusFilterRecord, methodFilterRecord, startDateRecord, endDateRecord, statusFilterPayout]);

  // ==========================================================================
  // PHASE 5: PAYOUT ACTION HANDLERS
  // ==========================================================================
  const handleOpenCreateBatchModal = () => {
    setSelectedRecipientForBatch('');
    setUnpaidCommissionsForRecipient([]);
    setSelectedCommissionIds([]);
    setOverrideThreshold(false);
    setOverrideReason('');
    setCreateBatchModalOpen(true);
  };

  const handleSelectRecipientForBatch = (recId: string) => {
    setSelectedRecipientForBatch(recId);
    fetchUnpaidCommissionsForRecipient(recId);
  };

  const handleToggleCommissionSelection = (commId: string) => {
    if (selectedCommissionIds.includes(commId)) {
      setSelectedCommissionIds(selectedCommissionIds.filter(id => id !== commId));
    } else {
      setSelectedCommissionIds([...selectedCommissionIds, commId]);
    }
  };

  const handleCreateBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecipientForBatch) {
      setErrorMsg('Pilih mitra penerima komisi');
      return;
    }
    if (selectedCommissionIds.length === 0) {
      setErrorMsg('Pilih minimal satu catatan komisi untuk dialokasikan');
      return;
    }
    setCreatingBatch(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch('/api/admin/commission/payouts/create', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recipientId: selectedRecipientForBatch,
          commissionRecordIds: selectedCommissionIds,
          overrideThreshold,
          overrideReason: overrideThreshold ? overrideReason : undefined
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal membuat payout batch');
      }
      setSuccessMsg(`Payout Batch #${data.batch.batchNumber} berhasil dibuat (Status: DRAFT).`);
      setCreateBatchModalOpen(false);
      fetchPayoutBatches();
      fetchRecords(1);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal membuat payout batch');
    } finally {
      setCreatingBatch(false);
    }
  };

  const handleSubmitBatch = async (batchId: string) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch(`/api/admin/commission/payouts/${batchId}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal mengajukan payout batch');
      }
      setSuccessMsg('Batch berhasil diajukan untuk persetujuan (PENDING_APPROVAL).');
      fetchPayoutBatches();
      if (selectedBatch?.id === batchId) {
        handleViewBatchDetail(batchId);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengajukan batch');
    }
  };

  const handleApproveBatch = async (batchId: string) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch(`/api/admin/commission/payouts/${batchId}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal menyetujui payout batch');
      }
      setSuccessMsg('Batch berhasil disetujui (APPROVED / READY_FOR_DISBURSEMENT).');
      fetchPayoutBatches();
      if (selectedBatch?.id === batchId) {
        handleViewBatchDetail(batchId);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menyetujui batch');
    }
  };

  const handleOpenConfirmPaidModal = (batch: PayoutBatch) => {
    setBatchToConfirm(batch);
    setTransferReference('');
    setProofReference('');
    setConfirmPaidModalOpen(true);
  };

  const handleConfirmPaidSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchToConfirm) return;
    if (!transferReference.trim()) {
      setErrorMsg('Nomor referensi mutasi bank wajib diisi');
      return;
    }
    setConfirmingPaid(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch(`/api/admin/commission/payouts/${batchToConfirm.id}/confirm-paid`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          transferReference: transferReference.trim(),
          proofReference: proofReference.trim() || undefined
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal mengonfirmasi pelunasan batch');
      }
      setSuccessMsg(`Batch #${batchToConfirm.batchNumber} berhasil dilunasi & dijurnalkan ke Buku Besar.`);
      setConfirmPaidModalOpen(false);
      fetchPayoutBatches();
      fetchRecords(1);
      if (selectedBatch?.id === batchToConfirm.id) {
        handleViewBatchDetail(batchToConfirm.id);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengonfirmasi pelunasan');
    } finally {
      setConfirmingPaid(false);
    }
  };

  const handleOpenCancelModal = (batch: PayoutBatch) => {
    setBatchToCancel(batch);
    setCancellationReason('');
    setCancelModalOpen(true);
  };

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchToCancel) return;
    if (!cancellationReason.trim()) {
      setErrorMsg('Alasan pembatalan batch wajib diisi');
      return;
    }
    setCancellingBatch(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch(`/api/admin/commission/payouts/${batchToCancel.id}/cancel`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reason: cancellationReason.trim()
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal membatalkan payout batch');
      }
      setSuccessMsg(`Batch #${batchToCancel.batchNumber} berhasil dibatalkan dan alokasi dikembalikan.`);
      setCancelModalOpen(false);
      fetchPayoutBatches();
      fetchRecords(1);
      if (selectedBatch?.id === batchToCancel.id) {
        handleViewBatchDetail(batchToCancel.id);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal membatalkan batch');
    } finally {
      setCancellingBatch(false);
    }
  };

  const handleExportInstruction = async (batchId: string) => {
    setErrorMsg('');
    try {
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch(`/api/admin/commission/payouts/${batchId}/export-instruction`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Gagal mengekspor instruksi transfer');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transfer_instruction_${batchId}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengunduh CSV instruksi transfer');
    }
  };

  const handleViewBatchDetail = async (batchId: string) => {
    setErrorMsg('');
    try {
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch(`/api/admin/commission/payouts/${batchId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal memuat rincian batch');
      }
      setSelectedBatch(data.batch);
      setBatchCommissions(data.commissions || []);
      setBatchDetailModalOpen(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memuat rincian batch');
    }
  };

  // Handle Save Config
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch('/api/admin/commission/config', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal menyimpan konfigurasi');
      setSuccessMsg('Konfigurasi program komisi berhasil disimpan.');
      fetchData();
    } catch (e: any) {
      setErrorMsg(e.message || 'Gagal menyimpan konfigurasi');
    } finally {
      setSaving(false);
    }
  };

  // Open Create Recipient Modal
  const openCreateRecipientModal = () => {
    setEditingRecipient(null);
    setRecName('');
    setRecCode('');
    setRecStatus('ACTIVE');
    setRecNotes('');
    setRecBankName('');
    setRecAccountNumber('');
    setRecAccountHolder('');
    setRecipientModalOpen(true);
  };

  // Open Edit Recipient Modal
  const openEditRecipientModal = (rec: CommissionRecipient) => {
    setEditingRecipient(rec);
    setRecName(rec.name);
    setRecCode(rec.code);
    setRecStatus(rec.status);
    setRecNotes(rec.notes || '');
    setRecBankName(rec.payoutAccount?.bankName || '');
    setRecAccountNumber(''); // Leave blank for security; placeholder shows masked number
    setRecAccountHolder(rec.payoutAccount?.accountHolderName || '');
    setRecipientModalOpen(true);
  };

  // Save Recipient
  const handleSaveRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const token = await (user as any)?.getIdToken?.();
      
      let payoutPayload = null;
      if (recBankName) {
        payoutPayload = {
          bankName: recBankName,
          accountNumber: recAccountNumber, // if empty on edit, server retains existing encrypted account number
          accountHolderName: recAccountHolder || recName
        };
      }

      const payload: any = {
        name: recName,
        code: recCode,
        status: recStatus,
        notes: recNotes,
        type: 'AFFILIATE',
        payoutAccount: payoutPayload
      };

      const url = editingRecipient 
        ? `/api/admin/commission/recipients/${editingRecipient.id}`
        : '/api/admin/commission/recipients';
      
      const method = editingRecipient ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal menyimpan penerima komisi');

      setSuccessMsg(editingRecipient ? 'Data afiliasi berhasil diperbarui.' : 'Mitra afiliasi baru berhasil ditambahkan.');
      setRecipientModalOpen(false);
      fetchData();
    } catch (e: any) {
      setErrorMsg(e.message || 'Gagal menyimpan afiliasi');
    } finally {
      setSaving(false);
    }
  };

  // Open Create Rule Modal
  const openCreateRuleModal = () => {
    setEditingRule(null);
    setRuleName('');
    setRuleMethod('PERCENTAGE_OF_SELLING_PRICE');
    setRuleRate(2.0);
    setRuleMinOrder(0);
    setRuleMaxCommission('');
    setRulePriority(10);
    setRuleEffectiveFrom(new Date().toISOString().split('T')[0]);
    setRuleEffectiveUntil('');
    setRuleRecipientId('');
    setRuleStatus('ACTIVE');
    setRuleModalOpen(true);
  };

  // Open Edit Rule Modal
  const openEditRuleModal = (rule: CommissionRule) => {
    setEditingRule(rule);
    setRuleName(rule.name);
    setRuleMethod(rule.calculationMethod);
    setRuleRate(rule.rate);
    setRuleMinOrder(rule.minOrderAmount || 0);
    setRuleMaxCommission(rule.maxCommissionAmount ? String(rule.maxCommissionAmount) : '');
    setRulePriority(rule.priority || 10);
    setRuleEffectiveFrom(rule.effectiveFrom);
    setRuleEffectiveUntil(rule.effectiveUntil || '');
    setRuleRecipientId(rule.recipientId || '');
    setRuleStatus(rule.status);
    setRuleModalOpen(true);
  };

  // Save Rule
  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const token = await (user as any)?.getIdToken?.();
      const payload: any = {
        name: ruleName,
        recipientType: 'AFFILIATE',
        recipientId: ruleRecipientId || null,
        calculationMethod: ruleMethod,
        rate: Number(ruleRate),
        minOrderAmount: Number(ruleMinOrder),
        maxCommissionAmount: ruleMaxCommission ? Number(ruleMaxCommission) : null,
        priority: Number(rulePriority),
        effectiveFrom: ruleEffectiveFrom,
        effectiveUntil: ruleEffectiveUntil || null,
        status: ruleStatus
      };

      const url = editingRule
        ? `/api/admin/commission/rules/${editingRule.id}`
        : '/api/admin/commission/rules';
      
      const method = editingRule ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal menyimpan aturan komisi');

      setSuccessMsg(editingRule ? 'Aturan komisi berhasil diperbarui.' : 'Aturan komisi baru berhasil dibuat.');
      setRuleModalOpen(false);
      fetchData();
    } catch (e: any) {
      setErrorMsg(e.message || 'Gagal menyimpan aturan komisi');
    } finally {
      setSaving(false);
    }
  };

  // Quick toggle rule status
  const toggleRuleStatus = async (rule: CommissionRule) => {
    try {
      const token = await (user as any)?.getIdToken?.();
      const nextStatus = rule.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      const res = await fetch(`/api/admin/commission/rules/${rule.id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: nextStatus })
      });
      if (res.ok) {
        setRules(prev => prev.map(r => r.id === rule.id ? { ...r, status: nextStatus } : r));
        setSuccessMsg(`Status aturan '${rule.name}' diubah menjadi ${nextStatus}.`);
      }
    } catch (e: any) {
      setErrorMsg('Gagal mengubah status aturan.');
    }
  };

  // Filtered Recipients
  const filteredRecipients = recipients.filter(r => {
    const matchesSearch = !searchRecipient || 
      r.name.toLowerCase().includes(searchRecipient.toLowerCase()) ||
      r.code.toLowerCase().includes(searchRecipient.toLowerCase());
    const matchesStatus = statusFilterRecipient === 'ALL' || r.status === statusFilterRecipient;
    return matchesSearch && matchesStatus;
  });

  // Filtered Rules
  const filteredRules = rules.filter(r => {
    const matchesSearch = !searchRule || r.name.toLowerCase().includes(searchRule.toLowerCase());
    const matchesStatus = statusFilterRule === 'ALL' || r.status === statusFilterRule;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Award className="w-7 h-7 text-indigo-600" />
            Commission & Affiliate Foundation
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Pengelolaan komisi afiliasi, integrasi buku besar akuntansi, dan skema bagi hasil penjualan.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition"
          >
            <RefreshCw className="w-4 h-4" />
            Muat Ulang
          </button>
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            {errorMsg}
          </div>
          <button onClick={() => setErrorMsg('')} className="text-red-500 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm font-medium flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            {successMsg}
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Phase 2, 3, 4 & 5 Advisory Notice */}
      <div className="bg-indigo-50/80 border border-indigo-200/80 rounded-2xl p-5 flex items-start gap-4">
        <AlertCircle className="w-6 h-6 text-indigo-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-indigo-950 space-y-1">
          <p className="font-semibold">Fase 5: Payout & Disbursement Engine Aktif (Manual Bank Transfer MVP)</p>
          <p className="text-indigo-900 leading-relaxed">
            Komisi diakrualkan secara immutable (Fase 2 & 3) dan disesuaikan secara proporsional saat refund/clawback (Fase 4). Pada Fase 5, tim Finance dapat mengelompokkan komisi PAYABLE per mitra ke dalam <strong>Payout Batch</strong>, melalui persetujuan Maker-Checker, mengekspor instruksi transfer, dan membukukan pelunasan otomatis ke General Ledger (DR 2100 Utang Komisi / CR 1200 Bank Utama).
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'overview'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Layers className="w-4 h-4" />
          Ringkasan
        </button>
        <button
          onClick={() => setActiveTab('payouts')}
          className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'payouts'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Payout & Pencairan ({payoutBatches.length})
        </button>
        <button
          onClick={() => setActiveTab('records')}
          className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'records'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Riwayat Komisi ({recordSummary.totalRecords})
        </button>
        <button
          onClick={() => setActiveTab('affiliates')}
          className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'affiliates'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Users className="w-4 h-4" />
          Mitra Afiliasi ({recipients.length})
        </button>
        <button
          onClick={() => setActiveTab('rules')}
          className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'rules'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Award className="w-4 h-4" />
          Aturan Komisi ({rules.length})
        </button>
        <button
          onClick={() => setActiveTab('config')}
          className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'config'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Settings className="w-4 h-4" />
          Pengaturan Global
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Akrual Komisi</span>
                <DollarSign className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="mt-3 text-2xl font-black text-slate-900">
                Rp {recordSummary.totalCommissionAmount.toLocaleString('id-ID')}
              </div>
              <p className="text-xs text-emerald-600 font-semibold mt-1">
                Rp {recordSummary.payableAmount.toLocaleString('id-ID')} PAYABLE
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Catatan Komisi</span>
                <TrendingUp className="w-5 h-5 text-indigo-500" />
              </div>
              <div className="mt-3 text-2xl font-black text-slate-900">
                {recordSummary.totalRecords}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {recordSummary.totalPayable} PAYABLE · {recordSummary.totalCancelled} CANCELLED
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Mitra Afiliasi</span>
                <Users className="w-5 h-5 text-blue-500" />
              </div>
              <div className="mt-3 text-2xl font-black text-slate-900">
                {recipients.length}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {recipients.filter(r => r.status === 'ACTIVE').length} aktif · {recipients.filter(r => r.status === 'SUSPENDED').length} ditangguhkan
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Aturan Komisi</span>
                <Award className="w-5 h-5 text-amber-500" />
              </div>
              <div className="mt-3 text-2xl font-black text-slate-900">
                {rules.length}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {rules.filter(r => r.status === 'ACTIVE').length} aktif · {config.enabled ? 'Sistem Aktif' : 'Sistem Nonaktif'}
              </p>
            </div>
          </div>

          {/* Quick Actions & Architectural Separation Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                Status Accrual & Earning (Phase 2)
              </h3>
              <ul className="space-y-3 text-sm text-slate-600">
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Komisi otomatis tercipta saat pesanan afiliasi berubah ke status <strong>SUCCESS</strong>.</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Snapshot persentase, nominal, dan modal tersimpan secara <strong>immutable</strong>.</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Idempotensi ketat mencegah double komisi pada webhook atau transaksi ganda.</span>
                </li>
              </ul>
            </div>

            <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-6 shadow-sm space-y-3">
              <h3 className="text-base font-bold text-indigo-950 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-600" />
                  Integrasi Buku Besar (Phase 3: Double-Entry)
                </span>
                <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-full">
                  AKTIF
                </span>
              </h3>
              <p className="text-xs text-indigo-900 leading-relaxed">
                Setiap komisi berstatus <strong className="text-emerald-700">PAYABLE</strong> otomatis dibukukan ke General Ledger Double-Entry secara append-only dan terisolasi:
              </p>
              <div className="bg-white/80 border border-indigo-200/60 rounded-xl p-3 text-xs font-mono space-y-1">
                <div className="flex justify-between text-slate-700">
                  <span>Debit: 5200_COMMISSION_EXPENSE</span>
                  <span className="font-bold text-slate-900">Beban Operasional Komisi</span>
                </div>
                <div className="flex justify-between text-slate-700 border-t border-indigo-100 pt-1">
                  <span>Kredit: 2100_COMMISSION_PAYABLE</span>
                  <span className="font-bold text-slate-900">Kewajiban Utang Komisi</span>
                </div>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleRunReconciliation}
                  disabled={reconciling}
                  className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${reconciling ? 'animate-spin' : ''}`} />
                  {reconciling ? 'Memverifikasi...' : 'Jalankan Audit Rekonsiliasi Ledger'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: PAYOUT BATCHES (Phase 5) */}
      {activeTab === 'payouts' && (
        <div className="space-y-6">
          {/* Header Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <select
                value={statusFilterPayout}
                onChange={e => setStatusFilterPayout(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
              >
                <option value="ALL">Semua Status Batch</option>
                <option value="DRAFT">DRAFT</option>
                <option value="PENDING_APPROVAL">PENDING_APPROVAL</option>
                <option value="APPROVED">APPROVED</option>
                <option value="NEEDS_REVIEW">NEEDS_REVIEW</option>
                <option value="PAID">PAID</option>
                <option value="CANCELLED">CANCELLED</option>
                <option value="FAILED">FAILED</option>
              </select>
              <button
                type="button"
                onClick={fetchPayoutBatches}
                className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition"
                title="Muat Ulang"
              >
                <RefreshCw className={`w-4 h-4 ${payoutLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <button
              type="button"
              onClick={handleOpenCreateBatchModal}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Buat Payout Batch Baru
            </button>
          </div>

          {/* Batches Table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Batch / Tanggal</th>
                    <th className="py-3 px-4">Penerima Komisi</th>
                    <th className="py-3 px-4">Rekening Tujuan</th>
                    <th className="py-3 px-4 text-center">Items</th>
                    <th className="py-3 px-4 text-right">Total Nominal</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {payoutLoading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        Memuat data payout batches...
                      </td>
                    </tr>
                  ) : payoutBatches.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        Belum ada payout batch yang dibuat.
                      </td>
                    </tr>
                  ) : (
                    payoutBatches.map(batch => (
                      <tr key={batch.id} className="hover:bg-slate-50/50 transition">
                        <td className="py-3.5 px-4">
                          <div className="font-mono font-bold text-slate-900">
                            #{batch.batchNumber}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {new Date(batch.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900">{batch.recipientSnapshot?.name || "N/A"}</div>
                          <div className="text-xs font-mono text-slate-400">{batch.recipientSnapshot?.recipientId || batch.recipientId || ""}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="text-xs font-medium text-slate-700">
                            {batch.recipientSnapshot?.bankName || ""} - {batch.recipientSnapshot?.accountNumberMasked || ""}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            a.n. {batch.recipientSnapshot?.accountHolderName || ""}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full text-xs font-semibold font-mono">
                            {batch.allocations?.length || 0}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="font-bold text-slate-900">
                            Rp {(batch.totalCommissionAmount || 0).toLocaleString('id-ID')}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            batch.status === 'PAID'
                              ? 'bg-emerald-100 text-emerald-800'
                              : batch.status === 'PROCESSING'
                              ? 'bg-blue-100 text-blue-800'
                              : batch.status === 'PENDING_APPROVAL'
                              ? 'bg-amber-100 text-amber-800'
                              : batch.status === 'NEEDS_REVIEW'
                              ? 'bg-rose-100 text-rose-800 animate-pulse'
                              : batch.status === 'DRAFT'
                              ? 'bg-slate-100 text-slate-700'
                              : 'bg-rose-50 text-rose-600'
                          }`}>
                            {batch.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleViewBatchDetail(batch.id)}
                              className="px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition"
                              title="Lihat Rincian"
                            >
                              <Eye className="w-3.5 h-3.5 inline mr-1" />
                              Detail
                            </button>

                            {batch.status === 'DRAFT' && (
                              <button
                                type="button"
                                onClick={() => handleSubmitBatch(batch.id)}
                                className="px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition"
                                title="Ajukan Persetujuan"
                              >
                                <Send className="w-3.5 h-3.5 inline mr-1" />
                                Submit
                              </button>
                            )}

                            {batch.status === 'PENDING_APPROVAL' && (
                              <button
                                type="button"
                                onClick={() => handleApproveBatch(batch.id)}
                                className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition"
                                title="Setujui Batch"
                              >
                                <Check className="w-3.5 h-3.5 inline mr-1" />
                                Approve
                              </button>
                            )}

                             {batch.status === 'PROCESSING' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleExportInstruction(batch.id)}
                                  className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                                  title="Download Instruksi Transfer CSV"
                                >
                                  <Download className="w-3.5 h-3.5 inline mr-1" />
                                  CSV
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenConfirmPaidModal(batch)}
                                  className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition"
                                  title="Konfirmasi Pelunasan Bank"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />
                                  Paid
                                </button>
                              </>
                            )}

                            {(batch.status === 'DRAFT' || batch.status === 'PENDING_APPROVAL' || batch.status === 'PROCESSING' || batch.status === 'NEEDS_REVIEW') && (
                              <button
                                type="button"
                                onClick={() => handleOpenCancelModal(batch)}
                                className="px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                title="Batalkan Batch"
                              >
                                <Ban className="w-3.5 h-3.5 inline" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: COMMISSION RECORDS (Phase 2 & Phase 3) */}
      {activeTab === 'records' && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari ID Komisi, ID Pesanan, atau Nama/Kode Afiliasi..."
                  value={searchRecord}
                  onChange={e => setSearchRecord(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') fetchRecords(1); }}
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <select
                value={statusFilterRecord}
                onChange={e => setStatusFilterRecord(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
              >
                <option value="ALL">Semua Status</option>
                <option value="PAYABLE">PAYABLE</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>

              <select
                value={methodFilterRecord}
                onChange={e => setMethodFilterRecord(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
              >
                <option value="ALL">Semua Metode</option>
                <option value="PERCENTAGE_OF_SELLING_PRICE">Persentase Harga Jual</option>
                <option value="FIXED_AMOUNT">Nominal Tetap</option>
                <option value="PERCENTAGE_OF_MARGIN">Persentase Margin</option>
              </select>

              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={startDateRecord}
                  onChange={e => setStartDateRecord(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
                  title="Tanggal Mulai"
                />
                <span className="text-slate-400 text-xs">s/d</span>
                <input
                  type="date"
                  value={endDateRecord}
                  onChange={e => setEndDateRecord(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
                  title="Tanggal Akhir"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 self-end lg:self-auto">
              <button
                onClick={handleRunReconciliation}
                disabled={reconciling}
                className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-sm font-semibold transition flex items-center gap-2 disabled:opacity-50"
                title="Periksa kecocokan catatan komisi dengan jurnal pembukuan Buku Besar"
              >
                <BookOpen className="w-4 h-4 text-indigo-600" />
                <span>{reconciling ? 'Memverifikasi...' : 'Audit Rekonsiliasi'}</span>
              </button>

              <button
                onClick={() => fetchRecords(1)}
                disabled={recordLoading}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold transition flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${recordLoading ? 'animate-spin' : ''}`} />
                Filter
              </button>
            </div>
          </div>

          {/* Records Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3.5 px-4">ID Komisi & Tanggal</th>
                    <th className="py-3.5 px-4">ID Pesanan</th>
                    <th className="py-3.5 px-4">Mitra Afiliasi</th>
                    <th className="py-3.5 px-4">Aturan & Metode</th>
                    <th className="py-3.5 px-4 text-right">Harga Jual</th>
                    <th className="py-3.5 px-4 text-right">Nominal Komisi</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4 text-center">Posting Buku Besar</th>
                    <th className="py-3.5 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {recordLoading ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                        Memuat catatan komisi...
                      </td>
                    </tr>
                  ) : records.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <p className="font-semibold text-slate-600">Belum ada catatan komisi yang memenuhi filter</p>
                        <p className="text-xs text-slate-400 mt-1">Komisi otomatis diakrualkan ketika order checkout mitra berhasil berstatus SUCCESS.</p>
                      </td>
                    </tr>
                  ) : (
                    records.map(rec => (
                      <tr key={rec.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4">
                          <span className="font-mono text-xs font-semibold text-slate-900 block truncate max-w-[180px]" title={rec.id}>
                            {rec.id}
                          </span>
                          <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3" />
                            {new Date(rec.earnedAt || rec.createdAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-mono text-xs font-medium text-indigo-600 block">
                            {rec.orderId}
                          </span>
                          {rec.metadata?.invoice && rec.metadata.invoice !== rec.orderId && (
                            <span className="text-[10px] text-slate-400 font-mono block">
                              Inv: {rec.metadata.invoice}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-800">{rec.recipientName}</div>
                          <span className="inline-block px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-mono font-bold mt-0.5">
                            {rec.recipientCode}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-xs font-medium text-slate-800 truncate max-w-[160px]" title={rec.ruleName}>
                            {rec.ruleName}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {rec.calculationMethod === 'PERCENTAGE_OF_SELLING_PRICE' && (
                              <span>{rec.commissionRateSnapshot}% dari Harga Jual</span>
                            )}
                            {rec.calculationMethod === 'FIXED_AMOUNT' && (
                              <span>Nominal Tetap Rp {rec.fixedAmountSnapshot.toLocaleString('id-ID')}</span>
                            )}
                            {rec.calculationMethod === 'PERCENTAGE_OF_MARGIN' && (
                              <span>{rec.commissionRateSnapshot}% dari Margin {rec.baseCostSnapshot !== null ? `(Modal: Rp ${rec.baseCostSnapshot.toLocaleString('id-ID')})` : ''}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-xs text-slate-600">
                          Rp {rec.sellingPriceSnapshot.toLocaleString('id-ID')}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="font-bold text-emerald-600 font-mono text-sm">
                            Rp {rec.commissionAmount.toLocaleString('id-ID')}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full ${
                            rec.status === 'PAYABLE' 
                              ? 'bg-emerald-100 text-emerald-700' 
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {rec.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full font-mono ${
                            rec.ledgerStatus === 'POSTED' 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : rec.ledgerStatus === 'FAILED'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {rec.ledgerStatus || 'PENDING'}
                          </span>
                          {rec.ledgerJournalId && (
                            <span className="block text-[9px] text-slate-400 font-mono mt-0.5 truncate max-w-[110px]" title={rec.ledgerJournalId}>
                              {rec.ledgerJournalId}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => {
                              setSelectedRecord(rec);
                              setRecordModalOpen(true);
                            }}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                            title="Lihat Detail Snapshot Finansial & Buku Besar"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {recordPagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50/50 text-xs text-slate-500">
                <div>
                  Menampilkan halaman <strong>{recordPagination.page}</strong> dari <strong>{recordPagination.totalPages}</strong> (Total {recordPagination.totalRecords} data)
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => fetchRecords(recordPagination.page - 1)}
                    disabled={recordPagination.page <= 1 || recordLoading}
                    className="px-3 py-1.5 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-40 font-medium transition"
                  >
                    Sebelumnya
                  </button>
                  <button
                    onClick={() => fetchRecords(recordPagination.page + 1)}
                    disabled={recordPagination.page >= recordPagination.totalPages || recordLoading}
                    className="px-3 py-1.5 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-40 font-medium transition"
                  >
                    Berikutnya
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: AFFILIATES */}
      {activeTab === 'affiliates' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-80">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari nama atau kode afiliasi..."
                  value={searchRecipient}
                  onChange={e => setSearchRecipient(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <select
                value={statusFilterRecipient}
                onChange={e => setStatusFilterRecipient(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="ALL">Semua Status</option>
                <option value="ACTIVE">Aktif</option>
                <option value="SUSPENDED">Ditangguhkan</option>
                <option value="INACTIVE">Nonaktif</option>
              </select>
            </div>

            <button
              onClick={openCreateRecipientModal}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              Tambah Mitra Afiliasi
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3.5 font-bold">Mitra Afiliasi</th>
                    <th className="px-6 py-3.5 font-bold">Kode Unik</th>
                    <th className="px-6 py-3.5 font-bold">Rekening Payout</th>
                    <th className="px-6 py-3.5 font-bold">Status</th>
                    <th className="px-6 py-3.5 font-bold text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredRecipients.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400 text-sm">
                        Belum ada mitra afiliasi yang terdaftar. Klik "Tambah Mitra Afiliasi" untuk membuat baru.
                      </td>
                    </tr>
                  ) : (
                    filteredRecipients.map(rec => (
                      <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-900">{rec.name}</div>
                          <div className="text-xs text-slate-400 font-mono mt-0.5">{rec.id}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 font-mono font-bold text-xs">
                            {rec.code}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-600">
                          {rec.payoutAccount ? (
                            <div>
                              <span className="font-semibold text-slate-800">{rec.payoutAccount.bankName}</span>
                              <span className="block text-slate-500 font-mono">
                                {rec.payoutAccount.accountNumberMasked || '-'} ({rec.payoutAccount.accountHolderName})
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Belum diatur</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            rec.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-700'
                              : rec.status === 'SUSPENDED'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {rec.status === 'ACTIVE' ? 'Aktif' : rec.status === 'SUSPENDED' ? 'Ditangguhkan' : 'Nonaktif'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => openEditRecipientModal(rec)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition"
                            title="Edit Afiliasi"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: RULES */}
      {activeTab === 'rules' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-80">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari nama aturan komisi..."
                  value={searchRule}
                  onChange={e => setSearchRule(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <select
                value={statusFilterRule}
                onChange={e => setStatusFilterRule(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="ALL">Semua Status</option>
                <option value="ACTIVE">Aktif</option>
                <option value="INACTIVE">Nonaktif</option>
              </select>
            </div>

            <button
              onClick={openCreateRuleModal}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              Buat Aturan Komisi
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3.5 font-bold">Nama Aturan & Prioritas</th>
                    <th className="px-6 py-3.5 font-bold">Metode & Rate</th>
                    <th className="px-6 py-3.5 font-bold">Target Cakupan</th>
                    <th className="px-6 py-3.5 font-bold">Periode Berlaku</th>
                    <th className="px-6 py-3.5 font-bold">Status</th>
                    <th className="px-6 py-3.5 font-bold text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredRules.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-sm">
                        Belum ada aturan komisi yang dibuat. Klik "Buat Aturan Komisi" untuk memulai.
                      </td>
                    </tr>
                  ) : (
                    filteredRules.map(rule => (
                      <tr key={rule.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-900">{rule.name}</div>
                          <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                            <span className="bg-slate-100 px-1.5 py-0.5 rounded font-mono font-bold text-slate-600">
                              Prioritas #{rule.priority}
                            </span>
                            <span className="font-mono">{rule.id}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-indigo-600">
                            {rule.calculationMethod === 'PERCENTAGE_OF_SELLING_PRICE' && `${rule.rate}% dari Harga Jual`}
                            {rule.calculationMethod === 'FIXED_AMOUNT' && `Rp ${rule.rate.toLocaleString('id-ID')} Flat`}
                            {rule.calculationMethod === 'PERCENTAGE_OF_MARGIN' && `${rule.rate}% dari Margin`}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            Min Order: Rp {rule.minOrderAmount.toLocaleString('id-ID')}
                            {rule.maxCommissionAmount && ` · Max: Rp ${rule.maxCommissionAmount.toLocaleString('id-ID')}`}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-600">
                          {rule.recipientId ? (
                            <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-medium">
                              Mitra Spesifik
                            </span>
                          ) : (
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">
                              Semua Afiliasi
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-600 font-mono">
                          <div>Mulai: {rule.effectiveFrom}</div>
                          <div className="text-slate-400">Sampai: {rule.effectiveUntil || 'Selamanya'}</div>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => toggleRuleStatus(rule)}
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold cursor-pointer transition ${
                              rule.status === 'ACTIVE'
                                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {rule.status === 'ACTIVE' ? 'Aktif' : 'Nonaktif'}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => openEditRuleModal(rule)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition"
                            title="Edit Aturan"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CONFIGURATION */}
      {activeTab === 'config' && (
        <form onSubmit={handleSaveConfig} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Konfigurasi Program Komisi</h2>
              <p className="text-xs text-slate-500 mt-0.5">Pengaturan global dan batasan operasional program kemitraan.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={e => setConfig(prev => ({ ...prev, enabled: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              <span className="ml-3 text-sm font-semibold text-slate-700">
                {config.enabled ? 'Program Aktif' : 'Program Nonaktif'}
              </span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-2">
                Metode Kalkulasi Default
              </label>
              <select
                value={config.defaultCalculationMethod}
                onChange={e => setConfig(prev => ({ ...prev, defaultCalculationMethod: e.target.value as any }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="PERCENTAGE_OF_SELLING_PRICE">Persentase dari Harga Jual (% Selling Price)</option>
                <option value="FIXED_AMOUNT">Nominal Tetap per Transaksi (Fixed Amount)</option>
                <option value="PERCENTAGE_OF_MARGIN">Persentase dari Margin Keuntungan (% Margin)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-2">
                Minimum Payout Threshold (Rp)
              </label>
              <input
                type="number"
                step="5000"
                min="0"
                value={config.minimumPayoutThreshold}
                onChange={e => setConfig(prev => ({ ...prev, minimumPayoutThreshold: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <p className="text-xs text-slate-400 mt-1">Batas saldo minimum bagi mitra untuk dapat mengajukan pencairan dana.</p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-2">
                Tipe Mitra yang Didukung (MVP Scope)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 border-2 border-indigo-500 bg-indigo-50/50 rounded-xl flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-900">AFFILIATE</span>
                  <Check className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="p-3 border border-slate-200 bg-slate-50 rounded-xl flex items-center justify-between opacity-60">
                  <span className="text-xs font-medium text-slate-500">RESELLER</span>
                  <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-600 font-semibold">Segera</span>
                </div>
                <div className="p-3 border border-slate-200 bg-slate-50 rounded-xl flex items-center justify-between opacity-60">
                  <span className="text-xs font-medium text-slate-500">AGENT</span>
                  <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-600 font-semibold">Segera</span>
                </div>
                <div className="p-3 border border-slate-200 bg-slate-50 rounded-xl flex items-center justify-between opacity-60">
                  <span className="text-xs font-medium text-slate-500">PARTNER</span>
                  <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-600 font-semibold">Segera</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-sm transition disabled:opacity-50"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Simpan Pengaturan
            </button>
          </div>
        </form>
      )}

      {/* MODAL: RECIPIENT CREATE / EDIT */}
      {recipientModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900 text-base">
                {editingRecipient ? 'Edit Mitra Afiliasi' : 'Tambah Mitra Afiliasi Baru'}
              </h3>
              <button onClick={() => setRecipientModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRecipient} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Nama Mitra / Kreator</label>
                <input
                  type="text"
                  required
                  placeholder="cth. Budi Gaming Channel"
                  value={recName}
                  onChange={e => setRecName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Kode Afiliasi Unik (Alfanumerik)
                </label>
                <input
                  type="text"
                  required
                  placeholder="cth. BUDIGAMING26"
                  value={recCode}
                  onChange={e => setRecCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 uppercase"
                />
                <p className="text-[11px] text-slate-400 mt-1">Kode unik yang digunakan untuk tracking referral checkout.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Status Kemitraan</label>
                <select
                  value={recStatus}
                  onChange={e => setRecStatus(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="ACTIVE">Aktif (ACTIVE)</option>
                  <option value="SUSPENDED">Ditangguhkan (SUSPENDED)</option>
                  <option value="INACTIVE">Nonaktif (INACTIVE)</option>
                </select>
              </div>

              <div className="border-t border-slate-200 pt-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 uppercase">Rekening Payout (Opsional)</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 uppercase font-semibold mb-1">Bank / E-Wallet</label>
                    <input
                      type="text"
                      placeholder="cth. BCA / Mandiri / GoPay"
                      value={recBankName}
                      onChange={e => setRecBankName(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 uppercase font-semibold mb-1">Nomor Rekening</label>
                    <input
                      type="text"
                      placeholder={editingRecipient?.payoutAccount?.accountNumberMasked || "cth. 882019281"}
                      value={recAccountNumber}
                      onChange={e => setRecAccountNumber(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    {editingRecipient?.payoutAccount?.accountNumberMasked && (
                      <p className="text-[10px] text-slate-400 mt-0.5">Tersimpan aman. Kosongkan jika tidak ingin mengubah.</p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 uppercase font-semibold mb-1">Nama Pemilik Rekening</label>
                  <input
                    type="text"
                    placeholder="cth. Budi Santoso"
                    value={recAccountHolder}
                    onChange={e => setRecAccountHolder(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Catatan Internal</label>
                <textarea
                  rows={2}
                  placeholder="Catatan tambahan untuk internal admin..."
                  value={recNotes}
                  onChange={e => setRecNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setRecipientModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Mitra'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RULE CREATE / EDIT */}
      {ruleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900 text-base">
                {editingRule ? 'Edit Aturan Komisi' : 'Buat Aturan Komisi Baru'}
              </h3>
              <button onClick={() => setRuleModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRule} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Nama Aturan</label>
                <input
                  type="text"
                  required
                  placeholder="cth. Komisi Default Afiliasi 2%"
                  value={ruleName}
                  onChange={e => setRuleName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Metode Perhitungan</label>
                  <select
                    value={ruleMethod}
                    onChange={e => setRuleMethod(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="PERCENTAGE_OF_SELLING_PRICE">% Harga Jual</option>
                    <option value="FIXED_AMOUNT">Nominal Tetap (Flat Rp)</option>
                    <option value="PERCENTAGE_OF_MARGIN">% Margin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    {ruleMethod === 'FIXED_AMOUNT' ? 'Nominal (Rp)' : 'Persentase (%)'}
                  </label>
                  <input
                    type="number"
                    step={ruleMethod === 'FIXED_AMOUNT' ? '500' : '0.1'}
                    min="0"
                    max={ruleMethod === 'FIXED_AMOUNT' ? undefined : 100}
                    required
                    value={ruleRate}
                    onChange={e => setRuleRate(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Prioritas (1 = Tertinggi)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={rulePriority}
                    onChange={e => setRulePriority(parseInt(e.target.value) || 10)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Target Mitra</label>
                  <select
                    value={ruleRecipientId}
                    onChange={e => setRuleRecipientId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="">Semua Mitra Afiliasi</option>
                    {recipients.map(r => (
                      <option key={r.id} value={r.id}>{r.name} ({r.code})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Min. Order (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    value={ruleMinOrder}
                    onChange={e => setRuleMinOrder(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Maks. Komisi (Rp, Opsional)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Tanpa Batas"
                    value={ruleMaxCommission}
                    onChange={e => setRuleMaxCommission(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Mulai Berlaku</label>
                  <input
                    type="date"
                    required
                    value={ruleEffectiveFrom}
                    onChange={e => setRuleEffectiveFrom(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Berakhir (Opsional)</label>
                  <input
                    type="date"
                    value={ruleEffectiveUntil}
                    onChange={e => setRuleEffectiveUntil(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Status Aturan</label>
                <select
                  value={ruleStatus}
                  onChange={e => setRuleStatus(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="ACTIVE">Aktif (ACTIVE)</option>
                  <option value="INACTIVE">Nonaktif (INACTIVE)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setRuleModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Aturan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL MODAL: COMMISSION RECORD (Phase 2) */}
      {recordModalOpen && selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                  Detail Snapshot Finansial Komisi
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  ID: {selectedRecord.id}
                </p>
              </div>
              <button
                onClick={() => {
                  setRecordModalOpen(false);
                  setSelectedRecord(null);
                }}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Top Stat Banner */}
            <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-5 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Nominal Akrual Komisi</span>
                <div className="text-3xl font-black text-emerald-950 font-mono mt-1">
                  Rp {selectedRecord.commissionAmount.toLocaleString('id-ID')}
                </div>
                <div className="text-xs text-emerald-700 mt-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Diakrualkan: {new Date(selectedRecord.earnedAt || selectedRecord.createdAt).toLocaleString('id-ID')}
                </div>
              </div>
              <div className="text-right">
                <span className={`px-3 py-1.5 text-xs font-black rounded-full uppercase tracking-wider ${
                  selectedRecord.status === 'PAYABLE'
                    ? 'bg-emerald-200 text-emerald-900'
                    : 'bg-slate-200 text-slate-800'
                }`}>
                  {selectedRecord.status}
                </span>
                <div className="text-[11px] text-emerald-800 mt-2 font-medium">
                  {selectedRecord.recipientType}
                </div>
              </div>
            </div>

            {/* Two-Column Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Order & Affiliate Info */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-indigo-600" />
                  Pesanan & Mitra Afiliasi
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-500">ID Pesanan:</span>
                    <span className="font-mono font-semibold text-indigo-600">{selectedRecord.orderId}</span>
                  </div>
                  {selectedRecord.metadata?.invoice && (
                    <div className="flex justify-between py-1 border-b border-slate-200">
                      <span className="text-slate-500">Nomor Invoice:</span>
                      <span className="font-mono font-medium text-slate-800">{selectedRecord.metadata.invoice}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-500">Nama Mitra:</span>
                    <span className="font-semibold text-slate-900">{selectedRecord.recipientName}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-500">Kode Afiliasi:</span>
                    <span className="font-mono font-bold text-slate-800 px-1.5 py-0.5 bg-slate-200 rounded">{selectedRecord.recipientCode}</span>
                  </div>
                  {selectedRecord.metadata?.customerId && (
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">Customer ID:</span>
                      <span className="font-mono text-slate-700">{selectedRecord.metadata.customerId}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Rule & Method Info */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-indigo-600" />
                  Aturan & Rumus Komisi
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-500">Nama Aturan:</span>
                    <span className="font-semibold text-slate-900 truncate max-w-[150px]">{selectedRecord.ruleName}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-500">Metode:</span>
                    <span className="font-semibold text-indigo-700">
                      {selectedRecord.calculationMethod === 'PERCENTAGE_OF_SELLING_PRICE' && 'Persentase Harga Jual'}
                      {selectedRecord.calculationMethod === 'FIXED_AMOUNT' && 'Nominal Tetap'}
                      {selectedRecord.calculationMethod === 'PERCENTAGE_OF_MARGIN' && 'Persentase Margin'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-500">Rate Snapshot:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {selectedRecord.calculationMethod === 'FIXED_AMOUNT' 
                        ? `Rp ${selectedRecord.fixedAmountSnapshot.toLocaleString('id-ID')}`
                        : `${selectedRecord.commissionRateSnapshot}%`
                      }
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">ID Aturan Snapshot:</span>
                    <span className="font-mono text-[10px] text-slate-600 truncate max-w-[140px]">{selectedRecord.ruleId}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Financial Calculation Breakdown */}
            <div className="bg-slate-900 text-white rounded-2xl p-5 space-y-3">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Rincian Kalkulasi Deterministik</span>
                <span className="text-[10px] text-emerald-400 font-mono">Immutable Snapshot</span>
              </h4>
              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between text-slate-300">
                  <span>Harga Jual Pesanan (Selling Price)</span>
                  <span>Rp {selectedRecord.sellingPriceSnapshot.toLocaleString('id-ID')}</span>
                </div>
                {selectedRecord.baseCostSnapshot !== null && (
                  <div className="flex justify-between text-slate-400">
                    <span>Modal Dasar / Base Cost Provider</span>
                    <span>- Rp {selectedRecord.baseCostSnapshot.toLocaleString('id-ID')}</span>
                  </div>
                )}
                {selectedRecord.baseCostSnapshot !== null && (
                  <div className="flex justify-between text-slate-300 border-t border-slate-800 pt-1">
                    <span>Margin Kotor (Selling - Base Cost)</span>
                    <span>Rp {Math.max(0, selectedRecord.sellingPriceSnapshot - selectedRecord.baseCostSnapshot).toLocaleString('id-ID')}</span>
                  </div>
                )}
                <div className="flex justify-between text-emerald-400 border-t border-slate-800 pt-2 text-sm font-bold">
                  <span>Komisi Diperoleh (Integer IDR)</span>
                  <span>Rp {selectedRecord.commissionAmount.toLocaleString('id-ID')}</span>
                </div>
              </div>
            </div>

            {/* Financial Immutability Notice */}
            <div className="bg-slate-100 rounded-xl p-3 text-[11px] text-slate-600 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
              <span>
                Catatan ini terkunci secara permanen. Perubahan aturan, rate persentase, atau konfigurasi harga di masa mendatang tidak akan mengubah nominal yang telah diakrualkan pada pesanan ini.
              </span>
            </div>

            {/* Phase 4: Refund & Clawback History (If any) */}
            {((selectedRecord.cumulativeReversedAmount || 0) > 0 || selectedRecord.status === 'CANCELLED' || selectedRecord.cancelReason) && (
              <div className="bg-rose-50/60 border border-rose-200/80 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-rose-800 uppercase tracking-wider flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    Pembalikan Komisi (Refund Clawback - Phase 4)
                  </h4>
                  <span className="px-2.5 py-0.5 bg-rose-200 text-rose-900 rounded-full text-xs font-bold font-mono">
                    {selectedRecord.cancelReason || (selectedRecord.status === 'CANCELLED' ? 'CANCELLED_BY_REFUND' : 'PARTIAL_CLAWBACK')}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="bg-white p-3 rounded-xl border border-rose-100">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Dibalikkan</span>
                    <span className="font-mono font-bold text-rose-700 text-sm">
                      Rp {(selectedRecord.cumulativeReversedAmount || 0).toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-rose-100">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Sisa Komisi Valid</span>
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      Rp {(selectedRecord.remainingPayableAmount !== undefined ? selectedRecord.remainingPayableAmount : (selectedRecord.status === 'CANCELLED' ? 0 : selectedRecord.commissionAmount)).toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-rose-100">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Waktu Pembalikan</span>
                    <span className="text-slate-700 text-[11px]">
                      {selectedRecord.reversedAt ? new Date(selectedRecord.reversedAt).toLocaleString('id-ID') : '-'}
                    </span>
                  </div>
                </div>

                {Array.isArray(selectedRecord.reversalSnapshots) && selectedRecord.reversalSnapshots.length > 0 && (
                  <div className="bg-white p-3 rounded-xl border border-rose-100 space-y-2">
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Riwayat Snapshot Pembalikan Refund</span>
                    <div className="space-y-1.5 font-mono text-xs">
                      {selectedRecord.reversalSnapshots.map((snap: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center py-1 border-b border-slate-100 last:border-0">
                          <div>
                            <span className="font-semibold text-slate-800">Refund Key: {snap.refundKey}</span>
                            <span className="text-slate-400 text-[10px] ml-2">
                              {snap.reversedAt ? new Date(snap.reversedAt).toLocaleDateString('id-ID') : ''}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-rose-600">- Rp {(snap.deltaReversedCommission || 0).toLocaleString('id-ID')}</span>
                            {snap.ledgerJournalId && (
                              <div className="text-[10px] text-slate-400">{snap.ledgerJournalId}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Double-Entry Ledger Posting Status (Phase 3) */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-indigo-600" />
                  Integrasi Buku Besar (Double-Entry Ledger)
                </h4>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold font-mono ${
                  selectedRecord.ledgerStatus === 'POSTED'
                    ? 'bg-emerald-100 text-emerald-800'
                    : selectedRecord.ledgerStatus === 'FAILED'
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {selectedRecord.ledgerStatus || 'PENDING'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Jurnal Entry ID</span>
                  <span className="font-mono font-semibold text-slate-800 break-all text-[11px]">
                    {selectedRecord.ledgerJournalId || `ledger_commission_accrual_${selectedRecord.id}`}
                  </span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Waktu Posting</span>
                  <span className="text-slate-700">
                    {selectedRecord.ledgerPostedAt 
                      ? new Date(selectedRecord.ledgerPostedAt).toLocaleString('id-ID')
                      : 'Otomatis tersinkronisasi saat PAYABLE'}
                  </span>
                </div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1.5 font-mono text-xs">
                <div className="flex justify-between items-center text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    Debit: 5200_COMMISSION_EXPENSE (Beban Komisi)
                  </span>
                  <span className="font-bold text-slate-900">
                    Rp {selectedRecord.commissionAmount.toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-600 border-t border-slate-100 pt-1.5">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    Kredit: 2100_COMMISSION_PAYABLE (Utang Komisi)
                  </span>
                  <span className="font-bold text-slate-900">
                    Rp {selectedRecord.commissionAmount.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  setRecordModalOpen(false);
                  setSelectedRecord(null);
                }}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECONCILIATION REPORT MODAL (Phase 3) */}
      {reconcileModalOpen && reconciliationReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-600" />
                  Hasil Audit Rekonsiliasi Komisi & Buku Besar
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Verifikasi integritas double-entry antara commissionRecords dan ledgerJournalEntries.
                </p>
              </div>
              <button
                onClick={() => setReconcileModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Health Status Banner */}
            <div className={`rounded-2xl p-5 border flex items-center justify-between ${
              reconciliationReport.status === 'HEALTHY'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                : 'bg-amber-50 border-amber-200 text-amber-950'
            }`}>
              <div className="flex items-center gap-3">
                {reconciliationReport.status === 'HEALTHY' ? (
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="w-8 h-8 text-amber-600 flex-shrink-0" />
                )}
                <div>
                  <div className="font-bold text-base">
                    {reconciliationReport.status === 'HEALTHY'
                      ? 'Integritas Buku Besar Sempurna (HEALTHY)'
                      : 'Ditemukan Diskrepansi Pembukuan'}
                  </div>
                  <p className="text-xs opacity-80 mt-0.5">
                    {reconciliationReport.status === 'HEALTHY'
                      ? 'Seluruh komisi PAYABLE dan jurnal akrual Buku Besar terverifikasi 100% seimbang.'
                      : `${reconciliationReport.discrepanciesCount} anomali pembukuan terdeteksi dan membutuhkan perhatian admin.`}
                  </p>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                reconciliationReport.status === 'HEALTHY'
                  ? 'bg-emerald-200 text-emerald-900'
                  : 'bg-amber-200 text-amber-900'
              }`}>
                {reconciliationReport.status}
              </span>
            </div>

            {/* Summary Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Komisi PAYABLE</span>
                <div className="text-xl font-black text-slate-900 mt-0.5">{reconciliationReport.totalPayableCommissions}</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Jurnal Akrual</span>
                <div className="text-xl font-black text-slate-900 mt-0.5">{reconciliationReport.totalLedgerAccruals}</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Jurnal Reversal</span>
                <div className="text-xl font-black text-slate-900 mt-0.5">{reconciliationReport.totalLedgerReversals || 0}</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Cocok 1:1</span>
                <div className="text-xl font-black text-emerald-600 mt-0.5">{reconciliationReport.matchedCount}</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Diskrepansi</span>
                <div className={`text-xl font-black mt-0.5 ${reconciliationReport.discrepanciesCount === 0 ? 'text-slate-400' : 'text-rose-600'}`}>
                  {reconciliationReport.discrepanciesCount}
                </div>
              </div>
            </div>

            {/* Discrepancies List (If any) */}
            {reconciliationReport.discrepanciesCount > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Daftar Diskrepansi Terdeteksi
                </h4>
                <div className="space-y-2 max-h-[220px] overflow-y-auto">
                  {reconciliationReport.discrepancies.map((disc: any, idx: number) => (
                    <div key={idx} className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-rose-800">{disc.caseType}</span>
                        <span className="px-2 py-0.5 bg-rose-200 text-rose-900 rounded text-[10px] font-bold">{disc.severity}</span>
                      </div>
                      <p className="text-slate-700">{disc.message}</p>
                      {disc.commissionId && (
                        <div className="font-mono text-[10px] text-slate-500">Commission ID: {disc.commissionId}</div>
                      )}
                      {disc.ledgerJournalId && (
                        <div className="font-mono text-[10px] text-slate-500">Ledger ID: {disc.ledgerJournalId}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setReconcileModalOpen(false)}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* PHASE 5: CREATE PAYOUT BATCH MODAL                                   */}
      {/* ==================================================================== */}
      {createBatchModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-indigo-600" />
                  Buat Payout Batch Baru
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  1 Payout Batch = 1 Mitra Afiliasi. Hanya komisi PAYABLE & UNPAID yang dapat dialokasikan.
                </p>
              </div>
              <button
                onClick={() => setCreateBatchModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBatchSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Pilih Mitra Penerima (Recipient)
                </label>
                <select
                  value={selectedRecipientForBatch}
                  onChange={e => handleSelectRecipientForBatch(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
                  required
                >
                  <option value="">-- Pilih Mitra Afiliasi --</option>
                  {recipients
                    .filter(r => r.status === 'ACTIVE')
                    .map(rec => (
                      <option key={rec.id} value={rec.id}>
                        {rec.name} ({rec.code}) - {rec.payoutAccount?.bankName || 'No Bank'} {rec.payoutAccount?.accountNumber ? `(${rec.payoutAccount.accountNumber})` : ''}
                      </option>
                    ))}
                </select>
              </div>

              {selectedRecipientForBatch && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Komisi Tersedia ({unpaidCommissionsForRecipient.length})
                    </label>
                    <span className="text-xs text-slate-500">
                      Terpilih: {selectedCommissionIds.length} komisi
                    </span>
                  </div>

                  {unpaidCommissionsForRecipient.length === 0 ? (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500">
                      Tidak ada komisi PAYABLE yang siap dicairkan untuk mitra ini.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[220px] overflow-y-auto border border-slate-200 rounded-xl p-2 bg-slate-50/50">
                      {unpaidCommissionsForRecipient.map(comm => (
                        <div
                          key={comm.id}
                          onClick={() => handleToggleCommissionSelection(comm.id)}
                          className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between text-xs ${
                            selectedCommissionIds.includes(comm.id)
                              ? 'bg-indigo-50/80 border-indigo-200 text-indigo-950'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={selectedCommissionIds.includes(comm.id)}
                              onChange={() => {}} // Handled by div click
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <div>
                              <div className="font-mono font-semibold">Order: #{comm.orderId.slice(-8)}</div>
                              <div className="text-[10px] text-slate-400">
                                {new Date(comm.createdAt).toLocaleDateString('id-ID')}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-slate-900">
                              Rp {(comm.remainingPayableAmount || comm.commissionAmount).toLocaleString('id-ID')}
                            </div>
                            <div className="text-[10px] text-emerald-600 font-medium">PAYABLE</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Summary & Threshold */}
                  {selectedCommissionIds.length > 0 && (
                    <div className="p-3.5 bg-slate-900 text-white rounded-xl space-y-2">
                      <div className="flex justify-between text-xs text-slate-300">
                        <span>Total Nominal Terpilih:</span>
                        <span className="text-sm font-bold text-emerald-400 font-mono">
                          Rp {unpaidCommissionsForRecipient
                            .filter(c => selectedCommissionIds.includes(c.id))
                            .reduce((sum, c) => sum + (c.remainingPayableAmount || c.commissionAmount), 0)
                            .toLocaleString('id-ID')}
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-400 border-t border-slate-800 pt-1.5">
                        <span>Ambang Batas Minimum Payout:</span>
                        <span>Rp {(config.minimumPayoutThreshold || 50000).toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                  )}

                  {/* Override Threshold Checkbox */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={overrideThreshold}
                        onChange={e => setOverrideThreshold(e.target.checked)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="font-semibold">Bypass / Override Ambang Batas Minimum</span>
                    </label>
                    {overrideThreshold && (
                      <input
                        type="text"
                        placeholder="Alasan override ambang batas (wajib)..."
                        value={overrideReason}
                        onChange={e => setOverrideReason(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        required={overrideThreshold}
                      />
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCreateBatchModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={creatingBatch || !selectedRecipientForBatch || selectedCommissionIds.length === 0}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50 flex items-center gap-2"
                >
                  {creatingBatch ? 'Membuat Batch...' : 'Buat Batch (DRAFT)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* PHASE 5: BATCH DETAIL MODAL                                          */}
      {/* ==================================================================== */}
      {batchDetailModalOpen && selectedBatch && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-slate-900 font-mono">
                    Batch #{selectedBatch.batchNumber}
                  </h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    selectedBatch.status === 'PAID'
                      ? 'bg-emerald-100 text-emerald-800'
                      : selectedBatch.status === 'PROCESSING'
                      ? 'bg-blue-100 text-blue-800'
                      : selectedBatch.status === 'PENDING_APPROVAL'
                      ? 'bg-amber-100 text-amber-800'
                      : selectedBatch.status === 'NEEDS_REVIEW'
                      ? 'bg-rose-100 text-rose-800 animate-pulse'
                      : 'bg-slate-100 text-slate-700'
                  }`}>
                    {selectedBatch.status}
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono mt-0.5">ID: {selectedBatch.id}</p>
              </div>
              <button
                onClick={() => setBatchDetailModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Recipient & Transfer Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Mitra Afiliasi</span>
                <div className="font-semibold text-slate-900">{selectedBatch.recipientSnapshot?.name || "N/A"}</div>
                <div className="font-mono text-slate-500">{selectedBatch.recipientSnapshot?.recipientId || selectedBatch.recipientId || ""}</div>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Rekening Tujuan</span>
                <div className="font-semibold text-slate-900">
                  {selectedBatch.recipientSnapshot?.bankName || ""} - {selectedBatch.recipientSnapshot?.accountNumberMasked || ""}
                </div>
                <div className="text-slate-500">a.n. {selectedBatch.recipientSnapshot?.accountHolderName || ""}</div>
              </div>
            </div>

            {/* Amount & Items Card */}
            <div className="bg-slate-900 text-white rounded-2xl p-4 space-y-2 text-xs font-mono">
              <div className="flex justify-between text-slate-300">
                <span>Total Nominal Komisi:</span>
                <span className="text-base font-bold text-emerald-400">
                  Rp {(selectedBatch.totalCommissionAmount || 0).toLocaleString('id-ID')}
                </span>
              </div>
              <div className="flex justify-between text-slate-400 border-t border-slate-800 pt-2">
                <span>Jumlah Catatan Komisi (Items):</span>
                <span>{selectedBatch.allocations?.length || 0} records</span>
              </div>
              {selectedBatch.transferReference && (
                <div className="flex justify-between text-slate-300 border-t border-slate-800 pt-2">
                  <span>Ref Transfer Bank:</span>
                  <span className="font-bold text-slate-100">{selectedBatch.transferReference}</span>
                </div>
              )}
              {selectedBatch.ledgerJournalId && (
                <div className="flex justify-between text-indigo-300 border-t border-slate-800 pt-2">
                  <span>Jurnal Buku Besar:</span>
                  <span className="font-mono">{selectedBatch.ledgerJournalId}</span>
                </div>
              )}
            </div>

            {/* Review Note / Revalidation Error Banner (if NEEDS_REVIEW) */}
            {selectedBatch.status === 'NEEDS_REVIEW' && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-rose-800">
                  <AlertTriangle className="w-4 h-4" />
                  Perhatian: Batch Membutuhkan Peninjauan Ulang
                </div>
                <p className="text-slate-700">
                  {selectedBatch.reviewReason || 'Nominal komisi telah disesuaikan akibat refund/clawback. Batalkan batch ini untuk mengembalikan alokasi dan buat batch baru.'}
                </p>
              </div>
            )}

            {/* Commissions List in this batch */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Catatan Komisi Terkunci dalam Batch ({batchCommissions.length})
              </h4>
              <div className="space-y-2 max-h-[200px] overflow-y-auto border border-slate-200 rounded-xl p-2 bg-slate-50/50">
                {batchCommissions.map(comm => (
                  <div key={comm.id} className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <div className="font-mono font-semibold text-slate-900">ID: {comm.id}</div>
                      <div className="text-[10px] text-slate-400">Pesanan: #{comm.orderId.slice(-8)}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-slate-900">
                        Rp {comm.commissionAmount.toLocaleString('id-ID')}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {comm.payoutStatus || 'UNPAID'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setBatchDetailModalOpen(false)}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* PHASE 5: CONFIRM PAID MODAL                                          */}
      {/* ==================================================================== */}
      {confirmPaidModalOpen && batchToConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  Konfirmasi Pelunasan Transfer
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Batch #{batchToConfirm.batchNumber} · Rp {(batchToConfirm.totalCommissionAmount || 0).toLocaleString('id-ID')}
                </p>
              </div>
              <button
                onClick={() => setConfirmPaidModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmPaidSubmit} className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-xs text-emerald-950 space-y-1">
                <p className="font-semibold">Konfirmasi Pelunasan Manual Bank Transfer:</p>
                <p className="text-[11px] leading-relaxed">
                  Setelah disimpan, sistem akan menandai komisi sebagai <strong>PAID</strong> dan membukukan pelunasan ke General Ledger (Debit 2100_COMMISSION_PAYABLE / Kredit 1200_BANK_PRIMARY).
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nomor Referensi Transfer Bank (Wajib)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: TRF-BCA-20260905-00123"
                  value={transferReference}
                  onChange={e => setTransferReference(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Catatan / Bukti Referensi (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Slip mutasi rekening koran halaman 3"
                  value={proofReference}
                  onChange={e => setProofReference(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setConfirmPaidModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={confirmingPaid || !transferReference.trim()}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50"
                >
                  {confirmingPaid ? 'Menyimpan & Menjurnal...' : 'Konfirmasi Pelunasan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* PHASE 5: CANCEL BATCH MODAL                                          */}
      {/* ==================================================================== */}
      {cancelModalOpen && batchToCancel && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-black text-rose-600 flex items-center gap-2">
                  <Ban className="w-5 h-5" />
                  Batalkan Payout Batch
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Batch #{batchToCancel.batchNumber} · Status saat ini: {batchToCancel.status}
                </p>
              </div>
              <button
                onClick={() => setCancelModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCancelSubmit} className="space-y-4">
              <p className="text-xs text-slate-600">
                Membatalkan batch ini akan melepaskan seluruh komisi yang dialokasikan kembali menjadi status <strong>UNPAID</strong> sehingga dapat dialokasikan pada batch berikutnya.
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Alasan Pembatalan (Wajib)
                </label>
                <textarea
                  rows={3}
                  placeholder="Masukkan alasan pembatalan batch..."
                  value={cancellationReason}
                  onChange={e => setCancellationReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCancelModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  disabled={cancellingBatch || !cancellationReason.trim()}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50"
                >
                  {cancellingBatch ? 'Membatalkan...' : 'Konfirmasi Batalkan Batch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
