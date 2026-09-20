import re

with open('src/pages/admin/AdminCampaignsPage.tsx', 'r') as f:
    content = f.read()

# 1. Revert Table
target_table = """            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-3 px-4">📢 Pengumuman</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Periode</th>
                  <th className="py-3 px-4">Prioritas</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-sm">
                {filteredCampaigns.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                          <Megaphone className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 line-clamp-1">{c.title}</p>
                          <p className="text-xs text-gray-500 font-medium">Internal: {c.name}</p>
                          {c.slug && <p className="text-[10px] text-blue-500 font-mono mt-0.5">/{c.slug}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        <div>{getStatusBadge(c.status)}</div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-xs text-gray-500 flex items-center gap-1 font-mono">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        <span>{new Date(c.startAt).toLocaleDateString("id-ID")}</span>
                        {c.endAt && <span>- {new Date(c.endAt).toLocaleDateString("id-ID")}</span>}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-gray-600">{c.priority}</td>"""

old_table = """            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Campaign</th>
                  <th className="py-3 px-4">Status & Jadwal</th>
                  <th className="py-3 px-4">Komponen Terhubung</th>
                  <th className="py-3 px-4">Prioritas</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-sm">
                {filteredCampaigns.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {c.mediaUrl ? (
                          <div className="w-14 h-14 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                            <img src={c.mediaUrl} alt={c.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                        ) : (
                          <div className="w-14 h-14 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs flex-shrink-0">
                            <Megaphone className="w-6 h-6" />
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-gray-900">{c.title}</p>
                          <p className="text-xs text-gray-500 font-medium">Internal: {c.name}</p>
                          <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">{c.description}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        <div>{getStatusBadge(c.status)}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-1 font-mono">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          <span>{new Date(c.startAt).toLocaleDateString("id-ID")}</span>
                          {c.endAt && <span>- {new Date(c.endAt).toLocaleDateString("id-ID")}</span>}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1.5 text-xs">
                        {c.promoIds && c.promoIds.length > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium" title="Promo / Voucher">
                            <TicketPercent className="w-3 h-3" /> {c.promoIds.length} Promo
                          </span>
                        )}
                        {c.flashSaleIds && c.flashSaleIds.length > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-medium" title="Flash Sale">
                            <Zap className="w-3 h-3" /> {c.flashSaleIds.length} Flash Sale
                          </span>
                        )}
                        {c.bannerIds && c.bannerIds.length > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-medium" title="Banner">
                            <ImageIcon className="w-3 h-3" /> {c.bannerIds.length} Banner
                          </span>
                        )}
                        {c.popupIds && c.popupIds.length > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-pink-50 text-pink-700 font-medium" title="Popup">
                            <MousePointer2 className="w-3 h-3" /> {c.popupIds.length} Popup
                          </span>
                        )}
                        {(!c.promoIds || c.promoIds.length === 0) && 
                         (!c.flashSaleIds || c.flashSaleIds.length === 0) && 
                         (!c.bannerIds || c.bannerIds.length === 0) && 
                         (!c.popupIds || c.popupIds.length === 0) && (
                          <span className="text-gray-400 text-xs italic">Tanpa komponen</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-gray-600">{c.priority}</td>"""

content = content.replace(target_table, old_table)


# 2. Revert Modal Header and Form fields up to Promo Selection
modal_start = content.find('{isModalOpen && (')
promo_selection_start = content.find('{/* Promo Selection */}')

if modal_start != -1 and promo_selection_start != -1:
    old_modal_header = """{isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col my-8">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-950">{editingCampaign ? "Edit Campaign" : "Buat Campaign Baru"}</h3>
                <p className="text-xs text-gray-500">Konfigurasi parameter kampanye dan komponen pemasaran terkait.</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 font-semibold">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Nama Internal</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Campaign Ramadhan Sale 2026"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Judul Tampilan Publik</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Festival Diskon Berkah Ramadhan"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Deskripsi Kampanye</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Penjelasan ringkas kampanye untuk pelanggan..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Link / Tujuan (Slug) - Opsional</label>
                <input
                  type="text"
                  placeholder="Contoh: ramadhan-sale"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Media Asset (Media Library integration) */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Visual Cover (Dari Media Library)</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    readOnly
                    placeholder="Pilih visual banner kampanye..."
                    value={mediaUrl}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      fetchMediaLibrary();
                      setIsMediaPickerOpen(true);
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-medium rounded-lg whitespace-nowrap"
                  >
                    Pilih Asset
                  </button>
                </div>
                {mediaUrl && (
                  <div className="mt-2 flex items-center gap-3">
                    <div className="w-24 h-14 rounded-lg overflow-hidden border bg-gray-100">
                      <img src={mediaUrl} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <button type="button" onClick={() => { setMediaUrl(""); setMediaId(""); }} className="text-xs text-red-600 hover:underline">Hapus Gambar</button>
                  </div>
                )}
              </div>

              {/* Marketing Components Orchestration */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <h4 className="text-sm font-bold text-slate-800">Orkestrasi Komponen Marketing</h4>
                </div>
                <p className="text-xs text-slate-500">Hubungkan promo, flash sale, banner, atau popup yang sudah ada ke dalam kampanye ini.</p>

                """
    
    content = content[:modal_start] + old_modal_header + content[promo_selection_start:]

# Remove showLegacyFields ending tags
content = content.replace('''                    </div>
                  </div>
                </div>
              )}

              {/* Schedule and Priority */}''', '''                    </div>
                  </div>
                </div>

              {/* Schedule and Priority */}''')

with open('src/pages/admin/AdminCampaignsPage.tsx', 'w') as f:
    f.write(content)

