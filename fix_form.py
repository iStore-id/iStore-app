import re

with open('src/pages/admin/AdminCampaignsPage.tsx', 'r') as f:
    content = f.read()

start_marker = '<form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">'
end_marker = '{/* Advanced/Legacy Fields Toggle */}'

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx != -1 and end_idx != -1:
    old_block = content[start_idx:end_idx]
    
    new_block = """<form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-bold text-gray-800 uppercase mb-2 flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-indigo-600" /> Teks Pengumuman
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Promo Gratis Ongkir! Gunakan kode MERDEKA"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-3 text-base font-medium border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 shadow-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Nama Internal</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Promo Kemerdekaan 2026"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Link / Tujuan (Opsional)</label>
                  <input
                    type="text"
                    placeholder="Contoh: /category/promo"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Deskripsi Internal (Opsional)</label>
                <textarea
                  rows={2}
                  placeholder="Catatan internal pengumuman..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* LIVE ANNOUNCEMENT PREVIEW */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-3">Preview Homepage</label>
                <div className="w-full bg-indigo-600 text-white rounded-lg overflow-hidden h-10 flex items-center px-4 shadow-sm">
                  <Megaphone className="w-4 h-4 shrink-0 mr-2" />
                  <div className="flex-1 overflow-hidden whitespace-nowrap">
                    <span className="text-sm font-medium animate-marquee inline-block">
                      {title || 'Teks pengumuman akan tampil di sini...'}
                    </span>
                  </div>
                </div>
              </div>

              """
    
    new_content = content[:start_idx] + new_block + content[end_idx:]
    with open('src/pages/admin/AdminCampaignsPage.tsx', 'w') as f:
        f.write(new_content)
    print("Form successfully replaced.")
else:
    print("Failed to find bounds.")
