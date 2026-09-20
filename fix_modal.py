import re

with open('src/pages/admin/AdminCampaignsPage.tsx', 'r') as f:
    content = f.read()

start_idx = content.find('{isModalOpen && (')
end_idx = content.find('{/* Media Picker Modal */}')

if start_idx != -1 and end_idx != -1:
    old_modal = content[start_idx:end_idx]
    new_modal = """{isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col my-8">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-950">{editingCampaign ? "Edit Pengumuman" : "Buat Pengumuman Baru"}</h3>
                <p className="text-xs text-gray-500">Atur teks pengumuman yang akan tampil di bar bagian atas homepage.</p>
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
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Deskripsi Kampanye (Opsional)</label>
                <textarea
                  rows={2}
                  placeholder="Penjelasan ringkas kampanye..."
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

              {/* LIVE ANNOUNCEMENT PREVIEW */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-3">Preview Announcement Homepage</label>
                <div className="w-full bg-blue-50 border-y sm:border border-blue-100 sm:rounded-lg overflow-hidden h-10 flex items-center px-4">
                  <div className="flex items-center justify-center bg-blue-50 z-10 pr-3 py-2">
                    <Megaphone className="w-5 h-5 text-blue-600 shrink-0" />
                    <span className="font-bold text-sm text-blue-800 ml-2 whitespace-nowrap hidden sm:inline-block">Pengumuman:</span>
                  </div>
                  <div className="flex-1 overflow-hidden relative h-full flex items-center">
                    <div className="whitespace-nowrap animate-marquee flex items-center shrink-0 min-w-full">
                      <span className="text-sm text-blue-700 font-medium">{title || 'Preview judul pengumuman...'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Advanced/Legacy Fields Toggle */}
              <div className="border-t border-gray-200 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setShowLegacyFields(!showLegacyFields)}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                >
                  {showLegacyFields ? "Sembunyikan Pengaturan Komponen (Advanced)" : "Tampilkan Pengaturan Komponen (Advanced)"}
                </button>
              </div>

              {showLegacyFields && (
                <div className="space-y-5 animate-in fade-in slide-in-from-top-2 duration-200">
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

                    {/* Promo Selection */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                        <TicketPercent className="w-3.5 h-3.5 text-blue-600" /> Hubungkan Promo / Voucher
                      </label>
                      {componentsData.promos.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">Belum ada promo aktif di Promo Engine.</p>
                      ) : (
                        <div className="max-h-32 overflow-y-auto space-y-1.5 bg-white p-2.5 rounded-lg border border-slate-200">
                          {componentsData.promos.map((p) => (
                            <label key={p.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:bg-slate-50 p-1 rounded">
                              <input
                                type="checkbox"
                                checked={selectedPromoIds.includes(p.id)}
                                onChange={() => toggleArrayItem(p.id, selectedPromoIds, setSelectedPromoIds)}
                                className="rounded text-indigo-600"
                              />
                              <span className="font-semibold text-slate-900">{p.code}</span>
                              <span className="text-slate-500">- {p.name} ({p.discountType === 'percentage' ? `${p.discountValue}%` : `Rp ${p.discountValue}`})</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Flash Sale Selection */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-amber-600" /> Hubungkan Flash Sale
                      </label>
                      {componentsData.flashSales.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">Belum ada item Flash Sale.</p>
                      ) : (
                        <div className="max-h-32 overflow-y-auto space-y-1.5 bg-white p-2.5 rounded-lg border border-slate-200">
                          {componentsData.flashSales.map((fs) => (
                            <label key={fs.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:bg-slate-50 p-1 rounded">
                              <input
                                type="checkbox"
                                checked={selectedFlashSaleIds.includes(fs.id)}
                                onChange={() => toggleArrayItem(fs.id, selectedFlashSaleIds, setSelectedFlashSaleIds)}
                                className="rounded text-indigo-600"
                              />
                              <span className="font-semibold text-slate-900">{fs.name}</span>
                              <span className="text-slate-500">- Rp {fs.salePrice.toLocaleString("id-ID")}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Banner Selection */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-purple-600" /> Hubungkan Banner
                      </label>
                      {componentsData.banners.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">Belum ada banner terkonfigurasi.</p>
                      ) : (
                        <div className="max-h-32 overflow-y-auto space-y-1.5 bg-white p-2.5 rounded-lg border border-slate-200">
                          {componentsData.banners.map((b) => (
                            <label key={b.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:bg-slate-50 p-1 rounded">
                              <input
                                type="checkbox"
                                checked={selectedBannerIds.includes(b.id)}
                                onChange={() => toggleArrayItem(b.id, selectedBannerIds, setSelectedBannerIds)}
                                className="rounded text-indigo-600"
                              />
                              <span className="font-semibold text-slate-900">{b.name}</span>
                              <span className="text-slate-500">({b.placement})</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Popup Selection */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                        <MousePointer2 className="w-3.5 h-3.5 text-pink-600" /> Hubungkan Popup
                      </label>
                      {componentsData.popups.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">Belum ada popup terkonfigurasi.</p>
                      ) : (
                        <div className="max-h-32 overflow-y-auto space-y-1.5 bg-white p-2.5 rounded-lg border border-slate-200">
                          {componentsData.popups.map((pop) => (
                            <label key={pop.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:bg-slate-50 p-1 rounded">
                              <input
                                type="checkbox"
                                checked={selectedPopupIds.includes(pop.id)}
                                onChange={() => toggleArrayItem(pop.id, selectedPopupIds, setSelectedPopupIds)}
                                className="rounded text-indigo-600"
                              />
                              <span className="font-semibold text-slate-900">{pop.name}</span>
                              <span className="text-slate-500">({pop.trigger})</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Schedule and Priority */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Mulai Tayang</label>
                  <input
                    type="datetime-local"
                    required
                    value={startAt}
                    onChange={(e) => setStartAt(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Berakhir (Opsional)</label>
                  <input
                    type="datetime-local"
                    value={endAt}
                    onChange={(e) => setEndAt(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Prioritas (Priority)</label>
                  <input
                    type="number"
                    value={priority}
                    onChange={(e) => setPriority(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Enabled (Aktif)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={published}
                    onChange={(e) => setPublished(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Published (Publikasikan)</span>
                </label>
              </div>

              {/* Submit / Cancel Buttons */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition"
                >
                  Simpan Campaign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      """
    
    new_content = content[:start_idx] + new_modal + content[end_idx:]
    with open('src/pages/admin/AdminCampaignsPage.tsx', 'w') as f:
        f.write(new_content)
    print("Modal successfully replaced.")
else:
    print("Failed to find modal bounds.")
