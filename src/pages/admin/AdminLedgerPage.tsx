import React, { useState, useEffect } from 'react';
import { 
  BookOpen, Search, Filter, Download, Eye, Calendar, 
  ArrowUpRight, ArrowDownRight, RefreshCw, Layers, ShieldCheck, 
  CheckCircle, AlertCircle, FileText
} from 'lucide-react';
import { useAuthStore } from '../../store/auth-store';
import { LEDGER_ACCOUNT_NAMES } from '../../types/ledger';

interface LedgerEntry {
  id: string;
  idempotencyKey: string;
  eventType: string;
  source: {
    collection: string;
    documentId: string;
    eventId?: string;
  };
  lineItems: Array<{
    accountId: string;
    accountName: string;
    debit: number;
    credit: number;
  }>;
  totalAmount: number;
  currency: 'IDR';
  reversalOf?: string | null;
  createdBy: string;
  createdAt: string;
  metadata?: Record<string, any>;
}

interface LedgerOverview {
  totalEntries: number;
  totalDebit: number;
  totalCredit: number;
  accountSummary: Record<string, { debit: number; credit: number; net: number; name: string }>;
}

export function AdminLedgerPage() {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<LedgerOverview | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<LedgerEntry | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Filters & Pagination
  const [eventType, setEventType] = useState('ALL');
  const [accountFilter, setAccountFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const { user } = useAuthStore();

  const fetchOverview = async () => {
    try {
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch('/api/admin/ledger/overview', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setOverview(data.data);
      }
    } catch (e) {
      console.error("Failed to fetch ledger overview", e);
    }
  };

  const fetchEntries = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const token = await (user as any)?.getIdToken?.();
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '25',
        eventType,
        account: accountFilter,
        search,
        startDate,
        endDate
      });

      const res = await fetch(`/api/admin/ledger/entries?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Failed to fetch ledger entries');

      setEntries(data.data.entries);
      setTotalPages(data.data.pagination.totalPages);
    } catch (error: any) {
      setErrorMsg(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, [user]);

  useEffect(() => {
    fetchEntries();
  }, [user, page, eventType, accountFilter, startDate, endDate]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchEntries();
  };

  const handleExport = async () => {
    try {
      const token = await (user as any)?.getIdToken?.();
      const res = await fetch('/api/admin/ledger/export', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to export CSV');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ledger_export_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e: any) {
      alert(e.message || 'Export failed');
    }
  };

  const formatIDR = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
  };

  const getEventTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      PAYMENT_RECEIVED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      FULFILLMENT_SUCCESS: 'bg-blue-100 text-blue-800 border-blue-200',
      REFUND_EXECUTED: 'bg-amber-100 text-amber-800 border-amber-200',
      SETTLEMENT_CLOSED: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      SETTLEMENT_ADJUSTMENT: 'bg-purple-100 text-purple-800 border-purple-200',
      MANUAL_REVERSAL: 'bg-rose-100 text-rose-800 border-rose-200',
      COMMISSION_ACCRUAL: 'bg-teal-100 text-teal-800 border-teal-200',
    };
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${colors[type] || 'bg-slate-100 text-slate-800 border-slate-200'}`}>
        {type}
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="ui-page-title text-slate-900 flex items-center gap-2">
            <BookOpen className="w-7 h-7 text-indigo-600" />
            General Ledger Control Center
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Immutable, append-only double-entry accounting audit trail for iStore financial transactions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { fetchOverview(); fetchEntries(); }}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium shadow-sm transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium">
          {errorMsg}
        </div>
      )}

      {/* Ledger Overview Cards */}
      {overview && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-slate-500">Total Journal Entries</span>
              <span className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                <Layers className="w-5 h-5" />
              </span>
            </div>
            <div className="text-3xl font-bold text-slate-900">{overview.totalEntries.toLocaleString()}</div>
            <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> Append-only cryptographic assurance
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-slate-500">Total Recorded Debits</span>
              <span className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                <ArrowDownRight className="w-5 h-5" />
              </span>
            </div>
            <div className="text-3xl font-bold text-emerald-600">{formatIDR(overview.totalDebit)}</div>
            <p className="text-xs text-slate-500 mt-2">Balanced with total credits</p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-slate-500">Total Recorded Credits</span>
              <span className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                <ArrowUpRight className="w-5 h-5" />
              </span>
            </div>
            <div className="text-3xl font-bold text-blue-600">{formatIDR(overview.totalCredit)}</div>
            <p className="text-xs text-slate-500 mt-2">Double-entry verified (Debit = Credit)</p>
          </div>
        </div>
      )}

      {/* Account Summary Matrix */}
      {overview?.accountSummary && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-slate-400" />
            Chart of Accounts Summary
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(overview.accountSummary).map(([accId, acc]: [string, any]) => (
              <div key={accId} className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-mono font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                    {accId}
                  </span>
                  <h4 className="font-medium text-sm text-slate-800 mt-2">{acc.name}</h4>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-200 flex justify-between text-xs">
                  <div>
                    <span className="text-slate-400 block">Net Balance</span>
                    <span className="font-bold text-slate-900 font-mono">{formatIDR(acc.net)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block">Dr / Cr</span>
                    <span className="text-slate-600 font-mono">{formatIDR(acc.debit)} / {formatIDR(acc.credit)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Search ID / Reference</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="ID / Order / Doc ID..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Event Type</label>
            <select
              value={eventType}
              onChange={e => { setEventType(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <option value="ALL">All Event Types</option>
              <option value="PAYMENT_RECEIVED">PAYMENT_RECEIVED</option>
              <option value="FULFILLMENT_SUCCESS">FULFILLMENT_SUCCESS</option>
              <option value="REFUND_EXECUTED">REFUND_EXECUTED</option>
              <option value="SETTLEMENT_CLOSED">SETTLEMENT_CLOSED</option>
              <option value="SETTLEMENT_ADJUSTMENT">SETTLEMENT_ADJUSTMENT</option>
              <option value="MANUAL_REVERSAL">MANUAL_REVERSAL</option>
              <option value="COMMISSION_ACCRUAL">COMMISSION_ACCRUAL</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Account Filter</label>
            <select
              value={accountFilter}
              onChange={e => { setAccountFilter(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <option value="ALL">All Accounts</option>
              {Object.entries(LEDGER_ACCOUNT_NAMES).map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={e => { setStartDate(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={e => { setEndDate(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>
        </form>
      </div>

      {/* Journal Entries Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
          <h3 className="font-semibold text-slate-900">Journal Entries</h3>
          <span className="text-xs text-slate-500 font-medium">Page {page} of {totalPages}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 bg-slate-50 uppercase border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 font-medium">Timestamp</th>
                <th className="px-6 py-3 font-medium">Event Type</th>
                <th className="px-6 py-3 font-medium">Source Document</th>
                <th className="px-6 py-3 font-medium text-right">Total Amount</th>
                <th className="px-6 py-3 font-medium">Idempotency Key</th>
                <th className="px-6 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-xs text-slate-600 font-medium">
                    {new Date(entry.createdAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    {getEventTypeBadge(entry.eventType)}
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-slate-700">
                    <span className="text-slate-400 block text-[10px]">{entry.source?.collection}</span>
                    {entry.source?.documentId}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-slate-900">
                    {formatIDR(entry.totalAmount)}
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-slate-500 truncate max-w-[180px]">
                    {entry.idempotencyKey}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => setSelectedEntry(entry)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg text-xs font-medium transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View Lines
                    </button>
                  </td>
                </tr>
              ))}
              {entries.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    No journal entries found matching criteria.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" />
                    Loading journal entries...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
          <button
            onClick={() => setPage(p => Math.max(p - 1, 1))}
            disabled={page === 1 || loading}
            className="px-4 py-2 border border-slate-300 bg-white rounded-xl text-sm font-medium text-slate-700 disabled:opacity-50 hover:bg-slate-50"
          >
            Previous
          </button>
          <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(p + 1, totalPages))}
            disabled={page >= totalPages || loading}
            className="px-4 py-2 border border-slate-300 bg-white rounded-xl text-sm font-medium text-slate-700 disabled:opacity-50 hover:bg-slate-50"
          >
            Next
          </button>
        </div>
      </div>

      {/* Journal Detail Modal */}
      {selectedEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-600" />
                  Journal Entry Details
                </h3>
                <p className="text-xs font-mono text-slate-500 mt-0.5">{selectedEntry.id}</p>
              </div>
              <button onClick={() => setSelectedEntry(null)} className="text-slate-400 hover:text-slate-600 text-lg">
                &times;
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 text-xs block">Event Type</span>
                  <div className="mt-1">{getEventTypeBadge(selectedEntry.eventType)}</div>
                </div>
                <div>
                  <span className="text-slate-400 text-xs block">Timestamp</span>
                  <span className="font-medium text-slate-800 text-xs">{new Date(selectedEntry.createdAt).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-xs block">Created By</span>
                  <span className="font-mono text-slate-800 text-xs">{selectedEntry.createdBy}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-xs block">Total Amount</span>
                  <span className="font-bold text-slate-955 text-sm">{formatIDR(selectedEntry.totalAmount)}</span>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-slate-900 mb-3 text-sm flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  Double-Entry Line Items (Balanced Dr = Cr)
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-xs text-slate-500 uppercase border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3">Account Code & Name</th>
                        <th className="px-4 py-3 text-right">Debit (IDR)</th>
                        <th className="px-4 py-3 text-right">Credit (IDR)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-mono text-xs">
                      {selectedEntry.lineItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-slate-900 font-sans">
                            <span className="font-semibold text-indigo-600 mr-2">{item.accountId}</span>
                            <span>{item.accountName}</span>
                          </td>
                          <td className="px-4 py-3 text-right text-emerald-600 font-bold">
                            {item.debit > 0 ? formatIDR(item.debit) : '-'}
                          </td>
                          <td className="px-4 py-3 text-right text-blue-600 font-bold">
                            {item.credit > 0 ? formatIDR(item.credit) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {selectedEntry.source && (
                <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                  <h4 className="font-semibold text-indigo-900 text-xs uppercase tracking-wider mb-2">Source Traceability Reference</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div><span className="text-slate-500">Collection:</span> {selectedEntry.source.collection}</div>
                    <div><span className="text-slate-500">Document ID:</span> {selectedEntry.source.documentId}</div>
                    <div className="col-span-2"><span className="text-slate-500">Idempotency Key:</span> {selectedEntry.idempotencyKey}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setSelectedEntry(null)}
                className="px-5 py-2 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
