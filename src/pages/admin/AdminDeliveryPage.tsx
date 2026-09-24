import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/auth-store';
import { Truck, Search, Eye, AlertCircle, CheckCircle, Clock, XCircle } from 'lucide-react';
import { motion } from 'motion/react';

export default function AdminDeliveryPage() {
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  
  const [selectedDelivery, setSelectedDelivery] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const { user } = useAuthStore();

  useEffect(() => {
    fetchDeliveries();
  }, []);

  const fetchDeliveries = async () => {
    try {
      setLoading(true);
      const token = await user?.getIdToken();
      const res = await fetch('/api/admin/deliveries', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch deliveries');
      const data = await res.json();
      setDeliveries(data.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchDeliveryDetail = async (id: string) => {
    try {
      setDetailLoading(true);
      const token = await user?.getIdToken();
      const res = await fetch(`/api/admin/deliveries/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch delivery detail');
      const data = await res.json();
      setSelectedDelivery(data.data);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setDetailLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'DELIVERED': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'READY': return <CheckCircle className="w-4 h-4 text-blue-500" />;
      case 'FAILED': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-amber-500" />;
    }
  };

  const filteredDeliveries = deliveries.filter(d => 
    d.orderId.toLowerCase().includes(search.toLowerCase()) || 
    (d.destinationMasked || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="ui-page-title text-slate-900">Digital Delivery</h1>
          <p className="text-slate-500">Monitor pengiriman top-up dan kode voucher digital ke pelanggan.</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Order ID or Destination..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-slate-500">Loading deliveries...</div>
        ) : error ? (
          <div className="p-10 text-center text-red-500">{error}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 bg-slate-50 uppercase border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 font-medium">Order ID</th>
                  <th className="px-6 py-3 font-medium">Type</th>
                  <th className="px-6 py-3 font-medium">Destination</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Timestamp</th>
                  <th className="px-6 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredDeliveries.map((delivery) => (
                  <tr key={delivery.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-primary">
                      {delivery.orderId}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded bg-slate-100 text-slate-700 text-xs font-medium">
                        {delivery.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-mono text-xs">
                      {delivery.destinationMasked || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        {getStatusIcon(delivery.status)}
                        <span className={`font-medium text-xs ${
                          delivery.status === 'DELIVERED' ? 'text-green-600' :
                          delivery.status === 'FAILED' ? 'text-red-600' :
                          delivery.status === 'READY' ? 'text-blue-600' : 'text-amber-600'
                        }`}>{delivery.status}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-xs">
                      {new Date(delivery.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => fetchDeliveryDetail(delivery.id)}
                        className="text-primary hover:text-primary/80 inline-flex items-center gap-1 font-medium text-sm"
                      >
                        <Eye className="w-4 h-4" /> Detail
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredDeliveries.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-slate-500">
                      No delivery records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedDelivery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <Truck className="w-5 h-5 text-slate-500" />
                Delivery Detail
              </h3>
              <button onClick={() => setSelectedDelivery(null)} className="text-slate-400 hover:text-slate-500">
                &times;
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-6">
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500 mb-1">Delivery ID</p>
                  <p className="font-medium font-mono text-xs">{selectedDelivery.id}</p>
                </div>
                <div>
                  <p className="text-slate-500 mb-1">Order ID</p>
                  <p className="font-medium font-mono text-xs text-primary">{selectedDelivery.orderId}</p>
                </div>
                <div>
                  <p className="text-slate-500 mb-1">Customer ID</p>
                  <p className="font-medium font-mono text-xs">{selectedDelivery.customerId}</p>
                </div>
                <div>
                  <p className="text-slate-500 mb-1">Status</p>
                  <div className="flex items-center gap-1.5">
                    {getStatusIcon(selectedDelivery.status)}
                    <span className="font-medium">{selectedDelivery.status}</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 space-y-3">
                <h4 className="font-medium text-sm text-slate-900 mb-2">Delivery Data</h4>
                
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500 text-sm">Type</span>
                  <span className="font-medium text-sm">{selectedDelivery.type}</span>
                </div>
                
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-500 text-sm">Target / Destination</span>
                  <span className="font-mono text-sm">{selectedDelivery.destinationMasked || '-'}</span>
                </div>

                {selectedDelivery.providerTransactionId && (
                  <div className="flex justify-between border-b border-slate-200 pb-2">
                    <span className="text-slate-500 text-sm">Provider Ref</span>
                    <span className="font-mono text-sm">{selectedDelivery.providerTransactionId}</span>
                  </div>
                )}
                
                {selectedDelivery.resultMessage && (
                  <div className="flex justify-between border-b border-slate-200 pb-2">
                    <span className="text-slate-500 text-sm">Result Message</span>
                    <span className="font-medium text-sm text-amber-600">{selectedDelivery.resultMessage}</span>
                  </div>
                )}

                {selectedDelivery.digitalCode !== undefined && (
                  <div className="pt-2">
                    <span className="text-slate-500 text-sm block mb-1">Digital Code / Voucher</span>
                    <div className="bg-white border border-slate-300 p-3 rounded font-mono text-sm text-slate-900 break-all">
                      {selectedDelivery.digitalCode || <span className="text-slate-400 italic">No code attached</span>}
                    </div>
                    <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Akses ke kode ini telah dicatat dalam Audit Log.
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs text-slate-500 pt-2">
                <div>
                  <p>Created At</p>
                  <p className="font-medium">{new Date(selectedDelivery.createdAt).toLocaleString()}</p>
                </div>
                {selectedDelivery.deliveredAt && (
                  <div>
                    <p>Delivered At</p>
                    <p className="font-medium">{new Date(selectedDelivery.deliveredAt).toLocaleString()}</p>
                  </div>
                )}
              </div>

            </div>
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setSelectedDelivery(null)}
                className="px-4 py-2 border border-slate-200 bg-white text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
