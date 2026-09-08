import React from 'react';
import { 
  User, 
  CreditCard, 
  Award, 
  Users, 
  Package, 
  ExternalLink,
  ShieldCheck,
  Zap,
  Info,
  Clock
} from 'lucide-react';
import { Support360 } from '../../../types/support';

interface Support360SidebarProps {
  context: Support360;
}

export default function Support360Sidebar({ context }: Support360SidebarProps) {
  const { customer, order, membership, loyalty, referral, previousCases } = context;

  const Section = ({ title, icon: Icon, children }: { title: string, icon: any, children: React.ReactNode }) => (
    <div className="p-4 border-b border-slate-100 last:border-0">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center">
          <Icon className="w-4 h-4 text-slate-500" />
        </div>
        <h4 className="font-bold text-slate-900 text-sm">{title}</h4>
      </div>
      <div className="space-y-3">
        {children}
      </div>
    </div>
  );

  const InfoRow = ({ label, value, icon: Icon }: { label: string, value: string | React.ReactNode, icon?: any }) => (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-slate-500">{label}</span>
      <div className="flex items-center gap-1.5 font-medium text-xs text-slate-900">
        {Icon && <Icon className="w-3 h-3 text-slate-400" />}
        {value}
      </div>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      {/* Customer Profile */}
      <Section title="Customer Profile" icon={User}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center font-bold text-primary text-xl uppercase">
            {customer?.name?.charAt(0) || '?'}
          </div>
          <div>
            <p className="font-bold text-slate-900 text-sm">{customer?.name || 'Unknown'}</p>
            <p className="text-[10px] text-slate-500">{customer?.email}</p>
          </div>
        </div>
        <InfoRow label="Status" value={
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
            customer?.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            {customer?.status || 'Active'}
          </span>
        } />
        <InfoRow label="Created" value={customer?.createdAt ? new Date(customer.createdAt).toLocaleDateString() : '-'} />
      </Section>

      {/* Membership & Loyalty */}
      <Section title="Rewards & Status" icon={Award}>
        <InfoRow 
          label="Membership" 
          icon={ShieldCheck}
          value={membership?.planName || 'Regular'} 
        />
        <InfoRow 
          label="Loyalty Points" 
          icon={Zap}
          value={`${loyalty?.points || 0} Pts`} 
        />
        <InfoRow 
          label="Referral Count" 
          icon={Users}
          value={referral?.successfulReferrals || 0} 
        />
      </Section>

      {/* SLA Status */}
      {context.sla && (
        <Section title="SLA Status" icon={Clock}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs text-slate-500">Overall Status</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
              context.sla.overallStatus === 'BREACHED' ? 'bg-red-100 text-red-700' :
              context.sla.overallStatus === 'WARNING' ? 'bg-amber-100 text-amber-700' :
              context.sla.overallStatus === 'COMPLETED' ? 'bg-green-100 text-green-700' :
              'bg-blue-100 text-blue-700'
            }`}>
              {context.sla.overallStatus}
            </span>
          </div>
          <div className="space-y-4">
            {Object.entries(context.sla.measurements || {}).map(([key, m]: [string, any]) => (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                    {key.replace(/_/g, ' ')}
                  </span>
                  <span className={`text-[9px] font-bold ${
                    m.status === 'BREACHED' ? 'text-red-600' :
                    m.status === 'WARNING' ? 'text-amber-600' :
                    'text-slate-600'
                  }`}>
                    {m.status}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${
                      m.status === 'BREACHED' ? 'bg-red-500' :
                      m.status === 'WARNING' ? 'bg-amber-500' :
                      m.status === 'COMPLETED' ? 'bg-green-500' :
                      'bg-blue-500'
                    }`}
                    style={{ width: `${Math.min(100, (m.elapsedMs / (m.policyLimitMs || 1)) * 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[9px] text-slate-400">
                  <span>{Math.floor(m.elapsedMs / 60000)}m elapsed</span>
                  <span>Limit: {Math.floor((m.policyLimitMs || 0) / 60000)}m</span>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Order Context */}
      {order && (
        <Section title="Order Context" icon={Package}>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 mb-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold font-mono text-slate-400">{order.id}</span>
              <a href={`/admin/orders/${order.id}`} target="_blank" rel="noopener noreferrer" className="p-1 hover:bg-white rounded transition-colors">
                <ExternalLink className="w-3 h-3 text-primary" />
              </a>
            </div>
            <p className="text-xs font-bold text-slate-900 mb-1">{order.productName || 'Order'}</p>
            <p className="text-[10px] text-slate-500 mb-3">{order.variantName}</p>
            
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-primary">Rp {order.totalAmount?.toLocaleString()}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                order.transactionStatus === 'success' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {order.transactionStatus}
              </span>
            </div>
          </div>
          <InfoRow label="Payment Status" value={order.paymentStatus} />
          <InfoRow label="Provider Status" value={order.providerStatus || '-'} />
        </Section>
      )}

      {/* Previous Cases */}
      {previousCases && previousCases.length > 0 && (
        <Section title="History" icon={Info}>
          <div className="space-y-3">
            {previousCases.map(c => (
              <div key={c.id} className="p-2 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-slate-100">
                <p className="text-[10px] font-bold text-slate-900 line-clamp-1">{c.subject}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[9px] text-slate-400">{new Date(c.createdAt).toLocaleDateString()}</span>
                  <span className="text-[9px] font-bold uppercase text-slate-500">{c.status}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
