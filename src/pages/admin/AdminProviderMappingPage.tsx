import React from "react";
import MappingsTab from "../../components/admin/providers/MappingsTab";

export default function AdminProviderMappingPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="ui-page-title text-slate-900">Pemetaan Produk</h1>
          <p className="text-slate-500 text-sm">
            Hubungkan varian produk iStore dengan produk dan kode supplier untuk pemenuhan pesanan otomatis.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <MappingsTab />
      </div>
    </div>
  );
}
