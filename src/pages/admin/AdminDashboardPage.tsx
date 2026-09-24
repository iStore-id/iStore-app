import { useEffect, useState } from "react";
import { formatRupiah } from "../../lib/utils";
import { useAuthStore } from "../../store/auth-store";
import { 
  Users, 
  ShoppingCart, 
  DollarSign, 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  Loader2, 
  Clock, 
  Database, 
  Truck,
  Calendar,
  ShieldCheck,
  TrendingUp,
  ChevronRight
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Link } from "react-router-dom";

interface DashboardStats {
  range: string;
  timezone: string;
  metrics: {
    orders: {
      total: number;
      success: number;
      trend: number;
    };
    financial: {
      grossRevenue: number;
      grossTrend: number;
      realizedRevenue: number;
      realizedTrend: number;
      refundTotal: number;
      totalSettled: number;
      settledTrend: number;
      totalMdr: number;
      currency: string;
    };
    operational: {
      isOpen: boolean;
      reason?: string;
      queueDepth: number;
      activeWorkers: number;
      avgFulfillmentTime: number;
    };
    customers: {
      total: number;
    };
  };
  recentOrders: any[];
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardStats | null>(null);
  const [range, setRange] = useState("24h");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuthStore();

  const fetchStats = async (selectedRange: string) => {
    setLoading(true);
    try {
      if (!user) throw new Error("Authentication required");
      const token = await user.getIdToken?.();
      const res = await fetch(`/api/admin/dashboard/stats?range=${selectedRange}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await res.json();
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.message);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log("AdminDashboardPage: user", user);
    fetchStats(range);
  }, [range, user]);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-slate-500 font-medium">Mengagregasi data real-time...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-red-100 shadow-sm">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-slate-900 mb-2">Gagal Memuat Dasbor</h3>
        <p className="text-slate-600 mb-6">{error}</p>
        <button 
          onClick={() => fetchStats(range)}
          className="px-4 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors"
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  const metrics = data?.metrics;

  return (
    <div className="space-y-8 pb-12">
      {/* Header & Range Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="min-w-0">
          <h1 className="ui-page-title text-slate-900 break-words">Dashboard</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <p className="text-slate-500 text-sm md:text-base">
              Pantau performa bisnis dan kesehatan operasional iStore.id.
            </p>
            <span className="px-2 py-0.5 bg-slate-100 rounded-md text-xs font-bold text-slate-400 uppercase whitespace-nowrap">
              TZ: {data?.timezone}
            </span>
          </div>
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-xl self-start sm:self-center shrink-0">
          {["24h", "7d", "30d"].map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 md:px-4 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all ${
                range === r 
                  ? "bg-white text-slate-900 shadow-sm" 
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {r === "24h" ? "Hari Ini" : r === "7d" ? "7 Hari" : "30 Hari"}
            </button>
          ))}
        </div>
      </div>

      {/* Main Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard 
          title="Gross Revenue" 
          value={formatRupiah(metrics?.financial.grossRevenue || 0)} 
          icon={DollarSign}
          trend={metrics?.financial.grossTrend} 
          color="blue"
        />
        <StatCard 
          title="Realized Revenue" 
          value={formatRupiah(metrics?.financial.realizedRevenue || 0)} 
          icon={TrendingUp}
          trend={metrics?.financial.realizedTrend}
          description="Fulfillment Completed"
          color="green"
        />
        <StatCard 
          title="Net Settlement" 
          value={formatRupiah(metrics?.financial.totalSettled || 0)} 
          icon={ShieldCheck}
          trend={metrics?.financial.settledTrend}
          description={`MDR: ${formatRupiah(metrics?.financial.totalMdr || 0)}`}
          color="indigo"
        />
        <StatCard 
          title="Total Customers" 
          value={metrics?.customers.total || 0}
          icon={Users}
          description="Registered users"
          color="purple"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        {/* Detailed Stats Row */}
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
           <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between min-h-[160px]">
             <div>
               <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Order Performance</p>
               <div className="flex items-end justify-between gap-2">
                 <div className="min-w-0">
                   <p className="text-2xl md:text-3xl font-bold text-slate-900 truncate">{metrics?.orders?.total ?? 0}</p>
                   <p className="text-xs text-slate-500">Total Transactions</p>
                 </div>
                 <div className="text-right shrink-0">
                   <p className="text-sm md:text-base font-bold text-green-600">{metrics?.orders?.success ?? 0}</p>
                   <p className="text-xs text-slate-400">Successful</p>
                 </div>
               </div>
             </div>
             <div className="mt-4">
               <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-green-500" 
                    style={{ width: `${(metrics?.orders && metrics.orders.total) ? ((metrics.orders.success || 0) / metrics.orders.total) * 100 : 0}%` }}
                  />
               </div>
             </div>
           </div>

           <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between min-h-[160px]">
             <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Financial Summary</p>
             <div className="space-y-3">
               <div className="flex justify-between items-center text-sm gap-2">
                 <span className="text-slate-500">Gross</span>
                 <span className="font-bold text-slate-900 truncate">{formatRupiah(metrics?.financial.grossRevenue || 0)}</span>
               </div>
               <div className="flex justify-between items-center text-sm gap-2">
                 <span className="text-slate-500">Refunds</span>
                 <span className="font-bold text-red-600 truncate">-{formatRupiah(metrics?.financial.refundTotal || 0)}</span>
               </div>
               <div className="flex justify-between items-center text-sm border-t border-slate-50 pt-3 gap-2">
                 <span className="text-slate-500 font-medium">Realized</span>
                 <span className="font-bold text-blue-600 truncate">{formatRupiah(metrics?.financial.realizedRevenue || 0)}</span>
               </div>
             </div>
           </div>

           <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between min-h-[160px]">
             <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Operational Latency</p>
             <div className="flex items-center gap-4">
               <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
                 <Clock className="w-6 h-6" />
               </div>
               <div className="min-w-0">
                 <p className="text-2xl md:text-3xl font-bold text-slate-900 truncate">{metrics?.operational.avgFulfillmentTime || 0}s</p>
                 <p className="text-xs text-slate-500">Avg. Fulfillment SLA</p>
               </div>
             </div>
             <p className="mt-4 text-xs text-slate-400 italic">Target: &lt; 60s for top providers</p>
           </div>
        </div>

        {/* Operational Health */}
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-full flex flex-col">
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600 shrink-0" />
              <span className="truncate">Kesehatan Operasional</span>
            </h3>
            
            <div className="space-y-5 flex-1">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`p-2 rounded-lg shrink-0 ${metrics?.operational.isOpen ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">Store Status</p>
                    <p className="text-xs text-slate-500 truncate">{metrics?.operational.isOpen ? 'Buka / Menerima Order' : 'Tutup'}</p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-md text-[10px] md:text-xs font-bold tracking-wider uppercase shrink-0 ${
                  metrics?.operational.isOpen ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {metrics?.operational.isOpen ? 'OPEN' : 'CLOSED'}
                </span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-orange-50 text-orange-600 shrink-0">
                    <Database className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">Queue Depth</p>
                    <p className="text-xs text-slate-500 truncate">{metrics?.operational.queueDepth} Jobs Pending</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-slate-700 shrink-0">{metrics?.operational.queueDepth}</span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-blue-50 text-blue-600 shrink-0">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">Active Workers</p>
                    <p className="text-xs text-slate-500 truncate">Currently processing</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-slate-700 shrink-0">{metrics?.operational.activeWorkers}</span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-purple-50 text-purple-600 shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">Avg. Fulfillment</p>
                    <p className="text-xs text-slate-500 truncate">Latency per order</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-slate-700 shrink-0">
                  {metrics?.operational.avgFulfillmentTime ? `${metrics.operational.avgFulfillmentTime}s` : '--'}
                </span>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-100">
              <Link 
                to="/admin/queue"
                className="text-sm font-semibold text-blue-600 hover:text-blue-700 flex items-center justify-between gap-2"
              >
                <span>Lihat Monitor Antrean</span>
                <ChevronRight className="w-4 h-4 shrink-0" />
              </Link>
            </div>
          </div>
        </div>

        {/* Recent Activity Table */}
        <div className="lg:col-span-2 min-w-0">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between gap-4">
              <h3 className="text-lg font-bold text-slate-900 truncate">Transaksi Terbaru</h3>
              <Link 
                to="/admin/orders"
                className="text-[10px] md:text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors uppercase tracking-wider shrink-0"
              >
                Lihat Semua
              </Link>
            </div>
            
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="text-[10px] md:text-xs text-slate-400 uppercase bg-slate-50/50 sticky top-0">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Order</th>
                    <th className="px-6 py-4 font-semibold">Produk</th>
                    <th className="px-6 py-4 font-semibold">Nominal</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data?.recentOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="min-w-[80px]">
                          <p className="font-bold text-slate-900">#{order.invoice?.split('-')[1] || order.id.substring(0, 8)}</p>
                          <p className="text-[10px] text-slate-400 font-medium uppercase">{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="min-w-[120px] max-w-[200px]">
                          <p className="font-semibold text-slate-700 leading-snug break-words">{order.productName}</p>
                          <p className="text-[10px] text-slate-400 truncate">{order.gameName}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-slate-900 whitespace-nowrap">{formatRupiah(order.totalAmount)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-md text-[10px] md:text-xs font-bold whitespace-nowrap ${
                          order.transactionStatus === 'success' ? 'bg-green-50 text-green-700' :
                          order.transactionStatus === 'failed' ? 'bg-red-50 text-red-700' :
                          order.paymentStatus === 'paid' ? 'bg-blue-50 text-blue-700' :
                          'bg-orange-50 text-orange-700'
                        }`}>
                          {(order.transactionStatus || order.paymentStatus).toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(!data?.recentOrders || data.recentOrders.length === 0) && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">
                        Belum ada aktivitas dalam periode ini
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, trend, description, color }: any) {
  const colors: any = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
    green: "bg-green-50 text-green-600 border-green-100",
    purple: "bg-purple-50 text-purple-600 border-purple-100",
    orange: "bg-orange-50 text-orange-600 border-orange-100",
  };

  const isTrendPositive = trend !== undefined && trend > 0;
  const isTrendNegative = trend !== undefined && trend < 0;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between h-full min-w-0"
    >
      <div className="flex items-start justify-between mb-4 gap-2">
        <h3 className="font-bold text-slate-500 text-[10px] md:text-xs uppercase tracking-wider mt-1">{title}</h3>
        <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center border shrink-0 ${colors[color]}`}>
          <Icon className="w-4 h-4 md:w-5 md:h-5" />
        </div>
      </div>
      <div className="space-y-1.5 min-w-0">
        <div className="text-lg md:text-2xl font-bold text-slate-900 tracking-tight truncate" title={String(value)}>{value}</div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {trend !== undefined && (
            <p className={`text-[10px] md:text-xs font-bold flex items-center gap-1 ${
              isTrendPositive ? "text-green-600" : isTrendNegative ? "text-red-600" : "text-slate-400"
            }`}>
              {isTrendPositive ? <TrendingUp className="w-3 h-3" /> : isTrendNegative ? <TrendingUp className="w-3 h-3 rotate-180" /> : null}
              {isTrendPositive ? `+${trend}%` : `${trend}%`}
            </p>
          )}
          {description && (
            <p className="text-[10px] md:text-xs font-medium text-slate-400 truncate max-w-full" title={description}>{description}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

